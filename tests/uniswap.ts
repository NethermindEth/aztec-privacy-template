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

const PROTOCOL_ID = `0x${'22'.repeat(32)}`;
const UNISWAP_AZTEC_DIR = 'packages/protocols/uniswap/aztec';
const UNISWAP_SOLIDITY_DIR = 'packages/protocols/uniswap/solidity';
const UNISWAP_MOCKS_SOLIDITY_DIR = 'tests/mocks/uniswap/solidity';
const TOKEN_IN = '0x000000000000000000000000000000000000ABCD';
const TOKEN_OUT = '0x000000000000000000000000000000000000BEEF';
const TEST_TAG = 'UNISWAP';

test(
  'Uniswap E2E: Aztec private state + L1 Uniswap portal flow',
  { timeout: 900_000 },
  async () => {
    logStep(TEST_TAG, 0, 'Start local Aztec + L1 runtime');
    const runtime = await ensureAztecLocalNetwork();

    try {
      logStep(TEST_TAG, 1, 'Compile Aztec adapter');
      compileAztecContract(UNISWAP_AZTEC_DIR);

      logStep(TEST_TAG, 2, 'Provision private Aztec token balance');
      const aztecState = await provisionPrivateTokenBalance('Uniswap Privacy Token', 'UPT', 5_000n);
      logValue(TEST_TAG, 'Aztec owner', aztecState.ownerAddress);
      logValue(TEST_TAG, 'Aztec private balance', aztecState.balance);

      logStep(TEST_TAG, 3, 'Build request content hash');
      const content = castKeccak(
        `uniswap-swap:${aztecState.ownerAddress}:${aztecState.balance.toString()}`,
      );
      logValue(TEST_TAG, 'Request content hash', content);

      logStep(TEST_TAG, 4, 'Deploy router mock + portal');
      const routerAddress = deployL1(
        'tests/mocks/uniswap/solidity/MockUniswapV3Router.sol:MockUniswapV3Router',
        UNISWAP_MOCKS_SOLIDITY_DIR,
      );
      logValue(TEST_TAG, 'MockUniswapV3Router', routerAddress);
      castSend(USER_PRIVATE_KEY, routerAddress, 'setSimulatedAmountOut(uint256)', ['1200']);

      const portalAddress = deployL1(
        'packages/protocols/uniswap/solidity/UniswapPortal.sol:UniswapPortal',
        UNISWAP_SOLIDITY_DIR,
        [PROTOCOL_ID, USER_ADDRESS, RELAYER_ADDRESS, routerAddress],
      );
      logValue(TEST_TAG, 'UniswapPortal', portalAddress);

      logStep(TEST_TAG, 5, 'Submit user swap request');
      castSend(
        USER_PRIVATE_KEY,
        portalAddress,
        'requestSwap(bytes32,address,address,uint256,uint256,uint24,address)',
        [content, TOKEN_IN, TOKEN_OUT, '1000', '900', '3000', USER_ADDRESS],
      );

      const requestHash = castCall(
        portalAddress,
        'messageHashFor(bytes32,address,uint64)(bytes32)',
        [content, USER_ADDRESS, '1'],
      );
      logValue(TEST_TAG, 'Request hash', requestHash);

      logStep(TEST_TAG, 6, 'Execute relayer swap on L1');
      castSend(
        RELAYER_PRIVATE_KEY,
        portalAddress,
        'executeSwap(bytes32,address,address,address,uint256,uint256,uint24,address,uint64,uint64)',
        [
          content,
          USER_ADDRESS,
          TOKEN_IN,
          TOKEN_OUT,
          '1000',
          '900',
          '3000',
          USER_ADDRESS,
          '1',
          '20',
        ],
      );

      logStep(TEST_TAG, 7, 'Assert consumed message + router side effects');
      const consumed = castCall(portalAddress, 'hasMessageBeenConsumed(bytes32)(bool)', [
        requestHash,
      ]);
      assert.equal(consumed, 'true');

      const lastAmountInRaw = castCall(routerAddress, 'lastAmountIn()(uint256)');
      assert.equal(BigInt(lastAmountInRaw), 1000n);

      const lastFeeRaw = castCall(routerAddress, 'lastFee()(uint24)');
      assert.equal(Number(lastFeeRaw), 3000);

      const lastRecipient = castCall(routerAddress, 'lastRecipient()(address)');
      assert.equal(lastRecipient.toLowerCase(), USER_ADDRESS);
    } finally {
      await stopProcess(runtime.process);
    }
  },
);
