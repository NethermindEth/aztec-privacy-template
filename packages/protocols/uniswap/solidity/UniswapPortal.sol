// SPDX-License-Identifier: MIT
pragma solidity ^0.8.33;

/* solhint-disable import-path-check */
import {BasePortal} from "../../core/solidity/BasePortal.sol";
import {EscapeHatch} from "../../core/solidity/EscapeHatch.sol";

/// @title IUniswapV3RouterLike
/// @author aztec-privacy-template
/// @notice Minimal swap router interface used by this portal.
interface IUniswapV3RouterLike {
    /// @notice Swaps an exact input token amount for another token.
    /// @param tokenIn Input token.
    /// @param tokenOut Output token.
    /// @param fee Pool fee tier in hundredths of a bip.
    /// @param recipient Recipient of output token.
    /// @param amountIn Input amount.
    /// @param amountOutMinimum Minimum output to accept.
    /// @param sqrtPriceLimitX96 Price limit.
    /// @return amountOut Amount of output token returned.
    function exactInputSingle(
        address tokenIn,
        address tokenOut,
        uint24 fee,
        address recipient,
        uint256 amountIn,
        uint256 amountOutMinimum,
        uint160 sqrtPriceLimitX96
    ) external returns (uint256 amountOut);
}

/// @title UniswapPortal
/// @author aztec-privacy-template
/// @notice Minimal single-contract portal for Uniswap swap private flow.
contract UniswapPortal is BasePortal, EscapeHatch {
    /// @notice flow id for swap actions.
    bytes32 public constant SWAP_FLOW = keccak256("UNISWAP_SWAP");

    /// @notice canonical Uniswap router used by this portal.
    address public immutable SWAP_ROUTER;

    /// @notice metadata for request->execute binding.
    mapping(bytes32 => SwapRequest) private swapRequests;

    /// @notice parameters captured at request time.
    struct SwapRequest {
        bytes32 action;
        address actor;
        address tokenIn;
        address tokenOut;
        uint24 fee;
        uint256 amountIn;
        uint256 minAmountOut;
        address recipient;
        bool exists;
    }

    /// @notice emitted when a private swap request is placed.
    /// @param messageHash Hash for the L1-to-L2 request.
    /// @param action Kind of action.
    /// @param actor Address that initiated the request.
    /// @param amountIn Input amount.
    event UniswapFlowRequested(
        bytes32 indexed messageHash,
        bytes32 indexed action,
        address indexed actor,
        uint256 amountIn
    );

    /// @notice emitted when a swap request fails and is registered into escape hatch.
    /// @param messageHash Hash for the action request.
    /// @param action Kind of action.
    /// @param actor Address associated with the action.
    /// @param amount Amount reserved for the escape.
    /// @param timeoutBlocks Effective timeout for claim.
    event UniswapFlowEscaped(
        bytes32 indexed messageHash,
        bytes32 indexed action,
        address indexed actor,
        uint256 amount,
        uint64 timeoutBlocks
    );

    /// @notice emitted when a swap action is completed successfully.
    /// @param messageHash Hash for the action request.
    /// @param action Kind of action.
    /// @param actor Address associated with the action.
    /// @param amount Amount swapped in.
    event UniswapFlowCompleted(
        bytes32 indexed messageHash,
        bytes32 indexed action,
        address indexed actor,
        uint256 amount
    );

    error InvalidAddress();
    error InvalidAmount();
    error InvalidFee();
    error FlowRequestNotFound();
    error FlowRequestMismatch();

    /// @notice Initializes Uniswap portal dependencies.
    /// @param protocolId_ Protocol identifier used for message hashing.
    /// @param l2Contract_ L2 contract that consumes outbound messages.
    /// @param relayer_ Relayer address authorized for inbound message execution.
    /// @param swapRouter_ Uniswap router contract.
    constructor(
        bytes32 protocolId_,
        address l2Contract_,
        address relayer_,
        address swapRouter_
    ) BasePortal(protocolId_, l2Contract_, relayer_) {
        if (swapRouter_ == address(0)) {
            revert InvalidAddress();
        }

        SWAP_ROUTER = swapRouter_;
    }

    /// @notice Request a private Uniswap swap from user side.
    /// @param content Encoded action payload hash from Aztec.
    /// @param tokenIn Input token.
    /// @param tokenOut Output token.
    /// @param amountIn Input amount.
    /// @param minAmountOut Minimum output amount expected.
    /// @param fee BPS fee tier.
    /// @param recipient Receiver of output token.
    /// @return messageHash Outbound message hash for matching inbound execution.
    function requestSwap(
        bytes32 content,
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut,
        uint24 fee,
        address recipient
    ) external returns (bytes32 messageHash) {
        if (tokenIn == address(0) || tokenOut == address(0) || recipient == address(0)) {
            revert InvalidAddress();
        }

        if (amountIn == 0) {
            revert InvalidAmount();
        }

        if (fee == 0) {
            revert InvalidFee();
        }

        messageHash = _sendL1ToL2Message(content, msg.sender);
        _markRequestMetadata(
            messageHash,
            SWAP_FLOW,
            msg.sender,
            tokenIn,
            tokenOut,
            amountIn,
            minAmountOut,
            fee,
            recipient
        );
    }

    /// @notice Execute a private Uniswap swap after relayer submits matching L2 message.
    /// @param content Encoded action payload hash from request.
    /// @param sender Original action initiator.
    /// @param tokenIn Input token.
    /// @param tokenOut Output token.
    /// @param amountIn Input amount.
    /// @param minAmountOut Minimum output expected.
    /// @param fee BPS fee tier.
    /// @param recipient Receiver of output token.
    /// @param nonce Message nonce from request sequence.
    /// @param timeoutBlocks Timeout for fallback escape hatch.
    function executeSwap(
        bytes32 content,
        address sender,
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut,
        uint24 fee,
        address recipient,
        uint64 nonce,
        uint64 timeoutBlocks
    ) external onlyRelayer {
        if (tokenIn == address(0) || tokenOut == address(0) || recipient == address(0)) {
            revert InvalidAddress();
        }

        if (amountIn == 0) {
            revert InvalidAmount();
        }

        bytes32 messageHash = _buildMessageHash(content, sender, nonce);
        _assertFlowRequest(
            messageHash,
            SWAP_FLOW,
            sender,
            tokenIn,
            tokenOut,
            amountIn,
            minAmountOut,
            fee,
            recipient
        );

        _consumeL2ToL1Message(content, sender, nonce);
        delete swapRequests[messageHash];

        bool success = _executeSwap(tokenIn, tokenOut, amountIn, minAmountOut, fee, recipient);
        if (!success) {
            _registerEscape(messageHash, sender, tokenIn, amountIn, timeoutBlocks);
            emit UniswapFlowEscaped(
                messageHash,
                SWAP_FLOW,
                sender,
                amountIn,
                timeoutBlocks == 0 ? DEFAULT_ESCAPE_TIMEOUT : timeoutBlocks
            );
            return;
        }

        emit UniswapFlowCompleted(messageHash, SWAP_FLOW, sender, amountIn);
        _sendL1ToL2Message(content, sender);
    }

    /// @notice Build hash for a hypothetical private flow action.
    /// @param content Encoded action payload hash.
    /// @param sender Original action initiator.
    /// @param nonce Action nonce.
    /// @return messageHash Message hash.
    function messageHashFor(
        bytes32 content,
        address sender,
        uint64 nonce
    ) external view returns (bytes32 messageHash) {
        return _buildMessageHash(content, sender, nonce);
    }

    function _markRequestMetadata(
        bytes32 messageHash,
        bytes32 action,
        address actor,
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut,
        uint24 fee,
        address recipient
    ) private {
        if (actor == address(0)) {
            revert InvalidAddress();
        }

        swapRequests[messageHash] = SwapRequest({
            action: action,
            actor: actor,
            tokenIn: tokenIn,
            tokenOut: tokenOut,
            fee: fee,
            amountIn: amountIn,
            minAmountOut: minAmountOut,
            recipient: recipient,
            exists: true
        });

        emit UniswapFlowRequested(messageHash, action, actor, amountIn);
    }

    function _assertFlowRequest(
        bytes32 messageHash,
        bytes32 action,
        address actor,
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut,
        uint24 fee,
        address recipient
    ) private view {
        SwapRequest memory request = swapRequests[messageHash];
        if (!request.exists) {
            revert FlowRequestNotFound();
        }

        if (
            request.action != action ||
            request.actor != actor ||
            request.tokenIn != tokenIn ||
            request.tokenOut != tokenOut ||
            request.amountIn != amountIn ||
            request.minAmountOut != minAmountOut ||
            request.fee != fee ||
            request.recipient != recipient
        ) {
            revert FlowRequestMismatch();
        }
    }

    function _executeSwap(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut,
        uint24 fee,
        address recipient
    ) private returns (bool) {
        try
            IUniswapV3RouterLike(SWAP_ROUTER).exactInputSingle(
                tokenIn,
                tokenOut,
                fee,
                recipient,
                amountIn,
                minAmountOut,
                0
            )
            returns (uint256 amountOut)
        {
            return !(amountOut < minAmountOut);
        } catch {
            return false;
        }
    }
}
