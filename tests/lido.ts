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

const PROTOCOL_ID = `0x${'33'.repeat(32)}`;
const LIDO_AZTEC_DIR = 'packages/protocols/lido/aztec';
const LIDO_SOLIDITY_DIR = 'packages/protocols/lido/solidity';
const LIDO_MOCKS_SOLIDITY_DIR = 'tests/mocks/lido/solidity';
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const ONE_ETH_WEI = '1000000000000000000';
const TEST_TAG = 'LIDO';

test('Lido E2E: Aztec private state + L1 Lido portal flow', { timeout: 900_000 }, async () => {
  logStep(TEST_TAG, 0, 'Start local Aztec + L1 runtime');
  const runtime = await ensureAztecLocalNetwork();

  try {
    logStep(TEST_TAG, 1, 'Compile Aztec adapter');
    compileAztecContract(LIDO_AZTEC_DIR);

    logStep(TEST_TAG, 2, 'Provision private Aztec token balance');
    const aztecState = await provisionPrivateTokenBalance('Lido Privacy Receipt', 'LPR', 1_000n);
    logValue(TEST_TAG, 'Aztec owner', aztecState.ownerAddress);
    logValue(TEST_TAG, 'Aztec private balance', aztecState.balance);

    logStep(TEST_TAG, 3, 'Build request content hash');
    const content = castKeccak(
      `lido-stake:${aztecState.ownerAddress}:${aztecState.balance.toString()}`,
    );
    logValue(TEST_TAG, 'Request content hash', content);

    logStep(TEST_TAG, 4, 'Deploy L1 protocol mock + portal');
    const protocolAddress = deployL1(
      'tests/mocks/lido/solidity/MockLidoProtocol.sol:MockLidoProtocol',
      LIDO_MOCKS_SOLIDITY_DIR,
    );
    logValue(TEST_TAG, 'MockLidoProtocol', protocolAddress);
    const portalAddress = deployL1(
      'packages/protocols/lido/solidity/LidoPortal.sol:LidoPortal',
      LIDO_SOLIDITY_DIR,
      [PROTOCOL_ID, USER_ADDRESS, RELAYER_ADDRESS, protocolAddress],
    );
    logValue(TEST_TAG, 'LidoPortal', portalAddress);

    logStep(TEST_TAG, 5, 'Submit user stake request');
    castSend(USER_PRIVATE_KEY, portalAddress, 'requestStake(bytes32,uint256,address,address)', [
      content,
      ONE_ETH_WEI,
      USER_ADDRESS,
      ZERO_ADDRESS,
    ]);

    const requestHash = castCall(portalAddress, 'messageHashFor(bytes32,address,uint64)(bytes32)', [
      content,
      USER_ADDRESS,
      '1',
    ]);
    logValue(TEST_TAG, 'Request hash', requestHash);

    logStep(TEST_TAG, 6, 'Execute relayer stake on L1');
    castSend(
      RELAYER_PRIVATE_KEY,
      portalAddress,
      'executeStake(bytes32,address,uint256,address,address,uint64,uint64)',
      [content, USER_ADDRESS, ONE_ETH_WEI, USER_ADDRESS, ZERO_ADDRESS, '1', '20'],
      ONE_ETH_WEI,
    );

    logStep(TEST_TAG, 7, 'Assert consumed message + protocol side effects');
    const consumed = castCall(portalAddress, 'hasMessageBeenConsumed(bytes32)(bool)', [
      requestHash,
    ]);
    assert.equal(consumed, 'true');

    const lastAmountRaw = castCall(protocolAddress, 'lastAmount()(uint256)');
    const lastAmount = BigInt(lastAmountRaw.split(' ')[0]);
    assert.equal(lastAmount, 1_000_000_000_000_000_000n);

    const lastStakeRecipient = castCall(protocolAddress, 'lastStakeRecipient()(address)');
    assert.equal(lastStakeRecipient.toLowerCase(), USER_ADDRESS);
  } finally {
    await stopProcess(runtime.process);
  }
});
