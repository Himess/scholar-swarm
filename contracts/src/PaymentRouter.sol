// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import {IPaymentRouter} from "./interfaces/IPaymentRouter.sol";

/// @title PaymentRouter — Scholar Swarm payment rail (Base Sepolia)
/// @notice User funds USDC escrow per bounty. KeeperHub triggers `distribute` after the
///         off-chain workflow watches 0G `BountyCompleted` events. KH provides retry,
///         gas estimation, and audit log on top of this contract.
/// @dev Owner = deployer (us). Keeper = KeeperHub Para wallet. Owner can rotate keeper
///      and refund cancelled escrows. Distribution must conserve total amount.
contract PaymentRouter is IPaymentRouter, Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public immutable override token;
    address public override keeper;

    mapping(bytes32 => Escrow) private _escrows;

    constructor(address token_, address keeper_, address owner_) Ownable(owner_) {
        require(token_ != address(0) && keeper_ != address(0) && owner_ != address(0), "zero addr");
        token = IERC20(token_);
        keeper = keeper_;
        emit KeeperUpdated(address(0), keeper_);
    }

    modifier onlyKeeper() {
        if (msg.sender != keeper) revert NotKeeper();
        _;
    }

    /// @inheritdoc IPaymentRouter
    function fund(bytes32 bountyKey, uint256 amount) external override nonReentrant {
        if (_escrows[bountyKey].status != EscrowStatus.None) revert AlreadyFunded(bountyKey);
        if (amount == 0) revert AmountMismatch(0, 0);

        _escrows[bountyKey] = Escrow({
            user: msg.sender,
            totalAmount: amount,
            status: EscrowStatus.Funded,
            createdAt: uint64(block.timestamp),
            settledAt: 0
        });

        token.safeTransferFrom(msg.sender, address(this), amount);
        emit Funded(bountyKey, msg.sender, amount);
    }

    /// @inheritdoc IPaymentRouter
    function distribute(bytes32 bountyKey, address[] calldata recipients, uint256[] calldata amounts)
        external
        override
        onlyKeeper
        nonReentrant
    {
        Escrow memory e = _escrows[bountyKey];
        if (e.status != EscrowStatus.Funded) revert NotFunded(bountyKey);
        if (recipients.length != amounts.length) revert MismatchedArrays();

        uint256 sum;
        for (uint256 i = 0; i < amounts.length; ++i) {
            sum += amounts[i];
        }
        if (sum != e.totalAmount) revert AmountMismatch(sum, e.totalAmount);

        // Effects before interactions.
        _escrows[bountyKey].status = EscrowStatus.Distributed;
        _escrows[bountyKey].settledAt = uint64(block.timestamp);

        for (uint256 i = 0; i < recipients.length; ++i) {
            if (recipients[i] == address(0) || amounts[i] == 0) revert TransferFailed();
            token.safeTransfer(recipients[i], amounts[i]);
        }

        bytes32 distHash = keccak256(abi.encode(bountyKey, recipients, amounts));
        emit Distributed(bountyKey, recipients, amounts, distHash);
    }

    /// @inheritdoc IPaymentRouter
    function refund(bytes32 bountyKey) external override onlyKeeper nonReentrant {
        Escrow memory e = _escrows[bountyKey];
        if (e.status != EscrowStatus.Funded) revert NotFunded(bountyKey);

        _escrows[bountyKey].status = EscrowStatus.Refunded;
        _escrows[bountyKey].settledAt = uint64(block.timestamp);

        token.safeTransfer(e.user, e.totalAmount);
        emit Refunded(bountyKey, e.user, e.totalAmount);
    }

    /// @inheritdoc IPaymentRouter
    function escrow(bytes32 bountyKey) external view override returns (Escrow memory) {
        return _escrows[bountyKey];
    }

    /// @inheritdoc IPaymentRouter
    function setKeeper(address newKeeper) external override onlyOwner {
        require(newKeeper != address(0), "zero keeper");
        emit KeeperUpdated(keeper, newKeeper);
        keeper = newKeeper;
    }
}
