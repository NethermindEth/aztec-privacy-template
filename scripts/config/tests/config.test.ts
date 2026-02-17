import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { strict as assert } from 'node:assert';
import {
  loadConfigPair,
  privacyFlagsNoir,
  protocolConstantsTs,
  portalConstantsSol,
} from '../src/config';

const TEMPLATE = `
template_version = 1

[metadata]
name = "template"

[privacy]
recipient_private = true
amount_private = false
sender_private = true
memo_private = false

[runtime]
l1_chain_id = 1
l2_chain_id = 31337
escape_timeout_blocks = 1200
default_gas_limit = 500000

[addresses]
l1_portal = "0x1111111111111111111111111111111111111111"
protocol_contract = "0x2222222222222222222222222222222222222222"
token_address = "0x3333333333333333333333333333333333333333"
`;

const OVERRIDE = `
[metadata]
name = "aave"

[privacy]
memo_private = true
[runtime]
escape_timeout_blocks = 900
[addresses]
protocol_contract = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
`;

function writeConfig(filePath: string, contents: string): void {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${contents}\n`);
}

test('loadConfigPair applies per-protocol override precedence', () => {
  const dir = mkdtempSync(join(tmpdir(), 'config-test-'));
  const templatePath = join(dir, 'template.toml');
  const protocolPath = join(dir, 'protocol.toml');

  writeConfig(templatePath, TEMPLATE);
  writeConfig(protocolPath, OVERRIDE);

  const config = loadConfigPair(templatePath, protocolPath);

  assert.equal(config.metadata.name, 'aave');
  assert.equal(config.privacy.recipientPrivate, true);
  assert.equal(config.privacy.amountPrivate, false);
  assert.equal(config.privacy.senderPrivate, true);
  assert.equal(config.privacy.memoPrivate, true);
  assert.equal(config.runtime.escapeTimeoutBlocks, 900);
  assert.equal(config.addresses.protocolContract, '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');

  rmSync(dir, { recursive: true, force: true });
});

test('loadConfigPair rejects unknown nested keys', () => {
  const dir = mkdtempSync(join(tmpdir(), 'config-test-'));
  const templatePath = join(dir, 'template.toml');
  const protocolPath = join(dir, 'protocol.toml');

  writeConfig(templatePath, TEMPLATE);
  writeConfig(
    protocolPath,
    `
[runtime]
unexpected_key = 1
`,
  );

  assert.throws(() => {
    loadConfigPair(templatePath, protocolPath);
  }, /Unknown key 'runtime.unexpected_key'/);

  rmSync(dir, { recursive: true, force: true });
});

test('loadConfigPair rejects empty metadata name', () => {
  const dir = mkdtempSync(join(tmpdir(), 'config-test-'));
  const templatePath = join(dir, 'template.toml');
  const protocolPath = join(dir, 'protocol.toml');

  writeConfig(templatePath, TEMPLATE);
  writeConfig(
    protocolPath,
    `
[metadata]
name = "   "
`,
  );

  assert.throws(() => {
    loadConfigPair(templatePath, protocolPath);
  }, /Expected non-empty string for 'metadata.name'/);

  rmSync(dir, { recursive: true, force: true });
});

test('privacyFlagsNoir output is deterministic', () => {
  const config = {
    templateVersion: 1,
    metadata: { name: 'aave' },
    privacy: {
      senderPrivate: false,
      recipientPrivate: true,
      amountPrivate: false,
      memoPrivate: true,
    },
    runtime: {
      l1ChainId: 1,
      l2ChainId: 2,
      escapeTimeoutBlocks: 1000,
      defaultGasLimit: 500000,
    },
    addresses: {
      l1Portal: '0x1111111111111111111111111111111111111111',
      protocolContract: '0x2222222222222222222222222222222222222222',
      tokenAddress: '0x3333333333333333333333333333333333333333',
    },
  };

  const first = privacyFlagsNoir(config).trim();
  const second = privacyFlagsNoir(config).trim();

  assert.equal(first, second);
  assert.equal(first.includes('AMOUNT_PRIVATE'), true);
  assert.equal(first.includes('RECIPIENT_PRIVATE'), true);
});

test('generated artifacts include stable keys and protocol constants', () => {
  const config = {
    templateVersion: 2,
    metadata: { name: 'uniswap' },
    privacy: {
      recipientPrivate: true,
      amountPrivate: true,
      senderPrivate: true,
      memoPrivate: false,
    },
    runtime: {
      l1ChainId: 1,
      l2ChainId: 8453,
      escapeTimeoutBlocks: 1500,
      defaultGasLimit: 2000000,
    },
    addresses: {
      l1Portal: '0x9999999999999999999999999999999999999999',
      protocolContract: '0x8888888888888888888888888888888888888888',
      tokenAddress: '0x7777777777777777777777777777777777777777',
    },
  };

  const flags = protocolConstantsTs(config).trim();
  const sol = portalConstantsSol(config).trim();

  const outDir = mkdtempSync(join(tmpdir(), 'config-artifacts-'));
  const protocolFile = join(outDir, 'protocol_constants.ts');
  const portalFile = join(outDir, 'PortalConstants.sol');

  writeFileSync(protocolFile, flags);
  writeFileSync(portalFile, sol);

  const protocolText = readFileSync(protocolFile, 'utf8');
  const portalText = readFileSync(portalFile, 'utf8');

  assert.equal(protocolText.includes("PROTOCOL_NAME = 'uniswap'"), true);
  assert.equal(protocolText.includes('L1_CHAIN_ID = 1'), true);
  assert.equal(portalText.includes('uint256 internal constant DEFAULT_GAS_LIMIT = 2000000;'), true);

  rmSync(outDir, { recursive: true, force: true });
});
