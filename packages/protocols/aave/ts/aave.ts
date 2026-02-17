// SPDX-License-Identifier: MIT
import { AztecClient } from '../../../core/ts/aztec';
import type { EncodedMessage } from '../../../core/ts/message-utils';
import {
  PROTOCOL_NAME,
  TOKEN_ADDRESS,
  ESCAPE_TIMEOUT_BLOCKS,
} from '../generated/protocol_constants';

export const AAVE_DEPOSIT_ACTION = 'aave.deposit';
export const AAVE_WITHDRAW_ACTION = 'aave.withdraw';

export type AaveFlowAddress = string;
export type AaveAmount = string | number | bigint;

export type AaveDepositInput = {
  token?: string;
  amount: AaveAmount;
  referralCode?: number;
};

export type AaveWithdrawInput = {
  token?: string;
  amount: AaveAmount;
};

export type AaveFlowInput = {
  token: AaveFlowAddress;
  amount: string;
  referralCode?: number;
};

function normalizeAmount(value: AaveAmount): string {
  let normalized: bigint;

  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value)) {
      throw new Error('Invalid amount');
    }
    normalized = BigInt(value);
  } else if (typeof value === 'bigint') {
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

function ensureReferralCode(value: number | undefined): number {
  if (value === undefined) {
    return 0;
  }
  if (!Number.isSafeInteger(value) || value < 0 || value > 10_000) {
    throw new Error('Invalid referral code');
  }
  return value;
}

export class AaveProtocolClient {
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

  public buildDepositPayload(input: AaveDepositInput): AaveFlowInput {
    const token = ensureAddress(input.token ?? TOKEN_ADDRESS);
    const amount = normalizeAmount(input.amount);
    const referralCode = ensureReferralCode(input.referralCode);

    return {
      token,
      amount,
      referralCode,
    } as AaveFlowInput;
  }

  public buildWithdrawPayload(input: AaveWithdrawInput): AaveFlowInput {
    const token = ensureAddress(input.token ?? TOKEN_ADDRESS);
    const amount = normalizeAmount(input.amount);

    return {
      token,
      amount,
    } as AaveFlowInput;
  }

  public buildDepositMessage(input: AaveDepositInput): EncodedMessage {
    const payload = this.buildDepositPayload(input);
    return this.client.sendMessage({
      recipient: this.protocolName,
      action: AAVE_DEPOSIT_ACTION,
      payload: {
        action: AAVE_DEPOSIT_ACTION,
        ...payload,
      },
    });
  }

  public buildWithdrawMessage(input: AaveWithdrawInput): EncodedMessage {
    const payload = this.buildWithdrawPayload(input);
    return this.client.sendMessage({
      recipient: this.protocolName,
      action: AAVE_WITHDRAW_ACTION,
      payload: {
        action: AAVE_WITHDRAW_ACTION,
        ...payload,
      },
    });
  }
}
