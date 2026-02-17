// SPDX-License-Identifier: MIT
pragma solidity ^0.8.33;

/// @title IERC20Like
/// @author aztec-privacy-template
/// @notice Minimal ERC20 transfer interface used by escape logic.
interface IERC20Like {
    /// @notice Transfers tokens.
    /// @param to Recipient.
    /// @param value Amount to transfer.
    /// @return Success boolean.
    function transfer(address to, uint256 value) external returns (bool);
}

/// @title EscapeHatch
/// @author aztec-privacy-template
/// @notice Mixin-like escape hatch module for deferred token claims.
abstract contract EscapeHatch {
    struct EscapeRequest {
        address depositor;
        address token;
        uint256 amount;
        uint64 createdAtBlock;
        uint64 timeoutBlocks;
        bool claimed;
    }

    /// @notice Emitted when an escape request is registered.
    /// @param messageHash Message hash associated with the request.
    /// @param depositor Original depositor.
    /// @param token Token address (zero for native value).
    /// @param amount Claimed amount.
    /// @param timeoutBlocks Timeout blocks to wait before claim.
    event EscapeRegistered(
        bytes32 indexed messageHash,
        address indexed depositor,
        address indexed token,
        uint256 amount,
        uint64 timeoutBlocks
    );
    /// @notice Emitted when an escape request is canceled.
    /// @param messageHash Message hash associated with the request.
    event EscapeCanceled(bytes32 indexed messageHash);
    /// @notice Emitted when an escape request is claimed.
    /// @param messageHash Message hash associated with the request.
    /// @param recipient Recipient of the funds.
    /// @param amount Claimed amount.
    event EscapeClaimed(bytes32 indexed messageHash, address indexed recipient, uint256 indexed amount);

    mapping(bytes32 => EscapeRequest) internal escapeRequests;

    error EscapeNotReady();
    error EscapeAlreadyClaimed();
    error EscapeAlreadyRegistered();
    error InvalidDepositor();
    error EscapeNotFound();
    error EscapeNoFunds();

    /// @notice Default timeout in blocks when no timeout override is provided.
    uint64 public constant DEFAULT_ESCAPE_TIMEOUT = 20;

    /// @notice Registers an escape request.
    /// @param messageHash Message hash key.
    /// @param depositor Address posting escape request.
    /// @param token Token or zero for native ETH.
    /// @param amount Amount to escrow.
    /// @param timeoutBlocks Number of blocks to wait before claim is permitted.
    function _registerEscape(
        bytes32 messageHash,
        address depositor,
        address token,
        uint256 amount,
        uint64 timeoutBlocks
    ) internal {
        if (depositor == address(0)) {
            revert InvalidDepositor();
        }

        if (amount == 0) {
            revert EscapeNoFunds();
        }

        if (escapeRequests[messageHash].depositor != address(0)) {
            revert EscapeAlreadyRegistered();
        }

        uint64 effectiveTimeout = timeoutBlocks == 0 ? DEFAULT_ESCAPE_TIMEOUT : timeoutBlocks;

        escapeRequests[messageHash] = EscapeRequest({
            depositor: depositor,
            token: token,
            amount: amount,
            createdAtBlock: uint64(block.number),
            timeoutBlocks: effectiveTimeout,
            claimed: false
        });

        emit EscapeRegistered(messageHash, depositor, token, amount, effectiveTimeout);
    }

    /// @notice Claims an escape request after timeout.
    /// @param messageHash Message hash key.
    function claimEscape(bytes32 messageHash) external {
        EscapeRequest storage request = escapeRequests[messageHash];

        if (request.depositor == address(0)) {
            revert EscapeNotFound();
        }

        if (request.claimed) {
            revert EscapeAlreadyClaimed();
        }

        if (block.number < request.createdAtBlock + request.timeoutBlocks) {
            revert EscapeNotReady();
        }

        request.claimed = true;

        if (request.amount == 0) {
            revert EscapeNoFunds();
        }

        bool transferSuccessful;
        if (request.token == address(0)) {
            (transferSuccessful,) = payable(request.depositor).call{value: request.amount}("");
        } else {
            transferSuccessful = IERC20Like(request.token).transfer(request.depositor, request.amount);
        }

        if (!transferSuccessful) {
            revert EscapeNoFunds();
        }

        emit EscapeClaimed(messageHash, request.depositor, request.amount);
    }

    /// @notice Cancels an escape request.
    /// @param messageHash Message hash key.
    function _cancelEscape(bytes32 messageHash) internal {
        EscapeRequest storage request = escapeRequests[messageHash];

        if (request.depositor == address(0)) {
            revert EscapeNotFound();
        }

        delete escapeRequests[messageHash];
        emit EscapeCanceled(messageHash);
    }

    /// @notice Reads an escape request.
    /// @param messageHash Message hash key.
    /// @return request Active request payload.
    function getEscapeRequest(bytes32 messageHash)
        external
        view
        returns (EscapeRequest memory request)
    {
        return escapeRequests[messageHash];
    }
}
