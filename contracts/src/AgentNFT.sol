// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ERC721URIStorage} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

import {IAgentNFT} from "./interfaces/IAgentNFT.sol";
import {IERC7857, IERC7857Authorize, IERC7857DataVerifier} from "./interfaces/IERC7857.sol";
import {IIdentityRegistry} from "./interfaces/IERC8004.sol";

/// @title AgentNFT — Scholar Swarm agent identity (ERC-7857 + ERC-8004 unified)
/// @notice One token = one swarm agent. Encrypted intelligence on 0G Storage,
///         reputation accrued in ReputationRegistry, role + URI + metadata here.
contract AgentNFT is ERC721URIStorage, AccessControl, EIP712, IAgentNFT {
    using ECDSA for bytes32;

    bytes32 public constant ADMIN_ROLE = DEFAULT_ADMIN_ROLE;
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    uint256 public constant MAX_AUTHORIZED = 100;

    bytes32 private constant _AGENT_WALLET_TYPEHASH =
        keccak256("AgentWallet(uint256 agentId,address newWallet,uint256 deadline)");

    uint256 private _nextAgentId = 1;
    uint256 public override mintFee;

    IERC7857DataVerifier private _verifier;

    // ----- ERC-7857 state -----
    mapping(uint256 => bytes32) private _intelligenceRoot;
    mapping(uint256 => bytes) private _encryptedKey;

    // ----- ERC-7857 Authorize -----
    mapping(uint256 => address[]) private _authorizedUsers;
    mapping(uint256 => mapping(address => uint256)) private _authorizedExpiry;

    // ----- ERC-8004 metadata -----
    mapping(uint256 => mapping(string => bytes)) private _metadata;

    // ----- ERC-8004 agent wallet binding -----
    mapping(uint256 => address) private _agentWallets;

    // ----- Scholar Swarm role -----
    mapping(uint256 => AgentRole) private _roles;

    constructor(address admin_, IERC7857DataVerifier verifier_)
        ERC721("Scholar Swarm Agent", "SSAGENT")
        EIP712("ScholarSwarmAgentNFT", "1")
    {
        _grantRole(ADMIN_ROLE, admin_);
        _grantRole(OPERATOR_ROLE, admin_);
        _grantRole(MINTER_ROLE, admin_);
        _verifier = verifier_;
    }

    // ===================================================================
    //                            ERC-7857 core
    // ===================================================================

    function mint(address to, bytes32 intelligenceRoot_, bytes calldata encryptedKey_)
        external
        override
        onlyRole(MINTER_ROLE)
        returns (uint256 tokenId)
    {
        tokenId = _mintInternal(to, intelligenceRoot_, encryptedKey_, "", new MetadataEntry[](0));
    }

    function intelligenceRoot(uint256 tokenId) external view override returns (bytes32) {
        _requireOwned(tokenId);
        return _intelligenceRoot[tokenId];
    }

    function encryptedKey(uint256 tokenId) external view override returns (bytes memory) {
        _requireOwned(tokenId);
        return _encryptedKey[tokenId];
    }

    function verifier() external view override returns (IERC7857DataVerifier) {
        return _verifier;
    }

    function setVerifier(IERC7857DataVerifier newVerifier) external onlyRole(ADMIN_ROLE) {
        _verifier = newVerifier;
    }

    /// @notice Called by the new owner (or operator) after transfer, with a verifier-issued
    ///         proof binding old + new intelligence roots. Updates encryptedKey.
    function commitReencryption(
        uint256 tokenId,
        bytes32 newIntelligenceRoot,
        bytes calldata newEncryptedKey,
        bytes calldata verifierProof
    ) external override {
        address owner = ownerOf(tokenId);
        if (msg.sender != owner && !hasRole(OPERATOR_ROLE, msg.sender)) revert UnauthorizedReencryption();
        if (address(_verifier) == address(0)) revert InvalidVerifier();

        bytes32 oldRoot = _intelligenceRoot[tokenId];
        bool ok = _verifier.verifyReencryption(tokenId, oldRoot, newIntelligenceRoot, verifierProof);
        if (!ok) revert InvalidVerifier();

        _intelligenceRoot[tokenId] = newIntelligenceRoot;
        _encryptedKey[tokenId] = newEncryptedKey;
        emit Reencrypted(tokenId, owner, newIntelligenceRoot);
    }

    // ===================================================================
    //                          ERC-7857 Authorize
    // ===================================================================

    function authorizeUsage(uint256 tokenId, address user, uint256 expiresAt) external override {
        if (msg.sender != ownerOf(tokenId)) revert NotTokenOwner();
        address[] storage list = _authorizedUsers[tokenId];
        if (list.length >= MAX_AUTHORIZED) revert TooManyAuthorizedUsers();

        if (_authorizedExpiry[tokenId][user] == 0) {
            list.push(user);
        }
        _authorizedExpiry[tokenId][user] = expiresAt;
        emit UsageAuthorized(tokenId, user, expiresAt);
    }

    function revokeAuthorization(uint256 tokenId, address user) external override {
        if (msg.sender != ownerOf(tokenId)) revert NotTokenOwner();
        if (_authorizedExpiry[tokenId][user] == 0) return;

        delete _authorizedExpiry[tokenId][user];
        address[] storage list = _authorizedUsers[tokenId];
        for (uint256 i = 0; i < list.length; ++i) {
            if (list[i] == user) {
                list[i] = list[list.length - 1];
                list.pop();
                break;
            }
        }
        emit UsageRevoked(tokenId, user);
    }

    function isAuthorized(uint256 tokenId, address user) external view override returns (bool) {
        uint256 exp = _authorizedExpiry[tokenId][user];
        if (exp == 0) return false;
        if (exp == type(uint256).max) return true;
        return block.timestamp <= exp;
    }

    function authorizedUsers(uint256 tokenId) external view override returns (address[] memory) {
        return _authorizedUsers[tokenId];
    }

    // ===================================================================
    //                       ERC-8004 IdentityRegistry
    // ===================================================================

    function register(string calldata agentURI_, MetadataEntry[] calldata metadata)
        external
        override
        returns (uint256 agentId)
    {
        agentId = _mintInternal(msg.sender, bytes32(0), bytes(""), agentURI_, metadata);
    }

    function register(string calldata agentURI_) external override returns (uint256 agentId) {
        agentId = _mintInternal(msg.sender, bytes32(0), bytes(""), agentURI_, new MetadataEntry[](0));
    }

    function register() external override returns (uint256 agentId) {
        agentId = _mintInternal(msg.sender, bytes32(0), bytes(""), "", new MetadataEntry[](0));
    }

    function setAgentURI(uint256 agentId, string calldata newURI) external override {
        if (msg.sender != ownerOf(agentId)) revert NotTokenOwner();
        _setTokenURI(agentId, newURI);
        emit URIUpdated(agentId, newURI, msg.sender);
    }

    function getMetadata(uint256 agentId, string memory metadataKey) external view returns (bytes memory) {
        _requireOwned(agentId);
        return _metadata[agentId][metadataKey];
    }

    function setMetadata(uint256 agentId, string memory metadataKey, bytes memory metadataValue) external {
        if (msg.sender != ownerOf(agentId)) revert NotTokenOwner();
        _metadata[agentId][metadataKey] = metadataValue;
        emit MetadataSet(agentId, metadataKey, metadataKey, metadataValue);
    }

    function setAgentWallet(uint256 agentId, address newWallet, uint256 deadline, bytes calldata signature)
        external
        override
    {
        _requireOwned(agentId);
        if (block.timestamp > deadline) revert WalletDeadlineExpired();

        bytes32 structHash = keccak256(abi.encode(_AGENT_WALLET_TYPEHASH, agentId, newWallet, deadline));
        bytes32 digest = _hashTypedDataV4(structHash);
        address signer = digest.recover(signature);
        if (signer != newWallet) revert InvalidWalletSignature();

        _agentWallets[agentId] = newWallet;
        emit AgentWalletSet(agentId, newWallet);
    }

    function getAgentWallet(uint256 agentId) external view override returns (address) {
        return _agentWallets[agentId];
    }

    function unsetAgentWallet(uint256 agentId) external override {
        if (msg.sender != ownerOf(agentId)) revert NotTokenOwner();
        address prev = _agentWallets[agentId];
        if (prev == address(0)) return;
        delete _agentWallets[agentId];
        emit AgentWalletUnset(agentId, prev);
    }

    // ===================================================================
    //                      Scholar Swarm composed mint
    // ===================================================================

    function mintAgent(
        address to,
        AgentRole role,
        bytes32 intelligenceRoot_,
        bytes calldata encryptedKey_,
        string calldata agentURI_,
        MetadataEntry[] calldata metadata
    ) external payable override returns (uint256 agentId) {
        if (msg.value < mintFee) revert MintFeeNotPaid(mintFee, msg.value);
        agentId = _mintInternal(to, intelligenceRoot_, encryptedKey_, agentURI_, metadata);
        _roles[agentId] = role;
        emit AgentMinted(agentId, msg.sender, role, intelligenceRoot_, agentURI_);
    }

    function roleOf(uint256 agentId) external view override returns (AgentRole) {
        _requireOwned(agentId);
        return _roles[agentId];
    }

    function totalAgents() external view override returns (uint256) {
        return _nextAgentId - 1;
    }

    function setMintFee(uint256 newFee) external onlyRole(ADMIN_ROLE) {
        mintFee = newFee;
    }

    function withdrawFees(address payable to) external onlyRole(ADMIN_ROLE) {
        (bool ok,) = to.call{value: address(this).balance}("");
        require(ok, "withdraw failed");
    }

    // ===================================================================
    //                              internal
    // ===================================================================

    function _mintInternal(
        address to,
        bytes32 intelligenceRoot_,
        bytes memory encryptedKey_,
        string memory agentURI_,
        MetadataEntry[] memory metadata
    ) internal returns (uint256 agentId) {
        agentId = _nextAgentId++;
        _safeMint(to, agentId);

        if (intelligenceRoot_ != bytes32(0)) {
            _intelligenceRoot[agentId] = intelligenceRoot_;
            _encryptedKey[agentId] = encryptedKey_;
            emit Minted(agentId, to, intelligenceRoot_);
        }

        if (bytes(agentURI_).length != 0) {
            _setTokenURI(agentId, agentURI_);
        }

        for (uint256 i = 0; i < metadata.length; ++i) {
            _metadata[agentId][metadata[i].metadataKey] = metadata[i].metadataValue;
            emit MetadataSet(agentId, metadata[i].metadataKey, metadata[i].metadataKey, metadata[i].metadataValue);
        }

        emit Registered(agentId, agentURI_, to);
    }

    /// @dev Clear authorizations on transfer (per ERC-7857 spec).
    function _update(address to, uint256 tokenId, address auth) internal virtual override returns (address) {
        address from = super._update(to, tokenId, auth);
        if (from != address(0) && to != address(0) && from != to) {
            _clearAuthorizations(tokenId);
        }
        return from;
    }

    function _clearAuthorizations(uint256 tokenId) internal {
        address[] storage list = _authorizedUsers[tokenId];
        for (uint256 i = 0; i < list.length; ++i) {
            delete _authorizedExpiry[tokenId][list[i]];
        }
        delete _authorizedUsers[tokenId];
    }

    // ===================================================================
    //                              ERC-165
    // ===================================================================

    function supportsInterface(bytes4 interfaceId)
        public
        view
        virtual
        override(ERC721URIStorage, AccessControl, IERC165)
        returns (bool)
    {
        return interfaceId == type(IERC7857).interfaceId
            || interfaceId == type(IERC7857Authorize).interfaceId
            || interfaceId == type(IIdentityRegistry).interfaceId
            || super.supportsInterface(interfaceId);
    }
}
