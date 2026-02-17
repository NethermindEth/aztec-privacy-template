import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  loadConfigPair,
  portalConstantsSol,
  privacyFlagsNoir,
  protocolConstantsTs,
} from './config';

type CliArgs = {
  template?: string;
  protocol?: string;
  protocolConfig?: string;
  outDir?: string;
};

const HELP = `Usage:
  bun run scripts/config/src/cli.ts --template=<path> --protocol=<name> --protocol-config=<path> [--out-dir=<path>]
`;

function parseArgs(argv: string[]): CliArgs {
  const result: CliArgs = {};

  for (const arg of argv) {
    if (arg === '--help' || arg === '-h') {
      return { protocol: '--help' };
    }

    if (!arg.startsWith('--')) {
      continue;
    }

    const [key, value] = arg.slice(2).split('=', 2);
    if (!value) {
      continue;
    }

    if (key === 'template') {
      result.template = value;
    } else if (key === 'protocol') {
      result.protocol = value;
    } else if (key === 'protocol-config') {
      result.protocolConfig = value;
    } else if (key === 'out-dir') {
      result.outDir = value;
    }
  }

  return result;
}

function requireArg(value: string | undefined, name: string): string {
  if (!value) {
    throw new Error(`Missing required argument --${name}`);
  }
  return value;
}

function normalize(name: string, value: string): string {
  if (!name || !value.trim()) {
    throw new Error(`Missing required argument --${name}`);
  }
  return value.trim();
}

function run(args: string[]): void {
  const parsed = parseArgs(args);
  if (
    parsed.protocol === '--help' ||
    process.argv.includes('--help') ||
    process.argv.includes('-h')
  ) {
    console.log(HELP);
    return;
  }

  const template = normalize('template', requireArg(parsed.template, 'template'));
  const protocol = normalize('protocol', requireArg(parsed.protocol, 'protocol'));
  const protocolConfig = normalize(
    'protocol-config',
    requireArg(parsed.protocolConfig, 'protocol-config'),
  );
  const outDir = parsed.outDir ?? `packages/protocols/${protocol}/generated`;

  const config = loadConfigPair(template, protocolConfig);
  const configWithProtocol = {
    ...config,
    metadata: {
      name: protocol,
    },
  };

  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, 'privacy_flags.nr'), privacyFlagsNoir(configWithProtocol));
  writeFileSync(join(outDir, 'protocol_constants.ts'), protocolConstantsTs(configWithProtocol));
  writeFileSync(join(outDir, 'PortalConstants.sol'), portalConstantsSol(configWithProtocol));

  console.log(`Generated protocol artifacts in ${outDir}`);
}

run(process.argv.slice(2));
