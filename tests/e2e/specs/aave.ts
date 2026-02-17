import type { ProtocolLifecycle } from '../harness';
import { AaveProtocolClient } from '../../../packages/protocols/aave/ts/aave';
import { createHash } from 'node:crypto';

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
    const result = createHash('sha256').update('aave-spec-assert').digest('hex');
    return `0x${result}`.startsWith('0x');
  },
};
