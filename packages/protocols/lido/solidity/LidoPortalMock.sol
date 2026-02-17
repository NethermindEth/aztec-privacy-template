// SPDX-License-Identifier: MIT
pragma solidity ^0.8.33;

import {LidoPortal} from "./LidoPortal.sol";

/// @title LidoPortalTestHarness
/// @author aztec-privacy-template
/// @notice Exposes the Lido portal constructor for tests.
contract LidoPortalTestHarness is LidoPortal {
    constructor(bytes32 protocolId_, address l2Contract_, address relayer_, address lidoProtocol_)
        LidoPortal(protocolId_, l2Contract_, relayer_, lidoProtocol_)
    {}
}
