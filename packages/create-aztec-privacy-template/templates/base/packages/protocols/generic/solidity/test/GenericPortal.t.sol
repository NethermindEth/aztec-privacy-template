// SPDX-License-Identifier: MIT
pragma solidity ^0.8.33;

import "../GenericPortal.sol";

interface IHevm {
    function roll(uint256) external;

    function deal(address who, uint256 newBalance) external;
}

contract GenericExecutorMock is IGenericActionExecutor {
    enum Mode {
        Success,
        ReturnFalse,
        RevertCall
    }

    Mode public mode;
    address public lastActor;
    uint256 public lastAmount;
    bytes public lastData;

    constructor() {
        mode = Mode.Success;
    }

    function setMode(Mode nextMode) external {
        mode = nextMode;
    }

    function executeAction(address actor, uint256 amount, bytes calldata actionData) external returns (bool success) {
        lastActor = actor;
        lastAmount = amount;
        lastData = actionData;

        if (mode == Mode.RevertCall) {
            revert("executor-revert");
        }

        return mode == Mode.Success;
    }
}

contract UnauthorizedGenericRelayerCaller {
    function execute(
        GenericPortal portal,
        bytes32 content,
        address sender,
        uint256 amount,
        bytes calldata actionData,
        uint64 nonce,
        uint64 timeoutBlocks
    ) external {
        portal.executeAction(content, sender, amount, actionData, nonce, timeoutBlocks);
    }
}

contract GenericPortalTest {
    IHevm private constant HEVM = IHevm(0x7109709ECfa91a80626fF3989D68f67F5b1DD12D);

    receive() external payable {}

    function testGenericPortalRequestStoresMetadata() external {
        GenericExecutorMock executor = new GenericExecutorMock();
        GenericPortal portal =
            new GenericPortal(bytes32("GENERIC_PORTAL"), address(0xAAA1), address(this), address(executor));

        bytes32 content = keccak256("generic-request-content");
        bytes memory actionData = abi.encode(address(0xBEEF), uint256(500), uint8(7));
        bytes32 actionHash = keccak256(actionData);

        bytes32 messageHash = portal.requestAction(content, 500, actionHash);
        GenericPortal.FlowRequest memory request = portal.getFlowRequest(messageHash);

        assert(request.exists);
        assert(request.actor == address(this));
        assert(request.amount == 500);
        assert(request.actionHash == actionHash);
        assert(portal.hasMessageBeenIssued(messageHash));
        assert(!portal.hasMessageBeenConsumed(messageHash));
    }

    function testGenericPortalExecuteSuccessConsumesInboundAndSendsCompletion() external {
        GenericExecutorMock executor = new GenericExecutorMock();
        GenericPortal portal =
            new GenericPortal(bytes32("GENERIC_PORTAL"), address(0xAAA2), address(this), address(executor));

        bytes32 content = keccak256("generic-success-content");
        address sender = address(this);
        uint256 amount = 1000;
        bytes memory actionData = abi.encode("success");
        bytes32 actionHash = keccak256(actionData);

        bytes32 requestMessageHash = portal.requestAction(content, amount, actionHash);
        portal.executeAction(content, sender, amount, actionData, 1, 10);

        bytes32 completionMessageHash = portal.messageHashFor(content, sender, 2);

        assert(portal.hasMessageBeenConsumed(requestMessageHash));
        assert(portal.hasMessageBeenIssued(completionMessageHash));

        GenericPortal.FlowRequest memory request = portal.getFlowRequest(requestMessageHash);
        assert(!request.exists);

        assert(executor.lastActor() == sender);
        assert(executor.lastAmount() == amount);
        assert(keccak256(executor.lastData()) == actionHash);
    }

    function testGenericPortalRejectsUnauthorizedRelayerExecution() external {
        GenericExecutorMock executor = new GenericExecutorMock();
        GenericPortal portal =
            new GenericPortal(bytes32("GENERIC_PORTAL"), address(0xAAA3), address(this), address(executor));
        UnauthorizedGenericRelayerCaller unauthorized = new UnauthorizedGenericRelayerCaller();

        bytes32 content = keccak256("generic-unauthorized-content");
        bytes memory actionData = abi.encode("unauthorized");
        bytes32 actionHash = keccak256(actionData);
        portal.requestAction(content, 1, actionHash);

        bool reverted = false;
        try unauthorized.execute(portal, content, address(this), 1, actionData, 1, 1) {
            reverted = false;
        } catch {
            reverted = true;
        }

        assert(reverted);
    }

    function testGenericPortalFailureRegistersEscapeAndCanBeClaimed() external {
        GenericExecutorMock executor = new GenericExecutorMock();
        executor.setMode(GenericExecutorMock.Mode.ReturnFalse);

        GenericPortal portal =
            new GenericPortal(bytes32("GENERIC_PORTAL"), address(0xAAA4), address(this), address(executor));

        bytes32 content = keccak256("generic-failure-content");
        bytes memory actionData = abi.encode("escape");
        bytes32 actionHash = keccak256(actionData);
        uint256 amount = 2 ether;

        bytes32 messageHash = portal.requestAction(content, amount, actionHash);
        portal.executeAction(content, address(this), amount, actionData, 1, 2);

        EscapeHatch.EscapeRequest memory request = portal.getEscapeRequest(messageHash);
        assert(request.depositor == address(this));
        assert(request.amount == amount);
        assert(request.timeoutBlocks == 2);
        assert(!request.claimed);
        assert(portal.messageNonce() == 1);

        HEVM.deal(address(portal), amount);
        HEVM.roll(block.number + 2);
        portal.claimEscape(messageHash);

        request = portal.getEscapeRequest(messageHash);
        assert(request.claimed);
    }

    function testGenericPortalRejectsInvalidExecutePayload() external {
        GenericExecutorMock executor = new GenericExecutorMock();
        GenericPortal portal =
            new GenericPortal(bytes32("GENERIC_PORTAL"), address(0xAAA5), address(this), address(executor));

        bytes32 content = keccak256("generic-invalid-content");
        bytes memory expectedActionData = abi.encode("expected");
        bytes32 actionHash = keccak256(expectedActionData);
        portal.requestAction(content, 123, actionHash);

        bool invalidActionData = false;
        try portal.executeAction(content, address(this), 123, "", 1, 1) {
            invalidActionData = false;
        } catch {
            invalidActionData = true;
        }
        assert(invalidActionData);

        bool mismatchedActionHash = false;
        try portal.executeAction(content, address(this), 123, abi.encode("different"), 1, 1) {
            mismatchedActionHash = false;
        } catch {
            mismatchedActionHash = true;
        }
        assert(mismatchedActionHash);
    }
}
