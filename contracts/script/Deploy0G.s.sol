// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Script, console2} from "forge-std/Script.sol";

import {AgentNFT} from "../src/AgentNFT.sol";
import {ReputationRegistry} from "../src/ReputationRegistry.sol";
import {ArtifactRegistry} from "../src/ArtifactRegistry.sol";
import {Bounty} from "../src/Bounty.sol";
import {BountyFactory} from "../src/BountyFactory.sol";
import {IERC7857DataVerifier} from "../src/interfaces/IERC7857.sol";

/// @notice Deploy script for 0G Galileo testnet (chainId 16602).
/// @dev Run:
///      forge script contracts/script/Deploy0G.s.sol:Deploy0G \
///        --rpc-url https://evmrpc-testnet.0g.ai \
///        --private-key $DEMO_PLANNER_KEY --broadcast --slow
///
///      Required env: DEMO_PLANNER_KEY (deployer + admin), DEMO_RELAYER_KEY (off-chain coordinator)
///      Optional: VERIFIER_ADDRESS (external TEE oracle); if unset, deploys a stub.
contract Deploy0G is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("DEMO_PLANNER_KEY");
        address deployer = vm.addr(deployerKey);

        // Relayer = trusted off-chain coordinator binding Base USDC events to 0G bounties.
        // For hackathon, same EOA is fine.
        address relayer = vm.envOr("DEMO_RELAYER_ADDRESS", deployer);

        // Verifier: real TEE oracle in production. Stub for hackathon.
        address verifierAddr = vm.envOr("VERIFIER_ADDRESS", address(0));

        vm.startBroadcast(deployerKey);

        if (verifierAddr == address(0)) {
            verifierAddr = address(new StubVerifier());
            console2.log("Deployed StubVerifier at:", verifierAddr);
        }

        AgentNFT agentNFT = new AgentNFT(deployer, IERC7857DataVerifier(verifierAddr));
        console2.log("AgentNFT deployed at:", address(agentNFT));

        ReputationRegistry rep = new ReputationRegistry();
        rep.initialize(address(agentNFT));
        console2.log("ReputationRegistry deployed at:", address(rep));

        ArtifactRegistry artifacts = new ArtifactRegistry();
        console2.log("ArtifactRegistry deployed at:", address(artifacts));

        Bounty bountyImpl = new Bounty();
        console2.log("Bounty (impl) deployed at:", address(bountyImpl));

        BountyFactory factory = new BountyFactory(address(bountyImpl), address(agentNFT), relayer, deployer);
        console2.log("BountyFactory deployed at:", address(factory));

        vm.stopBroadcast();

        console2.log("\n=== Deployment summary (0G Galileo) ===");
        console2.log("Deployer / admin:    ", deployer);
        console2.log("Relayer:             ", relayer);
        console2.log("Verifier:            ", verifierAddr);
        console2.log("AgentNFT:            ", address(agentNFT));
        console2.log("ReputationRegistry:  ", address(rep));
        console2.log("ArtifactRegistry:    ", address(artifacts));
        console2.log("Bounty (impl):       ", address(bountyImpl));
        console2.log("BountyFactory:       ", address(factory));
    }
}

/// @dev Hackathon stub. Production: replace with TEE-backed oracle (dstack-bound).
contract StubVerifier is IERC7857DataVerifier {
    function verifyReencryption(uint256, bytes32, bytes32, bytes calldata) external pure returns (bool) {
        return true;
    }
}
