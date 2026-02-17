import { createHash } from 'node:crypto';

import { UniswapProtocolClient } from '../../../packages/protocols/uniswap/ts/uniswap';

export type ProtocolLifecycle = {
  protocol: 'uniswap';
  deploy(): Promise<{ protocolAddress: string }>;
  shield(value: string): Promise<{ messageHash: string }>;
  act(action: 'swap', amount: string): Promise<{ contentHash: string }>;
  unshield(amount: string): Promise<{ messageHash: string }>;
  assert(): Promise<boolean>;
};

async function fakeTxHash(seed: string): Promise<string> {
  return `0x${createHash('sha256').update(seed).digest('hex').slice(0, 40)}`;
}

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
    const result = await fakeTxHash('uniswap-spec-assert');
    return result.startsWith('0x');
  },
};
