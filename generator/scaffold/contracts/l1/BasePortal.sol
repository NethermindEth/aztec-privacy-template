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
    /// @notice bound L2 portal contract identifier (Aztec contract address bytes32).
    bytes32 public L2_CONTRACT;
    /// @notice authorized relayer address.
    address public immutable RELAYER;
    /// @notice one-time configuration admin for deferred L2 binding.
    address public immutable CONFIG_ADMIN;
    /// @notice monotonic message nonce.
    uint64 public messageNonce;

    mapping(bytes32 => bool) private consumedMessages;
    mapping(bytes32 => bool) private issuedMessages;

    error EmptyRecipient();
    error InvalidL2Contract();
    error InvalidRelayer();
    error L2ContractAlreadyConfigured();
    error L2ContractNotConfigured();
    error MessageAlreadyIssued();
    error MessageAlreadyConsumed();
    error MessageNotIssued();
    error UnauthorizedConfigAdmin();
    error UnauthorizedCaller();

    event L2ContractConfigured(bytes32 indexed l2Contract);

    /// @notice Initializes the portal with immutable protocol metadata.
    /// @param protocolId_ protocol identifier used for hashing messages.
    /// @param l2Contract_ bound L2 contract identifier (`bytes32` Aztec address for this flow).
    /// `bytes32(0)` is allowed for deferred one-time initialization via `setL2Contract`.
    /// @param relayer_ authorized relayer/service address.
    /// @dev Value source guidance is documented in scaffold docs/DEPLOYMENT.md.
    constructor(bytes32 protocolId_, bytes32 l2Contract_, address relayer_) {
        if (relayer_ == address(0)) {
            revert InvalidRelayer();
        }

        PROTOCOL_ID = protocolId_;
        RELAYER = relayer_;
        CONFIG_ADMIN = msg.sender;
        messageNonce = 0;

        if (l2Contract_ != bytes32(0)) {
            L2_CONTRACT = l2Contract_;
            emit L2ContractConfigured(l2Contract_);
        }
    }

    modifier onlyRelayer() {
        _onlyRelayer();
        _;
    }

    /// @notice Sends an L1-to-L2 message and returns the derived message hash.
    /// @param content Message body hash.
    /// @param sender Message sender address.
    /// @return messageHash Derived message hash.
    function _sendL1ToL2Message(bytes32 content, address sender) internal returns (bytes32 messageHash) {
        _assertL2ContractConfigured();

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
        _assertL2ContractConfigured();
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
        _assertL2ContractConfigured();
        // forge-lint: disable-next-line(asm-keccak256)
        return keccak256(abi.encodePacked(PROTOCOL_ID, L2_CONTRACT, content, sender, nonce));
    }

    function _onlyRelayer() private view {
        if (msg.sender != RELAYER) {
            revert UnauthorizedCaller();
        }
    }

    function _assertL2ContractConfigured() private view {
        if (L2_CONTRACT == bytes32(0)) {
            revert L2ContractNotConfigured();
        }
    }

    /// @notice Configures the L2 contract binding exactly once.
    /// @param l2Contract_ Aztec contract address (`bytes32`) bound to this portal.
    function setL2Contract(bytes32 l2Contract_) external {
        if (msg.sender != CONFIG_ADMIN) {
            revert UnauthorizedConfigAdmin();
        }
        if (l2Contract_ == bytes32(0)) {
            revert InvalidL2Contract();
        }
        if (L2_CONTRACT != bytes32(0)) {
            revert L2ContractAlreadyConfigured();
        }
        if (messageNonce != 0) {
            revert MessageAlreadyIssued();
        }

        L2_CONTRACT = l2Contract_;
        emit L2ContractConfigured(l2Contract_);
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
