// SPDX-License-Identifier: MIT
pragma solidity ^0.8.33;

/* solhint-disable import-path-check */
import {BasePortal} from "../../core/solidity/BasePortal.sol";
import {EscapeHatch} from "../../core/solidity/EscapeHatch.sol";

/// @title ILidoLike
/// @author aztec-privacy-template
/// @notice Minimal protocol interface used by the Lido portal.
interface ILidoLike {
    /// @notice Stake ETH into the protocol and mint a wrapped token to beneficiary.
    /// @param beneficiary Receiver of the wrapped token.
    /// @param referral Optional referral address.
    /// @return shares Minted token amount.
    function submit(address beneficiary, address referral) external payable returns (uint256 shares);

    /// @notice Request a withdrawal from the protocol.
    /// @param owner Address whose stake is being unwound.
    /// @param recipient Recipient of unlocked ETH.
    /// @param amount Amount requested.
    /// @return unlocked Amount unlocked.
    function unstake(address owner, address recipient, uint256 amount) external returns (uint256 unlocked);
}

/// @title LidoPortal
/// @author aztec-privacy-template
/// @notice Minimal single-contract portal for Lido stake/unstake private flows.
contract LidoPortal is BasePortal, EscapeHatch {
    /// @notice flow id for stake action.
    bytes32 public constant STAKE_FLOW = keccak256("LIDO_STAKE");
    /// @notice flow id for unstake action.
    bytes32 public constant UNSTAKE_FLOW = keccak256("LIDO_UNSTAKE");

    /// @notice Lido protocol contract used by this portal.
    address public immutable LIDO_PROTOCOL;
    /// @notice request metadata for stake/unstake.
    mapping(bytes32 => StakeRequest) private stakeRequests;
    mapping(bytes32 => UnstakeRequest) private unstakeRequests;

    struct StakeRequest {
        bytes32 action;
        address actor;
        address recipient;
        address referral;
        bool exists;
        uint256 amount;
    }

    struct UnstakeRequest {
        bytes32 action;
        address actor;
        address recipient;
        bool exists;
        uint256 amount;
    }

    /// @notice emitted when a private stake request is placed.
    /// @param messageHash Hash for the action request.
    /// @param actor Address that initiated the request.
    /// @param amount Amount in request payload.
    event LidoFlowRequested(
        bytes32 indexed messageHash,
        address indexed actor,
        uint256 indexed amount
    );

    /// @notice emitted when a request fails and is registered into escape hatch.
    /// @param messageHash Hash for the action request.
    /// @param action Kind of action.
    /// @param actor Address associated with the action.
    /// @param amount Amount reserved for escape.
    /// @param timeoutBlocks Effective timeout for claim.
    event LidoFlowEscaped(
        bytes32 indexed messageHash,
        bytes32 indexed action,
        address indexed actor,
        uint256 amount,
        uint64 timeoutBlocks
    );

    /// @notice emitted when an action completes successfully.
    /// @param messageHash Hash for the action request.
    /// @param action Kind of action.
    /// @param actor Address associated with the action.
    /// @param amount Amount handled by the action.
    event LidoFlowCompleted(
        bytes32 indexed messageHash,
        bytes32 indexed action,
        address indexed actor,
        uint256 amount
    );

    error InvalidAddress();
    error InvalidAmount();
    error InvalidStakeValue();
    error FlowRequestNotFound();
    error FlowRequestMismatch();

    /// @notice Initializes Lido portal dependencies.
    /// @param protocolId_ protocol identifier used for message hashing.
    /// @param l2Contract_ L2 contract that consumes outbound messages.
    /// @param relayer_ relayer authorized for execution.
    /// @param lidoProtocol_ Lido-like protocol contract.
    constructor(bytes32 protocolId_, address l2Contract_, address relayer_, address lidoProtocol_)
        BasePortal(protocolId_, l2Contract_, relayer_)
    {
        if (lidoProtocol_ == address(0)) {
            revert InvalidAddress();
        }
        LIDO_PROTOCOL = lidoProtocol_;
    }

    /// @notice Request a private stake flow from user side.
    /// @param content Encoded action payload hash from Aztec.
    /// @param amount Amount of ETH to stake.
    /// @param recipient Receiver of protocol output token.
    /// @param referral Optional referral address.
    /// @return messageHash Outbound message hash for matching inbound execution.
    function requestStake(
        bytes32 content,
        uint256 amount,
        address recipient,
        address referral
    ) external returns (bytes32 messageHash) {
        if (amount == 0) {
            revert InvalidAmount();
        }

        if (recipient == address(0)) {
            revert InvalidAddress();
        }

        messageHash = _sendL1ToL2Message(content, msg.sender);
        _markStakeRequest(messageHash, msg.sender, amount, recipient, referral);
    }

    /// @notice Request a private unstake flow from user side.
    /// @param content Encoded action payload hash from Aztec.
    /// @param amount Amount of wrapped tokens to unstake.
    /// @param recipient Recipient of ETH proceeds.
    /// @return messageHash Outbound message hash for matching inbound execution.
    function requestUnstake(bytes32 content, uint256 amount, address recipient) external returns (bytes32 messageHash) {
        if (amount == 0) {
            revert InvalidAmount();
        }

        if (recipient == address(0)) {
            revert InvalidAddress();
        }

        messageHash = _sendL1ToL2Message(content, msg.sender);
        _markUnstakeRequest(messageHash, msg.sender, amount, recipient);
    }

    /// @notice Execute private staking after relayer submits matching L2 message.
    /// @param content Encoded action payload hash from request.
    /// @param sender Original action initiator.
    /// @param amount Amount to stake.
    /// @param recipient Wrapped-token beneficiary.
    /// @param referral Optional referral.
    /// @param nonce Message nonce from request sequence.
    /// @param timeoutBlocks Timeout override for fallback escape hatch.
    function executeStake(
        bytes32 content,
        address sender,
        uint256 amount,
        address recipient,
        address referral,
        uint64 nonce,
        uint64 timeoutBlocks
    ) external payable onlyRelayer {
        if (msg.value != amount) {
            revert InvalidStakeValue();
        }

        bytes32 messageHash = _buildMessageHash(content, sender, nonce);
        _assertStakeRequest(messageHash, sender, amount, recipient, referral);
        _consumeL2ToL1Message(content, sender, nonce);
        delete stakeRequests[messageHash];

        bool success = _executeStake(recipient, referral, amount);
        if (!success) {
            _registerEscape(messageHash, sender, address(0), amount, timeoutBlocks);
            emit LidoFlowEscaped(messageHash, STAKE_FLOW, sender, amount, _effectiveTimeout(timeoutBlocks));
            return;
        }

        emit LidoFlowCompleted(messageHash, STAKE_FLOW, sender, amount);
        _sendL1ToL2Message(content, sender);
    }

    /// @notice Execute private unstaking after relayer submits matching L2 message.
    /// @param content Encoded action payload hash from request.
    /// @param sender Original action initiator.
    /// @param amount Amount requested.
    /// @param recipient Recipient of withdrawn ETH.
    /// @param nonce Message nonce from request sequence.
    /// @param timeoutBlocks Timeout override for fallback escape hatch.
    function executeUnstake(
        bytes32 content,
        address sender,
        uint256 amount,
        address recipient,
        uint64 nonce,
        uint64 timeoutBlocks
    ) external onlyRelayer {
        if (recipient == address(0)) {
            revert InvalidAddress();
        }

        bytes32 messageHash = _buildMessageHash(content, sender, nonce);
        _assertUnstakeRequest(messageHash, sender, amount, recipient);
        _consumeL2ToL1Message(content, sender, nonce);
        delete unstakeRequests[messageHash];

        bool success = _executeUnstake(sender, recipient, amount);
        if (!success) {
            _registerEscape(messageHash, sender, address(0), amount, timeoutBlocks);
            emit LidoFlowEscaped(messageHash, UNSTAKE_FLOW, sender, amount, _effectiveTimeout(timeoutBlocks));
            return;
        }

        emit LidoFlowCompleted(messageHash, UNSTAKE_FLOW, sender, amount);
        _sendL1ToL2Message(content, sender);
    }

    /// @notice Build hash for a hypothetical private action.
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

    function _markStakeRequest(
        bytes32 messageHash,
        address actor,
        uint256 amount,
        address recipient,
        address referral
    ) private {
        if (actor == address(0)) {
            revert InvalidAddress();
        }

        stakeRequests[messageHash] = StakeRequest({
            action: STAKE_FLOW,
            actor: actor,
            recipient: recipient,
            referral: referral,
            amount: amount,
            exists: true
        });

        emit LidoFlowRequested(messageHash, actor, amount);
    }

    function _markUnstakeRequest(
        bytes32 messageHash,
        address actor,
        uint256 amount,
        address recipient
    ) private {
        if (actor == address(0)) {
            revert InvalidAddress();
        }

        unstakeRequests[messageHash] = UnstakeRequest({
            action: UNSTAKE_FLOW,
            actor: actor,
            recipient: recipient,
            amount: amount,
            exists: true
        });

        emit LidoFlowRequested(messageHash, actor, amount);
    }

    function _assertStakeRequest(
        bytes32 messageHash,
        address actor,
        uint256 amount,
        address recipient,
        address referral
    ) private view {
        StakeRequest memory request = stakeRequests[messageHash];
        if (!request.exists) {
            revert FlowRequestNotFound();
        }

        if (
            request.action != STAKE_FLOW ||
            request.actor != actor ||
            request.amount != amount ||
            request.recipient != recipient ||
            request.referral != referral
        ) {
            revert FlowRequestMismatch();
        }
    }

    function _assertUnstakeRequest(
        bytes32 messageHash,
        address actor,
        uint256 amount,
        address recipient
    ) private view {
        UnstakeRequest memory request = unstakeRequests[messageHash];
        if (!request.exists) {
            revert FlowRequestNotFound();
        }

        if (
            request.action != UNSTAKE_FLOW ||
            request.actor != actor ||
            request.amount != amount ||
            request.recipient != recipient
        ) {
            revert FlowRequestMismatch();
        }
    }

    function _executeStake(
        address recipient,
        address referral,
        uint256 amount
    ) private returns (bool) {
        try ILidoLike(LIDO_PROTOCOL).submit{value: amount}(recipient, referral) {
            return true;
        } catch {
            return false;
        }
    }

    function _executeUnstake(
        address owner,
        address recipient,
        uint256 amount
    ) private returns (bool) {
        try ILidoLike(LIDO_PROTOCOL).unstake(owner, recipient, amount) returns (uint256 unlocked) {
            return unlocked == amount;
        } catch {
            return false;
        }
    }

    function _effectiveTimeout(uint64 timeoutBlocks) private pure returns (uint64) {
        return timeoutBlocks == 0 ? DEFAULT_ESCAPE_TIMEOUT : timeoutBlocks;
    }
}
