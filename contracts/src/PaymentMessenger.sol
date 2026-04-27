// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {OApp, Origin} from "@layerzerolabs/oapp-evm/contracts/oapp/OApp.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title PaymentMessenger — Base Sepolia LayerZero V2 OApp
/// @notice Receives `BountyCompleted` messages from 0G via LayerZero V2 and emits
///         a `DistributeRequested` event. KeeperHub workflow watches this event and
///         triggers `PaymentRouter.distribute(bountyKey, recipients, amounts)` via
///         Direct Execution API — gas estimation, retry, audit log all handled.
/// @dev We deliberately keep the receiver minimal: decode + emit. The actual
///      contract write is delegated to KeeperHub, separating message integrity
///      (LZ DVN-attested) from execution reliability (KH).
contract PaymentMessenger is OApp {
    /// @dev Records of every received message — sequential anti-replay guard.
    mapping(bytes32 => bool) public seen;

    /// @notice The structured event KH workflow listens for.
    event DistributeRequested(
        bytes32 indexed messageGuid,
        uint32 indexed srcEid,
        uint256 indexed bountyId,
        bytes32 srcSender, // bytes32 form of the source OApp address
        address[] recipients,
        uint256[] amounts
    );

    error MessageAlreadyProcessed();

    constructor(address endpoint, address owner_) OApp(endpoint, owner_) Ownable(owner_) {}

    function _lzReceive(
        Origin calldata _origin,
        bytes32 _guid,
        bytes calldata _message,
        address /*_executor*/,
        bytes calldata /*_extraData*/
    ) internal virtual override {
        if (seen[_guid]) revert MessageAlreadyProcessed();
        seen[_guid] = true;

        (uint256 bountyId, address[] memory recipients, uint256[] memory amounts) =
            abi.decode(_message, (uint256, address[], uint256[]));

        emit DistributeRequested(_guid, _origin.srcEid, bountyId, _origin.sender, recipients, amounts);
    }
}
