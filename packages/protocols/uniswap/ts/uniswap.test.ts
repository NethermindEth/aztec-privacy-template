import { strict as assert } from 'node:assert';
import test from 'node:test';

import { verifyPrivateMessage } from '../../../core/ts/message-utils';
import { UNISWAP_SWAP_ACTION, UniswapProtocolClient } from './uniswap';

test('builds valid swap payload', () => {
  const client = new UniswapProtocolClient();
  const payload = client.buildSwapPayload({
    amountIn: 5_000,
    minAmountOut: 4_800,
    feeBps: 3000,
    tokenIn: '0xb000000000000000000000000000000000000001',
    tokenOut: '0xb000000000000000000000000000000000000002',
  });

  assert.equal(payload.tokenIn, '0xb000000000000000000000000000000000000001');
  assert.equal(payload.tokenOut, '0xb000000000000000000000000000000000000002');
  assert.equal(payload.amountIn, '5000');
  assert.equal(payload.minAmountOut, '4800');
  assert.equal(payload.feeBps, 3000);
});

test('validates invalid swap amounts', () => {
  const client = new UniswapProtocolClient();
  assert.throws(() => {
    client.buildSwapPayload({
      amountIn: 0,
      minAmountOut: '100',
      feeBps: 3000,
    });
  }, /Invalid amount/);

  assert.throws(() => {
    client.buildSwapPayload({
      amountIn: '1000',
      minAmountOut: '0',
      feeBps: 3000,
    });
  }, /Invalid amount/);
});

test('validates invalid swap fee', () => {
  const client = new UniswapProtocolClient();
  assert.throws(() => {
    client.buildSwapPayload({
      amountIn: 1000,
      minAmountOut: 900,
      feeBps: 0,
    });
  }, /Invalid fee/);

  assert.throws(() => {
    client.buildSwapPayload({
      amountIn: 1000,
      minAmountOut: 900,
      feeBps: 1_000_001,
    });
  }, /Invalid fee/);
});

test('allows output minimum greater than input amount across token pairs', () => {
  const client = new UniswapProtocolClient();
  const payload = client.buildSwapPayload({
    amountIn: '1000',
    minAmountOut: '2000',
    feeBps: 3000,
  });

  assert.equal(payload.amountIn, '1000');
  assert.equal(payload.minAmountOut, '2000');
});

test('normalizes numeric amounts to canonical decimal string', () => {
  const client = new UniswapProtocolClient();
  const payload = client.buildSwapPayload({
    amountIn: '000100',
    minAmountOut: 50,
    feeBps: 100,
  });

  assert.equal(payload.amountIn, '100');
  assert.equal(payload.minAmountOut, '50');
});

test('builds and verifies swap message', () => {
  const client = new UniswapProtocolClient();
  const encoded = client.buildSwapMessage({
    amountIn: '1000',
    minAmountOut: 900,
    feeBps: 3000,
    tokenIn: '0xc000000000000000000000000000000000000000',
    tokenOut: '0xd000000000000000000000000000000000000000',
  });

  assert.equal(verifyPrivateMessage(encoded, client.protocolName, UNISWAP_SWAP_ACTION), true);
});
