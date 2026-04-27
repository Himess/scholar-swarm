// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Test} from "forge-std/Test.sol";

import {Bounty} from "../src/Bounty.sol";
import {BountyFactory} from "../src/BountyFactory.sol";
import {IBountyFactory} from "../src/interfaces/IBountyFactory.sol";
import {AgentNFT} from "../src/AgentNFT.sol";
import {MockVerifier} from "./mocks/MockVerifier.sol";

contract BountyFactoryTest is Test {
    AgentNFT nft;
    BountyFactory factory;

    address admin = address(0xA11CE);
    address user = address(0xCAFE);
    address relayer = address(0xBEEF);

    function setUp() public {
        MockVerifier v = new MockVerifier();
        nft = new AgentNFT(admin, v);
        Bounty impl = new Bounty();
        factory = new BountyFactory(address(impl), address(nft), relayer, admin);
    }

    function test_createBounty_assignsIdAndAddress() public {
        vm.prank(user);
        (uint256 id, address addr) = factory.createBounty(100e6, "ipfs://goal", keccak256("g"));

        assertEq(id, 1);
        assertTrue(addr != address(0));
        assertEq(factory.bountyAddress(id), addr);
        assertEq(factory.totalBounties(), 1);
    }

    function test_createBounty_revertsOnZeroBudget() public {
        vm.prank(user);
        vm.expectRevert(IBountyFactory.InvalidBudget.selector);
        factory.createBounty(0, "ipfs://goal", keccak256("g"));
    }

    function test_createBounty_revertsOnEmptyGoal() public {
        vm.prank(user);
        vm.expectRevert(IBountyFactory.EmptyGoal.selector);
        factory.createBounty(1e6, "", keccak256("g"));
    }

    function test_bindPayment_relayerOnly() public {
        vm.prank(user);
        (uint256 id,) = factory.createBounty(1e6, "ipfs://goal", keccak256("g"));

        vm.prank(user);
        vm.expectRevert(BountyFactory.NotRelayer.selector);
        factory.bindPayment(id, bytes32(uint256(0xfeed)));

        vm.prank(relayer);
        factory.bindPayment(id, bytes32(uint256(0xfeed)));
        assertEq(factory.paymentRef(id), bytes32(uint256(0xfeed)));
    }

    function test_bindPayment_doubleBindReverts() public {
        vm.prank(user);
        (uint256 id,) = factory.createBounty(1e6, "ipfs://goal", keccak256("g"));

        vm.startPrank(relayer);
        factory.bindPayment(id, bytes32(uint256(1)));
        vm.expectRevert(abi.encodeWithSelector(BountyFactory.AlreadyBound.selector, id));
        factory.bindPayment(id, bytes32(uint256(2)));
        vm.stopPrank();
    }

    function test_setRelayer_onlyOwner() public {
        address newRelayer = address(0xFEED);
        vm.prank(user);
        vm.expectRevert();
        factory.setRelayer(newRelayer);

        vm.prank(admin);
        factory.setRelayer(newRelayer);
        assertEq(factory.relayer(), newRelayer);
    }
}
