// SPDX-License-Identifier: MIT
pragma solidity ^0.8.33;

import {ILidoLike} from "../../../../packages/protocols/lido/solidity/LidoPortal.sol";

/// @title MockLidoProtocol
/// @author aztec-privacy-template
/// @notice Test double for stake/unstake calls.
contract MockLidoProtocol is ILidoLike {
    /// @notice If true, protocol methods revert.
    bool public shouldFail;
    /// @notice mocked amount returned by `unstake`.
    uint256 public simulatedUnstakeReturn;
    /// @notice last beneficiary passed to stake.
    address public lastStakeRecipient;
    /// @notice last referral passed to stake.
    address public lastReferral;
    /// @notice last owner passed to unstake.
    address public lastUnstakeOwner;
    /// @notice last recipient passed to unstake.
    address public lastUnstakeRecipient;
    /// @notice last amount passed to both stake and unstake methods.
    uint256 public lastAmount;
    /// @notice indicates a mocked protocol failure is requested.
    error ProtocolOperationFailed();

    /// @notice Initializes the mock protocol.
    constructor() {
        simulatedUnstakeReturn = 1 ether;
    }

    /// @notice Configure failure mode for controlled revert simulation.
    /// @param value If true, protocol interactions revert.
    function setShouldFail(bool value) external {
        shouldFail = value;
    }

    /// @notice Configure unstake return value.
    /// @param value Simulated value to return from `unstake`.
    function setSimulatedUnstakeReturn(uint256 value) external {
        simulatedUnstakeReturn = value;
    }

    /// @notice Minimal mocked `submit`.
    /// @param beneficiary Wrapped-token beneficiary.
    /// @param referral Referral recipient.
    /// @return minted Amount of wrapped token minted.
    function submit(address beneficiary, address referral) external payable returns (uint256 minted) {
        if (shouldFail) {
            revert ProtocolOperationFailed();
        }

        lastStakeRecipient = beneficiary;
        lastReferral = referral;
        lastAmount = msg.value;
        return msg.value;
    }

    /// @notice Minimal mocked `unstake`.
    /// @param owner Address whose stake is being unwound.
    /// @param recipient Recipient of unlocked ETH.
    /// @param amount Amount requested.
    /// @return unlocked Amount unlocked.
    function unstake(
        address owner,
        address recipient,
        uint256 amount
    ) external returns (uint256 unlocked) {
        if (shouldFail) {
            revert ProtocolOperationFailed();
        }

        lastUnstakeOwner = owner;
        lastUnstakeRecipient = recipient;
        lastAmount = amount;
        return simulatedUnstakeReturn;
    }

    /// @notice Receive ETH sent by external callers.
    receive() external payable {}
}
