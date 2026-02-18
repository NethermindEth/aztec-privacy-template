// SPDX-License-Identifier: MIT
pragma solidity ^0.8.33;

interface IInboxLike {
    struct L2Actor {
        bytes32 actor;
        uint256 version;
    }

    function sendL2Message(L2Actor memory recipient, bytes32 content, bytes32 secretHash)
        external
        returns (bytes32 messageHash, uint256 index);
}

/// @title L1ToL2TestSender
/// @notice Minimal helper to enqueue test L1->L2 messages from a contract sender.
contract L1ToL2TestSender {
    bytes32 public lastMessageHash;
    uint256 public lastMessageIndex;

    function sendL2Message(
        address inbox,
        bytes32 recipientActor,
        uint256 recipientVersion,
        bytes32 content,
        bytes32 secretHash
    ) external returns (bytes32 messageHash, uint256 index) {
        (messageHash, index) = IInboxLike(inbox)
            .sendL2Message(IInboxLike.L2Actor({actor: recipientActor, version: recipientVersion}), content, secretHash);

        lastMessageHash = messageHash;
        lastMessageIndex = index;
    }
}
