// SPDX-License-Identifier: MIT
pragma solidity ^0.8.33;

/* solhint-disable import-path-check */
import {Test} from "forge-std/Test.sol";
import {UniswapPortal} from "../UniswapPortal.sol";
import {UniswapPortalTestHarness} from "../UniswapPortalMock.sol";
import {MockUniswapV3Router} from "../MockUniswapV3Router.sol";

/// @title UniswapPortalTest
/// @author aztec-privacy-template
/// @notice Unit tests for Uniswap portal swap request/execute paths.
contract UniswapPortalTest is Test {
    UniswapPortalTestHarness private portal;
    MockUniswapV3Router private router;
    address private relayer;
    address private user;
    address private tokenIn;
    address private tokenOut;

    /// @notice initializes core test dependencies.
    function setUp() public {
        relayer = address(1);
        user = address(2);
        tokenIn = address(0xABCD);
        tokenOut = address(0xBEEF);

        router = new MockUniswapV3Router();
        router.setSimulatedAmountOut(1000);
        portal = new UniswapPortalTestHarness(
            bytes32(uint256(1)),
            address(this),
            relayer,
            address(router)
        );
    }

    /// @notice validates swap execution on success path.
    function testSwapFlowCompletes() public {
        bytes32 content = keccak256(abi.encodePacked("swap", user));
        vm.prank(user);
        bytes32 requestHash = portal.requestSwap(
            content,
            tokenIn,
            tokenOut,
            1 ether,
            900,
            3000,
            user
        );
        assertEq(portal.hasMessageBeenIssued(requestHash), true);

        vm.prank(relayer);
        portal.executeSwap(content, user, tokenIn, tokenOut, 1 ether, 900, 3000, user, 1, 0);

        assertEq(router.lastAmountIn(), 1 ether);
        assertEq(router.lastAmountOutMinimum(), 900);
        assertEq(router.lastFee(), 3000);
        assertEq(router.lastRecipient(), user);
        assertEq(portal.hasMessageBeenConsumed(requestHash), true);
    }

    /// @notice enforces relayer-only execution for the execute entrypoint.
    function testOnlyRelayerCanExecute() public {
        vm.prank(user);
        bytes32 content = keccak256(abi.encodePacked("swap", user));
        portal.requestSwap(content, tokenIn, tokenOut, 1 ether, 900, 3000, user);

        vm.expectRevert(UniswapPortal.UnauthorizedCaller.selector);
        portal.executeSwap(content, user, tokenIn, tokenOut, 1 ether, 900, 3000, user, 1, 0);
    }

    /// @notice rejects invalid fee configuration at request and execute time.
    function testRejectsFeeAboveBound() public {
        bytes32 content = keccak256(abi.encodePacked("swap-fee-bound", user));

        vm.prank(user);
        vm.expectRevert(UniswapPortal.InvalidFee.selector);
        portal.requestSwap(content, tokenIn, tokenOut, 1 ether, 900, 1_000_001, user);

        vm.prank(user);
        portal.requestSwap(content, tokenIn, tokenOut, 1 ether, 900, 3000, user);

        vm.prank(relayer);
        vm.expectRevert(UniswapPortal.InvalidFee.selector);
        portal.executeSwap(content, user, tokenIn, tokenOut, 1 ether, 900, 1_000_001, user, 1, 0);
    }

    /// @notice rejects execution parameters that do not match the request.
    function testExecuteRevertsOnRequestMismatch() public {
        vm.prank(user);
        bytes32 content = keccak256(abi.encodePacked("swap", user));
        portal.requestSwap(content, tokenIn, tokenOut, 1 ether, 900, 3000, user);

        vm.prank(relayer);
        vm.expectRevert(UniswapPortal.FlowRequestMismatch.selector);
        portal.executeSwap(content, user, tokenIn, tokenOut, 2 ether, 900, 3000, user, 1, 0);
    }

    /// @notice falls back to escape hatch when router failure occurs.
    function testSwapEscapesWhenRouterFails() public {
        router.setShouldFail(true);
        vm.prank(user);
        bytes32 content = keccak256(abi.encodePacked("swap-fail", user));
        bytes32 requestHash = portal.requestSwap(content, tokenIn, tokenOut, 1 ether, 900, 3000, user);
        vm.prank(relayer);
        portal.executeSwap(content, user, tokenIn, tokenOut, 1 ether, 900, 3000, user, 1, 24);

        assertEq(portal.hasMessageBeenConsumed(requestHash), true);
        UniswapPortal.EscapeRequest memory request = portal.getEscapeRequest(requestHash);
        assertEq(request.depositor, user);
        assertEq(request.token, tokenIn);
        assertEq(request.amount, 1 ether);
        assertEq(request.timeoutBlocks, 24);
    }

    /// @notice falls back to escape hatch when output amount violates minimum.
    function testSwapEscapesWhenOutputBelowMinimum() public {
        router.setSimulatedAmountOut(500);
        vm.prank(user);
        bytes32 content = keccak256(abi.encodePacked("swap-too-few", user));
        bytes32 requestHash = portal.requestSwap(content, tokenIn, tokenOut, 1 ether, 900, 3000, user);
        vm.prank(relayer);
        portal.executeSwap(content, user, tokenIn, tokenOut, 1 ether, 900, 3000, user, 1, 0);

        assertEq(portal.hasMessageBeenConsumed(requestHash), true);
        UniswapPortal.EscapeRequest memory request = portal.getEscapeRequest(requestHash);
        assertEq(request.amount, 1 ether);
        assertEq(request.token, tokenIn);
    }
}
