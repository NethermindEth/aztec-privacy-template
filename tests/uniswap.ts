import { strict as assert } from 'node:assert';
import test from 'node:test';
import { USER_ADDRESS, USER_PRIVATE_KEY, castCall, castSend } from './runtime';
import { runProtocolE2EHappyPath, type ProtocolFlowSpec } from './e2e-flow';

const PROTOCOL_ID = `0x${'22'.repeat(32)}`;
const UNISWAP_AZTEC_DIR = 'packages/protocols/uniswap/aztec';
const UNISWAP_SOLIDITY_DIR = 'packages/protocols/uniswap/solidity';
const UNISWAP_MOCKS_SOLIDITY_DIR = 'tests/mocks/uniswap/solidity';
const TEST_TAG = 'UNISWAP';
const TOKEN_IN = '0x000000000000000000000000000000000000ABCD';
const TOKEN_OUT = '0x000000000000000000000000000000000000BEEF';
const SIMULATED_AMOUNT_OUT = '1200';

const UNISWAP_FLOW: ProtocolFlowSpec = {
  tag: TEST_TAG,
  protocolId: PROTOCOL_ID,
  aztec: {
    dir: UNISWAP_AZTEC_DIR,
    tokenName: 'Uniswap Privacy Token',
    tokenSymbol: 'UPT',
    tokenAmount: 5_000n,
  },
  buildContent: (ownerAddress, balance) => `uniswap-swap:${ownerAddress}:${balance}`,
  portal: {
    source: 'packages/protocols/uniswap/solidity/UniswapPortal.sol:UniswapPortal',
    contractsDir: UNISWAP_SOLIDITY_DIR,
    constructorArgs: ({ protocolId, userAddress, relayerAddress, deployedMocks }) => [
      protocolId,
      userAddress,
      relayerAddress,
      deployedMocks.UNISWAP_MOCK_ROUTER,
    ],
  },
  mocks: [
    {
      label: 'UNISWAP_MOCK_ROUTER',
      source: 'tests/mocks/uniswap/solidity/MockUniswapV3Router.sol:MockUniswapV3Router',
      contractsDir: UNISWAP_MOCKS_SOLIDITY_DIR,
    },
  ],
  setup: ({ mocks }) => {
    castSend(USER_PRIVATE_KEY, mocks.UNISWAP_MOCK_ROUTER, 'setSimulatedAmountOut(uint256)', [
      SIMULATED_AMOUNT_OUT,
    ]);
  },
  request: {
    signature: 'requestSwap(bytes32,address,address,uint256,uint256,uint24,address)',
    args: ({ content, userAddress }) => [
      content,
      TOKEN_IN,
      TOKEN_OUT,
      '1000',
      '900',
      '3000',
      userAddress,
    ],
  },
  execute: {
    signature:
      'executeSwap(bytes32,address,address,address,uint256,uint256,uint24,address,uint64,uint64)',
    args: ({ content, userAddress }) => [
      content,
      userAddress,
      TOKEN_IN,
      TOKEN_OUT,
      '1000',
      '900',
      '3000',
      userAddress,
      '1',
      '20',
    ],
  },
  assertState: ({ mocks }) => {
    const lastAmountInRaw = castCall(mocks.UNISWAP_MOCK_ROUTER, 'lastAmountIn()(uint256)');
    assert.equal(BigInt(lastAmountInRaw), 1000n);

    const lastFeeRaw = castCall(mocks.UNISWAP_MOCK_ROUTER, 'lastFee()(uint24)');
    assert.equal(Number(lastFeeRaw), 3000);

    const lastRecipient = castCall(mocks.UNISWAP_MOCK_ROUTER, 'lastRecipient()(address)');
    assert.equal(lastRecipient.toLowerCase(), USER_ADDRESS);
  },
};

test(
  'Uniswap E2E: Aztec private state + L1 Uniswap portal flow',
  { timeout: 900_000 },
  async () => {
    await runProtocolE2EHappyPath(UNISWAP_FLOW);
  },
);
