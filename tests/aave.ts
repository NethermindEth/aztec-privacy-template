import { strict as assert } from 'node:assert';
import test from 'node:test';
import { USER_ADDRESS, USER_PRIVATE_KEY, castCall, castSend } from './runtime';
import { runProtocolE2EHappyPath, type ProtocolFlowSpec } from './e2e-flow';

const PROTOCOL_ID = `0x${'11'.repeat(32)}`;
const AAVE_AZTEC_DIR = 'packages/protocols/aave/aztec';
const AAVE_SOLIDITY_DIR = 'packages/protocols/aave/solidity';
const AAVE_MOCKS_SOLIDITY_DIR = 'tests/mocks/aave/solidity';
const TEST_TAG = 'AAVE';
const LP_TOKEN_MOCK_LIQUIDITY = '1000000000000000000000';

const AAVE_FLOW: ProtocolFlowSpec = {
  tag: TEST_TAG,
  protocolId: PROTOCOL_ID,
  aztec: {
    dir: AAVE_AZTEC_DIR,
    tokenName: 'Aave Privacy Token',
    tokenSymbol: 'APT',
    tokenAmount: 1_000n,
  },
  buildContent: (ownerAddress, balance) => `aave-deposit:${ownerAddress}:${balance}`,
  portal: {
    source: 'packages/protocols/aave/solidity/AavePortal.sol:AavePortal',
    contractsDir: AAVE_SOLIDITY_DIR,
    constructorArgs: ({ protocolId, userAddress, relayerAddress, deployedMocks }) => [
      protocolId,
      userAddress,
      relayerAddress,
      deployedMocks.AAVE_MOCK_POOL,
      deployedMocks.AAVE_MOCK_ERC20,
    ],
  },
  mocks: [
    {
      label: 'AAVE_MOCK_ERC20',
      source: 'tests/mocks/aave/solidity/MockERC20.sol:MockERC20',
      contractsDir: AAVE_MOCKS_SOLIDITY_DIR,
    },
    {
      label: 'AAVE_MOCK_POOL',
      source: 'tests/mocks/aave/solidity/MockAavePool.sol:MockAavePool',
      contractsDir: AAVE_MOCKS_SOLIDITY_DIR,
    },
  ],
  setup: ({ mocks }) => {
    castSend(USER_PRIVATE_KEY, mocks.AAVE_MOCK_ERC20, 'mint(address,uint256)', [
      mocks.AAVE_MOCK_POOL,
      LP_TOKEN_MOCK_LIQUIDITY,
    ]);
  },
  request: {
    signature: 'requestDeposit(bytes32,uint256,uint16)',
    args: ({ content }) => [content, '1000', '0'],
  },
  execute: {
    signature: 'executeDeposit(bytes32,address,uint256,uint16,uint64,uint64)',
    args: ({ content, userAddress }) => [content, userAddress, '1000', '0', '1', '20'],
  },
  assertState: ({ mocks }) => {
    const lastAmountRaw = castCall(mocks.AAVE_MOCK_POOL, 'lastAmount()(uint256)');
    assert.equal(BigInt(lastAmountRaw), 1000n);

    const lastOnBehalfOf = castCall(mocks.AAVE_MOCK_POOL, 'lastOnBehalfOf()(address)');
    assert.equal(lastOnBehalfOf.toLowerCase(), USER_ADDRESS);

    const lastReferralCodeRaw = castCall(mocks.AAVE_MOCK_POOL, 'lastReferralCode()(uint16)');
    assert.equal(Number(lastReferralCodeRaw), 0);
  },
};

test('Aave E2E: Aztec private token + L1 Aave portal flow', { timeout: 900_000 }, async () => {
  await runProtocolE2EHappyPath(AAVE_FLOW);
});
