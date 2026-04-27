// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Script, console2} from "forge-std/Script.sol";

interface IOAppCore {
    function setPeer(uint32 eid, bytes32 peer) external;
    function peers(uint32 eid) external view returns (bytes32);
}

/// @notice Wires the LZ V2 OApp pair on each chain.
/// @dev Run once on each chain with the appropriate env vars:
///        OG side  : forge script ... :WirePeers0G   --rpc-url https://evmrpc-testnet.0g.ai --broadcast --slow --legacy --with-gas-price 4000000000
///        Base side: forge script ... :WirePeersBase --rpc-url https://sepolia.base.org    --broadcast --slow
contract WirePeers0G is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("DEMO_PLANNER_KEY");
        address bountyMessenger = vm.envAddress("OG_BOUNTY_MESSENGER");
        address paymentMessenger = vm.envAddress("BASE_PAYMENT_MESSENGER");
        uint32 baseEid = uint32(vm.envOr("BASE_SEPOLIA_EID", uint256(40245)));

        bytes32 peer = bytes32(uint256(uint160(paymentMessenger)));
        console2.log("Wiring 0G BountyMessenger ->  Base PaymentMessenger");
        console2.log("  src OApp:", bountyMessenger);
        console2.log("  dst eid: ", baseEid);
        console2.log("  dst peer (address):", paymentMessenger);

        vm.startBroadcast(deployerKey);
        IOAppCore(bountyMessenger).setPeer(baseEid, peer);
        vm.stopBroadcast();

        bytes32 stored = IOAppCore(bountyMessenger).peers(baseEid);
        require(stored == peer, "peer not set correctly");
        console2.log("  setPeer ok, stored:", uint256(stored));
    }
}

contract WirePeersBase is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("DEMO_PLANNER_KEY");
        address paymentMessenger = vm.envAddress("BASE_PAYMENT_MESSENGER");
        address bountyMessenger = vm.envAddress("OG_BOUNTY_MESSENGER");
        uint32 ogEid = uint32(vm.envOr("OG_GALILEO_EID", uint256(40428)));

        bytes32 peer = bytes32(uint256(uint160(bountyMessenger)));
        console2.log("Wiring Base PaymentMessenger -> 0G BountyMessenger");
        console2.log("  src OApp:", paymentMessenger);
        console2.log("  dst eid: ", ogEid);
        console2.log("  dst peer (address):", bountyMessenger);

        vm.startBroadcast(deployerKey);
        IOAppCore(paymentMessenger).setPeer(ogEid, peer);
        vm.stopBroadcast();

        bytes32 stored = IOAppCore(paymentMessenger).peers(ogEid);
        require(stored == peer, "peer not set correctly");
        console2.log("  setPeer ok, stored:", uint256(stored));
    }
}
