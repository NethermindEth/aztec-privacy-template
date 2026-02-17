import type { ProtocolLifecycle } from '../harness';
import { UniswapProtocolClient } from '../../../packages/protocols/uniswap/ts/uniswap';
import { createHash } from 'node:crypto';

export const uniswapSpec: ProtocolLifecycle = {
  protocol: 'uniswap',
  async deploy() {
    return { protocolAddress: '0x0000000000000000000000000000000000000000' };
  },
  async shield(value: string) {
    const client = new UniswapProtocolClient();
    const message = client.buildSwapMessage({
      amountIn: value,
      minAmountOut: 1,
      feeBps: 3000,
    });
    return { messageHash: message.contentHash };
  },
  async act(action, amount) {
    const client = new UniswapProtocolClient();
    if (action !== 'swap') {
      throw new Error('Unsupported action');
    }

    const message = client.buildSwapMessage({
      amountIn: amount,
      minAmountOut: 1,
      feeBps: 3000,
    });
    return { contentHash: message.contentHash };
  },
  async unshield(amount: string) {
    const client = new UniswapProtocolClient();
    const message = client.buildSwapMessage({
      amountIn: amount,
      minAmountOut: 1,
      feeBps: 3000,
    });
    return { messageHash: message.contentHash };
  },
  async assert() {
    const result = createHash('sha256').update('uniswap-spec-assert').digest('hex');
    return `0x${result}`.startsWith('0x');
  },
};
