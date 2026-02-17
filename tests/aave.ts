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
  logStep,
  logValue,
  provisionPrivateTokenBalance,
  stopProcess,
} from './runtime';

const PROTOCOL_ID = `0x${'11'.repeat(32)}`;
const AAVE_AZTEC_DIR = 'packages/protocols/aave/aztec';
const AAVE_SOLIDITY_DIR = 'packages/protocols/aave/solidity';
const AAVE_MOCKS_SOLIDITY_DIR = 'tests/mocks/aave/solidity';
const TEST_TAG = 'AAVE';

test('Aave E2E: Aztec private token + L1 Aave portal flow', { timeout: 900_000 }, async () => {
  logStep(TEST_TAG, 0, 'Start local Aztec + L1 runtime');
  const runtime = await ensureAztecLocalNetwork();

  try {
    logStep(TEST_TAG, 1, 'Compile Aztec adapter');
    compileAztecContract(AAVE_AZTEC_DIR);

    logStep(TEST_TAG, 2, 'Provision private Aztec token balance');
    const aztecState = await provisionPrivateTokenBalance('Aave Privacy Token', 'APT', 1_000n);
    logValue(TEST_TAG, 'Aztec owner', aztecState.ownerAddress);
    logValue(TEST_TAG, 'Aztec private balance', aztecState.balance);

    logStep(TEST_TAG, 3, 'Build request content hash');
    const content = castKeccak(
      `aave-deposit:${aztecState.ownerAddress}:${aztecState.balance.toString()}`,
    );
    logValue(TEST_TAG, 'Request content hash', content);

    logStep(TEST_TAG, 4, 'Deploy L1 mocks + portal');
    const mockTokenAddress = deployL1(
      'tests/mocks/aave/solidity/MockERC20.sol:MockERC20',
      AAVE_MOCKS_SOLIDITY_DIR,
    );
    logValue(TEST_TAG, 'MockERC20', mockTokenAddress);
    const mockPoolAddress = deployL1(
      'tests/mocks/aave/solidity/MockAavePool.sol:MockAavePool',
      AAVE_MOCKS_SOLIDITY_DIR,
    );
    logValue(TEST_TAG, 'MockAavePool', mockPoolAddress);
    const portalAddress = deployL1(
      'packages/protocols/aave/solidity/AavePortal.sol:AavePortal',
      AAVE_SOLIDITY_DIR,
      [PROTOCOL_ID, USER_ADDRESS, RELAYER_ADDRESS, mockPoolAddress, mockTokenAddress],
    );
    logValue(TEST_TAG, 'AavePortal', portalAddress);

    logStep(TEST_TAG, 5, 'Seed mock pool liquidity');
    castSend(USER_PRIVATE_KEY, mockTokenAddress, 'mint(address,uint256)', [
      mockPoolAddress,
      '1000000000000000000000',
    ]);

    logStep(TEST_TAG, 6, 'Submit user deposit request');
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
    logValue(TEST_TAG, 'Request hash', requestHash);

    logStep(TEST_TAG, 7, 'Execute relayer deposit on L1');
    castSend(
      RELAYER_PRIVATE_KEY,
      portalAddress,
      'executeDeposit(bytes32,address,uint256,uint16,uint64,uint64)',
      [content, USER_ADDRESS, '1000', '0', '1', '20'],
    );

    logStep(TEST_TAG, 8, 'Assert consumed message + protocol side effects');
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
