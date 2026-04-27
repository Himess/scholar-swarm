// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {OApp, MessagingFee, MessagingReceipt, Origin} from "@layerzerolabs/oapp-evm/contracts/oapp/OApp.sol";
import {OptionsBuilder} from "@layerzerolabs/oapp-evm/contracts/oapp/libs/OptionsBuilder.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title BountyMessenger — 0G-side LayerZero V2 OApp
/// @notice Fires a `BountyCompleted` cross-chain message to Base Sepolia when a
///         Scholar Swarm bounty finalizes. The Base counterpart `PaymentMessenger`
///         emits a `DistributeRequested` event that KeeperHub workflow watches +
///         triggers `PaymentRouter.distribute()` against.
/// @dev Bidirectional minimal OApp. Only `notifyCompletion` is wired in MVP — the
///      reverse (Base USDC fund → 0G bounty bind) follows the same pattern in v2.
contract BountyMessenger is OApp {
    using OptionsBuilder for bytes;

    /// @dev Authorized callers (Bounty contracts spawned by BountyFactory).
    mapping(address => bool) public authorizedSenders;

    /// @dev Default LZ destination EID (Base Sepolia = 40245).
    uint32 public defaultDstEid;

    event Authorized(address indexed sender, bool allowed);
    event DefaultDstEidUpdated(uint32 eid);
    event CompletionSent(
        uint256 indexed bountyId,
        bytes32 indexed messageGuid,
        uint64 nonce,
        uint32 dstEid,
        address[] recipients,
        uint256[] amounts
    );

    error NotAuthorized();
    error ArrayLengthMismatch();

    constructor(address endpoint, address owner_, uint32 defaultDstEid_)
        OApp(endpoint, owner_)
        Ownable(owner_)
    {
        defaultDstEid = defaultDstEid_;
    }

    function setAuthorized(address sender, bool allowed) external onlyOwner {
        authorizedSenders[sender] = allowed;
        emit Authorized(sender, allowed);
    }

    function setDefaultDstEid(uint32 eid) external onlyOwner {
        defaultDstEid = eid;
        emit DefaultDstEidUpdated(eid);
    }

    /// @notice Quote LZ fee for a bounty completion message. Useful for off-chain
    ///         budgeting. `dstEid` 0 falls back to `defaultDstEid`.
    function quote(
        uint32 dstEid,
        uint256 bountyId,
        address[] calldata recipients,
        uint256[] calldata amounts,
        bytes calldata extraOptions
    ) external view returns (MessagingFee memory) {
        bytes memory message = abi.encode(bountyId, recipients, amounts);
        bytes memory options = extraOptions.length == 0
            ? OptionsBuilder.newOptions().addExecutorLzReceiveOption(200_000, 0)
            : extraOptions;
        return _quote(dstEid == 0 ? defaultDstEid : dstEid, message, options, /*payInLzToken*/ false);
    }

    /// @notice Called by an authorized Bounty (or owner) when the bounty completes.
    ///         Sends a LayerZero V2 message to the Base counterpart.
    /// @param dstEid Optional destination EID; pass 0 to use `defaultDstEid`.
    /// @param bountyId Mirrored Bounty id (cross-chain key).
    /// @param recipients Agent wallets that should be paid.
    /// @param amounts Per-recipient USDC units (6 decimals).
    function notifyCompletion(
        uint32 dstEid,
        uint256 bountyId,
        address[] calldata recipients,
        uint256[] calldata amounts,
        bytes calldata extraOptions
    ) external payable returns (MessagingReceipt memory receipt) {
        if (!authorizedSenders[msg.sender] && msg.sender != owner()) revert NotAuthorized();
        if (recipients.length != amounts.length) revert ArrayLengthMismatch();

        uint32 effectiveEid = dstEid == 0 ? defaultDstEid : dstEid;
        bytes memory message = abi.encode(bountyId, recipients, amounts);
        bytes memory options = extraOptions.length == 0
            ? OptionsBuilder.newOptions().addExecutorLzReceiveOption(200_000, 0)
            : extraOptions;

        receipt = _lzSend(
            effectiveEid,
            message,
            options,
            MessagingFee({nativeFee: msg.value, lzTokenFee: 0}),
            payable(msg.sender)
        );

        emit CompletionSent(bountyId, receipt.guid, receipt.nonce, effectiveEid, recipients, amounts);
    }

    /// @dev We are a sender-only OApp on this chain; lzReceive is a no-op for now.
    ///      The reverse direction (Base → 0G bind) wires here in v2.
    function _lzReceive(
        Origin calldata,
        bytes32,
        bytes calldata,
        address,
        bytes calldata
    ) internal virtual override {
        // no-op MVP
    }

    /// @notice Allow contract to hold native OG for paying LZ fees on auto-call paths.
    receive() external payable {}
}
