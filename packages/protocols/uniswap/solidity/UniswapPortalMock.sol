// SPDX-License-Identifier: MIT
pragma solidity ^0.8.33;

import {UniswapPortal} from "./UniswapPortal.sol";

/// @title UniswapPortalTestHarness
/// @author aztec-privacy-template
/// @notice Exposes the Uniswap portal constructor for testing.
contract UniswapPortalTestHarness is UniswapPortal {
    constructor(
        bytes32 protocolId_,
        address l2Contract_,
        address relayer_,
        address swapRouter_
    )
        UniswapPortal(protocolId_, l2Contract_, relayer_, swapRouter_)
    {}
}
