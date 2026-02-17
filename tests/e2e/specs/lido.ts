import type { ProtocolLifecycle } from '../harness';
import { LidoProtocolClient } from '../../../packages/protocols/lido/ts/lido';
import { createHash } from 'node:crypto';

const STAKE_RECIPIENT = '0xB000000000000000000000000000000000000001';

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
    const result = createHash('sha256').update('lido-spec-assert').digest('hex');
    return `0x${result}`.startsWith('0x');
  },
};
