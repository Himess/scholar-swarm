// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Test} from "forge-std/Test.sol";

import {Bounty} from "../src/Bounty.sol";
import {BountyFactory} from "../src/BountyFactory.sol";
import {IBounty} from "../src/interfaces/IBounty.sol";
import {AgentNFT} from "../src/AgentNFT.sol";
import {IAgentNFT} from "../src/interfaces/IAgentNFT.sol";
import {IIdentityRegistry} from "../src/interfaces/IERC8004.sol";
import {MockVerifier} from "./mocks/MockVerifier.sol";

contract BountyTest is Test {
    AgentNFT nft;
    BountyFactory factory;
    Bounty bounty;
    MockVerifier verifier;

    address admin = address(0xA11CE);
    address user = address(0xCAFE);
    address relayer = address(0xBEEF);

    address plannerOwner = address(0xA01);
    address r1Owner = address(0xA02);
    address r2Owner = address(0xA03);
    address criticOwner = address(0xA04);
    address synthOwner = address(0xA05);

    uint256 plannerId;
    uint256 r1Id;
    uint256 r2Id;
    uint256 criticId;
    uint256 synthId;

    function setUp() public {
        verifier = new MockVerifier();
        nft = new AgentNFT(admin, verifier);

        Bounty impl = new Bounty();
        factory = new BountyFactory(address(impl), address(nft), relayer, admin);

        // Mint role-tagged agents to distinct owners.
        IIdentityRegistry.MetadataEntry[] memory md = new IIdentityRegistry.MetadataEntry[](0);
        vm.startPrank(admin);
        nft.grantRole(nft.MINTER_ROLE(), plannerOwner);
        nft.grantRole(nft.MINTER_ROLE(), r1Owner);
        nft.grantRole(nft.MINTER_ROLE(), r2Owner);
        nft.grantRole(nft.MINTER_ROLE(), criticOwner);
        nft.grantRole(nft.MINTER_ROLE(), synthOwner);
        vm.stopPrank();

        vm.prank(plannerOwner);
        plannerId = nft.mintAgent(plannerOwner, IAgentNFT.AgentRole.Planner, bytes32(uint256(1)), "k", "uri", md);
        vm.prank(r1Owner);
        r1Id = nft.mintAgent(r1Owner, IAgentNFT.AgentRole.Researcher, bytes32(uint256(2)), "k", "uri", md);
        vm.prank(r2Owner);
        r2Id = nft.mintAgent(r2Owner, IAgentNFT.AgentRole.Researcher, bytes32(uint256(3)), "k", "uri", md);
        vm.prank(criticOwner);
        criticId = nft.mintAgent(criticOwner, IAgentNFT.AgentRole.Critic, bytes32(uint256(4)), "k", "uri", md);
        vm.prank(synthOwner);
        synthId = nft.mintAgent(synthOwner, IAgentNFT.AgentRole.Synthesizer, bytes32(uint256(5)), "k", "uri", md);

        // Create a bounty.
        vm.prank(user);
        (, address bountyAddr) =
            factory.createBounty(1000e6, "ipfs://goal", keccak256("Analyze Stargate AI"));
        bounty = Bounty(bountyAddr);
    }

    function test_fullHappyPath_completesBounty() public {
        // Open → Planning
        vm.prank(user);
        bounty.acceptPlanner(plannerId);
        assertEq(uint256(bounty.status()), uint256(IBounty.BountyStatus.Planning));

        // Planning → Bidding
        string[] memory tasks = new string[](3);
        tasks[0] = "Competitors";
        tasks[1] = "Tech moat";
        tasks[2] = "Risks";
        vm.prank(plannerOwner);
        bounty.broadcastSubTasks(tasks);
        assertEq(uint256(bounty.status()), uint256(IBounty.BountyStatus.Bidding));

        // Bids: r1 bids on tasks 0,2; r2 bids on task 1.
        vm.prank(r1Owner);
        bounty.placeBid(0, r1Id, 200e6, 12);
        vm.prank(r2Owner);
        bounty.placeBid(1, r2Id, 250e6, 4);
        vm.prank(r1Owner);
        bounty.placeBid(2, r1Id, 200e6, 12);

        // Awards
        vm.startPrank(plannerOwner);
        bounty.awardBid(0, r1Id);
        bounty.awardBid(1, r2Id);
        bounty.awardBid(2, r1Id);
        vm.stopPrank();
        assertEq(uint256(bounty.status()), uint256(IBounty.BountyStatus.Researching));

        // Findings → triggers Reviewing.
        vm.prank(r1Owner);
        bounty.submitFindings(0, r1Id, keccak256("findings-0"));
        assertEq(uint256(bounty.status()), uint256(IBounty.BountyStatus.Reviewing));
        vm.prank(r2Owner);
        bounty.submitFindings(1, r2Id, keccak256("findings-1"));
        vm.prank(r1Owner);
        bounty.submitFindings(2, r1Id, keccak256("findings-2"));

        // Critic approves all three.
        vm.startPrank(criticOwner);
        bounty.reviewClaim(0, criticId, true, "ipfs://rationale-0");
        bounty.reviewClaim(1, criticId, true, "ipfs://rationale-1");
        bounty.reviewClaim(2, criticId, true, "ipfs://rationale-2");
        vm.stopPrank();
        assertEq(uint256(bounty.status()), uint256(IBounty.BountyStatus.Synthesizing));

        // Synthesizer publishes.
        vm.prank(synthOwner);
        bounty.submitSynthesis(synthId, keccak256("final-report"));
        assertEq(uint256(bounty.status()), uint256(IBounty.BountyStatus.Completed));
        assertEq(bounty.finalReportRoot(), keccak256("final-report"));
    }

    function test_rejectThenRetry_reEntersResearching() public {
        vm.prank(user);
        bounty.acceptPlanner(plannerId);

        string[] memory tasks = new string[](3);
        tasks[0] = "A"; tasks[1] = "B"; tasks[2] = "C";
        vm.prank(plannerOwner);
        bounty.broadcastSubTasks(tasks);

        vm.prank(r1Owner);
        bounty.placeBid(0, r1Id, 100e6, 0);
        vm.prank(r2Owner);
        bounty.placeBid(1, r2Id, 100e6, 0);
        vm.prank(r1Owner);
        bounty.placeBid(2, r1Id, 100e6, 0);

        vm.startPrank(plannerOwner);
        bounty.awardBid(0, r1Id);
        bounty.awardBid(1, r2Id);
        bounty.awardBid(2, r1Id);
        vm.stopPrank();

        vm.prank(r1Owner);
        bounty.submitFindings(0, r1Id, keccak256("v1"));

        // Critic rejects task 0.
        vm.prank(criticOwner);
        bounty.reviewClaim(0, criticId, false, "weak source");
        // Should be back in Researching for the rejected sub-task.
        assertEq(uint256(bounty.status()), uint256(IBounty.BountyStatus.Researching));
    }

    function test_cancel_fromUserOnly() public {
        vm.prank(r1Owner);
        vm.expectRevert(IBounty.NotPlanner.selector);
        bounty.cancel("nope");

        vm.prank(user);
        bounty.cancel("changed mind");
        assertEq(uint256(bounty.status()), uint256(IBounty.BountyStatus.Cancelled));
    }
}
