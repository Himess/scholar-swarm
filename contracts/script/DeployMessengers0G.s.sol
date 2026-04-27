// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Script, console2} from "forge-std/Script.sol";

import {BountyMessenger} from "../src/BountyMessenger.sol";

/// @notice Deploy BountyMessenger on 0G Galileo. Wires LZ V2 endpoint.
/// @dev Run after Deploy0G.s.sol. Endpoint values verified Day 4 (LZ metadata API).
contract DeployMessengers0G is Script {
    /// @dev 0G Galileo Testnet LZ V2 EndpointV2
    address constant OG_GALILEO_ENDPOINT = 0x3aCAAf60502791D199a5a5F0B173D78229eBFe32;
    /// @dev Base Sepolia EID v2
    uint32 constant BASE_SEPOLIA_EID = 40245;

    function run() external {
        uint256 deployerKey = vm.envUint("DEMO_PLANNER_KEY");
        address deployer = vm.addr(deployerKey);

        vm.startBroadcast(deployerKey);
        BountyMessenger messenger = new BountyMessenger(OG_GALILEO_ENDPOINT, deployer, BASE_SEPOLIA_EID);
        console2.log("BountyMessenger deployed at:", address(messenger));
        vm.stopBroadcast();

        console2.log("\n=== 0G Galileo LZ Messenger ===");
        console2.log("BountyMessenger:    ", address(messenger));
        console2.log("Endpoint:           ", OG_GALILEO_ENDPOINT);
        console2.log("Default dst EID:    ", BASE_SEPOLIA_EID);
        console2.log("Owner / delegate:   ", deployer);
        console2.log("\nNext: deploy PaymentMessenger on Base Sepolia, then run WirePeers0G + WirePeersBase.");
    }
}
