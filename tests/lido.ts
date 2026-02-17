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

const PROTOCOL_ID = `0x${'33'.repeat(32)}`;
const LIDO_AZTEC_DIR = 'packages/protocols/lido/aztec';
const LIDO_SOLIDITY_DIR = 'packages/protocols/lido/solidity';
const LIDO_MOCKS_SOLIDITY_DIR = 'tests/mocks/lido/solidity';
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const ONE_ETH_WEI = '1000000000000000000';

test('Lido E2E: Aztec private state + L1 Lido portal flow', { timeout: 900_000 }, async () => {
  const runtime = await ensureAztecLocalNetwork();

  try {
    compileAztecContract(LIDO_AZTEC_DIR);
    const aztecState = await provisionPrivateTokenBalance('Lido Privacy Receipt', 'LPR', 1_000n);
    const content = castKeccak(
      `lido-stake:${aztecState.ownerAddress}:${aztecState.balance.toString()}`,
    );

    const protocolAddress = deployL1(
      'tests/mocks/lido/solidity/MockLidoProtocol.sol:MockLidoProtocol',
      LIDO_MOCKS_SOLIDITY_DIR,
    );
    const portalAddress = deployL1(
      'packages/protocols/lido/solidity/LidoPortal.sol:LidoPortal',
      LIDO_SOLIDITY_DIR,
      [PROTOCOL_ID, USER_ADDRESS, RELAYER_ADDRESS, protocolAddress],
    );

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

    castSend(
      RELAYER_PRIVATE_KEY,
      portalAddress,
      'executeStake(bytes32,address,uint256,address,address,uint64,uint64)',
      [content, USER_ADDRESS, ONE_ETH_WEI, USER_ADDRESS, ZERO_ADDRESS, '1', '20'],
      ONE_ETH_WEI,
    );

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
