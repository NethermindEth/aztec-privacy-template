// SPDX-License-Identifier: MIT
pragma solidity ^0.8.33;

/* solhint-disable import-path-check */
import {Test} from "forge-std/Test.sol";
import {MockEscape} from "./EscapeHatchMock.sol";

/// @title EscapeHatchTest
/// @author aztec-privacy-template
/// @notice Tests for EscapeHatch behavior.
contract EscapeHatchTest is Test {
    MockEscape private target;

    /// @notice Initializes the test subject.
    function setUp() public {
        target = new MockEscape();
    }

    /// @notice Registers and then cancels a request.
    function testRegisterThenCancel() public {
        bytes32 key = keccak256(abi.encodePacked("escape"));
        target.register(key, address(0x1234), address(0), 1 ether, 10);
        EscapeHatch.EscapeRequest memory request = target.getEscapeRequest(key);
        assertEq(request.depositor, address(0x1234));

        target.cancel(key);
        request = target.getEscapeRequest(key);
        assertEq(request.depositor, address(0));
    }

    /// @notice Prevents duplicate request registration.
    function testCannotOverwriteEscapeRequest() public {
        bytes32 key = keccak256(abi.encodePacked("escape-dup"));
        target.register(key, address(0x1234), address(0), 1 ether, 10);

        vm.expectRevert(EscapeHatch.EscapeAlreadyRegistered.selector);
        target.register(key, address(0x1234), address(0), 2 ether, 10);
    }
}
