// SPDX-License-Identifier: MIT
pragma solidity ^0.8.33;

import {IUniswapV3RouterLike} from "./UniswapPortal.sol";

/* solhint-disable gas-custom-errors */
/// @title MockUniswapV3Router
/// @author aztec-privacy-template
/// @notice Mock implementation for swap router behavior.
contract MockUniswapV3Router is IUniswapV3RouterLike {
    /// @notice failure flag for controlled revert simulation.
    bool public shouldFail;
    /// @notice configured amountOut return when not failing.
    uint256 public simulatedAmountOut;
    /// @notice last input token.
    address public lastTokenIn;
    /// @notice last output token.
    address public lastTokenOut;
    /// @notice last pool fee.
    uint24 public lastFee;
    /// @notice last amount in.
    uint256 public lastAmountIn;
    /// @notice last amountOutMinimum.
    uint256 public lastAmountOutMinimum;
    /// @notice last recipient.
    address public lastRecipient;
    /// @notice last sqrtPriceLimit.
    uint160 public lastSqrtPriceLimitX96;

    /// @notice Builds a mock router starting with 1:1 quote behavior.
    constructor() {
        simulatedAmountOut = 1 ether;
    }

    /// @notice Configure failure mode.
    /// @param value If true, swaps revert.
    function setShouldFail(bool value) external {
        shouldFail = value;
    }

    /// @notice Configure simulated output amount.
    /// @param value Mocked output value.
    function setSimulatedAmountOut(uint256 value) external {
        simulatedAmountOut = value;
    }

    /// @notice Mocked exactInputSingle implementation.
    /// @param tokenIn Input token.
    /// @param tokenOut Output token.
    /// @param fee Fee tier.
    /// @param recipient Recipient address.
    /// @param amountIn Input amount.
    /// @param amountOutMinimum Minimum output.
    /// @param sqrtPriceLimitX96 Price limit.
    /// @return amountOut Output amount.
    function exactInputSingle(
        address tokenIn,
        address tokenOut,
        uint24 fee,
        address recipient,
        uint256 amountIn,
        uint256 amountOutMinimum,
        uint160 sqrtPriceLimitX96
    ) external returns (uint256 amountOut) {
        if (shouldFail) {
            revert("router failed");
        }

        lastTokenIn = tokenIn;
        lastTokenOut = tokenOut;
        lastFee = fee;
        lastAmountIn = amountIn;
        lastAmountOutMinimum = amountOutMinimum;
        lastRecipient = recipient;
        lastSqrtPriceLimitX96 = sqrtPriceLimitX96;
        return simulatedAmountOut;
    }
}
