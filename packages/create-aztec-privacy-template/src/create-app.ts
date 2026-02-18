import { relative } from 'node:path';

import type { ExampleSelection, PackageManager } from './constants.js';
import { tryGitInit } from './helpers/git.js';
import { installDependencies } from './helpers/install.js';
import { runPostInitHooks } from './helpers/post-init.js';
import { scaffoldBaseTemplate } from './scaffold.js';
import { assertTargetPathSafe, resolveProjectTarget } from './validate.js';

export interface CreateAppOptions {
  generatorRoot: string;
  projectArg: string;
  packageManager: PackageManager;
  exampleSelection: ExampleSelection;
  skipInstall?: boolean;
  disableGit?: boolean;
}

export interface CreateAppResult {
  absoluteTargetPath: string;
  displayPath: string;
  packageManager: PackageManager;
  projectName: string;
  installedDependencies: boolean;
  gitInitialized: boolean;
}

interface CreateAppDependencies {
  install: typeof installDependencies;
  postInit: typeof runPostInitHooks;
  gitInit: typeof tryGitInit;
}

const defaultDependencies: CreateAppDependencies = {
  install: installDependencies,
  postInit: runPostInitHooks,
  gitInit: tryGitInit,
};

export async function createApp(
  options: CreateAppOptions,
  dependencies: CreateAppDependencies = defaultDependencies,
): Promise<CreateAppResult> {
  const {
    generatorRoot,
    projectArg,
    packageManager,
    exampleSelection,
    skipInstall = false,
    disableGit = false,
  } = options;

  const { absoluteTargetPath, projectName } = resolveProjectTarget(projectArg);
  assertTargetPathSafe(absoluteTargetPath);

  await scaffoldBaseTemplate({
    generatorRoot,
    absoluteTargetPath,
    projectName,
    packageManager,
    exampleSelection,
  });

  if (!skipInstall) {
    await dependencies.install({
      packageManager,
      cwd: absoluteTargetPath,
    });
  }

  await dependencies.postInit({
    absoluteTargetPath,
    exampleSelection,
    installedDependencies: !skipInstall,
  });

  const gitInitialized = disableGit ? false : dependencies.gitInit(absoluteTargetPath);

  return {
    absoluteTargetPath,
    displayPath: relative(process.cwd(), absoluteTargetPath) || absoluteTargetPath,
    packageManager,
    projectName,
    installedDependencies: !skipInstall,
    gitInitialized,
  };
}
