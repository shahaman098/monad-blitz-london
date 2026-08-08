// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title Clutch
/// @notice Sub-second in-play prediction markets. Binary YES/NO markets priced by a
///         constant-product AMM over complete sets, collateralised in native MON.
///
/// Solvency invariant: every complete set in existence (held by users or by the pool)
/// is backed 1:1 by native collateral held in this contract. Buying mints sets,
/// selling burns them, so `totalSets == collateral` for every market at all times.
/// Redemption pays the winning side 1:1, which is exactly the collateral on hand.
contract Clutch {
    struct Market {
        string question;
        address creator;
        uint96 closesAt; // advisory: trading is blocked at/after this timestamp
        uint256 resYes; // YES shares held by the pool
        uint256 resNo; // NO shares held by the pool
        uint256 collateral; // native MON backing this market == total sets outstanding
        uint256 volume; // cumulative collateral traded, for the leaderboard
        Status status;
        bool outcomeYes;
        bool poolRedeemed;
    }

    enum Status {
        Open,
        Resolved,
        Cancelled
    }

    address public owner;
    Market[] private _markets;

    /// @dev marketId => trader => share balance
    mapping(uint256 => mapping(address => uint256)) public yesOf;
    mapping(uint256 => mapping(address => uint256)) public noOf;

    event MarketCreated(uint256 indexed marketId, string question, uint256 seed, uint96 closesAt);
    event Trade(
        uint256 indexed marketId,
        address indexed trader,
        bool isYes,
        bool isBuy,
        uint256 collateralDelta,
        uint256 shares,
        uint256 resYes,
        uint256 resNo
    );
    event Resolved(uint256 indexed marketId, bool outcomeYes);
    event Cancelled(uint256 indexed marketId);
    event Redeemed(uint256 indexed marketId, address indexed trader, uint256 payout);

    error NotOwner();
    error NotOpen();
    error NotResolved();
    error Closed();
    error ZeroAmount();
    error NoShares();
    error Slippage();
    error NothingToRedeem();
    error TransferFailed();
    error AlreadyRedeemed();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    function transferOwnership(address next) external onlyOwner {
        owner = next;
    }

    // ---------------------------------------------------------------- markets

    /// @notice Open a market. `msg.value` seeds the pool with an equal number of
    ///         YES and NO shares, so the market starts at 50/50.
    function createMarket(string calldata question, uint96 closesAt)
        external
        payable
        onlyOwner
        returns (uint256 marketId)
    {
        if (msg.value == 0) revert ZeroAmount();
        marketId = _markets.length;
        _markets.push(
            Market({
                question: question,
                creator: msg.sender,
                closesAt: closesAt,
                resYes: msg.value,
                resNo: msg.value,
                collateral: msg.value,
                volume: 0,
                status: Status.Open,
                outcomeYes: false,
                poolRedeemed: false
            })
        );
        emit MarketCreated(marketId, question, msg.value, closesAt);
    }

    function resolve(uint256 marketId, bool outcomeYes) external onlyOwner {
        Market storage m = _markets[marketId];
        if (m.status != Status.Open) revert NotOpen();
        m.status = Status.Resolved;
        m.outcomeYes = outcomeYes;
        emit Resolved(marketId, outcomeYes);
    }

    /// @notice Escape hatch: refunds are handled by treating both sides as winners
    ///         via complete-set redemption.
    function cancel(uint256 marketId) external onlyOwner {
        Market storage m = _markets[marketId];
        if (m.status != Status.Open) revert NotOpen();
        m.status = Status.Cancelled;
        emit Cancelled(marketId);
    }

    // ---------------------------------------------------------------- trading

    /// @notice Buy YES or NO shares with native MON.
    /// @param minSharesOut slippage guard; the trade reverts if it would fill worse.
    function buy(uint256 marketId, bool isYes, uint256 minSharesOut)
        external
        payable
        returns (uint256 sharesOut)
    {
        Market storage m = _markets[marketId];
        if (m.status != Status.Open) revert NotOpen();
        if (m.closesAt != 0 && block.timestamp >= m.closesAt) revert Closed();
        if (msg.value == 0) revert ZeroAmount();

        uint256 c = msg.value;
        uint256 k = m.resYes * m.resNo;

        // Mint one complete set per wei of collateral into the pool.
        uint256 y = m.resYes + c;
        uint256 n = m.resNo + c;

        if (isYes) {
            // Keep the invariant by removing YES shares: (y - out) * n == k
            sharesOut = y - _ceilDiv(k, n);
            if (sharesOut < minSharesOut) revert Slippage();
            m.resYes = y - sharesOut;
            m.resNo = n;
            yesOf[marketId][msg.sender] += sharesOut;
        } else {
            sharesOut = n - _ceilDiv(k, y);
            if (sharesOut < minSharesOut) revert Slippage();
            m.resYes = y;
            m.resNo = n - sharesOut;
            noOf[marketId][msg.sender] += sharesOut;
        }

        m.collateral += c;
        m.volume += c;
        emit Trade(marketId, msg.sender, isYes, true, c, sharesOut, m.resYes, m.resNo);
    }

    /// @notice Sell shares back to the pool for native MON.
    /// @param minCollateralOut slippage guard.
    function sell(uint256 marketId, bool isYes, uint256 shares, uint256 minCollateralOut)
        external
        returns (uint256 collateralOut)
    {
        Market storage m = _markets[marketId];
        if (m.status != Status.Open) revert NotOpen();
        if (m.closesAt != 0 && block.timestamp >= m.closesAt) revert Closed();
        if (shares == 0) revert ZeroAmount();

        uint256 held = isYes ? yesOf[marketId][msg.sender] : noOf[marketId][msg.sender];
        if (held < shares) revert NoShares();

        uint256 k = m.resYes * m.resNo;
        uint256 y = isYes ? m.resYes + shares : m.resYes;
        uint256 n = isYes ? m.resNo : m.resNo + shares;

        // Burn `c` complete sets such that (y - c) * (n - c) == k.
        // c is the smaller root of c^2 - (y+n)c + (yn - k) = 0.
        collateralOut = _solveBurn(y, n, k);
        if (collateralOut > m.collateral) collateralOut = m.collateral;
        if (collateralOut < minCollateralOut) revert Slippage();

        if (isYes) {
            yesOf[marketId][msg.sender] = held - shares;
        } else {
            noOf[marketId][msg.sender] = held - shares;
        }

        m.resYes = y - collateralOut;
        m.resNo = n - collateralOut;
        m.collateral -= collateralOut;
        m.volume += collateralOut;

        emit Trade(marketId, msg.sender, isYes, false, collateralOut, shares, m.resYes, m.resNo);
        _pay(msg.sender, collateralOut);
    }

    // -------------------------------------------------------------- redemption

    /// @notice Redeem winning shares 1:1 after resolution. On a cancelled market
    ///         both sides redeem, which refunds every complete set.
    function redeem(uint256 marketId) external returns (uint256 payout) {
        Market storage m = _markets[marketId];
        if (m.status == Status.Open) revert NotResolved();

        if (m.status == Status.Cancelled) {
            payout = yesOf[marketId][msg.sender] + noOf[marketId][msg.sender];
            yesOf[marketId][msg.sender] = 0;
            noOf[marketId][msg.sender] = 0;
        } else if (m.outcomeYes) {
            payout = yesOf[marketId][msg.sender];
            yesOf[marketId][msg.sender] = 0;
        } else {
            payout = noOf[marketId][msg.sender];
            noOf[marketId][msg.sender] = 0;
        }

        if (payout == 0) revert NothingToRedeem();
        if (payout > m.collateral) payout = m.collateral;
        m.collateral -= payout;

        emit Redeemed(marketId, msg.sender, payout);
        _pay(msg.sender, payout);
    }

    /// @notice The pool's own winning shares belong to whoever seeded the market.
    function redeemPool(uint256 marketId) external returns (uint256 payout) {
        Market storage m = _markets[marketId];
        if (m.status == Status.Open) revert NotResolved();
        if (m.poolRedeemed) revert AlreadyRedeemed();
        m.poolRedeemed = true;

        if (m.status == Status.Cancelled) {
            payout = m.resYes + m.resNo;
        } else {
            payout = m.outcomeYes ? m.resYes : m.resNo;
        }

        if (payout == 0) revert NothingToRedeem();
        if (payout > m.collateral) payout = m.collateral;
        m.collateral -= payout;

        emit Redeemed(marketId, m.creator, payout);
        _pay(m.creator, payout);
    }

    // ------------------------------------------------------------------ views

    function marketCount() external view returns (uint256) {
        return _markets.length;
    }

    function getMarket(uint256 marketId) external view returns (Market memory) {
        return _markets[marketId];
    }

    /// @notice YES price in basis points (10000 = 100%). Price is the pool's
    ///         opposing reserve share, the standard CPMM binary-market price.
    function priceYesBps(uint256 marketId) public view returns (uint256) {
        Market storage m = _markets[marketId];
        uint256 total = m.resYes + m.resNo;
        if (total == 0) return 5000;
        return (m.resNo * 10_000) / total;
    }

    /// @notice Quote a buy without sending a transaction.
    function quoteBuy(uint256 marketId, bool isYes, uint256 amountIn)
        external
        view
        returns (uint256 sharesOut)
    {
        Market storage m = _markets[marketId];
        if (amountIn == 0) return 0;
        uint256 k = m.resYes * m.resNo;
        uint256 y = m.resYes + amountIn;
        uint256 n = m.resNo + amountIn;
        sharesOut = isYes ? y - _ceilDiv(k, n) : n - _ceilDiv(k, y);
    }

    /// @notice Quote a sell without sending a transaction.
    function quoteSell(uint256 marketId, bool isYes, uint256 shares)
        external
        view
        returns (uint256 collateralOut)
    {
        Market storage m = _markets[marketId];
        if (shares == 0) return 0;
        uint256 k = m.resYes * m.resNo;
        uint256 y = isYes ? m.resYes + shares : m.resYes;
        uint256 n = isYes ? m.resNo : m.resNo + shares;
        collateralOut = _solveBurn(y, n, k);
        if (collateralOut > m.collateral) collateralOut = m.collateral;
    }

    function positionOf(uint256 marketId, address trader)
        external
        view
        returns (uint256 yes, uint256 no)
    {
        return (yesOf[marketId][trader], noOf[marketId][trader]);
    }

    // -------------------------------------------------------------- internals

    /// @dev Smaller root of c^2 - (y+n)c + (yn - k) = 0, clamped to min(y, n).
    function _solveBurn(uint256 y, uint256 n, uint256 k) private pure returns (uint256 c) {
        uint256 s = y + n;
        uint256 p = y * n;
        // yn >= k always holds here because we only ever add to a reserve.
        uint256 q = p - k;
        uint256 disc = s * s - 4 * q;
        c = (s - _sqrt(disc)) / 2;
        uint256 cap = y < n ? y : n;
        if (c > cap) c = cap;
    }

    function _sqrt(uint256 x) private pure returns (uint256 z) {
        if (x == 0) return 0;
        z = x;
        uint256 g = x / 2 + 1;
        while (g < z) {
            z = g;
            g = (x / g + g) / 2;
        }
    }

    function _ceilDiv(uint256 a, uint256 b) private pure returns (uint256) {
        return a == 0 ? 0 : (a - 1) / b + 1;
    }

    function _pay(address to, uint256 amount) private {
        (bool ok,) = payable(to).call{value: amount}("");
        if (!ok) revert TransferFailed();
    }
}
