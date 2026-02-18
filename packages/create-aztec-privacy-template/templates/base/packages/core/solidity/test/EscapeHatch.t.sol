// SPDX-License-Identifier: MIT
pragma solidity ^0.8.33;

import "../EscapeHatch.sol";

interface IHevm {
    function roll(uint256) external;

    function deal(address who, uint256 newBalance) external;
}

contract EscapeTokenMock {
    bool public transferResult;

    constructor(bool initialResult) {
        transferResult = initialResult;
    }

    function setTransferResult(bool result) external {
        transferResult = result;
    }

    function transfer(address, uint256) external view returns (bool) {
        return transferResult;
    }
}

contract EscapeHatchHarness is EscapeHatch {
    function register(bytes32 messageHash, address depositor, address token, uint256 amount, uint64 timeoutBlocks)
        external
    {
        _registerEscape(messageHash, depositor, token, amount, timeoutBlocks);
    }

    function claim(bytes32 messageHash) external {
        this.claimEscape(messageHash);
    }

    function cancel(bytes32 messageHash) external {
        _cancelEscape(messageHash);
    }
}

contract EscapeHatchTest {
    IHevm private constant HEVM = IHevm(0x7109709ECfa91a80626fF3989D68f67F5b1DD12D);

    function testEscapeHatchResolvesRegistrationDefaultsAndClaimsAfterTimeout() external {
        EscapeHatchHarness portal = new EscapeHatchHarness();
        EscapeTokenMock token = new EscapeTokenMock(true);
        uint64 defaultTimeout = portal.DEFAULT_ESCAPE_TIMEOUT();

        bytes32 messageHash = keccak256("escape-default-timeout");

        portal.register(messageHash, address(0x1234), address(token), 1000, 0);

        EscapeHatch.EscapeRequest memory request = portal.getEscapeRequest(messageHash);

        assert(request.depositor == address(0x1234));
        assert(request.token == address(token));
        assert(request.amount == 1000);
        assert(request.timeoutBlocks == defaultTimeout);
        assert(!request.claimed);

        bool notReady = false;
        try portal.claim(messageHash) {
            notReady = false;
        } catch {
            notReady = true;
        }

        assert(notReady);

        HEVM.roll(block.number + defaultTimeout);
        portal.claim(messageHash);

        request = portal.getEscapeRequest(messageHash);
        assert(request.claimed);
    }

    function testEscapeHatchRejectsInvalidRegistrationAndDoubleRegistration() external {
        EscapeHatchHarness portal = new EscapeHatchHarness();

        bytes32 messageHash = keccak256("escape-reject");

        bool zeroDepositor = false;
        try portal.register(messageHash, address(0), address(0), 1, 1) {
            zeroDepositor = false;
        } catch {
            zeroDepositor = true;
        }
        assert(zeroDepositor);

        bool zeroAmount = false;
        try portal.register(messageHash, address(0xA11), address(0), 0, 1) {
            zeroAmount = false;
        } catch {
            zeroAmount = true;
        }
        assert(zeroAmount);

        portal.register(messageHash, address(0xBEEF), address(0), 10, 1);

        bool duplicated = false;
        try portal.register(messageHash, address(0xBEEF), address(0), 10, 1) {
            duplicated = false;
        } catch {
            duplicated = true;
        }
        assert(duplicated);
    }

    function testEscapeHatchCanCancelAndBlocksClaim() external {
        EscapeHatchHarness portal = new EscapeHatchHarness();

        bytes32 messageHash = keccak256("escape-cancel");

        portal.register(messageHash, address(0xABCD), address(0), 1 ether, 1);

        portal.cancel(messageHash);
        assert(portal.getEscapeRequest(messageHash).depositor == address(0));

        bool notFound = false;
        try portal.claim(messageHash) {
            notFound = false;
        } catch {
            notFound = true;
        }
        assert(notFound);
    }

    function testEscapeHatchNativeClaimSucceedsWhenFunded() external {
        EscapeHatchHarness portal = new EscapeHatchHarness();
        bytes32 messageHash = keccak256("escape-native-claim");
        address depositor = address(0xCAFE);
        uint256 amount = 1 ether;

        portal.register(messageHash, depositor, address(0), amount, 1);
        HEVM.deal(address(portal), amount);
        uint256 balanceBefore = depositor.balance;

        HEVM.roll(block.number + 1);
        portal.claim(messageHash);

        EscapeHatch.EscapeRequest memory request = portal.getEscapeRequest(messageHash);
        assert(request.claimed);
        assert(depositor.balance == balanceBefore + amount);
    }

    function testEscapeHatchTokenTransferFailureRevertsAndDoesNotMarkClaimed() external {
        EscapeHatchHarness portal = new EscapeHatchHarness();
        EscapeTokenMock token = new EscapeTokenMock(false);

        bytes32 messageHash = keccak256("escape-transfer-fail");

        portal.register(messageHash, address(0xD00D), address(token), 99, 1);
        HEVM.roll(block.number + 1);

        bool transferFailed = false;
        try portal.claim(messageHash) {
            transferFailed = false;
        } catch {
            transferFailed = true;
        }

        assert(transferFailed);

        EscapeHatch.EscapeRequest memory request = portal.getEscapeRequest(messageHash);
        assert(!request.claimed);
        assert(request.depositor == address(0xD00D));
    }
}
