// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Clones} from "@openzeppelin/contracts/proxy/Clones.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

import {IBountyFactory} from "./interfaces/IBountyFactory.sol";
import {Bounty} from "./Bounty.sol";

/// @title BountyFactory — minimal proxy factory for Bounty contracts on 0G Galileo
/// @notice Each new research job spawns a fresh Bounty contract via EIP-1167 clone.
/// @dev `relayer` is the trusted off-chain coordinator that binds Base Sepolia
///      USDC payment refs to bounties. v2 will replace with LayerZero/CCIP.
contract BountyFactory is IBountyFactory, Ownable {
    using Clones for address;

    address public immutable bountyImplementation;
    address public immutable agentRegistry;
    address public override relayer;

    uint256 private _nextBountyId = 1;
    mapping(uint256 => address) private _bounties;
    mapping(uint256 => bytes32) private _payments;

    error NotRelayer();
    error AlreadyBound(uint256 bountyId);

    constructor(address bountyImplementation_, address agentRegistry_, address relayer_, address owner_)
        Ownable(owner_)
    {
        require(bountyImplementation_ != address(0) && agentRegistry_ != address(0), "zero addr");
        bountyImplementation = bountyImplementation_;
        agentRegistry = agentRegistry_;
        relayer = relayer_;
    }

    /// @inheritdoc IBountyFactory
    function createBounty(uint256 budget, string calldata goalURI_, bytes32 goalHash_)
        external
        override
        returns (uint256 bountyId, address bountyAddress)
    {
        if (budget == 0) revert InvalidBudget();
        if (bytes(goalURI_).length == 0) revert EmptyGoal();

        bountyId = _nextBountyId++;
        bountyAddress = bountyImplementation.clone();
        _bounties[bountyId] = bountyAddress;

        Bounty(bountyAddress).initialize(msg.sender, budget, goalURI_, goalHash_, agentRegistry);
        emit BountyCreated(bountyAddress, msg.sender, bountyId, budget, goalURI_, goalHash_);
    }

    /// @inheritdoc IBountyFactory
    function bindPayment(uint256 bountyId, bytes32 baseChainPaymentRef) external override {
        if (msg.sender != relayer) revert NotRelayer();
        if (_bounties[bountyId] == address(0)) revert UnknownBounty(bountyId);
        if (_payments[bountyId] != bytes32(0)) revert AlreadyBound(bountyId);
        _payments[bountyId] = baseChainPaymentRef;
        emit PaymentBound(bountyId, baseChainPaymentRef);
    }

    function setRelayer(address newRelayer) external onlyOwner {
        require(newRelayer != address(0), "zero relayer");
        relayer = newRelayer;
    }

    function bountyAddress(uint256 bountyId) external view override returns (address) {
        return _bounties[bountyId];
    }

    function totalBounties() external view override returns (uint256) {
        return _nextBountyId - 1;
    }

    function paymentRef(uint256 bountyId) external view override returns (bytes32) {
        return _payments[bountyId];
    }
}
