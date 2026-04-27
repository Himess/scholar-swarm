// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Script, console2} from "forge-std/Script.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

import {Bounty} from "../src/Bounty.sol";
import {BountyFactory} from "../src/BountyFactory.sol";

interface IBountyMessengerOwnable {
    function setAuthorized(address, bool) external;
    function transferOwnership(address) external;
    function owner() external view returns (address);
}

/// @notice Day 7 — redeploy Bounty implementation + Factory with cross-chain
///         settlement wiring, hand BountyMessenger ownership to the new factory.
///
///         After this script:
///           - createBountyWithSettlement on the new factory creates a Bounty
///             that auto-fires LayerZero V2 on synthesis.
///           - The new factory is messenger.owner, so authorization happens
///             atomically inside createBountyWithSettlement.
///
/// @dev Run:
///        forge script contracts/script/DeployBountyV2.s.sol:DeployBountyV2 \
///          --rpc-url https://evmrpc-testnet.0g.ai \
///          --private-key $DEMO_PLANNER_KEY \
///          --legacy --with-gas-price 4000000000 \
///          --broadcast --slow
///
///        Required env: DEMO_PLANNER_KEY, OG_AGENT_NFT, OG_BOUNTY_MESSENGER
contract DeployBountyV2 is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("DEMO_PLANNER_KEY");
        address deployer = vm.addr(deployerKey);
        address agentNFT = vm.envAddress("OG_AGENT_NFT");
        address messenger = vm.envAddress("OG_BOUNTY_MESSENGER");
        address relayer = vm.envOr("DEMO_RELAYER_ADDRESS", deployer);

        console2.log("Deployer:           ", deployer);
        console2.log("AgentNFT:           ", agentNFT);
        console2.log("BountyMessenger:    ", messenger);

        address messengerOwner = IBountyMessengerOwnable(messenger).owner();
        console2.log("Messenger owner now:", messengerOwner);
        require(messengerOwner == deployer, "deployer must own messenger to transfer");

        vm.startBroadcast(deployerKey);

        Bounty bountyImpl = new Bounty();
        console2.log("Bounty (new impl):  ", address(bountyImpl));

        BountyFactory factory = new BountyFactory(address(bountyImpl), agentNFT, relayer, deployer);
        console2.log("BountyFactory (v2): ", address(factory));

        factory.setBountyMessenger(messenger);
        console2.log("Factory wired to messenger");

        IBountyMessengerOwnable(messenger).transferOwnership(address(factory));
        console2.log("Messenger ownership transferred to factory");

        vm.stopBroadcast();

        console2.log("\n=== DeployBountyV2 summary ===");
        console2.log("OG_BOUNTY_IMPL=    ", address(bountyImpl));
        console2.log("OG_BOUNTY_FACTORY= ", address(factory));
        console2.log("(messenger ", messenger, " now owned by factory)");
    }
}
