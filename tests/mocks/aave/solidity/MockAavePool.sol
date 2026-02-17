// SPDX-License-Identifier: MIT
pragma solidity ^0.8.33;

import {IAaveV3PoolLike} from "../../../../packages/protocols/aave/solidity/AavePortal.sol";

/* solhint-disable gas-custom-errors */
/// @title MockAavePool
/// @author aztec-privacy-template
/// @notice Minimal test double for the pool interactions.
contract MockAavePool is IAaveV3PoolLike {
    /// @notice If true, pool interactions revert.
    bool public shouldFail;
    /// @notice last asset passed to supply/withdraw.
    address public lastAsset;
    /// @notice last amount passed to supply/withdraw.
    uint256 public lastAmount;
    /// @notice last recipient on behalf for supply.
    address public lastOnBehalfOf;
    /// @notice last referral code on supply.
    uint16 public lastReferralCode;
    /// @notice last recipient for withdraw.
    address public lastRecipient;

    /// @notice configure failure mode for test coverage.
    /// @param value If true, operations revert.
    function setShouldFail(bool value) external {
        shouldFail = value;
    }

    /// @notice supply mock implementation.
    /// @param asset Asset address.
    /// @param amount Amount to deposit.
    /// @param onBehalfOf Recipient of credit.
    /// @param referralCode Referral code.
    function supply(address asset, uint256 amount, address onBehalfOf, uint16 referralCode) external {
        if (shouldFail) {
            revert("Aave pool supply failed");
        }
        lastAsset = asset;
        lastAmount = amount;
        lastOnBehalfOf = onBehalfOf;
        lastReferralCode = referralCode;
    }

    /// @notice withdraw mock implementation.
    /// @param asset Asset address.
    /// @param amount Amount to withdraw.
    /// @param to Recipient.
    /// @return withdrawnAmount Amount returned to caller.
    function withdraw(address asset, uint256 amount, address to) external returns (uint256) {
        if (shouldFail) {
            revert("Aave pool withdraw failed");
        }
        lastAsset = asset;
        lastAmount = amount;
        lastRecipient = to;
        return amount;
    }
}
