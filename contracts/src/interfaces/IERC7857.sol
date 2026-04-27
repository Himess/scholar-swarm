// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";

/// @title ERC-7857 Intelligent NFT Core
/// @notice NFT for tokenizing AI agents with encrypted intelligence on decentralized storage.
/// @dev Reference: github.com/0gfoundation/0g-agent-nft
interface IERC7857 is IERC721 {
    /// @dev `intelligenceRoot` is a 0G Storage merkle root pointing to the encrypted agent payload.
    /// @dev `encryptedKey` is the re-encryption envelope (TEE-readable) for the current owner.
    event Minted(uint256 indexed tokenId, address indexed creator, bytes32 intelligenceRoot);
    event Reencrypted(uint256 indexed tokenId, address indexed newOwner, bytes32 newIntelligenceRoot);

    error UnauthorizedReencryption();
    error InvalidVerifier();
    error TransferLockedPendingReencryption();

    function mint(address to, bytes32 intelligenceRoot, bytes calldata encryptedKey) external returns (uint256 tokenId);

    function intelligenceRoot(uint256 tokenId) external view returns (bytes32);

    function encryptedKey(uint256 tokenId) external view returns (bytes memory);

    function verifier() external view returns (IERC7857DataVerifier);

    /// @notice Called by the verifier oracle (TEE/ZKP) after re-encryption to commit new state on transfer.
    function commitReencryption(
        uint256 tokenId,
        bytes32 newIntelligenceRoot,
        bytes calldata newEncryptedKey,
        bytes calldata verifierProof
    ) external;
}

interface IERC7857Metadata {
    event MetadataUpdate(uint256 indexed tokenId, string indexed key, bytes value);

    function getMetadata(uint256 tokenId, string calldata key) external view returns (bytes memory);

    function setMetadata(uint256 tokenId, string calldata key, bytes calldata value) external;
}

interface IERC7857Authorize {
    event UsageAuthorized(uint256 indexed tokenId, address indexed user, uint256 expiresAt);
    event UsageRevoked(uint256 indexed tokenId, address indexed user);

    error TooManyAuthorizedUsers();
    error NotTokenOwner();

    /// @notice Authorize `user` to use the intelligence of `tokenId` until `expiresAt` (0 = no expiry).
    /// @dev Cleared automatically on token transfer. Max 100 active authorizations per token.
    function authorizeUsage(uint256 tokenId, address user, uint256 expiresAt) external;

    function revokeAuthorization(uint256 tokenId, address user) external;

    function isAuthorized(uint256 tokenId, address user) external view returns (bool);

    function authorizedUsers(uint256 tokenId) external view returns (address[] memory);
}

/// @notice Pluggable verifier for re-encryption proofs (TEE attestation, ZK proof, etc.)
interface IERC7857DataVerifier {
    function verifyReencryption(
        uint256 tokenId,
        bytes32 oldRoot,
        bytes32 newRoot,
        bytes calldata proof
    ) external view returns (bool);
}
