// SPDX-License-Identifier: MIT
pragma solidity ^0.8.33;

interface IERC20Like {
    function transfer(address to, uint256 value) external returns (bool);
}

abstract contract EscapeHatch {
    struct EscapeRequest {
        address depositor;
        address token;
        uint256 amount;
        uint64 createdAtBlock;
        uint64 timeoutBlocks;
        bool claimed;
    }

    event EscapeRegistered(bytes32 indexed messageHash, address indexed depositor, address token, uint256 amount, uint64 timeoutBlocks);
    event EscapeCanceled(bytes32 indexed messageHash);
    event EscapeClaimed(bytes32 indexed messageHash, address indexed recipient, uint256 amount);

    mapping(bytes32 => EscapeRequest) internal escapeRequests;

    error EscapeNotReady();
    error EscapeAlreadyClaimed();
    error EscapeNotFound();
    error EscapeNoFunds();

    uint64 public constant DEFAULT_ESCAPE_TIMEOUT = 20;

    function _registerEscape(
        bytes32 messageHash,
        address depositor,
        address token,
        uint256 amount,
        uint64 timeoutBlocks
    ) internal {
        if (amount == 0) {
            return;
        }

        escapeRequests[messageHash] = EscapeRequest({
            depositor: depositor,
            token: token,
            amount: amount,
            createdAtBlock: uint64(block.number),
            timeoutBlocks: timeoutBlocks == 0 ? DEFAULT_ESCAPE_TIMEOUT : timeoutBlocks,
            claimed: false
        });

        emit EscapeRegistered(messageHash, depositor, token, amount, timeoutBlocks == 0 ? DEFAULT_ESCAPE_TIMEOUT : timeoutBlocks);
    }

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
            payable(request.depositor).transfer(request.amount);
            transferSuccessful = true;
        } else {
            transferSuccessful = IERC20Like(request.token).transfer(request.depositor, request.amount);
        }

        if (!transferSuccessful) {
            revert EscapeNoFunds();
        }

        emit EscapeClaimed(messageHash, request.depositor, request.amount);
    }

    function _cancelEscape(bytes32 messageHash) internal {
        EscapeRequest storage request = escapeRequests[messageHash];

        if (request.depositor == address(0)) {
            revert EscapeNotFound();
        }

        delete escapeRequests[messageHash];
        emit EscapeCanceled(messageHash);
    }

    function getEscapeRequest(bytes32 messageHash)
        external
        view
        returns (EscapeRequest memory)
    {
        return escapeRequests[messageHash];
    }
}
