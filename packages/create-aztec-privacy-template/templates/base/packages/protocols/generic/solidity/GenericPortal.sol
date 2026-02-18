// SPDX-License-Identifier: MIT
pragma solidity ^0.8.33;

/* solhint-disable import-path-check */
import {BasePortal} from "../../../core/solidity/BasePortal.sol";
import {EscapeHatch} from "../../../core/solidity/EscapeHatch.sol";

/// @title IGenericActionExecutor
/// @author aztec-privacy-template
/// @notice Minimal protocol execution hook for the generic portal.
interface IGenericActionExecutor {
    /// @notice Executes an action on behalf of an actor.
    /// @param actor Original request actor.
    /// @param amount Amount carried by request metadata.
    /// @param actionData Protocol-specific execution payload.
    /// @return success Whether execution succeeded.
    function executeAction(address actor, uint256 amount, bytes calldata actionData) external returns (bool success);
}

/// @title GenericPortal
/// @author aztec-privacy-template
/// @notice Protocol-agnostic L1 portal skeleton for Aztec private flows.
/// @dev Customize only executor integration + payload shape when adapting.
contract GenericPortal is BasePortal, EscapeHatch {
    /// @notice Flow identifier used for the generic request/execute path.
    bytes32 public constant ACTION_FLOW = keccak256("GENERIC_ACTION");
    /// @notice Executor contract that performs protocol-side actions.
    address public immutable EXECUTOR;

    struct FlowRequest {
        address actor;
        uint256 amount;
        bytes32 actionHash;
        bool exists;
    }

    /// @notice Request metadata keyed by deterministic message hash.
    mapping(bytes32 => FlowRequest) private flowRequests;

    /// @notice Emitted when a generic flow request is registered.
    /// @param messageHash Hash for this request.
    /// @param actor Request owner.
    /// @param amount Request amount.
    /// @param actionHash Hash of protocol execution payload.
    event GenericFlowRequested(
        bytes32 indexed messageHash, address indexed actor, uint256 amount, bytes32 indexed actionHash
    );

    /// @notice Emitted when request execution succeeds.
    /// @param messageHash Hash for this request.
    /// @param actor Request owner.
    /// @param amount Request amount.
    /// @param actionHash Hash of protocol execution payload.
    event GenericFlowCompleted(
        bytes32 indexed messageHash, address indexed actor, uint256 amount, bytes32 indexed actionHash
    );

    /// @notice Emitted when request execution fails and escape is registered.
    /// @param messageHash Hash for this request.
    /// @param actor Request owner.
    /// @param amount Request amount.
    /// @param timeoutBlocks Effective timeout used by escape request.
    event GenericFlowEscaped(
        bytes32 indexed messageHash, address indexed actor, uint256 amount, uint64 timeoutBlocks
    );

    error InvalidAmount();
    error InvalidAddress();
    error InvalidActionData();
    error FlowRequestNotFound();
    error FlowRequestMismatch();

    /// @notice Creates a new generic portal.
    /// @param protocolId_ Protocol identifier used in deterministic message hashing.
    /// @param l2Contract_ L2 contract bound to this portal.
    /// @param relayer_ Address authorized to execute inbound messages.
    /// @param executor_ Protocol execution hook for concrete integration.
    constructor(bytes32 protocolId_, address l2Contract_, address relayer_, address executor_)
        BasePortal(protocolId_, l2Contract_, relayer_)
    {
        if (executor_ == address(0)) {
            revert InvalidAddress();
        }

        EXECUTOR = executor_;
    }

    /// @notice Registers a generic private action request.
    /// @param content Encoded action payload hash from Aztec.
    /// @param amount Amount associated with this request.
    /// @param actionHash Hash of L1 executor payload expected at execution.
    /// @return messageHash Deterministic outbound message hash.
    function requestAction(bytes32 content, uint256 amount, bytes32 actionHash) external returns (bytes32 messageHash) {
        if (amount == 0) {
            revert InvalidAmount();
        }

        messageHash = _sendL1ToL2Message(content, msg.sender);
        flowRequests[messageHash] =
            FlowRequest({actor: msg.sender, amount: amount, actionHash: actionHash, exists: true});

        emit GenericFlowRequested(messageHash, msg.sender, amount, actionHash);
    }

    /// @notice Executes a generic action after relayer proves matching inbound message.
    /// @dev Execution payload is validated via `keccak256(actionData)` against request metadata.
    /// @param content Encoded request payload hash from Aztec side.
    /// @param sender Original request actor.
    /// @param amount Amount expected from request metadata.
    /// @param actionData Protocol execution payload for executor integration.
    /// @param nonce Nonce from outbound request.
    /// @param timeoutBlocks Escape timeout override, zero uses default.
    function executeAction(
        bytes32 content,
        address sender,
        uint256 amount,
        bytes calldata actionData,
        uint64 nonce,
        uint64 timeoutBlocks
    ) external onlyRelayer {
        if (sender == address(0)) {
            revert InvalidAddress();
        }

        if (amount == 0) {
            revert InvalidAmount();
        }

        if (actionData.length == 0) {
            revert InvalidActionData();
        }

        bytes32 messageHash = _buildMessageHash(content, sender, nonce);
        bytes32 actionHash = keccak256(actionData);

        _assertFlowRequest(messageHash, sender, amount, actionHash);
        _consumeL2ToL1Message(content, sender, nonce);
        delete flowRequests[messageHash];

        bool success = _execute(sender, amount, actionData);
        if (!success) {
            _registerEscape(messageHash, sender, address(0), amount, timeoutBlocks);
            emit GenericFlowEscaped(
                messageHash, sender, amount, timeoutBlocks == 0 ? DEFAULT_ESCAPE_TIMEOUT : timeoutBlocks
            );
            return;
        }

        emit GenericFlowCompleted(messageHash, sender, amount, actionHash);
        _sendL1ToL2Message(content, sender);
    }

    /// @notice Returns deterministic message hash used by request and execute functions.
    /// @param content Encoded payload hash.
    /// @param sender Original request actor.
    /// @param nonce Monotonic message nonce.
    /// @return messageHash Deterministic message hash.
    function messageHashFor(bytes32 content, address sender, uint64 nonce) external view returns (bytes32 messageHash) {
        return _buildMessageHash(content, sender, nonce);
    }

    /// @notice Reads request metadata for a message hash.
    /// @param messageHash Deterministic message hash.
    /// @return request Request metadata.
    function getFlowRequest(bytes32 messageHash) external view returns (FlowRequest memory request) {
        return flowRequests[messageHash];
    }

    function _assertFlowRequest(bytes32 messageHash, address actor, uint256 amount, bytes32 actionHash) private view {
        FlowRequest memory request = flowRequests[messageHash];
        if (!request.exists) {
            revert FlowRequestNotFound();
        }

        if (request.actor != actor || request.amount != amount || request.actionHash != actionHash) {
            revert FlowRequestMismatch();
        }
    }

    function _execute(address actor, uint256 amount, bytes calldata actionData) private returns (bool) {
        try IGenericActionExecutor(EXECUTOR).executeAction(actor, amount, actionData) returns (bool success) {
            return success;
        } catch {
            return false;
        }
    }
}
