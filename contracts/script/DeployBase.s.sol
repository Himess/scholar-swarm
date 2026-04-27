// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Script, console2} from "forge-std/Script.sol";

import {PaymentRouter} from "../src/PaymentRouter.sol";

/// @notice Deploy script for Base Sepolia (chainId 84532).
/// @dev Run:
///      forge script contracts/script/DeployBase.s.sol:DeployBase \
///        --rpc-url https://sepolia.base.org \
///        --private-key $DEMO_PLANNER_KEY --broadcast --slow
///
///      Env vars:
///        DEMO_PLANNER_KEY      — deployer (also default owner)
///        KEEPERHUB_WALLET_ADDR — KH Para wallet (will be the keeper)
///        BASE_SEPOLIA_USDC     — defaults to canonical Base Sepolia USDC if unset
contract DeployBase is Script {
    /// @dev Canonical Base Sepolia USDC (Circle), as of 2026.
    address constant BASE_SEPOLIA_USDC_DEFAULT = 0x036CbD53842c5426634e7929541eC2318f3dCF7e;

    function run() external {
        uint256 deployerKey = vm.envUint("DEMO_PLANNER_KEY");
        address deployer = vm.addr(deployerKey);

        address keeper = vm.envAddress("KEEPERHUB_WALLET_ADDR");
        address usdc = vm.envOr("BASE_SEPOLIA_USDC", BASE_SEPOLIA_USDC_DEFAULT);
        address owner_ = vm.envOr("PAYMENT_ROUTER_OWNER", deployer);

        vm.startBroadcast(deployerKey);
        PaymentRouter router = new PaymentRouter(usdc, keeper, owner_);
        console2.log("PaymentRouter deployed at:", address(router));
        vm.stopBroadcast();

        console2.log("\n=== Deployment summary (Base Sepolia) ===");
        console2.log("Deployer:           ", deployer);
        console2.log("PaymentRouter:      ", address(router));
        console2.log("USDC:               ", usdc);
        console2.log("Keeper (KH wallet): ", keeper);
        console2.log("Owner:              ", owner_);
    }
}
