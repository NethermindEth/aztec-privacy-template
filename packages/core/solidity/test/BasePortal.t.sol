// SPDX-License-Identifier: MIT
pragma solidity ^0.8.33;

/* solhint-disable import-path-check */
import {Test} from "forge-std/Test.sol";
import {MockPortal} from "./BasePortalMock.sol";

/// @title BasePortalTest
/// @author aztec-privacy-template
/// @notice Test suite for BasePortal.
contract BasePortalTest is Test {
    MockPortal private portal;

    /// @notice Initializes a test portal.
    function setUp() public {
        portal = new MockPortal(bytes32(uint256(0x1)), address(this), address(this));
    }

    /// @notice Verifies send and consume work and mutate state.
    function testSendAndConsume() public {
        bytes32 content = keccak256(abi.encodePacked("content"));
        bytes32 messageHash = portal.sendMessage(content, address(0x1234));
        assertEq(portal.hasMessageBeenIssued(messageHash), true);

        portal.consume(content, address(0x1234), 1);
        assertEq(portal.hasMessageBeenConsumed(messageHash), true);
    }

    /// @notice Verifies only relayer can consume messages.
    function testOnlyRelayerCanConsume() public {
        bytes32 content = keccak256(abi.encodePacked("content-2"));
        bytes32 messageHash = portal.sendMessage(content, address(0x4321));
        vm.prank(address(0xBEEF));
        vm.expectRevert(BasePortal.UnauthorizedCaller.selector);
        portal.consume(content, address(0x4321), 1);

        assertEq(messageHash, messageHash);
    }
}
