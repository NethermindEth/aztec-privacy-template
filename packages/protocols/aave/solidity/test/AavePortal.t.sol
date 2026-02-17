/* solhint-disable no-empty-blocks, max-line-length */
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.33;

/* solhint-disable import-path-check */
import {Test} from "forge-std/Test.sol";
import {AavePortal} from "../AavePortal.sol";
import {AavePortalTestHarness} from "../AavePortalMock.sol";
import {MockAavePool} from "../MockAavePool.sol";
import {MockERC20} from "../MockERC20.sol";

/// @title AavePortalTest
/// @author aztec-privacy-template
/// @notice Unit tests for the Aave portal request/execute paths.
contract AavePortalTest is Test {
    AavePortalTestHarness private portal;
    MockAavePool private pool;
    MockERC20 private token;
    address private relayer;
    address private user;

    /// @notice initializes core test dependencies.
    function setUp() public {
        relayer = address(1);
        user = address(2);

        pool = new MockAavePool();
        token = new MockERC20();
        token.mint(address(pool), 100 ether);
        portal = new AavePortalTestHarness(bytes32(uint256(1)), address(this), relayer, address(pool), address(token));
    }

    /// @notice validates that a deposit request can execute successfully.
    function testDepositFlowCompletes() public {
        bytes32 content = keccak256(abi.encodePacked("deposit", user));
        vm.prank(user);
        bytes32 requestHash = portal.requestDeposit(content, 1 ether, 0);
        assertEq(portal.hasMessageBeenIssued(requestHash), true);

        vm.prank(relayer);
        portal.executeDeposit(content, user, 1 ether, 0, 1, 0);

        assertEq(pool.lastAmount(), 1 ether);
        assertEq(pool.lastOnBehalfOf(), user);
        assertEq(pool.lastReferralCode(), 0);
        assertEq(portal.hasMessageBeenConsumed(requestHash), true);
    }

    /// @notice validates that a withdraw request can execute successfully.
    function testWithdrawFlowCompletes() public {
        bytes32 content = keccak256(abi.encodePacked("withdraw", user));
        vm.prank(user);
        bytes32 requestHash = portal.requestWithdraw(content, 2 ether);
        assertEq(portal.hasMessageBeenIssued(requestHash), true);

        vm.prank(relayer);
        portal.executeWithdraw(content, user, 2 ether, 1, 0);

        assertEq(pool.lastAmount(), 2 ether);
        assertEq(pool.lastRecipient(), user);
        assertEq(portal.hasMessageBeenConsumed(requestHash), true);
    }

    /// @notice enforces relayer-only execution for execution entrypoint.
    function testOnlyRelayerCanExecute() public {
        bytes32 content = keccak256(abi.encodePacked("deposit", user));
        vm.prank(user);
        portal.requestDeposit(content, 1 ether, 0);

        vm.expectRevert(AavePortal.UnauthorizedCaller.selector);
        portal.executeDeposit(content, user, 1 ether, 0, 1, 0);
    }

    /// @notice prevents relayer tampering with amount in execute payload.
    function testExecuteRevertsOnRequestAmountMismatch() public {
        bytes32 content = keccak256(abi.encodePacked("deposit-mismatch", user));
        vm.prank(user);
        portal.requestDeposit(content, 1 ether, 0);

        vm.prank(relayer);
        vm.expectRevert(AavePortal.FlowRequestMismatch.selector);
        portal.executeDeposit(content, user, 2 ether, 0, 1, 0);
    }

    /// @notice falls back to escape hatch when Aave deposit fails.
    function testDepositEscapesWhenPoolFails() public {
        pool.setShouldFail(true);
        bytes32 content = keccak256(abi.encodePacked("deposit-fail", user));
        vm.prank(user);
        bytes32 requestHash = portal.requestDeposit(content, 1 ether, 0);
        vm.prank(relayer);
        portal.executeDeposit(content, user, 1 ether, 0, 1, 42);

        assertEq(portal.hasMessageBeenConsumed(requestHash), true);
        assertEq(pool.lastAmount(), 0);

        AavePortal.EscapeRequest memory request = portal.getEscapeRequest(requestHash);
        assertEq(request.depositor, user);
        assertEq(request.token, address(token));
        assertEq(request.amount, 1 ether);
        assertEq(request.timeoutBlocks, 42);
    }

    /// @notice falls back to escape hatch when Aave withdraw fails.
    function testWithdrawEscapesWhenPoolFails() public {
        pool.setShouldFail(true);
        bytes32 content = keccak256(abi.encodePacked("withdraw-fail", user));
        vm.prank(user);
        bytes32 requestHash = portal.requestWithdraw(content, 3 ether);
        vm.prank(relayer);
        portal.executeWithdraw(content, user, 3 ether, 1, 24);

        assertEq(portal.hasMessageBeenConsumed(requestHash), true);

        AavePortal.EscapeRequest memory request = portal.getEscapeRequest(requestHash);
        assertEq(request.depositor, user);
        assertEq(request.token, address(token));
        assertEq(request.amount, 3 ether);
        assertEq(request.timeoutBlocks, 24);
    }
}
