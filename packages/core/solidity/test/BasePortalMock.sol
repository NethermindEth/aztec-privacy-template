// SPDX-License-Identifier: MIT
pragma solidity ^0.8.33;

import {BasePortal} from "../BasePortal.sol";

/// @title MockPortal
/// @author aztec-privacy-template
/// @notice Minimal test portal contract for BasePortal behavior.
contract MockPortal is BasePortal {
    /// @notice Creates a mock portal instance.
    /// @param protocolId_ Protocol identifier.
    /// @param l2Contract_ Bound L2 contract.
    /// @param relayer_ Authorized relayer.
    constructor(bytes32 protocolId_, address l2Contract_, address relayer_)
        BasePortal(protocolId_, l2Contract_, relayer_)
    {}

    /// @notice Send helper for tests.
    /// @param content Message content hash.
    /// @param sender Message sender.
    /// @return messageHash Derived message hash.
    function sendMessage(bytes32 content, address sender) external returns (bytes32) {
        return _sendL1ToL2Message(content, sender);
    }

    /// @notice Consume helper for tests.
    /// @param content Message content hash.
    /// @param sender Message sender.
    /// @param nonce Message nonce.
    function consume(bytes32 content, address sender, uint64 nonce) external {
        _consumeL2ToL1Message(content, sender, nonce);
    }

    /// @notice Deterministic hash helper.
    /// @param content Message content hash.
    /// @param sender Message sender.
    /// @param nonce Message nonce.
    /// @return messageHash Derived message hash.
    function build(bytes32 content, address sender, uint64 nonce) external view returns (bytes32) {
        return _buildMessageHash(content, sender, nonce);
    }
}
