#!/usr/bin/env node

import { resolve, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { INSTALL_COMMANDS, type PackageManager } from './constants.js';
import { resolvePromptOptions } from './prompts.js';
import { scaffoldBaseTemplate } from './scaffold.js';
import { assertPackageManager, assertTargetPathSafe, resolveProjectTarget } from './validate.js';

interface CliOptions {
  projectArg: string;
  packageManager: PackageManager;
  yes: boolean;
}

function printUsage(): void {
  console.log(
    'Usage: create-aztec-privacy-template <project-name-or-path> [--pm <bun|npm|pnpm|yarn>] [--yes]',
  );
}

function parseArgs(argv: string[]): CliOptions {
  let projectArg = '';
  let packageManager: PackageManager = 'bun';
  let yes = false;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === '--help' || arg === '-h') {
      printUsage();
      process.exit(0);
    }

    if (arg === '--yes') {
      yes = true;
      continue;
    }

    if (arg === '--pm') {
      const value = argv[i + 1];
      if (!value) {
        throw new Error('--pm requires a value');
      }

      assertPackageManager(value);
      packageManager = value;
      i += 1;
      continue;
    }

    if (arg.startsWith('--pm=')) {
      const value = arg.slice('--pm='.length);
      assertPackageManager(value);
      packageManager = value;
      continue;
    }

    if (arg.startsWith('-')) {
      throw new Error(`Unknown option: ${arg}`);
    }

    if (projectArg) {
      throw new Error(`Unexpected extra argument: ${arg}`);
    }

    projectArg = arg;
  }

  if (!projectArg) {
    throw new Error('Project name/path is required');
  }

  return { projectArg, packageManager, yes };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  await resolvePromptOptions({ yes: args.yes });

  const { absoluteTargetPath, projectName } = resolveProjectTarget(args.projectArg);
  assertTargetPathSafe(absoluteTargetPath);

  const generatorRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

  await scaffoldBaseTemplate({
    generatorRoot,
    absoluteTargetPath,
    projectName,
    packageManager: args.packageManager,
  });

  const displayPath = relative(process.cwd(), absoluteTargetPath) || absoluteTargetPath;

  console.log(`\nScaffolded Aztec privacy starter at ${displayPath}`);
  console.log('\nNext steps:');
  console.log(`  cd ${displayPath}`);
  console.log(`  ${INSTALL_COMMANDS[args.packageManager]}`);
  console.log('  make check');
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Error: ${message}`);
  printUsage();
  process.exit(1);
});
