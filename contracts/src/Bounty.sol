// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {Initializable} from "@openzeppelin/contracts/proxy/utils/Initializable.sol";

import {IBounty} from "./interfaces/IBounty.sol";

/// @title Bounty — single research-job state machine (0G Galileo)
/// @notice Tracks one bounty's lifecycle from open → completed. Mirrors USDC escrow on
///         Base Sepolia (PaymentRouter). State transitions are authorized by:
///         - The user (owner of the bounty) — for cancel
///         - The planner agent's wallet — for sub-task broadcast / bid award / synthesis
///         - Any agent's wallet bound to a registered agentId — for placing bids
///         - The factory — for setup
/// @dev Initializer pattern so this can be deployed via clone factory.
contract Bounty is IBounty, Initializable {
    /// @dev Constants for our 3-task MVP.
    uint8 public constant SUB_TASK_COUNT = 3;
    uint8 public constant MAX_RETRIES = 1;

    address public override user;
    uint256 public override budget;
    string private _goalURI;
    bytes32 public override goalHash;

    BountyStatus private _status;
    uint256 public override plannerAgentId;
    uint256 public override criticAgentId;
    uint256 public override synthesizerAgentId;
    bytes32 public override finalReportRoot;

    /// @dev Reference to the AgentNFT contract on the same chain (0G).
    IERC721 public agentRegistry;
    /// @dev BountyFactory address — only it can call init.
    address public factory;

    /// @dev Sub-task storage indexed 0..SUB_TASK_COUNT-1.
    mapping(uint8 => SubTask) private _subTasks;
    /// @dev Bids per sub-task index.
    mapping(uint8 => Bid[]) private _bids;

    function initialize(
        address user_,
        uint256 budget_,
        string calldata goalURI_,
        bytes32 goalHash_,
        address agentRegistry_
    ) external initializer {
        require(user_ != address(0) && agentRegistry_ != address(0), "zero addr");
        user = user_;
        budget = budget_;
        _goalURI = goalURI_;
        goalHash = goalHash_;
        agentRegistry = IERC721(agentRegistry_);
        factory = msg.sender;
        _status = BountyStatus.Open;
        emit BountyOpened(user_, budget_, goalURI_, goalHash_);
    }

    // ---------- view ----------

    function status() external view override returns (BountyStatus) {
        return _status;
    }

    function goalURI() external view override returns (string memory) {
        return _goalURI;
    }

    function subTaskCount() external pure override returns (uint8) {
        return SUB_TASK_COUNT;
    }

    function getSubTask(uint8 index) external view override returns (SubTask memory) {
        if (index >= SUB_TASK_COUNT) revert SubTaskOutOfRange();
        return _subTasks[index];
    }

    function getBids(uint8 subTaskIndex) external view override returns (Bid[] memory) {
        if (subTaskIndex >= SUB_TASK_COUNT) revert SubTaskOutOfRange();
        return _bids[subTaskIndex];
    }

    // ---------- lifecycle ----------

    /// @notice User accepts a Planner agent (by token id). Transitions Open → Planning.
    function acceptPlanner(uint256 plannerAgentId_) external override {
        if (_status != BountyStatus.Open) revert InvalidStatus(BountyStatus.Open, _status);
        if (msg.sender != user) revert NotPlanner();
        if (agentRegistry.ownerOf(plannerAgentId_) == address(0)) revert NotAuthorizedAgent();

        plannerAgentId = plannerAgentId_;
        _status = BountyStatus.Planning;
        emit PlannerAssigned(plannerAgentId_, agentRegistry.ownerOf(plannerAgentId_));
        emit StatusChanged(BountyStatus.Planning);
    }

    /// @notice Planner publishes the 3 sub-task descriptions. Planning → Bidding.
    function broadcastSubTasks(string[] calldata descriptions) external override {
        if (_status != BountyStatus.Planning) revert InvalidStatus(BountyStatus.Planning, _status);
        if (msg.sender != agentRegistry.ownerOf(plannerAgentId)) revert NotPlanner();
        if (descriptions.length != SUB_TASK_COUNT) revert SubTaskOutOfRange();

        for (uint8 i = 0; i < SUB_TASK_COUNT; ++i) {
            _subTasks[i] = SubTask({
                index: i,
                description: descriptions[i],
                awardedTo: 0,
                awardedPrice: 0,
                findingsRoot: bytes32(0),
                criticApproved: false,
                retryCount: 0
            });
        }
        _status = BountyStatus.Bidding;
        emit SubTasksBroadcast(SUB_TASK_COUNT);
        emit StatusChanged(BountyStatus.Bidding);
    }

    /// @notice Researcher places a bid for `subTaskIndex`. Caller must own `agentId`.
    function placeBid(uint8 subTaskIndex, uint256 agentId, uint256 price, uint64 reputationSnapshot)
        external
        override
    {
        if (_status != BountyStatus.Bidding && _status != BountyStatus.Researching) {
            revert InvalidStatus(BountyStatus.Bidding, _status);
        }
        if (subTaskIndex >= SUB_TASK_COUNT) revert SubTaskOutOfRange();
        if (msg.sender != agentRegistry.ownerOf(agentId)) revert NotAuthorizedAgent();
        if (_subTasks[subTaskIndex].awardedTo != 0) revert AlreadyAwarded();

        _bids[subTaskIndex].push(
            Bid({agentId: agentId, price: price, reputationSnapshot: reputationSnapshot, submittedAt: uint64(block.timestamp)})
        );
        emit BidPlaced(subTaskIndex, agentId, price);
    }

    /// @notice Planner awards a bid. Picks any agentId that has a bid for this sub-task.
    function awardBid(uint8 subTaskIndex, uint256 agentId) external override {
        if (_status != BountyStatus.Bidding) revert InvalidStatus(BountyStatus.Bidding, _status);
        if (subTaskIndex >= SUB_TASK_COUNT) revert SubTaskOutOfRange();
        if (msg.sender != agentRegistry.ownerOf(plannerAgentId)) revert NotPlanner();
        if (_subTasks[subTaskIndex].awardedTo != 0) revert AlreadyAwarded();

        Bid[] storage bids = _bids[subTaskIndex];
        uint256 price = 0;
        bool found = false;
        for (uint256 i = 0; i < bids.length; ++i) {
            if (bids[i].agentId == agentId) {
                price = bids[i].price;
                found = true;
                break;
            }
        }
        if (!found) revert NotAuthorizedAgent();

        _subTasks[subTaskIndex].awardedTo = agentId;
        _subTasks[subTaskIndex].awardedPrice = price;
        emit BidAwarded(subTaskIndex, agentId, price);

        if (_allAwarded()) {
            _status = BountyStatus.Researching;
            emit StatusChanged(BountyStatus.Researching);
        }
    }

    /// @notice Awarded researcher submits findings (0G Storage root). Researching → Reviewing on first one.
    function submitFindings(uint8 subTaskIndex, uint256 agentId, bytes32 findingsRoot) external override {
        if (_status != BountyStatus.Researching && _status != BountyStatus.Reviewing) {
            revert InvalidStatus(BountyStatus.Researching, _status);
        }
        if (subTaskIndex >= SUB_TASK_COUNT) revert SubTaskOutOfRange();
        if (_subTasks[subTaskIndex].awardedTo != agentId) revert NotAuthorizedAgent();
        if (msg.sender != agentRegistry.ownerOf(agentId)) revert NotAuthorizedAgent();
        if (findingsRoot == bytes32(0)) revert NotAuthorizedAgent();

        _subTasks[subTaskIndex].findingsRoot = findingsRoot;
        emit FindingsSubmitted(subTaskIndex, agentId, findingsRoot);

        if (_status == BountyStatus.Researching) {
            _status = BountyStatus.Reviewing;
            emit StatusChanged(BountyStatus.Reviewing);
        }
    }

    /// @notice Critic approves or rejects a sub-task's findings.
    function reviewClaim(uint8 subTaskIndex, uint256 criticAgentId_, bool approved, string calldata reasonURI)
        external
        override
    {
        if (_status != BountyStatus.Reviewing) revert InvalidStatus(BountyStatus.Reviewing, _status);
        if (subTaskIndex >= SUB_TASK_COUNT) revert SubTaskOutOfRange();
        if (criticAgentId != 0 && criticAgentId != criticAgentId_) revert NotAuthorizedAgent();
        if (msg.sender != agentRegistry.ownerOf(criticAgentId_)) revert NotAuthorizedAgent();

        SubTask storage st = _subTasks[subTaskIndex];
        if (st.criticApproved) revert AlreadyApproved();
        if (st.findingsRoot == bytes32(0)) revert SubTaskOutOfRange();

        if (criticAgentId == 0) criticAgentId = criticAgentId_;

        if (approved) {
            st.criticApproved = true;
        } else {
            // Reset findings to allow retry.
            st.findingsRoot = bytes32(0);
            if (st.retryCount >= MAX_RETRIES) {
                // Forfeit — retry limit hit. Sub-task awardedTo keeps record for audit.
                // For MVP we don't redistribute; researcher just doesn't get paid for this one.
                st.criticApproved = true; // fail-closed: synthesizer skips this sub-task input
            } else {
                st.retryCount += 1;
                _status = BountyStatus.Researching;
                emit StatusChanged(BountyStatus.Researching);
            }
        }

        emit ClaimReviewed(subTaskIndex, criticAgentId_, approved, reasonURI);

        if (_allReviewed()) {
            _status = BountyStatus.Synthesizing;
            emit StatusChanged(BountyStatus.Synthesizing);
        }
    }

    /// @notice Synthesizer commits the final report root. Synthesizing → Completed.
    function submitSynthesis(uint256 synthesizerAgentId_, bytes32 reportRoot) external override {
        if (_status != BountyStatus.Synthesizing) revert InvalidStatus(BountyStatus.Synthesizing, _status);
        if (msg.sender != agentRegistry.ownerOf(synthesizerAgentId_)) revert NotAuthorizedAgent();
        if (reportRoot == bytes32(0)) revert NotAuthorizedAgent();

        synthesizerAgentId = synthesizerAgentId_;
        finalReportRoot = reportRoot;
        _status = BountyStatus.Completed;
        emit SynthesisComplete(synthesizerAgentId_, reportRoot);
        emit StatusChanged(BountyStatus.Completed);
    }

    /// @notice User cancels — only allowed before completion.
    function cancel(string calldata reason) external override {
        if (msg.sender != user) revert NotPlanner();
        if (_status == BountyStatus.Completed || _status == BountyStatus.Cancelled) {
            revert InvalidStatus(BountyStatus.Open, _status);
        }
        _status = BountyStatus.Cancelled;
        emit Cancelled(reason);
        emit StatusChanged(BountyStatus.Cancelled);
    }

    // ---------- internal ----------

    function _allAwarded() internal view returns (bool) {
        for (uint8 i = 0; i < SUB_TASK_COUNT; ++i) {
            if (_subTasks[i].awardedTo == 0) return false;
        }
        return true;
    }

    function _allReviewed() internal view returns (bool) {
        for (uint8 i = 0; i < SUB_TASK_COUNT; ++i) {
            if (!_subTasks[i].criticApproved) return false;
        }
        return true;
    }
}
