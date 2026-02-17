import { createHash } from 'node:crypto';

import type { ProtocolName } from './harness';

export type RelayerSubmitInput = {
  protocol: ProtocolName;
  protocolAddress: string;
  phase: string;
  payloadHash: string;
  blockHeight: number;
};

export type RelayerSubmitResult = {
  txHash: string;
  requestId: string;
};

export class StatelessRelayerRunner {
  public async submit(input: RelayerSubmitInput): Promise<RelayerSubmitResult> {
    const seed = `relayer-runner|${input.protocol}|${input.protocolAddress}|${input.phase}|${input.payloadHash}|${input.blockHeight}`;
    const digest = createHash('sha256').update(seed).digest('hex');

    return {
      txHash: `0x${digest.slice(0, 40)}`,
      requestId: `0x${digest.slice(40, 80)}`,
    };
  }
}
