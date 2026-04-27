// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Test} from "forge-std/Test.sol";

import {PaymentRouter} from "../src/PaymentRouter.sol";
import {IPaymentRouter} from "../src/interfaces/IPaymentRouter.sol";
import {MockUSDC} from "./mocks/MockUSDC.sol";

contract PaymentRouterTest is Test {
    PaymentRouter router;
    MockUSDC usdc;

    address owner = address(0xA11CE);
    address keeper = address(0xBEEF);
    address user = address(0xCAFE);
    address agent1 = address(0xD00D1);
    address agent2 = address(0xD00D2);
    address agent3 = address(0xD00D3);
    address agent4 = address(0xD00D4);
    address agent5 = address(0xD00D5);

    bytes32 constant KEY = keccak256("bounty-1");

    function setUp() public {
        usdc = new MockUSDC();
        router = new PaymentRouter(address(usdc), keeper, owner);
        usdc.mint(user, 10_000e6);
        vm.prank(user);
        usdc.approve(address(router), type(uint256).max);
    }

    function test_fund_emits_and_transfers() public {
        vm.prank(user);
        vm.expectEmit(true, true, false, true);
        emit IPaymentRouter.Funded(KEY, user, 100e6);
        router.fund(KEY, 100e6);

        assertEq(usdc.balanceOf(address(router)), 100e6);
        assertEq(uint256(router.escrow(KEY).status), uint256(IPaymentRouter.EscrowStatus.Funded));
    }

    function test_fund_revertsIfDoubleFund() public {
        vm.startPrank(user);
        router.fund(KEY, 100e6);
        vm.expectRevert(abi.encodeWithSelector(IPaymentRouter.AlreadyFunded.selector, KEY));
        router.fund(KEY, 50e6);
        vm.stopPrank();
    }

    function test_distribute_paysAllAgentsAndUpdatesStatus() public {
        vm.prank(user);
        router.fund(KEY, 1000e6);

        address[] memory recipients = new address[](5);
        recipients[0] = agent1;
        recipients[1] = agent2;
        recipients[2] = agent3;
        recipients[3] = agent4;
        recipients[4] = agent5;
        uint256[] memory amounts = new uint256[](5);
        amounts[0] = 150e6; // planner
        amounts[1] = 350e6; // researcher 1
        amounts[2] = 350e6; // researcher 2
        amounts[3] = 100e6; // critic
        amounts[4] = 50e6; // synthesizer

        vm.prank(keeper);
        router.distribute(KEY, recipients, amounts);

        assertEq(usdc.balanceOf(agent1), 150e6);
        assertEq(usdc.balanceOf(agent2), 350e6);
        assertEq(usdc.balanceOf(agent3), 350e6);
        assertEq(usdc.balanceOf(agent4), 100e6);
        assertEq(usdc.balanceOf(agent5), 50e6);
        assertEq(uint256(router.escrow(KEY).status), uint256(IPaymentRouter.EscrowStatus.Distributed));
    }

    function test_distribute_revertsIfNotKeeper() public {
        vm.prank(user);
        router.fund(KEY, 100e6);
        address[] memory recipients = new address[](1);
        recipients[0] = agent1;
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = 100e6;

        vm.prank(user);
        vm.expectRevert(IPaymentRouter.NotKeeper.selector);
        router.distribute(KEY, recipients, amounts);
    }

    function test_distribute_revertsIfAmountSumMismatches() public {
        vm.prank(user);
        router.fund(KEY, 100e6);
        address[] memory recipients = new address[](2);
        recipients[0] = agent1;
        recipients[1] = agent2;
        uint256[] memory amounts = new uint256[](2);
        amounts[0] = 30e6;
        amounts[1] = 30e6; // total 60, escrow 100

        vm.prank(keeper);
        vm.expectRevert(abi.encodeWithSelector(IPaymentRouter.AmountMismatch.selector, 60e6, 100e6));
        router.distribute(KEY, recipients, amounts);
    }

    function test_refund_returnsToUser() public {
        vm.prank(user);
        router.fund(KEY, 100e6);
        uint256 before = usdc.balanceOf(user);

        vm.prank(keeper);
        router.refund(KEY);

        assertEq(usdc.balanceOf(user), before + 100e6);
        assertEq(uint256(router.escrow(KEY).status), uint256(IPaymentRouter.EscrowStatus.Refunded));
    }

    function test_setKeeper_onlyOwner() public {
        address newKeeper = address(0xFEED);
        vm.prank(user);
        vm.expectRevert();
        router.setKeeper(newKeeper);

        vm.prank(owner);
        router.setKeeper(newKeeper);
        assertEq(router.keeper(), newKeeper);
    }
}
