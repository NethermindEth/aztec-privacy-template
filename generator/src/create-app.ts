import { relative } from 'node:path';

import type { ExampleSelection, PackageManager } from './constants.js';
import type { InstallExampleSourceResult } from './helpers/examples.js';
import { installExampleSource } from './helpers/examples.js';
import { tryGitInit } from './helpers/git.js';
import { installDependencies } from './helpers/install.js';
import { runPostInitHooks } from './helpers/post-init.js';
import { scaffoldTemplate } from './helpers/template-scaffold.js';
import { assertTargetPathSafe, resolveProjectTarget } from './validate.js';

export interface CreateAppOptions {
  generatorRoot: string;
  projectArg: string;
  packageManager: PackageManager;
  exampleSelection: ExampleSelection;
  exampleSource?: string;
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
  remoteExample?: InstallExampleSourceResult;
}

interface CreateAppDependencies {
  install?: typeof installDependencies;
  postInit?: typeof runPostInitHooks;
  gitInit?: typeof tryGitInit;
  installExampleSource?: typeof installExampleSource;
}

export async function createApp(
  options: CreateAppOptions,
  dependencies: CreateAppDependencies = {},
): Promise<CreateAppResult> {
  const {
    generatorRoot,
    projectArg,
    packageManager,
    exampleSelection,
    exampleSource,
    skipInstall = false,
    disableGit = false,
  } = options;
  const install = dependencies.install ?? installDependencies;
  const postInit = dependencies.postInit ?? runPostInitHooks;
  const gitInit = dependencies.gitInit ?? tryGitInit;
  const installRemoteExample = dependencies.installExampleSource ?? installExampleSource;

  const { absoluteTargetPath, projectName } = resolveProjectTarget(projectArg);
  assertTargetPathSafe(absoluteTargetPath);

  await scaffoldTemplate({
    generatorRoot,
    absoluteTargetPath,
    projectName,
    packageManager,
    exampleSelection,
  });

  const remoteExample = exampleSource
    ? await installRemoteExample({
        absoluteTargetPath,
        exampleSource,
      })
    : undefined;

  if (!skipInstall) {
    await install({
      packageManager,
      cwd: absoluteTargetPath,
    });
  }

  await postInit({
    absoluteTargetPath,
    exampleSelection,
    installedDependencies: !skipInstall,
  });

  const gitInitialized = disableGit ? false : gitInit(absoluteTargetPath);

  return {
    absoluteTargetPath,
    displayPath: relative(process.cwd(), absoluteTargetPath) || absoluteTargetPath,
    packageManager,
    projectName,
    installedDependencies: !skipInstall,
    gitInitialized,
    remoteExample,
  };
}
