import { createHash } from 'node:crypto';

export type MessagePayload = {
  chainId: number;
  recipient: string;
  action: string;
  data: Record<string, unknown>;
};

export type EncodedMessage = {
  contentHash: string;
  payload: string;
};

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(',')}]`;
  }

  const entries = Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, val]) => `${JSON.stringify(key)}:${stableStringify(val)}`)
    .join(',');

  return `{${entries}}`;
}

export function encodePrivateMessage(chainId: number, recipient: string, action: string, data: Record<string, unknown>): EncodedMessage {
  const payloadObj: MessagePayload = {
    chainId,
    recipient,
    action,
    data,
  };

  const payload = stableStringify(payloadObj);
  const contentHash = hashString(payload);

  return {
    contentHash,
    payload,
  };
}

function hashString(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

export function verifyPrivateMessage(message: EncodedMessage, expectedRecipient: string, expectedAction: string): boolean {
  try {
    const parsed = JSON.parse(message.payload) as Partial<MessagePayload>;

    return message.contentHash === hashString(message.payload)
      && parsed.recipient === expectedRecipient
      && parsed.action === expectedAction;
  } catch {
    return false;
  }
}
