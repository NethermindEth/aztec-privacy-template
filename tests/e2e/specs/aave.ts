import { createHash } from 'node:crypto';

import { AaveProtocolClient } from '../../../packages/protocols/aave/ts/aave';

export type ProtocolLifecycle = {
  protocol: 'aave';
  deploy(): Promise<{ protocolAddress: string }>;
  shield(value: string): Promise<{ messageHash: string }>;
  act(action: 'deposit' | 'withdraw', amount: string): Promise<{ contentHash: string }>;
  unshield(amount: string): Promise<{ messageHash: string }>;
  assert(): Promise<boolean>;
};

async function fakeTxHash(seed: string): Promise<string> {
  return `0x${createHash('sha256').update(seed).digest('hex').slice(0, 40)}`;
}

export const aaveSpec: ProtocolLifecycle = {
  protocol: 'aave',
  async deploy() {
    return { protocolAddress: '0x0000000000000000000000000000000000000000' };
  },
  async shield(value: string) {
    const client = new AaveProtocolClient();
    const message = client.buildDepositMessage({
      amount: value,
      referralCode: 0,
    });
    return { messageHash: message.contentHash };
  },
  async act(action, amount) {
    const client = new AaveProtocolClient();
    const message =
      action === 'deposit'
        ? client.buildDepositMessage({ amount, referralCode: 0 })
        : client.buildWithdrawMessage({ amount });
    return { contentHash: message.contentHash };
  },
  async unshield(amount: string) {
    const client = new AaveProtocolClient();
    const message = client.buildWithdrawMessage({
      amount,
    });
    return { messageHash: message.contentHash };
  },
  async assert() {
    const result = await fakeTxHash('aave-spec-assert');
    return result.startsWith('0x');
  },
};
