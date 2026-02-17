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

const PROTOCOL_ID = `0x${'22'.repeat(32)}`;
const UNISWAP_AZTEC_DIR = 'packages/protocols/uniswap/aztec';
const UNISWAP_SOLIDITY_DIR = 'packages/protocols/uniswap/solidity';
const TOKEN_IN = '0x000000000000000000000000000000000000ABCD';
const TOKEN_OUT = '0x000000000000000000000000000000000000BEEF';

test(
  'real Uniswap E2E: Aztec private state + L1 Uniswap portal flow',
  { timeout: 900_000 },
  async () => {
    const runtime = await ensureAztecLocalNetwork();

    try {
      compileAztecContract(UNISWAP_AZTEC_DIR);
      const aztecState = await provisionPrivateTokenBalance('Uniswap Privacy Token', 'UPT', 5_000n);
      const content = castKeccak(
        `uniswap-swap:${aztecState.ownerAddress}:${aztecState.balance.toString()}`,
      );

      const routerAddress = deployL1(
        'packages/protocols/uniswap/solidity/MockUniswapV3Router.sol:MockUniswapV3Router',
        UNISWAP_SOLIDITY_DIR,
      );
      castSend(USER_PRIVATE_KEY, routerAddress, 'setSimulatedAmountOut(uint256)', ['1200']);

      const portalAddress = deployL1(
        'packages/protocols/uniswap/solidity/UniswapPortal.sol:UniswapPortal',
        UNISWAP_SOLIDITY_DIR,
        [PROTOCOL_ID, USER_ADDRESS, RELAYER_ADDRESS, routerAddress],
      );

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
