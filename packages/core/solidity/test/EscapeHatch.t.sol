// SPDX-License-Identifier: MIT
pragma solidity ^0.8.33;

import "forge-std/Test.sol";

import "../EscapeHatch.sol";

contract MockEscape is EscapeHatch {
    function register(bytes32 messageHash, address depositor, address token, uint256 amount, uint64 timeoutBlocks)
        external
    {
        _registerEscape(messageHash, depositor, token, amount, timeoutBlocks);
    }

    function cancel(bytes32 messageHash) external {
        _cancelEscape(messageHash);
    }
}

contract EscapeHatchTest is Test {
    MockEscape private target;

    function setUp() public {
        target = new MockEscape();
    }

    function testRegisterThenCancel() public {
        bytes32 key = keccak256('escape');
        target.register(key, address(0x1234), address(0), 1 ether, 10);
        EscapeRequest memory request = target.getEscapeRequest(key);
        assertEq(request.depositor, address(0x1234));

        target.cancel(key);
        request = target.getEscapeRequest(key);
        assertEq(request.depositor, address(0));
    }
}
