// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Test} from "forge-std/Test.sol";

import {AgentRoyaltyVault} from "../src/AgentRoyaltyVault.sol";
import {AgentNFT} from "../src/AgentNFT.sol";
import {IAgentNFT} from "../src/interfaces/IAgentNFT.sol";
import {IIdentityRegistry} from "../src/interfaces/IERC8004.sol";
import {MockVerifier} from "./mocks/MockVerifier.sol";

contract AgentRoyaltyVaultTest is Test {
    AgentNFT nft;
    AgentRoyaltyVault vault;
    MockVerifier verifier;

    address admin = address(0xA11CE);
    address creator = address(0xC0FFEE);
    address tokenOwner = address(0x000ffe);
    address payer = address(0xD00D);
    address user = address(0xBADF00D);

    uint256 tokenId;

    function setUp() public {
        verifier = new MockVerifier();
        nft = new AgentNFT(admin, verifier);
        vault = new AgentRoyaltyVault(address(nft), payable(creator));

        bytes32 minterRole = nft.MINTER_ROLE();
        vm.prank(admin);
        nft.grantRole(minterRole, tokenOwner);

        IIdentityRegistry.MetadataEntry[] memory md = new IIdentityRegistry.MetadataEntry[](0);
        vm.prank(tokenOwner);
        tokenId = nft.mintAgent(tokenOwner, IAgentNFT.AgentRole.Researcher, bytes32(uint256(1)), "k", "uri", md);

        vm.deal(payer, 10 ether);
    }

    function test_setUsageFee_onlyOwner() public {
        vm.prank(payer);
        vm.expectRevert(AgentRoyaltyVault.NotTokenOwner.selector);
        vault.setUsageFee(tokenId, 1 ether);

        vm.prank(tokenOwner);
        vault.setUsageFee(tokenId, 1 ether);
        assertEq(vault.usageFee(tokenId), 1 ether);
    }

    function test_payAndAuthorize_splits_95_5() public {
        vm.prank(tokenOwner);
        vault.setUsageFee(tokenId, 1 ether);

        uint256 ownerBefore = tokenOwner.balance;
        uint256 creatorBefore = creator.balance;

        uint256 deadline = block.timestamp + 1 days;
        vm.prank(payer);
        (uint256 ownerShare, uint256 creatorShare) = vault.payAndAuthorize{value: 1 ether}(tokenId, user, deadline);

        // 5% creator, 95% owner
        assertEq(creatorShare, 0.05 ether);
        assertEq(ownerShare, 0.95 ether);
        assertEq(creator.balance - creatorBefore, 0.05 ether);
        assertEq(tokenOwner.balance - ownerBefore, 0.95 ether);

        assertTrue(vault.isAuthorized(tokenId, user));
        assertEq(vault.authorizedUntil(tokenId, user), deadline);
        assertEq(vault.lifetimeRevenue(tokenId), 1 ether);
    }

    function test_payAndAuthorize_revertsOnUnderpay() public {
        vm.prank(tokenOwner);
        vault.setUsageFee(tokenId, 1 ether);

        vm.prank(payer);
        vm.expectRevert(abi.encodeWithSelector(AgentRoyaltyVault.InsufficientPayment.selector, 1 ether, 0.5 ether));
        vault.payAndAuthorize{value: 0.5 ether}(tokenId, user, block.timestamp + 1 days);
    }

    function test_payAndAuthorize_revertsOnExpiredDeadline() public {
        vm.prank(tokenOwner);
        vault.setUsageFee(tokenId, 0);

        vm.prank(payer);
        vm.expectRevert(AgentRoyaltyVault.InvalidExpiry.selector);
        vault.payAndAuthorize{value: 0}(tokenId, user, block.timestamp);
    }

    function test_isAuthorized_expires() public {
        vm.prank(tokenOwner);
        vault.setUsageFee(tokenId, 0);

        uint256 deadline = block.timestamp + 100;
        vm.prank(payer);
        vault.payAndAuthorize{value: 0}(tokenId, user, deadline);
        assertTrue(vault.isAuthorized(tokenId, user));

        vm.warp(deadline + 1);
        assertFalse(vault.isAuthorized(tokenId, user));
    }

    function test_revokeAuthorization_onlyOwner() public {
        vm.prank(tokenOwner);
        vault.setUsageFee(tokenId, 0);
        vm.prank(payer);
        vault.payAndAuthorize{value: 0}(tokenId, user, block.timestamp + 1 days);

        vm.prank(payer);
        vm.expectRevert(AgentRoyaltyVault.NotTokenOwner.selector);
        vault.revokeAuthorization(tokenId, user);

        vm.prank(tokenOwner);
        vault.revokeAuthorization(tokenId, user);
        assertFalse(vault.isAuthorized(tokenId, user));
    }

    function test_royaltyInfo_returnsCreator5pct() public view {
        (address receiver, uint256 royaltyAmount) = vault.royaltyInfo(tokenId, 1 ether);
        assertEq(receiver, creator);
        assertEq(royaltyAmount, 0.05 ether);
    }

    function test_zeroFee_authorizesWithoutPayment() public {
        // Default fee is 0 — anyone can authorize themselves for free.
        vm.prank(payer);
        vault.payAndAuthorize{value: 0}(tokenId, user, block.timestamp + 1 days);
        assertTrue(vault.isAuthorized(tokenId, user));
    }
}
