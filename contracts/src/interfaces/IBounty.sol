// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

/// @title Scholar Swarm Bounty
/// @notice Per-job state machine on 0G Chain. Mirrors USDC escrow on Base via off-chain coordinator.
/// @dev One Bounty contract per research job. Created by BountyFactory.
interface IBounty {
    /// @notice Job lifecycle states.
    enum BountyStatus {
        Open,                // Posted, waiting for planner
        Planning,            // Planner accepted, decomposing into sub-tasks
        Bidding,             // Sub-tasks broadcast, researchers bidding
        Researching,         // Sub-tasks awarded, researchers working
        Reviewing,           // Critic reviewing findings
        Synthesizing,        // Synthesizer producing final report
        Completed,           // Final report stored, ready for payout
        Cancelled            // User cancelled or expired
    }

    /// @notice One sub-task within the bounty.
    struct SubTask {
        uint8 index;                     // 0..2 for our 3-task MVP
        string description;              // human-readable sub-goal
        uint256 awardedTo;               // researcher agentId; 0 if not awarded
        uint256 awardedPrice;            // price researcher bid (in bounty token unit)
        bytes32 findingsRoot;            // 0G Storage root of researcher output
        bool criticApproved;             // set true on critic approval
        uint8 retryCount;                // increments on rejection
    }

    struct Bid {
        uint256 agentId;                 // researcher iNFT id
        uint256 price;                   // ask in bounty token units
        uint64 reputationSnapshot;       // count of prior approvals (cached for fairness)
        uint64 submittedAt;
    }

    event BountyOpened(address indexed user, uint256 budget, string goalURI, bytes32 goalHash);
    event PlannerAssigned(uint256 indexed plannerAgentId, address indexed plannerWallet);
    event SubTasksBroadcast(uint8 count);
    event BidPlaced(uint8 indexed subTaskIndex, uint256 indexed agentId, uint256 price);
    event BidAwarded(uint8 indexed subTaskIndex, uint256 indexed agentId, uint256 price);
    event FindingsSubmitted(uint8 indexed subTaskIndex, uint256 indexed agentId, bytes32 findingsRoot);
    event ClaimReviewed(
        uint8 indexed subTaskIndex,
        uint256 indexed criticAgentId,
        bool approved,
        string reasonURI
    );
    event SynthesisComplete(uint256 indexed synthesizerAgentId, bytes32 reportRoot);
    event StatusChanged(BountyStatus indexed newStatus);
    event Cancelled(string reason);
    event SettlementConfigured(
        address indexed messenger,
        uint256 indexed bountyId,
        uint256 plannerFee,
        uint256 criticFee,
        uint256 synthesizerFee
    );
    event PayoutDispatched(
        bytes32 indexed lzGuid,
        uint64 nonce,
        uint256 lzFeePaid,
        address[] recipients,
        uint256[] amounts
    );

    error InvalidStatus(BountyStatus expected, BountyStatus actual);
    error NotPlanner();
    error NotAuthorizedAgent();
    error SubTaskOutOfRange();
    error AlreadyAwarded();
    error AlreadyApproved();
    error SettlementAlreadyConfigured();
    error OnlyFactory();

    function status() external view returns (BountyStatus);

    function user() external view returns (address);

    function budget() external view returns (uint256);

    function goalURI() external view returns (string memory);

    function goalHash() external view returns (bytes32);

    function plannerAgentId() external view returns (uint256);

    function synthesizerAgentId() external view returns (uint256);

    function criticAgentId() external view returns (uint256);

    function subTaskCount() external view returns (uint8);

    function getSubTask(uint8 index) external view returns (SubTask memory);

    function getBids(uint8 subTaskIndex) external view returns (Bid[] memory);

    function finalReportRoot() external view returns (bytes32);

    // ----- Lifecycle (state-transitioning) -----

    function acceptPlanner(uint256 plannerAgentId_) external;

    function broadcastSubTasks(string[] calldata descriptions) external;

    function placeBid(uint8 subTaskIndex, uint256 agentId, uint256 price, uint64 reputationSnapshot) external;

    function awardBid(uint8 subTaskIndex, uint256 agentId) external;

    function submitFindings(uint8 subTaskIndex, uint256 agentId, bytes32 findingsRoot) external;

    function reviewClaim(uint8 subTaskIndex, uint256 criticAgentId, bool approved, string calldata reasonURI) external;

    function submitSynthesis(uint256 synthesizerAgentId, bytes32 reportRoot) external payable;

    function cancel(string calldata reason) external;

    /// @notice One-shot wiring of cross-chain settlement. Callable by factory only.
    /// @dev When configured, `submitSynthesis` will atomically fire a LayerZero V2
    ///      message via the messenger to the Base counterpart on completion.
    function configureSettlement(
        address messenger,
        uint256 bountyId,
        uint256 plannerFee,
        uint256 criticFee,
        uint256 synthesizerFee
    ) external;

    function bountyMessenger() external view returns (address);

    function bountyId() external view returns (uint256);

    function plannerFee() external view returns (uint256);

    function criticFee() external view returns (uint256);

    function synthesizerFee() external view returns (uint256);

    /// @notice Compute the settlement payout vector from on-chain state.
    ///         Returns the same recipients/amounts the messenger will broadcast.
    function previewPayouts() external view returns (address[] memory recipients, uint256[] memory amounts);
}
