import { relative } from 'node:path';

import type { ExampleSelection, PackageManager } from './constants.js';
import { scaffoldBaseTemplate } from './scaffold.js';
import { assertTargetPathSafe, resolveProjectTarget } from './validate.js';

export interface CreateAppOptions {
  generatorRoot: string;
  projectArg: string;
  packageManager: PackageManager;
  exampleSelection: ExampleSelection;
}

export interface CreateAppResult {
  absoluteTargetPath: string;
  displayPath: string;
  packageManager: PackageManager;
  projectName: string;
}

export async function createApp(options: CreateAppOptions): Promise<CreateAppResult> {
  const { generatorRoot, projectArg, packageManager, exampleSelection } = options;

  const { absoluteTargetPath, projectName } = resolveProjectTarget(projectArg);
  assertTargetPathSafe(absoluteTargetPath);

  await scaffoldBaseTemplate({
    generatorRoot,
    absoluteTargetPath,
    projectName,
    packageManager,
    exampleSelection,
  });

  return {
    absoluteTargetPath,
    displayPath: relative(process.cwd(), absoluteTargetPath) || absoluteTargetPath,
    packageManager,
    projectName,
  };
}
