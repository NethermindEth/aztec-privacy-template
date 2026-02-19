// SPDX-License-Identifier: MIT
pragma solidity ^0.8.33;

import {IGenericActionExecutor} from "./GenericPortal.sol";

/// @title GenericActionExecutor
/// @author aztec-privacy-template
/// @notice Generic L1 executor that forwards validated actions to allowlisted targets.
/// @dev `actionData` schema: `abi.encode(address target, uint256 value, bytes callData)`.
contract GenericActionExecutor is IGenericActionExecutor {
    /// @notice Current operator allowed to configure this executor.
    address public operator;
    /// @notice Generic portal authorized to invoke `executeAction`.
    address public portal;
    /// @notice Allowlist of protocol targets callable by this executor.
    mapping(address target => bool allowed) public allowedTargets;

    error InvalidAddress();
    error UnauthorizedCaller();
    error PortalAlreadyConfigured();
    error TargetNotAllowed(address target);

    event OperatorUpdated(address indexed previousOperator, address indexed newOperator);
    event PortalConfigured(address indexed portal);
    event TargetPermissionSet(address indexed target, bool allowed);
    event ActionForwarded(address indexed actor, uint256 amount, address indexed target, uint256 value, bool success);

    constructor(address operator_) {
        if (operator_ == address(0)) {
            revert InvalidAddress();
        }
        operator = operator_;
    }

    modifier onlyOperator() {
        if (msg.sender != operator) {
            revert UnauthorizedCaller();
        }
        _;
    }

    modifier onlyPortal() {
        if (msg.sender != portal) {
            revert UnauthorizedCaller();
        }
        _;
    }

    /// @notice Sets the portal once after deployment.
    function setPortal(address portal_) external onlyOperator {
        if (portal_ == address(0)) {
            revert InvalidAddress();
        }
        if (portal != address(0)) {
            revert PortalAlreadyConfigured();
        }
        portal = portal_;
        emit PortalConfigured(portal_);
    }

    /// @notice Transfers executor configuration rights.
    function setOperator(address nextOperator) external onlyOperator {
        if (nextOperator == address(0)) {
            revert InvalidAddress();
        }
        address previous = operator;
        operator = nextOperator;
        emit OperatorUpdated(previous, nextOperator);
    }

    /// @notice Sets target allowlist status for forwarded calls.
    function setTargetPermission(address target, bool allowed) external onlyOperator {
        if (target == address(0)) {
            revert InvalidAddress();
        }
        allowedTargets[target] = allowed;
        emit TargetPermissionSet(target, allowed);
    }

    /// @inheritdoc IGenericActionExecutor
    function executeAction(address actor, uint256 amount, bytes calldata actionData)
        external
        onlyPortal
        returns (bool)
    {
        (address target, uint256 value, bytes memory callData) = abi.decode(actionData, (address, uint256, bytes));
        if (!allowedTargets[target]) {
            revert TargetNotAllowed(target);
        }

        (bool success,) = target.call{value: value}(callData);
        emit ActionForwarded(actor, amount, target, value, success);
        return success;
    }

    receive() external payable {}
}
