import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { createInterface } from 'node:readline/promises';
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
  yes: boolean;
}

export interface PromptDependencies {
  ask: (prompt: string) => Promise<string>;
  isInteractive: () => boolean;
  loadPreferences: () => Promise<GeneratorPreferences>;
  savePreferences: (preferences: GeneratorPreferences) => Promise<void>;
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
};

export async function resolvePromptOptions(
  options: CliOptions,
  dependencies: PromptDependencies = defaultPromptDependencies,
): Promise<ResolvedPromptOptions> {
  const preferences = await dependencies.loadPreferences();

  const projectArg = await resolveProjectArg(options, dependencies);
  const packageManager = await resolvePackageManager(options, preferences, dependencies);
  const exampleSelection = await resolveExampleSelection(options, preferences, dependencies);

  // Preference persistence should not block scaffolding.
  try {
    await dependencies.savePreferences({ packageManager, exampleSelection });
  } catch {}

  return {
    projectArg,
    packageManager,
    exampleSelection,
    yes: options.yes,
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
  preferences: GeneratorPreferences,
  dependencies: PromptDependencies,
): Promise<PackageManager> {
  if (options.packageManagerProvided) {
    return options.packageManager;
  }

  const fallback = preferences.packageManager ?? options.packageManager;
  if (options.yes) {
    return fallback;
  }

  if (!dependencies.isInteractive()) {
    return fallback;
  }

  return await promptSelection<PackageManager>(
    dependencies,
    `Package manager [${SUPPORTED_PACKAGE_MANAGERS.join('/')}] (default: ${fallback}): `,
    SUPPORTED_PACKAGE_MANAGERS,
    fallback,
    'Unsupported package manager selection',
  );
}

async function resolveExampleSelection(
  options: CliOptions,
  preferences: GeneratorPreferences,
  dependencies: PromptDependencies,
): Promise<ExampleSelection> {
  if (options.exampleSelectionProvided) {
    return options.exampleSelection;
  }

  const fallback = preferences.exampleSelection ?? options.exampleSelection;
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
