// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {Clutch} from "../src/Clutch.sol";

contract ClutchTest is Test {
    Clutch internal clutch;

    address internal owner = address(0xA11CE);
    address internal alice = address(0xB0B);
    address internal bob = address(0xCA7);

    uint96 internal constant NO_CLOSE = 0;
    uint256 internal constant SEED = 10 ether;

    function setUp() public {
        vm.deal(owner, 1000 ether);
        vm.deal(alice, 1000 ether);
        vm.deal(bob, 1000 ether);

        vm.prank(owner);
        clutch = new Clutch();
    }

    function _open() internal returns (uint256 id) {
        vm.prank(owner);
        id = clutch.createMarket{value: SEED}("Will this Reel hit 10,000 views in 30 minutes?", NO_CLOSE);
    }

    // ------------------------------------------------------------- pricing

    function test_MarketStartsAtFiftyFifty() public {
        uint256 id = _open();
        assertEq(clutch.priceYesBps(id), 5000, "seeded market should start at 50%");
    }

    function test_BuyYesMovesPriceUp() public {
        uint256 id = _open();
        uint256 before = clutch.priceYesBps(id);

        vm.prank(alice);
        clutch.buy{value: 2 ether}(id, true, 0);

        assertGt(clutch.priceYesBps(id), before, "buying YES must raise the YES price");
    }

    function test_BuyNoMovesPriceDown() public {
        uint256 id = _open();
        uint256 before = clutch.priceYesBps(id);

        vm.prank(alice);
        clutch.buy{value: 2 ether}(id, false, 0);

        assertLt(clutch.priceYesBps(id), before, "buying NO must lower the YES price");
    }

    function test_BuyGivesMoreSharesThanCollateral() public {
        uint256 id = _open();

        vm.prank(alice);
        uint256 shares = clutch.buy{value: 1 ether}(id, true, 0);

        // Below 100c a share, one unit of collateral must buy more than one share.
        assertGt(shares, 1 ether, "sub-100% price should yield >1 share per unit");
    }

    function test_QuoteBuyMatchesExecutedBuy() public {
        uint256 id = _open();
        uint256 quoted = clutch.quoteBuy(id, true, 3 ether);

        vm.prank(alice);
        uint256 actual = clutch.buy{value: 3 ether}(id, true, 0);

        assertEq(actual, quoted, "quoteBuy must match buy");
    }

    function test_QuoteSellMatchesExecutedSell() public {
        uint256 id = _open();

        vm.prank(alice);
        uint256 shares = clutch.buy{value: 3 ether}(id, true, 0);

        uint256 quoted = clutch.quoteSell(id, true, shares);

        vm.prank(alice);
        uint256 actual = clutch.sell(id, true, shares, 0);

        assertEq(actual, quoted, "quoteSell must match sell");
    }

    // ------------------------------------------------------------ economics

    function test_RoundTripCannotProfit() public {
        uint256 id = _open();

        vm.startPrank(alice);
        uint256 shares = clutch.buy{value: 5 ether}(id, true, 0);
        uint256 out = clutch.sell(id, true, shares, 0);
        vm.stopPrank();

        assertLe(out, 5 ether, "instant round trip must never mint value");
        // Rounding is the only leak; it should be dust, not a haircut.
        assertGe(out, 5 ether - 1e6, "round trip should lose only rounding dust");
    }

    function test_SellRevertsWithoutShares() public {
        uint256 id = _open();
        vm.prank(alice);
        vm.expectRevert(Clutch.NoShares.selector);
        clutch.sell(id, true, 1 ether, 0);
    }

    function test_SlippageGuardBlocksBadFill() public {
        uint256 id = _open();
        uint256 quoted = clutch.quoteBuy(id, true, 1 ether);

        vm.prank(alice);
        vm.expectRevert(Clutch.Slippage.selector);
        clutch.buy{value: 1 ether}(id, true, quoted + 1);
    }

    // ----------------------------------------------------------- settlement

    function test_ResolveAndRedeemPaysWinnersOneToOne() public {
        uint256 id = _open();

        vm.prank(alice);
        uint256 aliceShares = clutch.buy{value: 4 ether}(id, true, 0);

        vm.prank(bob);
        clutch.buy{value: 4 ether}(id, false, 0);

        vm.prank(owner);
        clutch.resolve(id, true);

        uint256 balBefore = alice.balance;
        vm.prank(alice);
        uint256 payout = clutch.redeem(id);

        assertEq(payout, aliceShares, "winning shares redeem 1:1");
        assertEq(alice.balance, balBefore + aliceShares, "payout must land");
    }

    function test_LosersGetNothing() public {
        uint256 id = _open();

        vm.prank(bob);
        clutch.buy{value: 4 ether}(id, false, 0);

        vm.prank(owner);
        clutch.resolve(id, true);

        vm.prank(bob);
        vm.expectRevert(Clutch.NothingToRedeem.selector);
        clutch.redeem(id);
    }

    function test_CancelRefundsBothSides() public {
        uint256 id = _open();

        vm.prank(alice);
        uint256 yes = clutch.buy{value: 3 ether}(id, true, 0);
        vm.prank(bob);
        uint256 no = clutch.buy{value: 3 ether}(id, false, 0);

        vm.prank(owner);
        clutch.cancel(id);

        vm.prank(alice);
        assertEq(clutch.redeem(id), yes, "cancel refunds YES holders");
        vm.prank(bob);
        assertEq(clutch.redeem(id), no, "cancel refunds NO holders");
    }

    function test_PoolResidualGoesToSeeder() public {
        uint256 id = _open();

        vm.prank(alice);
        clutch.buy{value: 4 ether}(id, true, 0);

        vm.prank(owner);
        clutch.resolve(id, true);

        uint256 balBefore = owner.balance;
        clutch.redeemPool(id);
        assertGt(owner.balance, balBefore, "seeder recovers the pool's winning shares");

        vm.expectRevert(Clutch.AlreadyRedeemed.selector);
        clutch.redeemPool(id);
    }

    // ------------------------------------------------------------- solvency

    /// @dev The property that matters: after arbitrary trading, the contract can
    ///      always pay every winning share plus the pool residual, with nothing
    ///      but rounding dust left behind.
    function testFuzz_AlwaysSolvent(uint96[8] calldata amounts, bool[8] calldata sides, bool outcome)
        public
    {
        uint256 id = _open();
        address[8] memory traders;

        for (uint256 i = 0; i < 8; i++) {
            uint256 amt = uint256(amounts[i]) % 20 ether;
            if (amt < 0.001 ether) amt = 0.001 ether;

            address t = address(uint160(0x1000 + i));
            traders[i] = t;
            vm.deal(t, amt);
            vm.prank(t);
            clutch.buy{value: amt}(id, sides[i], 0);
        }

        vm.prank(owner);
        clutch.resolve(id, outcome);

        uint256 collateral = clutch.getMarket(id).collateral;
        uint256 paid;

        for (uint256 i = 0; i < 8; i++) {
            (uint256 y, uint256 n) = clutch.positionOf(id, traders[i]);
            uint256 winning = outcome ? y : n;
            if (winning == 0) continue;
            vm.prank(traders[i]);
            paid += clutch.redeem(id);
        }
        paid += clutch.redeemPool(id);

        assertLe(paid, collateral, "cannot pay out more than is backed");
        assertLe(collateral - paid, 1e6, "residual must be rounding dust only");
        assertLe(address(clutch).balance, 1e6, "market should drain to dust");
    }

    /// @dev Sells must not break backing either.
    function testFuzz_SolventAfterSells(uint96 buyAmt, uint96 sellPct) public {
        uint256 id = _open();
        uint256 amt = uint256(buyAmt) % 50 ether;
        if (amt < 0.01 ether) amt = 0.01 ether;
        uint256 pct = uint256(sellPct) % 100 + 1;

        vm.deal(alice, amt);
        vm.prank(alice);
        uint256 shares = clutch.buy{value: amt}(id, true, 0);

        vm.prank(alice);
        clutch.sell(id, true, (shares * pct) / 100, 0);

        Clutch.Market memory m = clutch.getMarket(id);
        assertGe(address(clutch).balance, m.collateral, "held balance must back collateral");
        assertEq(clutch.priceYesBps(id) <= 10_000, true, "price stays in range");
    }

    // ---------------------------------------------------------------- access

    function test_OnlyOwnerCanCreate() public {
        vm.prank(alice);
        vm.expectRevert(Clutch.NotOwner.selector);
        clutch.createMarket{value: 1 ether}("nope", NO_CLOSE);
    }

    function test_OnlyOwnerCanResolve() public {
        uint256 id = _open();
        vm.prank(alice);
        vm.expectRevert(Clutch.NotOwner.selector);
        clutch.resolve(id, true);
    }

    function test_TradingBlockedAfterClose() public {
        vm.prank(owner);
        uint256 id = clutch.createMarket{value: SEED}("closes soon", uint96(block.timestamp + 60));

        vm.warp(block.timestamp + 61);
        vm.prank(alice);
        vm.expectRevert(Clutch.Closed.selector);
        clutch.buy{value: 1 ether}(id, true, 0);
    }

    function test_CannotTradeResolvedMarket() public {
        uint256 id = _open();
        vm.prank(owner);
        clutch.resolve(id, true);

        vm.prank(alice);
        vm.expectRevert(Clutch.NotOpen.selector);
        clutch.buy{value: 1 ether}(id, true, 0);
    }
}
