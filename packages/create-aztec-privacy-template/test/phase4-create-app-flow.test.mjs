import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { createApp } from '../dist/create-app.js';

const PACKAGE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

test('createApp installs dependencies, runs post-init hooks, and initializes git by default', async () => {
  const tempRoot = await mkdtemp(join(tmpdir(), 'capt-phase4-default-'));
  const target = join(tempRoot, 'phase4-default');

  const calls = {
    install: [],
    postInit: [],
    gitInit: [],
  };

  try {
    const result = await createApp(
      {
        generatorRoot: PACKAGE_ROOT,
        projectArg: target,
        packageManager: 'npm',
        exampleSelection: 'none',
      },
      {
        install: async (options) => {
          calls.install.push(options);
        },
        postInit: async (context) => {
          calls.postInit.push(context);
        },
        gitInit: (root) => {
          calls.gitInit.push(root);
          return true;
        },
      },
    );

    assert.equal(calls.install.length, 1);
    assert.equal(calls.install[0].packageManager, 'npm');
    assert.equal(calls.install[0].cwd, target);

    assert.equal(calls.postInit.length, 1);
    assert.equal(calls.postInit[0].absoluteTargetPath, target);
    assert.equal(calls.postInit[0].installedDependencies, true);

    assert.deepEqual(calls.gitInit, [target]);
    assert.equal(result.installedDependencies, true);
    assert.equal(result.gitInitialized, true);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('createApp honors --skip-install and --disable-git flow flags', async () => {
  const tempRoot = await mkdtemp(join(tmpdir(), 'capt-phase4-skip-'));
  const target = join(tempRoot, 'phase4-skip');

  const calls = {
    install: [],
    postInit: [],
    gitInit: [],
  };

  try {
    const result = await createApp(
      {
        generatorRoot: PACKAGE_ROOT,
        projectArg: target,
        packageManager: 'pnpm',
        exampleSelection: 'aave',
        skipInstall: true,
        disableGit: true,
      },
      {
        install: async (options) => {
          calls.install.push(options);
        },
        postInit: async (context) => {
          calls.postInit.push(context);
        },
        gitInit: (root) => {
          calls.gitInit.push(root);
          return true;
        },
      },
    );

    assert.equal(calls.install.length, 0);
    assert.equal(calls.postInit.length, 1);
    assert.equal(calls.postInit[0].installedDependencies, false);
    assert.equal(calls.postInit[0].exampleSelection, 'aave');
    assert.equal(calls.gitInit.length, 0);
    assert.equal(result.installedDependencies, false);
    assert.equal(result.gitInitialized, false);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});
