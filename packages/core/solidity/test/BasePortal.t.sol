// SPDX-License-Identifier: MIT
pragma solidity ^0.8.33;

import "forge-std/Test.sol";

import "../BasePortal.sol";

contract MockPortal is BasePortal {
    constructor(bytes32 protocolId_, address l2Contract_, address relayer_)
        BasePortal(protocolId_, l2Contract_, relayer_)
    {}

    function send(bytes32 content, address sender) external returns (bytes32) {
        return _sendL1ToL2Message(content, sender);
    }

    function consume(bytes32 content, address sender, uint64 nonce) external {
        _consumeL2ToL1Message(content, sender, nonce);
    }

    function build(bytes32 content, address sender, uint64 nonce) external view returns (bytes32) {
        return _buildMessageHash(content, sender, nonce);
    }
}

contract BasePortalTest is Test {
    MockPortal private portal;

    function setUp() public {
        portal = new MockPortal(bytes32(uint256(0x1)), address(this), address(this));
    }

    function testSendAndConsume() public {
        bytes32 content = keccak256('content');
        bytes32 messageHash = portal.send(content, address(0x1234));
        assertEq(portal.hasMessageBeenIssued(messageHash), true);

        portal.consume(content, address(0x1234), 1);
        assertEq(portal.hasMessageBeenConsumed(messageHash), true);
    }
}
