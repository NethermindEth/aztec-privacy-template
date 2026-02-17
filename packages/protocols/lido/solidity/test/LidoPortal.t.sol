/* solhint-disable no-empty-blocks, max-line-length */
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.33;

/* solhint-disable import-path-check */
import {Test} from "forge-std/Test.sol";
import {LidoPortal} from "../LidoPortal.sol";
import {LidoPortalTestHarness} from "../LidoPortalMock.sol";
import {MockLidoProtocol} from "../MockLidoProtocol.sol";

/// @title LidoPortalTest
/// @author aztec-privacy-template
/// @notice Unit tests for Lido portal stake/unstake request/execute paths.
contract LidoPortalTest is Test {
    LidoPortalTestHarness private portal;
    MockLidoProtocol private protocol;
    address private relayer;
    address private user;
    address private stakeRecipient;

    /// @notice Initializes core test dependencies.
    function setUp() public {
        relayer = address(1);
        user = address(2);
        stakeRecipient = address(0xBEEF);

        protocol = new MockLidoProtocol();
        portal = new LidoPortalTestHarness(bytes32(uint256(1)), address(this), relayer, address(protocol));
    }

    /// @notice validates that a stake request can execute successfully.
    function testStakeFlowCompletes() public {
        bytes32 content = keccak256(abi.encodePacked("stake", user));
        vm.deal(relayer, 1 ether);
        vm.prank(user);
        bytes32 requestHash = portal.requestStake(content, 1 ether, stakeRecipient, address(0));
        assertEq(portal.hasMessageBeenIssued(requestHash), true);

        vm.prank(relayer);
        portal.executeStake{value: 1 ether}(content, user, 1 ether, stakeRecipient, address(0), 1, 0);

        assertEq(protocol.lastAmount(), 1 ether);
        assertEq(protocol.lastStakeRecipient(), stakeRecipient);
        assertEq(protocol.lastReferral(), address(0));
        assertEq(portal.hasMessageBeenConsumed(requestHash), true);
    }

    /// @notice validates that an unstake request can execute successfully.
    function testUnstakeFlowCompletes() public {
        protocol.setSimulatedUnstakeReturn(2 ether);
        bytes32 content = keccak256(abi.encodePacked("unstake", user));
        vm.prank(user);
        bytes32 requestHash = portal.requestUnstake(content, 2 ether, stakeRecipient);
        assertEq(portal.hasMessageBeenIssued(requestHash), true);

        vm.prank(relayer);
        portal.executeUnstake(content, user, 2 ether, stakeRecipient, 1, 0);

        assertEq(protocol.lastAmount(), 2 ether);
        assertEq(protocol.lastUnstakeOwner(), user);
        assertEq(protocol.lastUnstakeRecipient(), stakeRecipient);
        assertEq(portal.hasMessageBeenConsumed(requestHash), true);
    }

    /// @notice enforces relayer-only execution for execute entrypoints.
    function testOnlyRelayerCanExecute() public {
        bytes32 content = keccak256(abi.encodePacked("stake", user));
        vm.prank(user);
        portal.requestStake(content, 1 ether, stakeRecipient, address(0));

        vm.expectRevert(LidoPortal.UnauthorizedCaller.selector);
        portal.executeStake(content, user, 1 ether, stakeRecipient, address(0), 1, 0);
    }

    /// @notice prevents relayer tampering with parameters in execute payload.
    function testExecuteRevertsOnRequestMismatch() public {
        bytes32 content = keccak256(abi.encodePacked("stake-mismatch", user));
        vm.prank(user);
        portal.requestStake(content, 1 ether, stakeRecipient, address(0));

        vm.deal(relayer, 2 ether);
        vm.prank(relayer);
        vm.expectRevert(LidoPortal.FlowRequestMismatch.selector);
        portal.executeStake{value: 2 ether}(content, user, 2 ether, stakeRecipient, address(0), 1, 0);
    }

    /// @notice falls back to escape hatch when stake call fails.
    function testStakeEscapesWhenProtocolFails() public {
        protocol.setShouldFail(true);
        vm.deal(relayer, 1 ether);
        bytes32 content = keccak256(abi.encodePacked("stake-fail", user));
        vm.prank(user);
        bytes32 requestHash = portal.requestStake(content, 1 ether, stakeRecipient, address(0));

        vm.prank(relayer);
        portal.executeStake{value: 1 ether}(content, user, 1 ether, stakeRecipient, address(0), 1, 42);

        assertEq(portal.hasMessageBeenConsumed(requestHash), true);
        LidoPortal.EscapeRequest memory request = portal.getEscapeRequest(requestHash);
        assertEq(request.depositor, user);
        assertEq(request.token, address(0));
        assertEq(request.amount, 1 ether);
        assertEq(request.timeoutBlocks, 42);
    }

    /// @notice falls back to escape hatch when unstake output is below requested amount.
    function testUnstakeEscapesWhenProtocolReturnsTooLittle() public {
        protocol.setSimulatedUnstakeReturn(1 ether);
        bytes32 content = keccak256(abi.encodePacked("unstake-low", user));
        vm.prank(user);
        bytes32 requestHash = portal.requestUnstake(content, 2 ether, stakeRecipient);

        vm.prank(relayer);
        portal.executeUnstake(content, user, 2 ether, stakeRecipient, 1, 24);

        assertEq(portal.hasMessageBeenConsumed(requestHash), true);
        LidoPortal.EscapeRequest memory request = portal.getEscapeRequest(requestHash);
        assertEq(request.depositor, user);
        assertEq(request.token, address(0));
        assertEq(request.amount, 2 ether);
        assertEq(request.timeoutBlocks, 24);
    }
}
