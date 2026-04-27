// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {IERC7857, IERC7857Authorize} from "./IERC7857.sol";
import {IIdentityRegistry} from "./IERC8004.sol";

/// @title Scholar Swarm Agent NFT
/// @notice Unified contract implementing ERC-7857 (iNFT core + authorize) and
///         ERC-8004 IdentityRegistry. Each token represents one swarm agent.
/// @dev Deployed on 0G Galileo. Encrypted intelligence (system prompt, role spec,
///      accumulated context) lives on 0G Storage; root committed on-chain.
/// @dev Note: ERC-7857 Metadata functions are subsumed by IIdentityRegistry's
///      get/setMetadata which have identical signatures. The concrete impl emits
///      BOTH MetadataUpdate (ERC-7857) and MetadataSet (ERC-8004) events on writes.
interface IAgentNFT is IERC7857, IERC7857Authorize, IIdentityRegistry {
    /// @notice Standard role identifiers used by Scholar Swarm.
    enum AgentRole {
        Planner,
        Researcher,
        Critic,
        Synthesizer
    }

    event AgentMinted(
        uint256 indexed agentId,
        address indexed creator,
        AgentRole indexed role,
        bytes32 intelligenceRoot,
        string agentURI
    );

    error InvalidRole(uint8 role);
    error MintFeeNotPaid(uint256 required, uint256 paid);

    /// @notice Compose mint of an agent — iNFT mint + ERC-8004 register in one call.
    /// @dev Reverts if `msg.value < mintFee()`. Emits `Minted`, `Registered`, `AgentMinted`.
    function mintAgent(
        address to,
        AgentRole role,
        bytes32 intelligenceRoot,
        bytes calldata encryptedKey,
        string calldata agentURI,
        IIdentityRegistry.MetadataEntry[] calldata metadata
    ) external payable returns (uint256 agentId);

    function roleOf(uint256 agentId) external view returns (AgentRole);

    function mintFee() external view returns (uint256);

    /// @notice Total agents minted (monotonic, also = nextAgentId - 1 in our impl).
    function totalAgents() external view returns (uint256);
}
