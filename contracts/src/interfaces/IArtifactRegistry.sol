// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

/// @title Scholar Swarm ArtifactRegistry
/// @notice Anchors 0G Storage roots for each artifact a bounty produces.
/// @dev Lightweight log — every research output, critic rationale, synthesis report
///      gets a permanent on-chain record tying (bountyId, subTask, kind) → storage root.
interface IArtifactRegistry {
    enum ArtifactKind {
        BountyGoal,        // user's research request
        SubTaskFindings,   // researcher output
        CriticRationale,   // critic decision detail
        FinalReport,       // synthesizer output
        AgentIntelligence  // iNFT-bound agent intelligence snapshot
    }

    event ArtifactAnchored(
        uint256 indexed bountyId,
        uint8 indexed subTaskIndex,
        ArtifactKind indexed kind,
        bytes32 storageRoot,
        uint256 producerAgentId,
        address producerWallet
    );

    error EmptyRoot();

    function anchor(
        uint256 bountyId,
        uint8 subTaskIndex,
        ArtifactKind kind,
        bytes32 storageRoot,
        uint256 producerAgentId
    ) external;

    function getRoot(uint256 bountyId, uint8 subTaskIndex, ArtifactKind kind) external view returns (bytes32);

    function getAllForBounty(uint256 bountyId)
        external
        view
        returns (uint8[] memory subTaskIndexes, ArtifactKind[] memory kinds, bytes32[] memory roots);
}
