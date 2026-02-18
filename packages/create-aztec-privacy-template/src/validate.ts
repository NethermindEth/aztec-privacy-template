import { basename, resolve } from 'node:path';
import { existsSync, readdirSync, statSync } from 'node:fs';

import type { ExampleSelection, PackageManager } from './constants.js';
import { SUPPORTED_EXAMPLE_SELECTIONS, SUPPORTED_PACKAGE_MANAGERS } from './constants.js';
import { parseGithubExampleSource } from './helpers/examples.js';

export interface ResolvedProjectTarget {
  absoluteTargetPath: string;
  projectName: string;
}

const PROJECT_NAME_PATTERN = /^[a-z0-9][a-z0-9-_]*$/;

export function resolveProjectTarget(projectArg: string): ResolvedProjectTarget {
  const trimmed = projectArg.trim();
  if (!trimmed) {
    throw new Error('Project name/path is required. Example: create-aztec-privacy-template my-app');
  }

  const absoluteTargetPath = resolve(process.cwd(), trimmed);
  const projectName = basename(absoluteTargetPath);

  if (!PROJECT_NAME_PATTERN.test(projectName)) {
    throw new Error(
      `Invalid project name "${projectName}". Use lowercase letters, numbers, hyphens, or underscores.`,
    );
  }

  return { absoluteTargetPath, projectName };
}

export function assertTargetPathSafe(absoluteTargetPath: string): void {
  if (!existsSync(absoluteTargetPath)) {
    return;
  }

  const stats = statSync(absoluteTargetPath);
  if (!stats.isDirectory()) {
    throw new Error(`Target path exists and is not a directory: ${absoluteTargetPath}`);
  }

  const entries = readdirSync(absoluteTargetPath);
  if (entries.length > 0) {
    throw new Error(`Target directory must be empty: ${absoluteTargetPath}`);
  }
}

export function assertPackageManager(pm: string): asserts pm is PackageManager {
  if ((SUPPORTED_PACKAGE_MANAGERS as readonly string[]).includes(pm)) {
    return;
  }

  throw new Error(
    `Unsupported package manager "${pm}". Supported values: ${SUPPORTED_PACKAGE_MANAGERS.join(', ')}`,
  );
}

export function assertExampleSelection(example: string): asserts example is ExampleSelection {
  if ((SUPPORTED_EXAMPLE_SELECTIONS as readonly string[]).includes(example)) {
    return;
  }

  throw new Error(
    `Unsupported example "${example}". Supported values: ${SUPPORTED_EXAMPLE_SELECTIONS.join(', ')}`,
  );
}

export function assertExampleSource(exampleSource: string): void {
  parseGithubExampleSource(exampleSource);
}
