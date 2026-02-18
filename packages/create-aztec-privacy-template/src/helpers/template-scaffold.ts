import { cp, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import {
  EXAMPLE_OVERLAY_ORDER,
  type ExampleSelection,
  OVERLAY_EXAMPLES_DIR,
  SCAFFOLD_DIR,
  STARTER_PACKAGE_JSON_BASE,
  TEMPLATE_COPY_ENTRIES,
  type PackageManager,
} from '../constants.js';
import {
  applyPlaceholdersInSelectedFiles,
  assertNoUnresolvedPlaceholders,
  getPlaceholderMap,
} from '../placeholders.js';

export interface ScaffoldTemplateOptions {
  generatorRoot: string;
  absoluteTargetPath: string;
  projectName: string;
  packageManager: PackageManager;
  exampleSelection?: ExampleSelection;
}

export async function scaffoldTemplate(options: ScaffoldTemplateOptions): Promise<void> {
  const {
    generatorRoot,
    absoluteTargetPath,
    projectName,
    packageManager,
    exampleSelection = 'none',
  } = options;

  await mkdir(absoluteTargetPath, { recursive: true });

  for (const entry of TEMPLATE_COPY_ENTRIES) {
    const sourcePath = join(generatorRoot, SCAFFOLD_DIR, entry);
    const destinationEntry = entry === 'gitignore' ? '.gitignore' : entry;
    const destinationPath = join(absoluteTargetPath, destinationEntry);

    await cp(sourcePath, destinationPath, {
      recursive: true,
      errorOnExist: true,
      force: false,
      preserveTimestamps: true,
    });
  }

  for (const overlayName of resolveExampleOverlays(exampleSelection)) {
    const sourcePath = join(generatorRoot, OVERLAY_EXAMPLES_DIR, overlayName);
    await cp(sourcePath, absoluteTargetPath, {
      recursive: true,
      errorOnExist: false,
      force: true,
      preserveTimestamps: true,
    });
  }

  const packageJson = {
    ...STARTER_PACKAGE_JSON_BASE,
    name: projectName,
  };

  await writeFile(
    join(absoluteTargetPath, 'package.json'),
    `${JSON.stringify(packageJson, null, 2)}\n`,
    'utf8',
  );

  const placeholderMap = getPlaceholderMap(projectName, packageManager);
  await applyPlaceholdersInSelectedFiles(absoluteTargetPath, placeholderMap);
  await assertNoUnresolvedPlaceholders(absoluteTargetPath);
}

function resolveExampleOverlays(exampleSelection: ExampleSelection): string[] {
  if (exampleSelection === 'none') {
    return [];
  }

  if (exampleSelection === 'all') {
    return [...EXAMPLE_OVERLAY_ORDER];
  }

  return [exampleSelection];
}
