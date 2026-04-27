// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title Scholar Swarm PaymentRouter (Base Sepolia)
/// @notice Holds USDC escrow per bounty + distributes to multiple agent wallets in a single tx.
/// @dev Triggered by KeeperHub Direct Execution API after off-chain workflow watches
///      0G `BountyCompleted` event. KeeperHub provides retry, gas estimation, audit log.
interface IPaymentRouter {
    enum EscrowStatus {
        None,
        Funded,        // user paid USDC, awaiting completion signal
        Distributed,   // payouts sent
        Refunded       // bounty cancelled, user refunded
    }

    struct Escrow {
        address user;
        uint256 totalAmount;
        EscrowStatus status;
        uint64 createdAt;
        uint64 settledAt;
    }

    event Funded(bytes32 indexed bountyKey, address indexed user, uint256 amount);
    event Distributed(
        bytes32 indexed bountyKey,
        address[] recipients,
        uint256[] amounts,
        bytes32 distributionHash
    );
    event Refunded(bytes32 indexed bountyKey, address indexed user, uint256 amount);
    event KeeperUpdated(address indexed oldKeeper, address indexed newKeeper);

    error AlreadyFunded(bytes32 bountyKey);
    error NotFunded(bytes32 bountyKey);
    error MismatchedArrays();
    error AmountMismatch(uint256 totalAllocated, uint256 escrowed);
    error NotKeeper();
    error TransferFailed();

    /// @notice User funds an escrow keyed by `bountyKey` (a hash bridging 0G bountyId and Base side).
    function fund(bytes32 bountyKey, uint256 amount) external;

    /// @notice Called by KeeperHub (or `keeper`) to distribute the escrow to agent wallets.
    /// @dev `recipients.length == amounts.length`, `sum(amounts) == escrow.totalAmount`.
    function distribute(bytes32 bountyKey, address[] calldata recipients, uint256[] calldata amounts) external;

    /// @notice Refund the user if the bounty was cancelled (relayer-signed).
    function refund(bytes32 bountyKey) external;

    function token() external view returns (IERC20);

    function keeper() external view returns (address);

    function escrow(bytes32 bountyKey) external view returns (Escrow memory);

    function setKeeper(address newKeeper) external;
}
