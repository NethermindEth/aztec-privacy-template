// SPDX-License-Identifier: MIT
pragma solidity ^0.8.33;

/* solhint-disable import-path-check */
import {BasePortal} from "../../../core/solidity/BasePortal.sol";
import {EscapeHatch} from "../../../core/solidity/EscapeHatch.sol";

/// @title IAaveV3PoolLike
/// @author aztec-privacy-template
/// @notice Minimal pool interface used by the Aave portal.
interface IAaveV3PoolLike {
    /// @notice Deposits an asset to the pool.
    /// @param asset Asset address.
    /// @param amount Amount to deposit.
    /// @param onBehalfOf Beneficiary of the deposit.
    /// @param referralCode Referral code forwarded to the pool.
    function supply(address asset, uint256 amount, address onBehalfOf, uint16 referralCode) external;

    /// @notice Withdraws an asset from the pool.
    /// @param asset Asset address.
    /// @param amount Amount requested.
    /// @param to Recipient of the withdrawn funds.
    /// @return withdrawnAmount Amount actually withdrawn.
    function withdraw(address asset, uint256 amount, address to) external returns (uint256);
}

/// @title AavePortal
/// @author aztec-privacy-template
/// @notice Minimal single-contract portal for Aave deposit/withdraw private flows.
contract AavePortal is BasePortal, EscapeHatch {
    /// @notice flow id for deposit actions.
    bytes32 public constant DEPOSIT_FLOW = keccak256("AAVE_DEPOSIT");
    /// @notice flow id for withdraw actions.
    bytes32 public constant WITHDRAW_FLOW = keccak256("AAVE_WITHDRAW");

    /// @notice canonical Aave pool contract used by this portal.
    address public immutable AAVE_POOL;
    /// @notice asset accepted by this simplified Aave flow.
    address public immutable ASSET;
    /// @notice per-request metadata used to bind execute payloads to request payloads.
    mapping(bytes32 => FlowRequest) private flowRequests;

    struct FlowRequest {
        bytes32 action;
        address actor;
        bool exists;
        uint256 amount;
    }

    /// @notice emitted when a private action request is placed.
    /// @param messageHash Hash for the L1-to-L2 request.
    /// @param action Kind of action: deposit or withdraw.
    /// @param actor Address that initiated the request.
    /// @param amount Amount in request payload.
    event AaveFlowRequested(bytes32 indexed messageHash, bytes32 indexed action, address indexed actor, uint256 amount);

    /// @notice emitted when a request fails and is registered into escape hatch.
    /// @param messageHash Hash for the action request.
    /// @param action Kind of action.
    /// @param actor Address associated with the action.
    /// @param amount Amount reserved for the escape.
    /// @param timeoutBlocks Effective timeout for claim.
    event AaveFlowEscaped(
        bytes32 indexed messageHash, bytes32 indexed action, address indexed actor, uint256 amount, uint64 timeoutBlocks
    );

    /// @notice emitted when an action is completed successfully and mirrored back to L2.
    /// @param messageHash Hash for the action request.
    /// @param action Kind of action.
    /// @param actor Address associated with the action.
    /// @param amount Amount handled by the action.
    event AaveFlowCompleted(bytes32 indexed messageHash, bytes32 indexed action, address indexed actor, uint256 amount);

    error InvalidAmount();
    error InvalidAddress();
    error InvalidReferralCode();
    error FlowRequestNotFound();
    error FlowRequestMismatch();

    /// @notice Initializes Aave portal dependencies.
    /// @param protocolId_ Protocol identifier used for message hashing.
    /// @param l2Contract_ L2 contract that consumes outbound messages.
    /// @param relayer_ Relayer address authorized for inbound message execution.
    /// @param aavePool_ Aave pool contract.
    /// @param asset_ Token used by this core flow.
    constructor(bytes32 protocolId_, address l2Contract_, address relayer_, address aavePool_, address asset_)
        BasePortal(protocolId_, l2Contract_, relayer_)
    {
        if (aavePool_ == address(0)) {
            revert InvalidAddress();
        }

        if (asset_ == address(0)) {
            revert InvalidAddress();
        }

        AAVE_POOL = aavePool_;
        ASSET = asset_;
    }

    /// @notice Request a private deposit flow from user side.
    /// @param content Encoded action payload hash from Aztec.
    /// @param amount Amount of asset in request.
    /// @param referralCode Protocol referral code.
    /// @return messageHash Outbound message hash for matching inbound execution.
    function requestDeposit(bytes32 content, uint256 amount, uint16 referralCode)
        external
        returns (bytes32 messageHash)
    {
        if (amount == 0) {
            revert InvalidAmount();
        }

        if (referralCode > 10000) {
            revert InvalidReferralCode();
        }

        messageHash = _sendL1ToL2Message(content, msg.sender);
        _markRequestMetadata(messageHash, DEPOSIT_FLOW, msg.sender, amount);
    }

    /// @notice Request a private withdraw flow from user side.
    /// @param content Encoded action payload hash from Aztec.
    /// @param amount Amount of asset in request.
    /// @return messageHash Outbound message hash for matching inbound execution.
    function requestWithdraw(bytes32 content, uint256 amount) external returns (bytes32 messageHash) {
        if (amount == 0) {
            revert InvalidAmount();
        }

        messageHash = _sendL1ToL2Message(content, msg.sender);
        _markRequestMetadata(messageHash, WITHDRAW_FLOW, msg.sender, amount);
    }

    /// @notice Execute a private Aave deposit after relayer submits matching L2 message.
    /// @param content Encoded action payload hash from request.
    /// @param sender Original action initiator.
    /// @param amount Amount to deposit.
    /// @param referralCode Protocol referral code.
    /// @param nonce Message nonce from request sequence.
    /// @param timeoutBlocks Timeout for fallback escape hatch.
    function executeDeposit(
        bytes32 content,
        address sender,
        uint256 amount,
        uint16 referralCode,
        uint64 nonce,
        uint64 timeoutBlocks
    ) external onlyRelayer {
        if (amount == 0) {
            revert InvalidAmount();
        }

        if (sender == address(0)) {
            revert InvalidAddress();
        }

        if (referralCode > 10000) {
            revert InvalidReferralCode();
        }

        bytes32 messageHash = _buildMessageHash(content, sender, nonce);
        _assertFlowRequest(messageHash, DEPOSIT_FLOW, sender, amount);
        _consumeL2ToL1Message(content, sender, nonce);
        delete flowRequests[messageHash];

        bool success = _executeDeposit(sender, amount, referralCode);
        if (!success) {
            _registerEscape(messageHash, sender, ASSET, amount, timeoutBlocks);
            emit AaveFlowEscaped(
                messageHash, DEPOSIT_FLOW, sender, amount, timeoutBlocks == 0 ? DEFAULT_ESCAPE_TIMEOUT : timeoutBlocks
            );
            return;
        }

        emit AaveFlowCompleted(messageHash, DEPOSIT_FLOW, sender, amount);
        _sendL1ToL2Message(content, sender);
    }

    /// @notice Execute a private Aave withdraw after relayer submits matching L2 message.
    /// @param content Encoded action payload hash from request.
    /// @param sender Original action initiator.
    /// @param amount Amount to withdraw.
    /// @param nonce Message nonce from request sequence.
    /// @param timeoutBlocks Timeout for fallback escape hatch.
    function executeWithdraw(bytes32 content, address sender, uint256 amount, uint64 nonce, uint64 timeoutBlocks)
        external
        onlyRelayer
    {
        if (amount == 0) {
            revert InvalidAmount();
        }

        if (sender == address(0)) {
            revert InvalidAddress();
        }

        bytes32 messageHash = _buildMessageHash(content, sender, nonce);
        _assertFlowRequest(messageHash, WITHDRAW_FLOW, sender, amount);
        _consumeL2ToL1Message(content, sender, nonce);
        delete flowRequests[messageHash];

        bool success = _executeWithdraw(sender, amount);
        if (!success) {
            _registerEscape(messageHash, sender, ASSET, amount, timeoutBlocks);
            emit AaveFlowEscaped(
                messageHash, WITHDRAW_FLOW, sender, amount, timeoutBlocks == 0 ? DEFAULT_ESCAPE_TIMEOUT : timeoutBlocks
            );
            return;
        }

        emit AaveFlowCompleted(messageHash, WITHDRAW_FLOW, sender, amount);
        _sendL1ToL2Message(content, sender);
    }

    /// @notice Build hash for a hypothetical private flow action.
    /// @param content Encoded action payload hash.
    /// @param sender Original action initiator.
    /// @param nonce Action nonce.
    /// @return messageHash Message hash.
    function messageHashFor(bytes32 content, address sender, uint64 nonce) external view returns (bytes32 messageHash) {
        return _buildMessageHash(content, sender, nonce);
    }

    function _markRequestMetadata(bytes32 messageHash, bytes32 action, address actor, uint256 amount) private {
        if (amount == 0) {
            revert InvalidAmount();
        }

        if (actor == address(0)) {
            revert InvalidAddress();
        }

        flowRequests[messageHash] = FlowRequest({action: action, actor: actor, amount: amount, exists: true});

        emit AaveFlowRequested(messageHash, action, actor, amount);
    }

    function _assertFlowRequest(bytes32 messageHash, bytes32 action, address actor, uint256 amount) private view {
        FlowRequest memory request = flowRequests[messageHash];
        if (!request.exists) {
            revert FlowRequestNotFound();
        }

        if (request.action != action || request.actor != actor || request.amount != amount) {
            revert FlowRequestMismatch();
        }
    }

    function _executeDeposit(address depositor, uint256 amount, uint16 referralCode) private returns (bool) {
        try IAaveV3PoolLike(AAVE_POOL).supply(ASSET, amount, depositor, referralCode) {
            return true;
        } catch {
            return false;
        }
    }

    function _executeWithdraw(address recipient, uint256 amount) private returns (bool) {
        try IAaveV3PoolLike(AAVE_POOL).withdraw(ASSET, amount, recipient) returns (uint256 withdrawnAmount) {
            return withdrawnAmount == amount;
        } catch {
            return false;
        }
    }
}
