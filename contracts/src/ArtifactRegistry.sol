// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {IArtifactRegistry} from "./interfaces/IArtifactRegistry.sol";

/// @title ArtifactRegistry
/// @notice Anchors 0G Storage merkle roots produced by Scholar Swarm agents.
/// @dev Append-only registry. Each (bountyId, subTaskIndex, kind) slot can be set once.
///      Lives on 0G Galileo. Read by frontend to render the source-traceability tree.
contract ArtifactRegistry is IArtifactRegistry {
    struct Entry {
        uint8 subTaskIndex;
        ArtifactKind kind;
        bytes32 storageRoot;
        uint256 producerAgentId;
        address producerWallet;
    }

    /// @dev Per-(bountyId, subTaskIndex, kind) → root. Zero means "not set".
    mapping(uint256 => mapping(uint8 => mapping(ArtifactKind => bytes32))) private _roots;

    /// @dev Per-bounty list of all anchored entries (for frontend traversal).
    mapping(uint256 => Entry[]) private _bountyEntries;

    error AlreadyAnchored();

    function anchor(
        uint256 bountyId,
        uint8 subTaskIndex,
        ArtifactKind kind,
        bytes32 storageRoot,
        uint256 producerAgentId
    ) external override {
        if (storageRoot == bytes32(0)) revert EmptyRoot();
        if (_roots[bountyId][subTaskIndex][kind] != bytes32(0)) revert AlreadyAnchored();

        _roots[bountyId][subTaskIndex][kind] = storageRoot;
        _bountyEntries[bountyId].push(
            Entry({
                subTaskIndex: subTaskIndex,
                kind: kind,
                storageRoot: storageRoot,
                producerAgentId: producerAgentId,
                producerWallet: msg.sender
            })
        );

        emit ArtifactAnchored(bountyId, subTaskIndex, kind, storageRoot, producerAgentId, msg.sender);
    }

    function getRoot(uint256 bountyId, uint8 subTaskIndex, ArtifactKind kind)
        external
        view
        override
        returns (bytes32)
    {
        return _roots[bountyId][subTaskIndex][kind];
    }

    function getAllForBounty(uint256 bountyId)
        external
        view
        override
        returns (uint8[] memory subTaskIndexes, ArtifactKind[] memory kinds, bytes32[] memory roots)
    {
        Entry[] storage entries = _bountyEntries[bountyId];
        uint256 n = entries.length;
        subTaskIndexes = new uint8[](n);
        kinds = new ArtifactKind[](n);
        roots = new bytes32[](n);
        for (uint256 i = 0; i < n; ++i) {
            subTaskIndexes[i] = entries[i].subTaskIndex;
            kinds[i] = entries[i].kind;
            roots[i] = entries[i].storageRoot;
        }
    }
}
