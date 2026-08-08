// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract MidrollEscrow {
    error InvalidCreator();
    error InvalidRate();
    error InvalidSegment();
    error EmptyFunding();
    error CampaignMissing();
    error CampaignInactive();
    error NotSponsor();
    error NotCreator();
    error InvalidWatchTotal();
    error NothingToWithdraw();

    struct Campaign {
        address sponsor;
        address creator;
        uint96 ratePerSecondWei;
        uint32 sponsorSegmentStart;
        uint32 sponsorSegmentEnd;
        uint128 fundedAmount;
        uint128 settledAmount;
        uint128 creatorClaimable;
        bool active;
    }

    uint256 public nextCampaignId = 1;

    mapping(uint256 => Campaign) public campaigns;
    mapping(uint256 => mapping(bytes32 => uint32)) public sessionWatchTotals;

    event CampaignFunded(
        uint256 indexed campaignId,
        address indexed sponsor,
        address indexed creator,
        uint256 fundedAmount,
        uint256 ratePerSecondWei,
        uint32 sponsorSegmentStart,
        uint32 sponsorSegmentEnd
    );

    event WatchSettled(
        uint256 indexed campaignId,
        bytes32 indexed sessionId,
        uint32 newlyCountedSeconds,
        uint256 payoutWei
    );

    event CreatorWithdrawal(uint256 indexed campaignId, address indexed creator, uint256 amount);
    event CampaignClosed(uint256 indexed campaignId, address indexed sponsor, uint256 refundedAmount);

    function fundCampaign(
        address creator,
        uint96 ratePerSecondWei,
        uint32 sponsorSegmentStart,
        uint32 sponsorSegmentEnd
    ) external payable returns (uint256 campaignId) {
        if (creator == address(0)) revert InvalidCreator();
        if (ratePerSecondWei == 0) revert InvalidRate();
        if (msg.value == 0) revert EmptyFunding();
        if (sponsorSegmentEnd <= sponsorSegmentStart) revert InvalidSegment();

        campaignId = nextCampaignId++;

        campaigns[campaignId] = Campaign({
            sponsor: msg.sender,
            creator: creator,
            ratePerSecondWei: ratePerSecondWei,
            sponsorSegmentStart: sponsorSegmentStart,
            sponsorSegmentEnd: sponsorSegmentEnd,
            fundedAmount: uint128(msg.value),
            settledAmount: 0,
            creatorClaimable: 0,
            active: true
        });

        emit CampaignFunded(
            campaignId,
            msg.sender,
            creator,
            msg.value,
            ratePerSecondWei,
            sponsorSegmentStart,
            sponsorSegmentEnd
        );
    }

    function settleWatch(
        uint256 campaignId,
        bytes32 sessionId,
        uint32 cumulativeWatchedSeconds
    ) external returns (uint32 newlyCountedSeconds, uint256 payoutWei) {
        Campaign storage campaign = campaigns[campaignId];
        if (campaign.sponsor == address(0)) revert CampaignMissing();
        if (!campaign.active) revert CampaignInactive();
        if (msg.sender != campaign.sponsor) revert NotSponsor();

        uint32 previousWatchedSeconds = sessionWatchTotals[campaignId][sessionId];
        if (cumulativeWatchedSeconds < previousWatchedSeconds) revert InvalidWatchTotal();

        uint32 deltaSeconds = cumulativeWatchedSeconds - previousWatchedSeconds;
        if (deltaSeconds == 0) revert InvalidWatchTotal();

        uint256 remainingBudgetWei = campaign.fundedAmount - campaign.settledAmount;
        uint256 maxPayableSeconds = remainingBudgetWei / campaign.ratePerSecondWei;
        if (maxPayableSeconds == 0) revert CampaignInactive();

        newlyCountedSeconds = deltaSeconds;
        if (uint256(newlyCountedSeconds) > maxPayableSeconds) {
            newlyCountedSeconds = uint32(maxPayableSeconds);
        }

        payoutWei = uint256(newlyCountedSeconds) * campaign.ratePerSecondWei;

        sessionWatchTotals[campaignId][sessionId] = previousWatchedSeconds + newlyCountedSeconds;
        campaign.settledAmount += uint128(payoutWei);
        campaign.creatorClaimable += uint128(payoutWei);

        emit WatchSettled(campaignId, sessionId, newlyCountedSeconds, payoutWei);
    }

    function withdrawCreator(uint256 campaignId) external {
        Campaign storage campaign = campaigns[campaignId];
        if (campaign.sponsor == address(0)) revert CampaignMissing();
        if (msg.sender != campaign.creator) revert NotCreator();

        uint256 amount = campaign.creatorClaimable;
        if (amount == 0) revert NothingToWithdraw();

        campaign.creatorClaimable = 0;
        payable(msg.sender).transfer(amount);

        emit CreatorWithdrawal(campaignId, msg.sender, amount);
    }

    function closeCampaign(uint256 campaignId) external {
        Campaign storage campaign = campaigns[campaignId];
        if (campaign.sponsor == address(0)) revert CampaignMissing();
        if (msg.sender != campaign.sponsor) revert NotSponsor();
        if (!campaign.active) revert CampaignInactive();

        campaign.active = false;

        uint256 refundAmount = campaign.fundedAmount - campaign.settledAmount;
        if (refundAmount > 0) {
            campaign.fundedAmount = campaign.settledAmount;
            payable(msg.sender).transfer(refundAmount);
        }

        emit CampaignClosed(campaignId, msg.sender, refundAmount);
    }

    function remainingBudget(uint256 campaignId) external view returns (uint256) {
        Campaign storage campaign = campaigns[campaignId];
        if (campaign.sponsor == address(0)) revert CampaignMissing();

        return campaign.fundedAmount - campaign.settledAmount;
    }
}
