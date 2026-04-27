// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Test} from "forge-std/Test.sol";

import {ReputationRegistry} from "../src/ReputationRegistry.sol";
import {IReputationRegistry} from "../src/interfaces/IERC8004.sol";
import {AgentNFT} from "../src/AgentNFT.sol";
import {IAgentNFT} from "../src/interfaces/IAgentNFT.sol";
import {IIdentityRegistry} from "../src/interfaces/IERC8004.sol";
import {MockVerifier} from "./mocks/MockVerifier.sol";

contract ReputationRegistryTest is Test {
    ReputationRegistry rep;
    AgentNFT nft;
    MockVerifier verifier;

    address admin = address(0xA11CE);
    address alice = address(0xA1);
    address critic = address(0xC0);

    uint256 researcherId;

    function setUp() public {
        verifier = new MockVerifier();
        nft = new AgentNFT(admin, verifier);
        rep = new ReputationRegistry();
        rep.initialize(address(nft));

        bytes32 minterRole = nft.MINTER_ROLE();
        vm.prank(admin);
        nft.grantRole(minterRole, alice);

        vm.prank(alice);
        researcherId = nft.register("ipfs://researcher");
    }

    function test_initialize_revertsIfDoubleInit() public {
        vm.expectRevert(ReputationRegistry.AlreadyInitialized.selector);
        rep.initialize(address(nft));
    }

    function test_giveFeedback_appendsAndIndexes() public {
        vm.prank(critic);
        rep.giveFeedback(
            researcherId, 85, 2, "researcher", "approval-rate", "https://api.swarm/ep1", "ipfs://feedback-1", bytes32(uint256(1))
        );

        (int128 v, uint8 d, string memory t1, string memory t2, bool revoked) =
            rep.readFeedback(researcherId, critic, 0);
        assertEq(v, 85);
        assertEq(d, 2);
        assertEq(t1, "researcher");
        assertEq(t2, "approval-rate");
        assertFalse(revoked);

        address[] memory clients = rep.getClients(researcherId);
        assertEq(clients.length, 1);
        assertEq(clients[0], critic);
    }

    function test_revokeFeedback_flipsFlag() public {
        vm.prank(critic);
        rep.giveFeedback(
            researcherId, 85, 2, "researcher", "approval-rate", "ep", "uri", bytes32(uint256(1))
        );

        vm.prank(critic);
        rep.revokeFeedback(researcherId, 0);

        (,,,, bool revoked) = rep.readFeedback(researcherId, critic, 0);
        assertTrue(revoked);
    }

    function test_getSummary_averagesByTag() public {
        // Two feedbacks: 80 (decimals=2) and 90 (decimals=2). Average = 85.
        vm.startPrank(critic);
        rep.giveFeedback(researcherId, 80, 2, "researcher", "approval-rate", "ep", "uri", bytes32(uint256(1)));
        rep.giveFeedback(researcherId, 90, 2, "researcher", "approval-rate", "ep", "uri", bytes32(uint256(2)));
        vm.stopPrank();

        address[] memory clients = new address[](0);
        (uint64 count, int128 summary, uint8 dec) =
            rep.getSummary(researcherId, clients, "researcher", "approval-rate");
        assertEq(count, 2);
        assertEq(summary, 85);
        assertEq(dec, 2);
    }

    function test_giveFeedback_revertsIfAgentDoesNotExist() public {
        vm.prank(critic);
        vm.expectRevert(IReputationRegistry.InvalidAgentId.selector);
        rep.giveFeedback(9999, 1, 0, "x", "y", "ep", "uri", bytes32(0));
    }

    function test_readAllFeedback_filtersRevokedByDefault() public {
        vm.startPrank(critic);
        rep.giveFeedback(researcherId, 80, 2, "researcher", "approval-rate", "ep", "uri", bytes32(uint256(1)));
        rep.giveFeedback(researcherId, 50, 2, "researcher", "approval-rate", "ep", "uri", bytes32(uint256(2)));
        rep.revokeFeedback(researcherId, 1);
        vm.stopPrank();

        address[] memory clients = new address[](0);
        (,, int128[] memory values,,,,) =
            rep.readAllFeedback(researcherId, clients, "researcher", "approval-rate", false);
        assertEq(values.length, 1);
        assertEq(values[0], 80);
    }
}
