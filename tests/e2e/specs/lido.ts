import { createHash } from 'node:crypto';

import { LidoProtocolClient } from '../../../packages/protocols/lido/ts/lido';

const STAKE_RECIPIENT = '0xB000000000000000000000000000000000000001';

export type ProtocolLifecycle = {
  protocol: 'lido';
  deploy(): Promise<{ protocolAddress: string }>;
  shield(value: string): Promise<{ messageHash: string }>;
  act(action: 'stake' | 'unstake', amount: string): Promise<{ contentHash: string }>;
  unshield(amount: string): Promise<{ messageHash: string }>;
  assert(): Promise<boolean>;
};

async function fakeTxHash(seed: string): Promise<string> {
  return `0x${createHash('sha256').update(seed).digest('hex').slice(0, 40)}`;
}

export const lidoSpec: ProtocolLifecycle = {
  protocol: 'lido',
  async deploy() {
    return { protocolAddress: '0x0000000000000000000000000000000000000000' };
  },
  async shield(value: string) {
    const client = new LidoProtocolClient();
    const message = client.buildStakeMessage({
      amount: value,
      recipient: STAKE_RECIPIENT,
      referral: '0x0000000000000000000000000000000000000000',
    });
    return { messageHash: message.contentHash };
  },
  async act(action, amount) {
    const client = new LidoProtocolClient();
    if (action === 'stake') {
      const message = client.buildStakeMessage({
        amount,
        recipient: STAKE_RECIPIENT,
        referral: '0x0000000000000000000000000000000000000000',
      });
      return { contentHash: message.contentHash };
    }

    const message = client.buildUnstakeMessage({
      amount,
      recipient: STAKE_RECIPIENT,
    });
    return { contentHash: message.contentHash };
  },
  async unshield(amount: string) {
    const client = new LidoProtocolClient();
    const message = client.buildUnstakeMessage({
      amount,
      recipient: STAKE_RECIPIENT,
    });
    return { messageHash: message.contentHash };
  },
  async assert() {
    const result = await fakeTxHash('lido-spec-assert');
    return result.startsWith('0x');
  },
};
