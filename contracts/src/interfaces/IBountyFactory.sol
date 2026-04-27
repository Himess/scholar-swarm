// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

/// @title Scholar Swarm BountyFactory
/// @notice Mints one Bounty contract per research job. Lives on 0G Chain.
/// @dev Payment escrow lives on Base Sepolia (PaymentRouter). This contract only
///      tracks job lifecycle. The off-chain coordinator binds Base USDC tx hashes
///      to bounties via `bindPayment`.
interface IBountyFactory {
    event BountyCreated(
        address indexed bountyAddress,
        address indexed user,
        uint256 indexed bountyId,
        uint256 budget,
        string goalURI,
        bytes32 goalHash
    );
    event PaymentBound(uint256 indexed bountyId, bytes32 baseChainPaymentRef);

    error InvalidBudget();
    error EmptyGoal();
    error UnknownBounty(uint256 bountyId);

    /// @notice Create a new bounty contract. `budget` is informational on 0G;
    ///         actual escrow is on Base Sepolia at PaymentRouter.
    function createBounty(uint256 budget, string calldata goalURI, bytes32 goalHash)
        external
        returns (uint256 bountyId, address bountyAddress);

    /// @notice Create a bounty AND wire its cross-chain settlement (LZ V2 messenger
    ///         + per-role fees). On synthesis the bounty fires LZ automatically.
    /// @dev Reverts if `bountyMessenger` on the factory is not set.
    function createBountyWithSettlement(
        uint256 budget,
        string calldata goalURI,
        bytes32 goalHash,
        uint256 plannerFee,
        uint256 criticFee,
        uint256 synthesizerFee
    ) external returns (uint256 bountyId, address bountyAddress);

    /// @notice Owner sets the BountyMessenger (LZ V2 OApp) used for cross-chain settlement.
    function setBountyMessenger(address messenger) external;

    function bountyMessenger() external view returns (address);

    /// @notice Bind a Base Sepolia payment ref (tx hash + chain id) to the bounty.
    /// @dev Called by the cross-chain coordinator (trusted relay for hackathon).
    function bindPayment(uint256 bountyId, bytes32 baseChainPaymentRef) external;

    function bountyAddress(uint256 bountyId) external view returns (address);

    function totalBounties() external view returns (uint256);

    function paymentRef(uint256 bountyId) external view returns (bytes32);

    function relayer() external view returns (address);
}
