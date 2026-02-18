import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { spawnSync } from 'node:child_process';
import process from 'node:process';

import {
  type ExampleSelection,
  type PackageManager,
  SUPPORTED_EXAMPLE_SELECTIONS,
  SUPPORTED_PACKAGE_MANAGERS,
} from './constants.js';
import type { CliOptions } from './helpers/cli-options.js';

const DEFAULT_PROJECT_ARG = 'my-aztec-app';
const PREFERENCES_FILE = join(
  process.env.XDG_CONFIG_HOME ?? join(homedir(), '.config'),
  'create-aztec-privacy-template',
  'preferences.json',
);

interface GeneratorPreferences {
  packageManager?: PackageManager;
  exampleSelection?: ExampleSelection;
}

export interface ResolvedPromptOptions {
  projectArg: string;
  packageManager: PackageManager;
  exampleSelection: ExampleSelection;
  exampleSource?: string;
  yes: boolean;
  skipInstall: boolean;
  disableGit: boolean;
}

export interface PromptDependencies {
  ask: (prompt: string) => Promise<string>;
  isInteractive: () => boolean;
  loadPreferences: () => Promise<GeneratorPreferences>;
  savePreferences: (preferences: GeneratorPreferences) => Promise<void>;
  isPackageManagerAvailable: (packageManager: PackageManager) => boolean;
}

const defaultPromptDependencies: PromptDependencies = {
  ask: async (prompt) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    try {
      return await rl.question(prompt);
    } finally {
      rl.close();
    }
  },
  isInteractive: () => Boolean(process.stdin.isTTY && process.stdout.isTTY),
  loadPreferences: readPreferences,
  savePreferences: writePreferences,
  isPackageManagerAvailable: isPackageManagerAvailable,
};

export async function resolvePromptOptions(
  options: CliOptions,
  dependencies: PromptDependencies = defaultPromptDependencies,
): Promise<ResolvedPromptOptions> {
  const projectArg = await resolveProjectArg(options, dependencies);
  const packageManager = await resolvePackageManager(options, dependencies);
  const exampleSelection = await resolveExampleSelection(options, dependencies);

  // Preference persistence should not block scaffolding.
  try {
    await dependencies.savePreferences({ packageManager, exampleSelection });
  } catch {}

  return {
    projectArg,
    packageManager,
    exampleSelection,
    exampleSource: options.exampleSource,
    yes: options.yes,
    skipInstall: options.skipInstall,
    disableGit: options.disableGit,
  };
}

async function resolveProjectArg(
  options: CliOptions,
  dependencies: PromptDependencies,
): Promise<string> {
  if (options.projectArg) {
    return options.projectArg;
  }

  if (options.yes) {
    return DEFAULT_PROJECT_ARG;
  }

  assertInteractive(dependencies, 'Project name/path is required');
  return await promptRequiredText(
    dependencies,
    `Project name/path (default: ${DEFAULT_PROJECT_ARG}): `,
    DEFAULT_PROJECT_ARG,
  );
}

async function resolvePackageManager(
  options: CliOptions,
  dependencies: PromptDependencies,
): Promise<PackageManager> {
  if (options.packageManagerProvided) {
    if (!dependencies.isPackageManagerAvailable(options.packageManager)) {
      throw new Error(
        `Package manager "${options.packageManager}" is not available on PATH. Install it or rerun with --pm <${SUPPORTED_PACKAGE_MANAGERS.join('|')}>.`,
      );
    }
    return options.packageManager;
  }

  const fallback = options.packageManager;

  if (options.yes) {
    if (!dependencies.isPackageManagerAvailable(fallback)) {
      throw new Error(
        `Default package manager "${fallback}" is not available on PATH. Install it or rerun with --pm <${SUPPORTED_PACKAGE_MANAGERS.join('|')}>.`,
      );
    }
    return fallback;
  }

  if (!dependencies.isInteractive()) {
    if (!dependencies.isPackageManagerAvailable(fallback)) {
      throw new Error(
        `Default package manager "${fallback}" is not available on PATH. Install it or rerun with --pm <${SUPPORTED_PACKAGE_MANAGERS.join('|')}>.`,
      );
    }
    return fallback;
  }

  return await promptPackageManagerSelection(dependencies, fallback);
}

async function promptPackageManagerSelection(
  dependencies: PromptDependencies,
  defaultValue: PackageManager,
): Promise<PackageManager> {
  const prompt = `Package manager [${SUPPORTED_PACKAGE_MANAGERS.join('/')}] (default: ${defaultValue}): `;

  for (;;) {
    const answer = (await dependencies.ask(prompt)).trim();
    const candidate = (answer || defaultValue) as PackageManager;

    if (!SUPPORTED_PACKAGE_MANAGERS.includes(candidate)) {
      console.error(
        `Unsupported package manager selection: "${candidate}". Allowed values: ${SUPPORTED_PACKAGE_MANAGERS.join(', ')}`,
      );
      continue;
    }

    if (!dependencies.isPackageManagerAvailable(candidate)) {
      console.error(
        `Package manager "${candidate}" is not available on PATH. Choose one of: ${SUPPORTED_PACKAGE_MANAGERS.join(', ')}`,
      );
      continue;
    }

    return candidate;
  }
}

function isPackageManagerAvailable(packageManager: PackageManager): boolean {
  const result = spawnSync(packageManager, ['--version'], {
    stdio: 'ignore',
  });

  if (result.error) {
    const error = result.error as NodeJS.ErrnoException;
    if (error.code === 'ENOENT') {
      return false;
    }
  }

  return result.status === 0;
}

async function resolveExampleSelection(
  options: CliOptions,
  dependencies: PromptDependencies,
): Promise<ExampleSelection> {
  if (options.exampleSelectionProvided) {
    return options.exampleSelection;
  }

  const fallback = options.exampleSelection;
  if (options.yes) {
    return fallback;
  }

  if (!dependencies.isInteractive()) {
    return fallback;
  }

  return await promptSelection<ExampleSelection>(
    dependencies,
    `Example [${SUPPORTED_EXAMPLE_SELECTIONS.join('/')}] (default: ${fallback}): `,
    SUPPORTED_EXAMPLE_SELECTIONS,
    fallback,
    'Unsupported example selection',
  );
}

function assertInteractive(dependencies: PromptDependencies, message: string): void {
  if (dependencies.isInteractive()) {
    return;
  }

  throw new Error(`${message}. Provide flags or use --yes in non-interactive environments.`);
}

async function promptRequiredText(
  dependencies: PromptDependencies,
  prompt: string,
  defaultValue: string,
): Promise<string> {
  const answer = (await dependencies.ask(prompt)).trim();
  return answer || defaultValue;
}

async function promptSelection<T extends string>(
  dependencies: PromptDependencies,
  prompt: string,
  values: readonly T[],
  defaultValue: T,
  errorPrefix: string,
): Promise<T> {
  for (;;) {
    const answer = (await dependencies.ask(prompt)).trim();
    const candidate = (answer || defaultValue) as T;

    if (values.includes(candidate)) {
      return candidate;
    }

    console.error(`${errorPrefix}: "${candidate}". Allowed values: ${values.join(', ')}`);
  }
}

async function readPreferences(): Promise<GeneratorPreferences> {
  try {
    const raw = await readFile(PREFERENCES_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    const packageManager = normalizePackageManager(parsed.packageManager);
    const exampleSelection = normalizeExampleSelection(parsed.exampleSelection);
    return { packageManager, exampleSelection };
  } catch {
    return {};
  }
}

async function writePreferences(preferences: GeneratorPreferences): Promise<void> {
  await mkdir(join(PREFERENCES_FILE, '..'), { recursive: true });
  await writeFile(`${PREFERENCES_FILE}`, `${JSON.stringify(preferences, null, 2)}\n`, 'utf8');
}

function normalizePackageManager(value: unknown): PackageManager | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  if ((SUPPORTED_PACKAGE_MANAGERS as readonly string[]).includes(value)) {
    return value as PackageManager;
  }

  return undefined;
}

function normalizeExampleSelection(value: unknown): ExampleSelection | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  if ((SUPPORTED_EXAMPLE_SELECTIONS as readonly string[]).includes(value)) {
    return value as ExampleSelection;
  }

  return undefined;
}
