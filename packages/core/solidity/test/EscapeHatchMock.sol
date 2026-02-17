// SPDX-License-Identifier: MIT
pragma solidity ^0.8.33;

import {EscapeHatch} from "../EscapeHatch.sol";

/// @title MockEscape
/// @author aztec-privacy-template
/// @notice Mock contract exposing EscapeHatch internals for tests.
contract MockEscape is EscapeHatch {
    /// @notice Registers an escape request in tests.
    /// @param messageHash Message hash key.
    /// @param depositor Depositor address.
    /// @param token Token or zero for native value.
    /// @param amount Escape amount.
    /// @param timeoutBlocks Timeout blocks.
    function register(
        bytes32 messageHash,
        address depositor,
        address token,
        uint256 amount,
        uint64 timeoutBlocks
    ) external {
        _registerEscape(messageHash, depositor, token, amount, timeoutBlocks);
    }

    /// @notice Cancels an escape request in tests.
    /// @param messageHash Message hash key.
    function cancel(bytes32 messageHash) external {
        _cancelEscape(messageHash);
    }
}
