// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {IERC2981} from "@openzeppelin/contracts/interfaces/IERC2981.sol";
import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title AgentRoyaltyVault — pay-to-authorize layer with automatic 95/5 split
/// @notice Sits next to `AgentNFT` and turns each agent into a leasable, royalty-
///         bearing asset. Owner of an iNFT sets a per-job usage fee; anyone can
///         pay that fee to be authorized to use the agent until `expiresAt`.
///         The vault automatically splits the payment 95% to current owner,
///         5% to the original creator (the deployer who minted Scholar Swarm
///         agents) — no claim step.
/// @dev We deliberately keep this OUT of `AgentNFT.sol` so we don't have to
///      re-deploy the existing iNFTs. The vault references them by tokenId.
///      Implements ERC-2981 `royaltyInfo` so marketplaces honor the same split.
contract AgentRoyaltyVault is IERC2981, ReentrancyGuard {
    /// @dev Bound iNFT collection (Scholar Swarm AgentNFT).
    IERC721 public immutable agentNFT;
    /// @dev Original creator of all agents minted under Scholar Swarm. Receives
    ///      5% royalty in perpetuity, regardless of subsequent ownership.
    address payable public immutable creator;
    /// @dev 5% creator royalty (basis points out of 10_000).
    uint96 public constant CREATOR_ROYALTY_BPS = 500;
    uint96 public constant BPS_DENOM = 10_000;

    /// @notice Per-agent usage fee, in native token (OG on 0G Galileo).
    mapping(uint256 => uint256) public usageFee;
    /// @notice Per (tokenId, user) — authorization expiry timestamp. 0 = never authorized.
    mapping(uint256 => mapping(address => uint256)) public authorizedUntil;
    /// @notice Lifetime accrued payments per token, denominated in native units.
    mapping(uint256 => uint256) public lifetimeRevenue;

    event UsageFeeSet(uint256 indexed tokenId, uint256 oldFee, uint256 newFee, address indexed setter);
    event UsageAuthorized(
        uint256 indexed tokenId,
        address indexed payer,
        address indexed user,
        uint256 expiresAt,
        uint256 paid,
        uint256 ownerShare,
        uint256 creatorShare,
        address ownerAt,
        address creatorAt
    );
    event AuthorizationRevoked(uint256 indexed tokenId, address indexed user, address indexed revoker);

    error NotTokenOwner();
    error InsufficientPayment(uint256 required, uint256 sent);
    error TransferFailed();
    error InvalidExpiry();
    error InvalidCreator();

    constructor(address agentNFT_, address payable creator_) {
        if (creator_ == address(0)) revert InvalidCreator();
        agentNFT = IERC721(agentNFT_);
        creator = creator_;
    }

    // ────────── owner-only writes ──────────

    /// @notice Token owner sets the per-job fee any user must pay to be authorized.
    /// @param tokenId AgentNFT token id.
    /// @param newFee Fee denominated in native chain unit (OG on 0G Galileo). 0 = free.
    function setUsageFee(uint256 tokenId, uint256 newFee) external {
        if (agentNFT.ownerOf(tokenId) != msg.sender) revert NotTokenOwner();
        uint256 oldFee = usageFee[tokenId];
        usageFee[tokenId] = newFee;
        emit UsageFeeSet(tokenId, oldFee, newFee, msg.sender);
    }

    /// @notice Token owner can revoke an authorization without refund (e.g., abuse).
    function revokeAuthorization(uint256 tokenId, address user) external {
        if (agentNFT.ownerOf(tokenId) != msg.sender) revert NotTokenOwner();
        delete authorizedUntil[tokenId][user];
        emit AuthorizationRevoked(tokenId, user, msg.sender);
    }

    // ────────── pay-to-authorize ──────────

    /// @notice Pay the configured fee, authorize `user` until `expiresAt`. Splits
    ///         payment 95% to current iNFT owner, 5% to original creator.
    /// @param tokenId AgentNFT token id.
    /// @param user The address being authorized.
    /// @param expiresAt UNIX timestamp the authorization expires. Must be > now.
    ///        Pass `type(uint256).max` for permanent.
    function payAndAuthorize(uint256 tokenId, address user, uint256 expiresAt)
        external
        payable
        nonReentrant
        returns (uint256 ownerShare, uint256 creatorShare)
    {
        if (expiresAt <= block.timestamp) revert InvalidExpiry();
        uint256 fee = usageFee[tokenId];
        if (msg.value < fee) revert InsufficientPayment(fee, msg.value);

        address ownerAt = agentNFT.ownerOf(tokenId);
        creatorShare = (msg.value * CREATOR_ROYALTY_BPS) / BPS_DENOM;
        ownerShare = msg.value - creatorShare;

        // Effects before interactions.
        authorizedUntil[tokenId][user] = expiresAt;
        lifetimeRevenue[tokenId] += msg.value;

        // Interactions — both must succeed; reentrancy guarded.
        if (creatorShare > 0) {
            (bool ok, ) = creator.call{value: creatorShare}("");
            if (!ok) revert TransferFailed();
        }
        if (ownerShare > 0) {
            (bool ok, ) = payable(ownerAt).call{value: ownerShare}("");
            if (!ok) revert TransferFailed();
        }

        emit UsageAuthorized(tokenId, msg.sender, user, expiresAt, msg.value, ownerShare, creatorShare, ownerAt, creator);
    }

    // ────────── views ──────────

    /// @notice True if `user` has unexpired paid authorization for `tokenId`.
    function isAuthorized(uint256 tokenId, address user) external view returns (bool) {
        uint256 exp = authorizedUntil[tokenId][user];
        if (exp == 0) return false;
        return block.timestamp <= exp;
    }

    // ────────── ERC-2981 ──────────

    /// @notice Marketplace-facing royalty hint for any `agentNFT` token. Always
    ///         returns the creator + a flat 5% of the salePrice.
    function royaltyInfo(uint256, uint256 salePrice)
        external
        view
        override
        returns (address receiver, uint256 royaltyAmount)
    {
        receiver = creator;
        royaltyAmount = (salePrice * CREATOR_ROYALTY_BPS) / BPS_DENOM;
    }

    /// @inheritdoc IERC165
    function supportsInterface(bytes4 interfaceId) external pure override returns (bool) {
        return interfaceId == type(IERC2981).interfaceId || interfaceId == type(IERC165).interfaceId;
    }

    /// @notice Allow contract to receive native if necessary (refunds, top-up).
    receive() external payable {}
}
