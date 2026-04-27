// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Script, console2} from "forge-std/Script.sol";

import {AgentRoyaltyVault} from "../src/AgentRoyaltyVault.sol";

/// @notice Deploy AgentRoyaltyVault on 0G Galileo. Sits next to AgentNFT,
///         turns each iNFT into a leasable, royalty-bearing asset.
contract DeployRoyaltyVault is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("DEMO_PLANNER_KEY");
        address deployer = vm.addr(deployerKey);
        address agentNFT = vm.envAddress("OG_AGENT_NFT");

        // Original creator = the deployer who minted Scholar Swarm agents.
        address payable creator = payable(deployer);

        vm.startBroadcast(deployerKey);
        AgentRoyaltyVault vault = new AgentRoyaltyVault(agentNFT, creator);
        console2.log("AgentRoyaltyVault deployed at:", address(vault));
        vm.stopBroadcast();

        console2.log("\n=== AgentRoyaltyVault (0G Galileo) ===");
        console2.log("Vault:    ", address(vault));
        console2.log("AgentNFT: ", agentNFT);
        console2.log("Creator:  ", creator);
        console2.log("Royalty:  5% of each payment auto-routed to creator, 95% to current owner");
    }
}
