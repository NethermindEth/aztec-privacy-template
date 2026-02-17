import { readFileSync } from 'node:fs';
import { parse } from 'toml';
import type { AddressConfig, GeneratedConfig, PrivacyConfig, RuntimeConfig } from './types';

const ADDRESS_REGEX = /^0x[0-9a-fA-F]{40}$/;
const ALLOWED_KEYS = ['template_version', 'metadata', 'privacy', 'runtime', 'addresses'];

const DEFAULTS = {
  template_version: 1,
  metadata: {
    name: 'unknown-protocol',
  },
  privacy: {
    recipient_private: false,
    amount_private: false,
    sender_private: false,
    memo_private: false,
  },
  runtime: {
    l1_chain_id: 1,
    l2_chain_id: 1,
    escape_timeout_blocks: 1200,
    default_gas_limit: 500_000,
  },
  addresses: {
    l1_portal: '0x0000000000000000000000000000000000000000',
    protocol_contract: '0x0000000000000000000000000000000000000000',
    token_address: '0x0000000000000000000000000000000000000000',
  },
} as const;

type ConfigSections = {
  template_version?: number;
  metadata?: {
    name?: string;
  };
  privacy?: {
    recipient_private?: boolean;
    amount_private?: boolean;
    sender_private?: boolean;
    memo_private?: boolean;
  };
  runtime?: {
    l1_chain_id?: number;
    l2_chain_id?: number;
    escape_timeout_blocks?: number;
    default_gas_limit?: number;
  };
  addresses?: {
    l1_portal?: string;
    protocol_contract?: string;
    token_address?: string;
  };
};

function ensureKnownKeys(parsed: unknown, source: string): asserts parsed is ConfigSections {
  if (parsed === null || typeof parsed !== 'object') {
    throw new Error(`${source} must be a TOML table.`);
  }

  for (const key of Object.keys(parsed)) {
    if (!ALLOWED_KEYS.includes(key)) {
      throw new Error(`Unknown top-level key '${key}' in ${source}`);
    }
  }
}

function readConfig(path: string): ConfigSections {
  let parsed: unknown;
  try {
    parsed = parse(readFileSync(path, 'utf8'));
  } catch (error) {
    throw new Error(`Invalid TOML in ${path}: ${(error as Error).message}`);
  }
  ensureKnownKeys(parsed, path);
  return parsed as ConfigSections;
}

function requireBoolean(value: unknown, source: string): boolean {
  if (typeof value !== 'boolean') {
    throw new Error(`Expected boolean for '${source}'`);
  }
  return value;
}

function requireNumber(value: unknown, source: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) {
    throw new Error(`Expected positive integer for '${source}'`);
  }
  return value;
}

function requireAddress(value: unknown, source: string): string {
  if (typeof value !== 'string' || !ADDRESS_REGEX.test(value)) {
    throw new Error(`Expected hex address for '${source}'`);
  }
  return value;
}

function toConstantName(field: string): string {
  return field
    .split('_')
    .map((chunk) => chunk.toUpperCase())
    .join('_');
}

function mergeSections(
  base: ConfigSections,
  override: ConfigSections,
): {
  templateVersion: number;
  metadataName: string;
  privacy: PrivacyConfig;
  runtime: RuntimeConfig;
  addresses: AddressConfig;
} {
  const merged = {
    templateVersion:
      override.template_version ?? base.template_version ?? DEFAULTS.template_version,
    metadataName: override.metadata?.name ?? base.metadata?.name ?? DEFAULTS.metadata.name,
    privacy: {
      recipientPrivate:
        override.privacy?.recipient_private ??
        base.privacy?.recipient_private ??
        DEFAULTS.privacy.recipient_private,
      amountPrivate:
        override.privacy?.amount_private ??
        base.privacy?.amount_private ??
        DEFAULTS.privacy.amount_private,
      senderPrivate:
        override.privacy?.sender_private ??
        base.privacy?.sender_private ??
        DEFAULTS.privacy.sender_private,
      memoPrivate:
        override.privacy?.memo_private ??
        base.privacy?.memo_private ??
        DEFAULTS.privacy.memo_private,
    },
    runtime: {
      l1ChainId:
        override.runtime?.l1_chain_id ?? base.runtime?.l1_chain_id ?? DEFAULTS.runtime.l1_chain_id,
      l2ChainId:
        override.runtime?.l2_chain_id ?? base.runtime?.l2_chain_id ?? DEFAULTS.runtime.l2_chain_id,
      escapeTimeoutBlocks:
        override.runtime?.escape_timeout_blocks ??
        base.runtime?.escape_timeout_blocks ??
        DEFAULTS.runtime.escape_timeout_blocks,
      defaultGasLimit:
        override.runtime?.default_gas_limit ??
        base.runtime?.default_gas_limit ??
        DEFAULTS.runtime.default_gas_limit,
    },
    addresses: {
      l1Portal:
        override.addresses?.l1_portal ?? base.addresses?.l1_portal ?? DEFAULTS.addresses.l1_portal,
      protocolContract:
        override.addresses?.protocol_contract ??
        base.addresses?.protocol_contract ??
        DEFAULTS.addresses.protocol_contract,
      tokenAddress:
        override.addresses?.token_address ??
        base.addresses?.token_address ??
        DEFAULTS.addresses.token_address,
    },
  };

  const normalized: GeneratedConfig = {
    templateVersion: requireNumber(merged.templateVersion, 'template_version'),
    metadata: {
      name: merged.metadataName,
    },
    privacy: {
      recipientPrivate: requireBoolean(
        merged.privacy.recipientPrivate,
        'privacy.recipient_private',
      ),
      amountPrivate: requireBoolean(merged.privacy.amountPrivate, 'privacy.amount_private'),
      senderPrivate: requireBoolean(merged.privacy.senderPrivate, 'privacy.sender_private'),
      memoPrivate: requireBoolean(merged.privacy.memoPrivate, 'privacy.memo_private'),
    },
    runtime: {
      l1ChainId: requireNumber(merged.runtime.l1ChainId, 'runtime.l1_chain_id'),
      l2ChainId: requireNumber(merged.runtime.l2ChainId, 'runtime.l2_chain_id'),
      escapeTimeoutBlocks: requireNumber(
        merged.runtime.escapeTimeoutBlocks,
        'runtime.escape_timeout_blocks',
      ),
      defaultGasLimit: requireNumber(merged.runtime.defaultGasLimit, 'runtime.default_gas_limit'),
    },
    addresses: {
      l1Portal: requireAddress(merged.addresses.l1Portal, 'addresses.l1_portal'),
      protocolContract: requireAddress(
        merged.addresses.protocolContract,
        'addresses.protocol_contract',
      ),
      tokenAddress: requireAddress(merged.addresses.tokenAddress, 'addresses.token_address'),
    },
  };

  return normalized;
}

export function loadConfigPair(templatePath: string, overridePath: string): GeneratedConfig {
  const template = readConfig(templatePath);
  const override = readConfig(overridePath);

  return mergeSections(template, override);
}

export function privacyFlagsNoir(config: GeneratedConfig): string {
  const privacy = [
    ['recipient_private', config.privacy.recipientPrivate],
    ['amount_private', config.privacy.amountPrivate],
    ['sender_private', config.privacy.senderPrivate],
    ['memo_private', config.privacy.memoPrivate],
  ]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `pub const ${toConstantName(key)}: bool = ${value ? 'true' : 'false'};`)
    .join('\n');

  return `// generated by config pipeline\n${privacy}\n`;
}

export function protocolConstantsTs(config: GeneratedConfig): string {
  const lines = [
    '// generated by config pipeline',
    `export const PROTOCOL_NAME = '${config.metadata.name}';`,
    `export const TEMPLATE_VERSION = ${config.templateVersion};`,
    '',
    `export const L1_CHAIN_ID = ${config.runtime.l1ChainId};`,
    `export const L2_CHAIN_ID = ${config.runtime.l2ChainId};`,
    `export const ESCAPE_TIMEOUT_BLOCKS = ${config.runtime.escapeTimeoutBlocks};`,
    `export const DEFAULT_GAS_LIMIT = ${config.runtime.defaultGasLimit};`,
    '',
    `export const L1_PORTAL = '${config.addresses.l1Portal}';`,
    `export const PROTOCOL_CONTRACT = '${config.addresses.protocolContract}';`,
    `export const TOKEN_ADDRESS = '${config.addresses.tokenAddress}';`,
  ];

  return `${lines.join('\n')}\n`;
}

export function portalConstantsSol(config: GeneratedConfig): string {
  return `// generated by config pipeline
pragma solidity ^0.8.33;

library PortalConstants {
  string internal constant PROTOCOL_NAME = "${config.metadata.name}";
  uint256 internal constant TEMPLATE_VERSION = ${config.templateVersion};

  uint256 internal constant L1_CHAIN_ID = ${config.runtime.l1ChainId};
  uint256 internal constant L2_CHAIN_ID = ${config.runtime.l2ChainId};
  uint256 internal constant ESCAPE_TIMEOUT_BLOCKS = ${config.runtime.escapeTimeoutBlocks};
  uint256 internal constant DEFAULT_GAS_LIMIT = ${config.runtime.defaultGasLimit};

  address internal constant L1_PORTAL = ${config.addresses.l1Portal};
  address internal constant PROTOCOL_CONTRACT = ${config.addresses.protocolContract};
  address internal constant TOKEN_ADDRESS = ${config.addresses.tokenAddress};

  bool internal constant RECIPIENT_PRIVATE = ${config.privacy.recipientPrivate ? 'true' : 'false'};
  bool internal constant AMOUNT_PRIVATE = ${config.privacy.amountPrivate ? 'true' : 'false'};
  bool internal constant SENDER_PRIVATE = ${config.privacy.senderPrivate ? 'true' : 'false'};
  bool internal constant MEMO_PRIVATE = ${config.privacy.memoPrivate ? 'true' : 'false'};
}\n`;
}
