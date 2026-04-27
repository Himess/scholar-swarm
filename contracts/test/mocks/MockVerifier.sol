// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {IERC7857DataVerifier} from "../../src/interfaces/IERC7857.sol";

/// @notice Stub verifier that always returns the configured result.
/// @dev Production replacement = TEE oracle (dstack-backed).
contract MockVerifier is IERC7857DataVerifier {
    bool public result = true;

    function setResult(bool r) external {
        result = r;
    }

    function verifyReencryption(uint256, bytes32, bytes32, bytes calldata) external view override returns (bool) {
        return result;
    }
}
