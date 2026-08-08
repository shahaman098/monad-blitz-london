// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {MidrollEscrow} from "../src/MidrollEscrow.sol";

contract MidrollEscrowTest is Test {
    MidrollEscrow internal escrow;

    address internal sponsor = makeAddr("sponsor");
    address internal creator = makeAddr("creator");
    address internal outsider = makeAddr("outsider");

    bytes32 internal sessionA = keccak256("session-a");

    function setUp() public {
        escrow = new MidrollEscrow();
        vm.deal(sponsor, 10 ether);
    }

    function test_FundCampaignStoresCampaignData() public {
        vm.prank(sponsor);
        uint256 campaignId = escrow.fundCampaign{value: 3 ether}(creator, 0.01 ether, 12, 22);

        (
            address storedSponsor,
            address storedCreator,
            uint96 ratePerSecondWei,
            uint32 sponsorSegmentStart,
            uint32 sponsorSegmentEnd,
            uint128 fundedAmount,
            uint128 settledAmount,
            uint128 creatorClaimable,
            bool active
        ) = escrow.campaigns(campaignId);

        assertEq(storedSponsor, sponsor);
        assertEq(storedCreator, creator);
        assertEq(ratePerSecondWei, 0.01 ether);
        assertEq(sponsorSegmentStart, 12);
        assertEq(sponsorSegmentEnd, 22);
        assertEq(fundedAmount, 3 ether);
        assertEq(settledAmount, 0);
        assertEq(creatorClaimable, 0);
        assertTrue(active);
    }

    function test_SettleWatchAccruesClaimableBalance() public {
        vm.prank(sponsor);
        uint256 campaignId = escrow.fundCampaign{value: 3 ether}(creator, 0.01 ether, 12, 22);

        vm.prank(sponsor);
        (uint32 countedSeconds, uint256 payoutWei) = escrow.settleWatch(campaignId, sessionA, 8);

        assertEq(countedSeconds, 8);
        assertEq(payoutWei, 0.08 ether);
        assertEq(escrow.sessionWatchTotals(campaignId, sessionA), 8);

        (, , , , , , uint128 settledAmount, uint128 creatorClaimable, ) = escrow.campaigns(campaignId);
        assertEq(settledAmount, 0.08 ether);
        assertEq(creatorClaimable, 0.08 ether);
    }

    function test_OnlySponsorCanSettleWatch() public {
        vm.prank(sponsor);
        uint256 campaignId = escrow.fundCampaign{value: 3 ether}(creator, 0.01 ether, 12, 22);

        vm.prank(outsider);
        vm.expectRevert(MidrollEscrow.NotSponsor.selector);
        escrow.settleWatch(campaignId, sessionA, 4);
    }

    function test_CreatorCanWithdrawClaimableBalance() public {
        vm.prank(sponsor);
        uint256 campaignId = escrow.fundCampaign{value: 3 ether}(creator, 0.01 ether, 12, 22);

        vm.prank(sponsor);
        escrow.settleWatch(campaignId, sessionA, 6);

        uint256 creatorBalanceBefore = creator.balance;

        vm.prank(creator);
        escrow.withdrawCreator(campaignId);

        assertEq(creator.balance, creatorBalanceBefore + 0.06 ether);
        (, , , , , , , uint128 creatorClaimable, ) = escrow.campaigns(campaignId);
        assertEq(creatorClaimable, 0);
    }

    function test_CloseCampaignRefundsUnusedBudget() public {
        vm.prank(sponsor);
        uint256 campaignId = escrow.fundCampaign{value: 3 ether}(creator, 0.01 ether, 12, 22);

        vm.prank(sponsor);
        escrow.settleWatch(campaignId, sessionA, 5);

        uint256 sponsorBalanceBefore = sponsor.balance;

        vm.prank(sponsor);
        escrow.closeCampaign(campaignId);

        assertEq(sponsor.balance, sponsorBalanceBefore + 2.95 ether);
    }

    function test_SettlementCapsToRemainingBudget() public {
        vm.prank(sponsor);
        uint256 campaignId = escrow.fundCampaign{value: 0.05 ether}(creator, 0.01 ether, 12, 22);

        vm.prank(sponsor);
        (uint32 countedSeconds, uint256 payoutWei) = escrow.settleWatch(campaignId, sessionA, 15);

        assertEq(countedSeconds, 5);
        assertEq(payoutWei, 0.05 ether);
        assertEq(escrow.sessionWatchTotals(campaignId, sessionA), 5);
    }
}
