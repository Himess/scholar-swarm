// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Test} from "forge-std/Test.sol";

import {AgentNFT} from "../src/AgentNFT.sol";
import {IAgentNFT} from "../src/interfaces/IAgentNFT.sol";
import {IIdentityRegistry} from "../src/interfaces/IERC8004.sol";
import {IERC7857, IERC7857Authorize} from "../src/interfaces/IERC7857.sol";
import {MockVerifier} from "./mocks/MockVerifier.sol";

contract AgentNFTTest is Test {
    AgentNFT nft;
    MockVerifier verifier;

    address admin = address(0xA11CE);
    address alice = address(0xA1);
    address bob = address(0xB0B);

    function setUp() public {
        verifier = new MockVerifier();
        nft = new AgentNFT(admin, verifier);
        // Admin is also the minter; mint to alice for tests.
        bytes32 minterRole = nft.MINTER_ROLE();
        vm.prank(admin);
        nft.grantRole(minterRole, alice);
    }

    function test_mintAgent_setsRoleAndIntelligence() public {
        bytes32 root = keccak256("intel-1");
        bytes memory key = "encrypted-key";
        IIdentityRegistry.MetadataEntry[] memory md = new IIdentityRegistry.MetadataEntry[](0);

        vm.prank(alice);
        uint256 id = nft.mintAgent(alice, IAgentNFT.AgentRole.Researcher, root, key, "ipfs://x", md);

        assertEq(id, 1);
        assertEq(nft.ownerOf(id), alice);
        assertEq(nft.intelligenceRoot(id), root);
        assertEq(nft.encryptedKey(id), key);
        assertEq(uint256(nft.roleOf(id)), uint256(IAgentNFT.AgentRole.Researcher));
        assertEq(nft.totalAgents(), 1);
    }

    function test_register_short_form_works() public {
        vm.prank(alice);
        uint256 id = nft.register("ipfs://only-uri");
        assertEq(nft.ownerOf(id), alice);
        // No intelligenceRoot bound for register-only call (ERC-8004 only).
        assertEq(nft.intelligenceRoot(id), bytes32(0));
    }

    function test_setMetadata_onlyOwner() public {
        vm.prank(alice);
        uint256 id = nft.register("ipfs://x");

        vm.prank(bob);
        vm.expectRevert(IERC7857Authorize.NotTokenOwner.selector);
        nft.setMetadata(id, "k", bytes("v"));

        vm.prank(alice);
        nft.setMetadata(id, "k", bytes("v"));
        assertEq(nft.getMetadata(id, "k"), bytes("v"));
    }

    function test_authorizeAndRevoke() public {
        vm.prank(alice);
        uint256 id = nft.register("ipfs://x");

        vm.prank(alice);
        nft.authorizeUsage(id, bob, type(uint256).max);
        assertTrue(nft.isAuthorized(id, bob));

        vm.prank(alice);
        nft.revokeAuthorization(id, bob);
        assertFalse(nft.isAuthorized(id, bob));
    }

    function test_authorizationsClearedOnTransfer() public {
        vm.prank(alice);
        uint256 id = nft.register("ipfs://x");

        vm.prank(alice);
        nft.authorizeUsage(id, bob, type(uint256).max);
        assertTrue(nft.isAuthorized(id, bob));

        vm.prank(alice);
        nft.transferFrom(alice, address(0xCAFE), id);

        assertFalse(nft.isAuthorized(id, bob));
    }

    function test_commitReencryption_updatesRoot() public {
        bytes32 root = keccak256("intel-1");
        IIdentityRegistry.MetadataEntry[] memory md = new IIdentityRegistry.MetadataEntry[](0);

        vm.prank(alice);
        uint256 id = nft.mintAgent(alice, IAgentNFT.AgentRole.Critic, root, "k", "ipfs://x", md);

        bytes32 newRoot = keccak256("intel-2");
        vm.prank(alice);
        nft.commitReencryption(id, newRoot, "new-k", "proof");
        assertEq(nft.intelligenceRoot(id), newRoot);
    }

    function test_commitReencryption_revertsIfVerifierFails() public {
        bytes32 root = keccak256("intel-1");
        IIdentityRegistry.MetadataEntry[] memory md = new IIdentityRegistry.MetadataEntry[](0);

        vm.prank(alice);
        uint256 id = nft.mintAgent(alice, IAgentNFT.AgentRole.Critic, root, "k", "ipfs://x", md);

        verifier.setResult(false);
        vm.prank(alice);
        vm.expectRevert(IERC7857.InvalidVerifier.selector);
        nft.commitReencryption(id, keccak256("intel-2"), "k", "proof");
    }

    function test_supportsInterface_returnsTrue_forERC7857_andERC8004() public view {
        assertTrue(nft.supportsInterface(type(IERC7857).interfaceId));
        assertTrue(nft.supportsInterface(type(IERC7857Authorize).interfaceId));
        assertTrue(nft.supportsInterface(type(IIdentityRegistry).interfaceId));
    }
}
