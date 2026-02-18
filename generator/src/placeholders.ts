import { readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { PackageManager } from './constants.js';
import { INSTALL_COMMANDS, PLACEHOLDER_TEXT_FILES } from './constants.js';

export type PlaceholderMap = Record<string, string>;

const PLACEHOLDER_PATTERN = /__[A-Z0-9_]+__/;

export function getPlaceholderMap(
  projectName: string,
  packageManager: PackageManager,
): PlaceholderMap {
  return {
    __PROJECT_NAME__: projectName,
    __INSTALL_COMMAND__: INSTALL_COMMANDS[packageManager],
  };
}

export async function applyPlaceholdersInSelectedFiles(
  absoluteTargetPath: string,
  placeholderMap: PlaceholderMap,
): Promise<void> {
  for (const relativePath of PLACEHOLDER_TEXT_FILES) {
    const targetPath = join(absoluteTargetPath, relativePath);
    let content = await readFile(targetPath, 'utf8');

    for (const [placeholder, value] of Object.entries(placeholderMap)) {
      content = content.split(placeholder).join(value);
    }

    await writeFile(targetPath, content, 'utf8');
  }
}

export async function assertNoUnresolvedPlaceholders(absoluteTargetPath: string): Promise<void> {
  const files = await listFilesRecursively(absoluteTargetPath);
  const unresolved: string[] = [];

  for (const filePath of files) {
    const content = await readFile(filePath, 'utf8');
    if (PLACEHOLDER_PATTERN.test(content)) {
      unresolved.push(filePath);
    }
  }

  if (unresolved.length > 0) {
    throw new Error(`Found unresolved placeholders in generated output: ${unresolved.join(', ')}`);
  }
}

async function listFilesRecursively(absoluteDirPath: string): Promise<string[]> {
  const entries = await readdir(absoluteDirPath);
  const files: string[] = [];

  for (const entry of entries) {
    const entryPath = join(absoluteDirPath, entry);
    const entryStats = await stat(entryPath);

    if (entryStats.isDirectory()) {
      files.push(...(await listFilesRecursively(entryPath)));
      continue;
    }

    files.push(entryPath);
  }

  return files;
}
