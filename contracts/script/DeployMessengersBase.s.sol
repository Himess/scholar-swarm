// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Script, console2} from "forge-std/Script.sol";

import {PaymentMessenger} from "../src/PaymentMessenger.sol";

/// @notice Deploy PaymentMessenger on Base Sepolia. LZ V2 receiver counterpart.
contract DeployMessengersBase is Script {
    /// @dev Base Sepolia LZ V2 EndpointV2
    address constant BASE_SEPOLIA_ENDPOINT = 0x6EDCE65403992e310A62460808c4b910D972f10f;

    function run() external {
        uint256 deployerKey = vm.envUint("DEMO_PLANNER_KEY");
        address deployer = vm.addr(deployerKey);

        vm.startBroadcast(deployerKey);
        PaymentMessenger messenger = new PaymentMessenger(BASE_SEPOLIA_ENDPOINT, deployer);
        console2.log("PaymentMessenger deployed at:", address(messenger));
        vm.stopBroadcast();

        console2.log("\n=== Base Sepolia LZ Messenger ===");
        console2.log("PaymentMessenger:   ", address(messenger));
        console2.log("Endpoint:           ", BASE_SEPOLIA_ENDPOINT);
        console2.log("Owner / delegate:   ", deployer);
    }
}
