import { strict as assert } from 'node:assert';
import test from 'node:test';
import { USER_ADDRESS, castCall } from './runtime';
import { runProtocolE2EHappyPath, type ProtocolFlowSpec } from './e2e-flow';

const PROTOCOL_ID = `0x${'33'.repeat(32)}`;
const LIDO_AZTEC_DIR = 'packages/protocols/lido/aztec';
const LIDO_SOLIDITY_DIR = 'packages/protocols/lido/solidity';
const LIDO_MOCKS_SOLIDITY_DIR = 'tests/mocks/lido/solidity';
const TEST_TAG = 'LIDO';
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const ONE_ETH_WEI = '1000000000000000000';

const LIDO_FLOW: ProtocolFlowSpec = {
  tag: TEST_TAG,
  protocolId: PROTOCOL_ID,
  aztec: {
    dir: LIDO_AZTEC_DIR,
    tokenName: 'Lido Privacy Receipt',
    tokenSymbol: 'LPR',
    tokenAmount: 1_000n,
  },
  buildContent: (ownerAddress, balance) => `lido-stake:${ownerAddress}:${balance}`,
  portal: {
    source: 'packages/protocols/lido/solidity/LidoPortal.sol:LidoPortal',
    contractsDir: LIDO_SOLIDITY_DIR,
    constructorArgs: ({ protocolId, userAddress, relayerAddress, deployedMocks }) => [
      protocolId,
      userAddress,
      relayerAddress,
      deployedMocks.LIDO_MOCK_PROTOCOL,
    ],
  },
  mocks: [
    {
      label: 'LIDO_MOCK_PROTOCOL',
      source: 'tests/mocks/lido/solidity/MockLidoProtocol.sol:MockLidoProtocol',
      contractsDir: LIDO_MOCKS_SOLIDITY_DIR,
    },
  ],
  request: {
    signature: 'requestStake(bytes32,uint256,address,address)',
    args: ({ content, userAddress }) => [content, ONE_ETH_WEI, userAddress, ZERO_ADDRESS],
  },
  execute: {
    signature: 'executeStake(bytes32,address,uint256,address,address,uint64,uint64)',
    args: ({ content, userAddress }) => [
      content,
      userAddress,
      ONE_ETH_WEI,
      userAddress,
      ZERO_ADDRESS,
      '1',
      '20',
    ],
    valueWei: ONE_ETH_WEI,
  },
  assertState: ({ mocks }) => {
    const lastAmountRaw = castCall(mocks.LIDO_MOCK_PROTOCOL, 'lastAmount()(uint256)');
    const lastAmount = BigInt(lastAmountRaw.split(' ')[0]);
    assert.equal(lastAmount, 1_000_000_000_000_000_000n);

    const lastStakeRecipient = castCall(mocks.LIDO_MOCK_PROTOCOL, 'lastStakeRecipient()(address)');
    assert.equal(lastStakeRecipient.toLowerCase(), USER_ADDRESS);
  },
};

test('Lido E2E: Aztec private state + L1 Lido portal flow', { timeout: 900_000 }, async () => {
  await runProtocolE2EHappyPath(LIDO_FLOW);
});
