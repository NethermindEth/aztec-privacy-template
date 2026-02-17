// SPDX-License-Identifier: MIT
pragma solidity ^0.8.33;

/// @title MockERC20
/// @author aztec-privacy-template
/// @notice Minimal ERC20-like token for portal test doubles.
contract MockERC20 {
    /// @notice token balance snapshot.
    mapping(address => uint256) public balanceOf;

    /// @notice Mints tokens into an account.
    /// @param to Recipient account.
    /// @param amount Amount minted.
    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
    }

    /// @notice Transfers balance between accounts.
    /// @param to Recipient account.
    /// @param amount Amount to transfer.
    /// @return success true when balance is sufficient.
    function transfer(address to, uint256 amount) external returns (bool) {
        uint256 balance = balanceOf[msg.sender];
        if (balance < amount) {
            return false;
        }
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        return true;
    }
}
