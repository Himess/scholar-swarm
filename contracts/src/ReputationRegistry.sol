// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {IReputationRegistry} from "./interfaces/IERC8004.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";

/// @title ReputationRegistry — ERC-8004 standard implementation
/// @notice Bounded feedback scores per agentId, with off-chain detail URIs and integrity hashes.
/// @dev Each (agentId, clientAddress) pair has an append-only `feedbacks` array.
///      Revocation flips a flag on a feedback entry. Responses are appended by any address.
///      Reference: github.com/erc-8004/erc-8004-contracts
contract ReputationRegistry is IReputationRegistry {
    struct Feedback {
        int128 value;
        uint8 valueDecimals;
        string tag1;
        string tag2;
        string endpoint;
        string feedbackURI;
        bytes32 feedbackHash;
        bool isRevoked;
    }

    struct Response {
        address responder;
        string responseURI;
        bytes32 responseHash;
    }

    address private _identityRegistry;
    bool private _initialized;

    /// @dev (agentId, client) → feedback list
    mapping(uint256 => mapping(address => Feedback[])) private _feedbacks;

    /// @dev (agentId, client, feedbackIndex) → response list
    mapping(uint256 => mapping(address => mapping(uint64 => Response[]))) private _responses;

    /// @dev Tracks distinct clients who have ever given feedback for an agent.
    mapping(uint256 => address[]) private _clientsByAgent;
    mapping(uint256 => mapping(address => bool)) private _hasFeedback;

    error AlreadyInitialized();
    error NotInitialized();

    function initialize(address identityRegistry_) external override {
        if (_initialized) revert AlreadyInitialized();
        if (identityRegistry_ == address(0)) revert InvalidAgentId();
        _identityRegistry = identityRegistry_;
        _initialized = true;
    }

    function getIdentityRegistry() external view override returns (address) {
        return _identityRegistry;
    }

    function giveFeedback(
        uint256 agentId,
        int128 value,
        uint8 valueDecimals,
        string calldata tag1,
        string calldata tag2,
        string calldata endpoint,
        string calldata feedbackURI,
        bytes32 feedbackHash
    ) external override {
        _validateAgent(agentId);

        Feedback[] storage list = _feedbacks[agentId][msg.sender];
        uint64 index = uint64(list.length);

        list.push(
            Feedback({
                value: value,
                valueDecimals: valueDecimals,
                tag1: tag1,
                tag2: tag2,
                endpoint: endpoint,
                feedbackURI: feedbackURI,
                feedbackHash: feedbackHash,
                isRevoked: false
            })
        );

        if (!_hasFeedback[agentId][msg.sender]) {
            _hasFeedback[agentId][msg.sender] = true;
            _clientsByAgent[agentId].push(msg.sender);
        }

        emit NewFeedback(
            agentId,
            msg.sender,
            index,
            value,
            valueDecimals,
            tag1,
            tag1,
            tag2,
            endpoint,
            feedbackURI,
            feedbackHash
        );
    }

    function revokeFeedback(uint256 agentId, uint64 feedbackIndex) external override {
        Feedback[] storage list = _feedbacks[agentId][msg.sender];
        if (feedbackIndex >= list.length) revert FeedbackNotFound();
        if (list[feedbackIndex].isRevoked) revert AlreadyRevoked();

        list[feedbackIndex].isRevoked = true;
        emit FeedbackRevoked(agentId, msg.sender, feedbackIndex);
    }

    function appendResponse(
        uint256 agentId,
        address clientAddress,
        uint64 feedbackIndex,
        string calldata responseURI,
        bytes32 responseHash
    ) external override {
        Feedback[] storage list = _feedbacks[agentId][clientAddress];
        if (feedbackIndex >= list.length) revert FeedbackNotFound();

        _responses[agentId][clientAddress][feedbackIndex].push(
            Response({responder: msg.sender, responseURI: responseURI, responseHash: responseHash})
        );

        emit ResponseAppended(agentId, clientAddress, feedbackIndex, msg.sender, responseURI, responseHash);
    }

    /// @notice Aggregate feedback values across optional client/tag filters.
    /// @dev Filtering: empty `clientAddresses` = all clients. Empty tag = no filter.
    ///      Output decimals = max(individual feedback decimals).
    function getSummary(uint256 agentId, address[] calldata clientAddresses, string calldata tag1, string calldata tag2)
        external
        view
        override
        returns (uint64 count, int128 summaryValue, uint8 summaryValueDecimals)
    {
        address[] memory clients;
        if (clientAddresses.length == 0) {
            clients = _clientsByAgent[agentId];
        } else {
            clients = new address[](clientAddresses.length);
            for (uint256 i = 0; i < clientAddresses.length; ++i) clients[i] = clientAddresses[i];
        }

        // First pass: find max decimals among matching feedbacks.
        uint8 maxDec = 0;
        for (uint256 i = 0; i < clients.length; ++i) {
            Feedback[] storage list = _feedbacks[agentId][clients[i]];
            for (uint256 j = 0; j < list.length; ++j) {
                if (!_matches(list[j], tag1, tag2)) continue;
                if (list[j].valueDecimals > maxDec) maxDec = list[j].valueDecimals;
            }
        }

        // Second pass: scale + sum.
        int256 total = 0;
        uint64 c = 0;
        for (uint256 i = 0; i < clients.length; ++i) {
            Feedback[] storage list = _feedbacks[agentId][clients[i]];
            for (uint256 j = 0; j < list.length; ++j) {
                Feedback storage f = list[j];
                if (!_matches(f, tag1, tag2)) continue;
                int256 scaled = int256(f.value) * int256(10 ** uint256(maxDec - f.valueDecimals));
                total += scaled;
                c++;
            }
        }

        summaryValue = c == 0 ? int128(0) : int128(total / int256(uint256(c)));
        return (c, summaryValue, maxDec);
    }

    function readFeedback(uint256 agentId, address clientAddress, uint64 feedbackIndex)
        external
        view
        override
        returns (int128 value, uint8 valueDecimals, string memory tag1, string memory tag2, bool isRevoked)
    {
        Feedback[] storage list = _feedbacks[agentId][clientAddress];
        if (feedbackIndex >= list.length) revert FeedbackNotFound();
        Feedback storage f = list[feedbackIndex];
        return (f.value, f.valueDecimals, f.tag1, f.tag2, f.isRevoked);
    }

    function readAllFeedback(
        uint256 agentId,
        address[] calldata clientAddresses,
        string calldata tag1,
        string calldata tag2,
        bool includeRevoked
    )
        external
        view
        override
        returns (
            address[] memory clients,
            uint64[] memory feedbackIndexes,
            int128[] memory values,
            uint8[] memory valueDecimals,
            string[] memory tag1s,
            string[] memory tag2s,
            bool[] memory revokedStatuses
        )
    {
        address[] memory candidates;
        if (clientAddresses.length == 0) {
            candidates = _clientsByAgent[agentId];
        } else {
            candidates = new address[](clientAddresses.length);
            for (uint256 i = 0; i < clientAddresses.length; ++i) candidates[i] = clientAddresses[i];
        }

        // First pass: count.
        uint256 total = 0;
        for (uint256 i = 0; i < candidates.length; ++i) {
            Feedback[] storage list = _feedbacks[agentId][candidates[i]];
            for (uint256 j = 0; j < list.length; ++j) {
                if (!includeRevoked && list[j].isRevoked) continue;
                if (!_matches(list[j], tag1, tag2)) continue;
                total++;
            }
        }

        clients = new address[](total);
        feedbackIndexes = new uint64[](total);
        values = new int128[](total);
        valueDecimals = new uint8[](total);
        tag1s = new string[](total);
        tag2s = new string[](total);
        revokedStatuses = new bool[](total);

        uint256 k = 0;
        for (uint256 i = 0; i < candidates.length; ++i) {
            Feedback[] storage list = _feedbacks[agentId][candidates[i]];
            for (uint256 j = 0; j < list.length; ++j) {
                Feedback storage f = list[j];
                if (!includeRevoked && f.isRevoked) continue;
                if (!_matches(f, tag1, tag2)) continue;
                clients[k] = candidates[i];
                feedbackIndexes[k] = uint64(j);
                values[k] = f.value;
                valueDecimals[k] = f.valueDecimals;
                tag1s[k] = f.tag1;
                tag2s[k] = f.tag2;
                revokedStatuses[k] = f.isRevoked;
                k++;
            }
        }
    }

    function getResponseCount(
        uint256 agentId,
        address clientAddress,
        uint64 feedbackIndex,
        address[] calldata responders
    ) external view override returns (uint64 count) {
        Response[] storage list = _responses[agentId][clientAddress][feedbackIndex];
        if (responders.length == 0) {
            return uint64(list.length);
        }
        for (uint256 i = 0; i < list.length; ++i) {
            for (uint256 j = 0; j < responders.length; ++j) {
                if (list[i].responder == responders[j]) {
                    count++;
                    break;
                }
            }
        }
    }

    function getClients(uint256 agentId) external view override returns (address[] memory) {
        return _clientsByAgent[agentId];
    }

    function getLastIndex(uint256 agentId, address clientAddress) external view override returns (uint64) {
        uint256 len = _feedbacks[agentId][clientAddress].length;
        return len == 0 ? type(uint64).max : uint64(len - 1);
    }

    // ---------- internal ----------

    function _validateAgent(uint256 agentId) internal view {
        if (!_initialized) revert NotInitialized();
        // ERC-721 ownerOf reverts if token doesn't exist — that's our existence check.
        // Wrapped in a try to fold any revert into our consistent error.
        try IERC721(_identityRegistry).ownerOf(agentId) returns (address owner) {
            if (owner == address(0)) revert InvalidAgentId();
        } catch {
            revert InvalidAgentId();
        }
    }

    function _matches(Feedback storage f, string calldata tag1, string calldata tag2) internal view returns (bool) {
        if (bytes(tag1).length != 0 && keccak256(bytes(f.tag1)) != keccak256(bytes(tag1))) return false;
        if (bytes(tag2).length != 0 && keccak256(bytes(f.tag2)) != keccak256(bytes(tag2))) return false;
        return true;
    }
}
