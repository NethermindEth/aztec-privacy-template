// SPDX-License-Identifier: MIT
pragma solidity ^0.8.33;

abstract contract BasePortal {
    event L1ToL2Message(bytes32 indexed messageHash, bytes32 indexed content, address indexed sender);
    event L2ToL1MessageConsumed(bytes32 indexed messageHash, bytes32 indexed content, address indexed caller);

    bytes32 public immutable protocolId;
    address public immutable l2Contract;
    address public immutable relayer;
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

    modifier onlyRelayer() {
        if (msg.sender != relayer) {
            revert UnauthorizedCaller();
        }
        _;
    }

    constructor(bytes32 protocolId_, address l2Contract_, address relayer_) {
        if (l2Contract_ == address(0)) {
            revert InvalidL2Contract();
        }

        if (relayer_ == address(0)) {
            revert InvalidRelayer();
        }

        protocolId = protocolId_;
        l2Contract = l2Contract_;
        relayer = relayer_;
        messageNonce = 0;
    }

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

    function _buildMessageHash(bytes32 content, address sender, uint64 nonce) internal view returns (bytes32) {
        return keccak256(abi.encodePacked(protocolId, l2Contract, content, sender, nonce));
    }

    function hasMessageBeenIssued(bytes32 messageHash) external view returns (bool) {
        return issuedMessages[messageHash];
    }

    function hasMessageBeenConsumed(bytes32 messageHash) external view returns (bool) {
        return consumedMessages[messageHash];
    }
}
