// SPDX-License-Identifier: MIT
pragma solidity ^0.8.33;

import {AavePortal} from "./AavePortal.sol";

/// @title AavePortalTestHarness
/// @author aztec-privacy-template
/// @notice Exposes the Aave portal with constructor wiring for tests.
contract AavePortalTestHarness is AavePortal {
    constructor(
        bytes32 protocolId_,
        address l2Contract_,
        address relayer_,
        address aavePool_,
        address asset_
    )
        AavePortal(protocolId_, l2Contract_, relayer_, aavePool_, asset_)
    {}
}
