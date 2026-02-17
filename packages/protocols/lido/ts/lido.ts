// SPDX-License-Identifier: MIT
import { AztecClient } from '../../../core/ts/aztec';
import type { EncodedMessage } from '../../../core/ts/message-utils';
import {
  PROTOCOL_NAME,
  TOKEN_ADDRESS,
  ESCAPE_TIMEOUT_BLOCKS,
} from '../generated/protocol_constants';

export const LIDO_STAKE_ACTION = 'lido.stake';
export const LIDO_UNSTAKE_ACTION = 'lido.unstake';

export type LidoAddress = string;
export type LidoAmount = string | number | bigint;

export type LidoStakeInput = {
  recipient: LidoAddress;
  amount: LidoAmount;
  referral?: LidoAddress;
};

export type LidoUnstakeInput = {
  recipient: LidoAddress;
  amount: LidoAmount;
};

export type LidoFlowPayload = {
  recipient: LidoAddress;
  amount: string;
  referral?: LidoAddress;
};

function normalizeAmount(value: LidoAmount): string {
  let normalized: bigint;

  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value) || value <= 0) {
      throw new Error('Invalid amount');
    }
    normalized = BigInt(value);
  } else if (typeof value === 'bigint') {
    if (value <= 0n) {
      throw new Error('Invalid amount');
    }
    normalized = value;
  } else {
    const parsed = value.trim();
    if (!/^\d+$/.test(parsed)) {
      throw new Error('Invalid amount');
    }
    normalized = BigInt(parsed);
  }

  if (normalized <= 0n) {
    throw new Error('Invalid amount');
  }

  return normalized.toString();
}

function ensureAddress(address: string): string {
  const normalized = address.trim().toLowerCase();
  if (!/^0x[0-9a-f]{40}$/.test(normalized)) {
    throw new Error('Invalid address');
  }
  return normalized;
}

export class LidoProtocolClient {
  private readonly client: AztecClient;

  constructor(client: AztecClient = AztecClient.sandbox()) {
    this.client = client;
  }

  public get protocolName(): string {
    return PROTOCOL_NAME;
  }

  public get timeoutBlocks(): number {
    return ESCAPE_TIMEOUT_BLOCKS;
  }

  public buildStakePayload(input: LidoStakeInput): LidoFlowPayload {
    const recipient = ensureAddress(input.recipient);
    const amount = normalizeAmount(input.amount);
    const referral = input.referral ? ensureAddress(input.referral) : undefined;

    return {
      recipient,
      amount,
      referral,
    };
  }

  public buildUnstakePayload(input: LidoUnstakeInput): LidoFlowPayload {
    const recipient = ensureAddress(input.recipient);
    const amount = normalizeAmount(input.amount);

    return {
      recipient,
      amount,
    };
  }

  public buildStakeMessage(input: LidoStakeInput): EncodedMessage {
    const payload = this.buildStakePayload(input);
    return this.client.sendMessage({
      recipient: this.protocolName,
      action: LIDO_STAKE_ACTION,
      payload: {
        action: LIDO_STAKE_ACTION,
        token: TOKEN_ADDRESS,
        ...payload,
      },
    });
  }

  public buildUnstakeMessage(input: LidoUnstakeInput): EncodedMessage {
    const payload = this.buildUnstakePayload(input);
    return this.client.sendMessage({
      recipient: this.protocolName,
      action: LIDO_UNSTAKE_ACTION,
      payload: {
        action: LIDO_UNSTAKE_ACTION,
        token: TOKEN_ADDRESS,
        ...payload,
      },
    });
  }
}
