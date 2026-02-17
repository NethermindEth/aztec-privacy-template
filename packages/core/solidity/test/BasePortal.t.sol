// SPDX-License-Identifier: MIT
pragma solidity ^0.8.33;

import "../BasePortal.sol";

contract BasePortalHarness is BasePortal {
    constructor(
        bytes32 protocolId,
        address l2Contract,
        address relayer
    ) BasePortal(protocolId, l2Contract, relayer) {}

    function sendMessage(bytes32 content, address sender) external returns (bytes32) {
        return _sendL1ToL2Message(content, sender);
    }

    function consumeMessage(
        bytes32 content,
        address sender,
        uint64 nonce
    ) external {
        _consumeL2ToL1Message(content, sender, nonce);
    }

    function messageHashFor(
        bytes32 content,
        address sender,
        uint64 nonce
    ) external view returns (bytes32) {
        return _buildMessageHash(content, sender, nonce);
    }
}

contract UnauthorizedPortalCaller {
    function consume(
        BasePortalHarness portal,
        bytes32 content,
        address sender,
        uint64 nonce
    ) external {
        portal.consumeMessage(content, sender, nonce);
    }
}

contract BasePortalTest {
    function testBasePortalSendGeneratesDeterministicHashesAndMonotonicNonce() external {
        BasePortalHarness portal = new BasePortalHarness(
            bytes32("BASE_PORTAL"),
            address(0xA11CE),
            address(this)
        );

        bytes32 content = keccak256("content-key");
        address sender = address(0xB0B);

        bytes32 first = portal.sendMessage(content, sender);
        bytes32 second = portal.sendMessage(content, sender);
        bytes32 expectedFirst = portal.messageHashFor(content, sender, 1);
        bytes32 expectedSecond = portal.messageHashFor(content, sender, 2);

        assert(portal.messageNonce() == 2);
        assert(first == expectedFirst);
        assert(second == expectedSecond);
        assert(first != second);
        assert(portal.hasMessageBeenIssued(first));
        assert(portal.hasMessageBeenIssued(second));
        assert(!portal.hasMessageBeenConsumed(first));
        assert(!portal.hasMessageBeenConsumed(second));
    }

    function testBasePortalRejectsEmptyRecipientMessageSend() external {
        BasePortalHarness portal = new BasePortalHarness(
            bytes32("BASE_PORTAL"),
            address(0xA11CE),
            address(this)
        );

        bool reverted = false;

        try portal.sendMessage(keccak256("invalid"), address(0)) {
            reverted = false;
        } catch {
            reverted = true;
        }

        assert(reverted);
    }

    function testBasePortalConsumptionFlow() external {
        BasePortalHarness portal = new BasePortalHarness(
            bytes32("BASE_PORTAL"),
            address(0xA11CE),
            address(this)
        );
        UnauthorizedPortalCaller unauthorized = new UnauthorizedPortalCaller();

        bytes32 content = keccak256("consume-key");
        address sender = address(0xF00D);

        bytes32 msgHash = portal.sendMessage(content, sender);
        bytes32 fakeHash = portal.messageHashFor(content, sender, 999);

        bool unauthorizedReverted = false;
        try unauthorized.consume(portal, content, sender, 1) {
            unauthorizedReverted = false;
        } catch {
            unauthorizedReverted = true;
        }
        assert(unauthorizedReverted);

        bool unissuedReverted = false;
        try portal.consumeMessage(content, sender, 2) {
            unissuedReverted = false;
        } catch {
            unissuedReverted = true;
        }
        assert(!portal.hasMessageBeenConsumed(fakeHash));
        assert(unissuedReverted);

        portal.consumeMessage(content, sender, 1);
        assert(portal.hasMessageBeenConsumed(msgHash));

        bool alreadyConsumedReverted = false;
        try portal.consumeMessage(content, sender, 1) {
            alreadyConsumedReverted = false;
        } catch {
            alreadyConsumedReverted = true;
        }

        assert(alreadyConsumedReverted);
    }
}
