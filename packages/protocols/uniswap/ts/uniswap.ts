// SPDX-License-Identifier: MIT
import { AztecClient } from '../../../core/ts/aztec';
import type { EncodedMessage } from '../../../core/ts/message-utils';
import {
  PROTOCOL_NAME,
  TOKEN_ADDRESS,
  ESCAPE_TIMEOUT_BLOCKS,
} from '../generated/protocol_constants';

export const UNISWAP_SWAP_ACTION = 'uniswap.swap';

export type UniswapAddress = string;
export type UniswapAmount = string | number | bigint;

export type UniswapSwapInput = {
  tokenIn?: string;
  tokenOut?: string;
  amountIn: UniswapAmount;
  minAmountOut: UniswapAmount;
  feeBps?: number;
};

export type UniswapSwapPayload = {
  tokenIn: UniswapAddress;
  tokenOut: UniswapAddress;
  amountIn: string;
  minAmountOut: string;
  feeBps: number;
};

function normalizeAmount(value: UniswapAmount): string {
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

function ensureFee(value: number | undefined): number {
  if (value === undefined) {
    return 3000;
  }
  if (!Number.isSafeInteger(value) || value <= 0 || value > 1_000_000) {
    throw new Error('Invalid fee');
  }
  return value;
}

export class UniswapProtocolClient {
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

  public buildSwapPayload(input: UniswapSwapInput): UniswapSwapPayload {
    const tokenIn = ensureAddress(input.tokenIn ?? TOKEN_ADDRESS);
    const tokenOut = ensureAddress(input.tokenOut ?? TOKEN_ADDRESS);
    const amountIn = normalizeAmount(input.amountIn);
    const minAmountOut = normalizeAmount(input.minAmountOut);

    const feeBps = ensureFee(input.feeBps);

    return {
      tokenIn,
      tokenOut,
      amountIn,
      minAmountOut,
      feeBps,
    };
  }

  public buildSwapMessage(input: UniswapSwapInput): EncodedMessage {
    const payload = this.buildSwapPayload(input);
    return this.client.sendMessage({
      recipient: this.protocolName,
      action: UNISWAP_SWAP_ACTION,
      payload: {
        action: UNISWAP_SWAP_ACTION,
        ...payload,
      },
    });
  }
}
