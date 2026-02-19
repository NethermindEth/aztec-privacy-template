// SPDX-License-Identifier: MIT
pragma solidity ^0.8.33;

/// @title BasePortal
/// @author aztec-privacy-template
/// @notice Base contract for protocol portal message bookkeeping.
/// @dev This contract defines deterministic message hashes + local tracking only.
/// Canonical Aztec Inbox/Outbox proof transport is handled by external relayer/integration code.
abstract contract BasePortal {
    /// @notice Emitted when an L1 message is sent to L2.
    /// @param messageHash Hash of the sent payload.
    /// @param content Message content.
    /// @param sender Original sender address.
    event L1ToL2Message(bytes32 indexed messageHash, bytes32 indexed content, address indexed sender);
    /// @notice Emitted when an L2 message is consumed on L1.
    /// @param messageHash Hash of the consumed payload.
    /// @param content Message content.
    /// @param caller Address that consumed the message.
    event L2ToL1MessageConsumed(bytes32 indexed messageHash, bytes32 indexed content, address indexed caller);

    /// @notice protocol identifier used in message derivation.
    bytes32 public immutable PROTOCOL_ID;
    /// @notice bound L2 portal contract address.
    address public immutable L2_CONTRACT;
    /// @notice authorized relayer address.
    address public immutable RELAYER;
    /// @notice monotonic message nonce.
    uint64 public messageNonce;

    mapping(bytes32 => bool) private consumedMessages;
    mapping(bytes32 => bool) private issuedMessages;

    error EmptyRecipient();
    error InvalidL2Contract();
    error InvalidRelayer();
    error MessageAlreadyIssued();
    error MessageAlreadyConsumed();
    error MessageNotIssued();
    error UnauthorizedCaller();

    /// @notice Initializes the portal with immutable protocol metadata.
    /// @param protocolId_ protocol identifier used for hashing messages.
    /// @param l2Contract_ bound L2 contract address.
    /// @param relayer_ authorized relayer address.
    constructor(bytes32 protocolId_, address l2Contract_, address relayer_) {
        if (l2Contract_ == address(0)) {
            revert InvalidL2Contract();
        }

        if (relayer_ == address(0)) {
            revert InvalidRelayer();
        }

        PROTOCOL_ID = protocolId_;
        L2_CONTRACT = l2Contract_;
        RELAYER = relayer_;
        messageNonce = 0;
    }

    modifier onlyRelayer() {
        if (msg.sender != RELAYER) {
            revert UnauthorizedCaller();
        }
        _;
    }

    /// @notice Sends an L1-to-L2 message and returns the derived message hash.
    /// @param content Message body hash.
    /// @param sender Message sender address.
    /// @return messageHash Derived message hash.
    function _sendL1ToL2Message(bytes32 content, address sender) internal returns (bytes32 messageHash) {
        if (sender == address(0)) {
            revert EmptyRecipient();
        }

        messageHash = _buildMessageHash(content, sender, ++messageNonce);

        if (issuedMessages[messageHash]) {
            revert MessageAlreadyIssued();
        }

        issuedMessages[messageHash] = true;
        emit L1ToL2Message(messageHash, content, sender);
    }

    function _consumeL2ToL1Message(bytes32 content, address sender, uint64 nonce) internal onlyRelayer {
        bytes32 messageHash = _buildMessageHash(content, sender, nonce);

        if (!issuedMessages[messageHash]) {
            revert MessageNotIssued();
        }

        if (consumedMessages[messageHash]) {
            revert MessageAlreadyConsumed();
        }

        consumedMessages[messageHash] = true;
        emit L2ToL1MessageConsumed(messageHash, content, msg.sender);
    }

    /// @notice Builds a deterministic message hash.
    /// @param content Message body hash.
    /// @param sender Message sender.
    /// @param nonce Monotonic nonce.
    /// @return Hashed message payload.
    function _buildMessageHash(bytes32 content, address sender, uint64 nonce) internal view returns (bytes32) {
        return keccak256(abi.encodePacked(PROTOCOL_ID, L2_CONTRACT, content, sender, nonce));
    }

    /// @notice Checks if a message hash was already issued.
    /// @param messageHash Message hash.
    /// @return Whether the message has been issued.
    function hasMessageBeenIssued(bytes32 messageHash) external view returns (bool) {
        return issuedMessages[messageHash];
    }

    /// @notice Checks if a message hash was already consumed.
    /// @param messageHash Message hash.
    /// @return Whether the message has been consumed.
    function hasMessageBeenConsumed(bytes32 messageHash) external view returns (bool) {
        return consumedMessages[messageHash];
    }
}
