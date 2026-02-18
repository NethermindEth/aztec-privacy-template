import type { ExampleSelection, PackageManager } from '../constants.js';
import { assertExampleSelection, assertPackageManager } from '../validate.js';

export interface CliOptions {
  projectArg?: string;
  packageManager: PackageManager;
  exampleSelection: ExampleSelection;
  yes: boolean;
  skipInstall: boolean;
  disableGit: boolean;
  packageManagerProvided: boolean;
  exampleSelectionProvided: boolean;
}

export function printUsage(): void {
  console.log(
    'Usage: create-aztec-privacy-template <project-name-or-path> [--pm <bun|npm|pnpm|yarn>] [--example <none|aave|lido|uniswap|all>] [--yes] [--skip-install] [--disable-git]',
  );
}

export function parseArgs(argv: string[]): CliOptions {
  let projectArg = '';
  let packageManager: PackageManager = 'bun';
  let exampleSelection: ExampleSelection = 'none';
  let yes = false;
  let skipInstall = false;
  let disableGit = false;
  let packageManagerProvided = false;
  let exampleSelectionProvided = false;

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

    if (arg === '--skip-install') {
      skipInstall = true;
      continue;
    }

    if (arg === '--disable-git') {
      disableGit = true;
      continue;
    }

    if (arg === '--pm') {
      const value = argv[i + 1];
      if (!value) {
        throw new Error('--pm requires a value');
      }

      assertPackageManager(value);
      packageManager = value;
      packageManagerProvided = true;
      i += 1;
      continue;
    }

    if (arg.startsWith('--pm=')) {
      const value = arg.slice('--pm='.length);
      assertPackageManager(value);
      packageManager = value;
      packageManagerProvided = true;
      continue;
    }

    if (arg === '--example') {
      const value = argv[i + 1];
      if (!value) {
        throw new Error('--example requires a value');
      }

      assertExampleSelection(value);
      exampleSelection = value;
      exampleSelectionProvided = true;
      i += 1;
      continue;
    }

    if (arg.startsWith('--example=')) {
      const value = arg.slice('--example='.length);
      assertExampleSelection(value);
      exampleSelection = value;
      exampleSelectionProvided = true;
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

  return {
    projectArg: projectArg || undefined,
    packageManager,
    exampleSelection,
    yes,
    skipInstall,
    disableGit,
    packageManagerProvided,
    exampleSelectionProvided,
  };
}
