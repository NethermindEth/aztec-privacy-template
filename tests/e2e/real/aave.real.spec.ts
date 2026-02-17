import { strict as assert } from 'node:assert';
import test from 'node:test';
import {
  RELAYER_ADDRESS,
  RELAYER_PRIVATE_KEY,
  USER_ADDRESS,
  USER_PRIVATE_KEY,
  castCall,
  castKeccak,
  castSend,
  compileAztecContract,
  deployL1,
  ensureAztecLocalNetwork,
  provisionPrivateTokenBalance,
  stopProcess,
} from './runtime';

const PROTOCOL_ID = `0x${'11'.repeat(32)}`;
const AAVE_AZTEC_DIR = 'packages/protocols/aave/aztec';
const AAVE_SOLIDITY_DIR = 'packages/protocols/aave/solidity';

test('real Aave E2E: Aztec private token + L1 Aave portal flow', { timeout: 900_000 }, async () => {
  const runtime = await ensureAztecLocalNetwork();

  try {
    compileAztecContract(AAVE_AZTEC_DIR);
    const aztecState = await provisionPrivateTokenBalance('Aave Privacy Token', 'APT', 1_000n);
    const content = castKeccak(
      `aave-deposit:${aztecState.ownerAddress}:${aztecState.balance.toString()}`,
    );

    const mockTokenAddress = deployL1(
      'packages/protocols/aave/solidity/MockERC20.sol:MockERC20',
      AAVE_SOLIDITY_DIR,
    );
    const mockPoolAddress = deployL1(
      'packages/protocols/aave/solidity/MockAavePool.sol:MockAavePool',
      AAVE_SOLIDITY_DIR,
    );
    const portalAddress = deployL1(
      'packages/protocols/aave/solidity/AavePortal.sol:AavePortal',
      AAVE_SOLIDITY_DIR,
      [PROTOCOL_ID, USER_ADDRESS, RELAYER_ADDRESS, mockPoolAddress, mockTokenAddress],
    );

    castSend(USER_PRIVATE_KEY, mockTokenAddress, 'mint(address,uint256)', [
      mockPoolAddress,
      '1000000000000000000000',
    ]);

    castSend(USER_PRIVATE_KEY, portalAddress, 'requestDeposit(bytes32,uint256,uint16)', [
      content,
      '1000',
      '0',
    ]);

    const requestHash = castCall(portalAddress, 'messageHashFor(bytes32,address,uint64)(bytes32)', [
      content,
      USER_ADDRESS,
      '1',
    ]);

    castSend(
      RELAYER_PRIVATE_KEY,
      portalAddress,
      'executeDeposit(bytes32,address,uint256,uint16,uint64,uint64)',
      [content, USER_ADDRESS, '1000', '0', '1', '20'],
    );

    const consumed = castCall(portalAddress, 'hasMessageBeenConsumed(bytes32)(bool)', [
      requestHash,
    ]);
    assert.equal(consumed, 'true');

    const lastAmountRaw = castCall(mockPoolAddress, 'lastAmount()(uint256)');
    assert.equal(BigInt(lastAmountRaw), 1000n);

    const lastOnBehalfOf = castCall(mockPoolAddress, 'lastOnBehalfOf()(address)');
    assert.equal(lastOnBehalfOf.toLowerCase(), USER_ADDRESS);

    const lastReferralCodeRaw = castCall(mockPoolAddress, 'lastReferralCode()(uint16)');
    assert.equal(Number(lastReferralCodeRaw), 0);
  } finally {
    await stopProcess(runtime.process);
  }
});
