import { cp, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import {
  STARTER_PACKAGE_JSON_BASE,
  TEMPLATE_COPY_ENTRIES,
  type PackageManager,
} from './constants.js';

export interface ScaffoldOptions {
  generatorRoot: string;
  absoluteTargetPath: string;
  projectName: string;
  packageManager: PackageManager;
}

export async function scaffoldBaseTemplate(options: ScaffoldOptions): Promise<void> {
  const { generatorRoot, absoluteTargetPath, projectName, packageManager } = options;

  await mkdir(absoluteTargetPath, { recursive: true });

  for (const entry of TEMPLATE_COPY_ENTRIES) {
    if (entry === 'bun.lock' && packageManager !== 'bun') {
      continue;
    }

    const sourcePath = join(generatorRoot, entry);
    const destinationPath = join(absoluteTargetPath, entry);

    await cp(sourcePath, destinationPath, {
      recursive: true,
      errorOnExist: true,
      force: false,
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
}
