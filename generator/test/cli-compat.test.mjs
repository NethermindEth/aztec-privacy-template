import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { run } from '../dist/index.js';
import { parseArgs } from '../dist/helpers/cli-options.js';

test('parseArgs preserves legacy flag behavior and defaults', () => {
  assert.deepEqual(parseArgs(['my-app']), {
    projectArg: 'my-app',
    packageManager: 'npm',
    exampleSelection: 'none',
    exampleSource: undefined,
    yes: false,
    skipInstall: false,
    disableGit: false,
    packageManagerProvided: false,
    exampleSelectionProvided: false,
    exampleSourceProvided: false,
  });

  assert.deepEqual(parseArgs(['my-app', '--pm', 'npm', '--example', 'aave', '--yes']), {
    projectArg: 'my-app',
    packageManager: 'npm',
    exampleSelection: 'aave',
    exampleSource: undefined,
    yes: true,
    skipInstall: false,
    disableGit: false,
    packageManagerProvided: true,
    exampleSelectionProvided: true,
    exampleSourceProvided: false,
  });

  assert.deepEqual(parseArgs(['my-app', '--pm=pnpm', '--example=all', '--skip-install']), {
    projectArg: 'my-app',
    packageManager: 'pnpm',
    exampleSelection: 'all',
    exampleSource: undefined,
    yes: false,
    skipInstall: true,
    disableGit: false,
    packageManagerProvided: true,
    exampleSelectionProvided: true,
    exampleSourceProvided: false,
  });

  assert.deepEqual(parseArgs([]), {
    projectArg: undefined,
    packageManager: 'npm',
    exampleSelection: 'none',
    exampleSource: undefined,
    yes: false,
    skipInstall: false,
    disableGit: false,
    packageManagerProvided: false,
    exampleSelectionProvided: false,
    exampleSourceProvided: false,
  });

  assert.deepEqual(parseArgs(['my-app', '--disable-git']), {
    projectArg: 'my-app',
    packageManager: 'npm',
    exampleSelection: 'none',
    exampleSource: undefined,
    yes: false,
    skipInstall: false,
    disableGit: true,
    packageManagerProvided: false,
    exampleSelectionProvided: false,
    exampleSourceProvided: false,
  });

  assert.deepEqual(
    parseArgs(['my-app', '--example-source', 'aztecprotocol/aztec-packages/examples']),
    {
      projectArg: 'my-app',
      packageManager: 'npm',
      exampleSelection: 'none',
      exampleSource: 'aztecprotocol/aztec-packages/examples',
      yes: false,
      skipInstall: false,
      disableGit: false,
      packageManagerProvided: false,
      exampleSelectionProvided: false,
      exampleSourceProvided: true,
    },
  );
});

test('parseArgs rejects unsupported or malformed inputs', () => {
  assert.throws(() => parseArgs(['my-app', '--pm', 'pip']), /Unsupported package manager "pip"/);
  assert.throws(() => parseArgs(['my-app', '--example', 'foo']), /Unsupported example "foo"/);
  assert.throws(
    () => parseArgs(['my-app', '--example-source', 'https://gitlab.com/acme/repo']),
    /must point to github.com/,
  );
  assert.throws(() => parseArgs(['my-app', '--bogus']), /Unknown option: --bogus/);
});

test('run scaffolds successfully through new index/create-app boundary', async () => {
  const projectRoot = await mkdtemp(join(tmpdir(), 'capt-cli-run-'));
  const target = join(projectRoot, 'legacy-flags-app');
  const originalLog = console.log;

  try {
    console.log = () => {};
    await run(
      [target, '--pm', 'npm', '--example', 'lido', '--yes', '--skip-install', '--disable-git'],
      import.meta.url,
    );

    const readme = await readFile(join(target, 'README.md'), 'utf8');
    const packageJson = JSON.parse(await readFile(join(target, 'package.json'), 'utf8'));
    const lidoReadme = await readFile(join(target, 'examples', 'lido', 'README.md'), 'utf8');

    assert.match(readme, /^# legacy-flags-app$/m);
    assert.match(readme, /npm install/);
    assert.equal(packageJson.name, 'legacy-flags-app');
    assert.match(lidoReadme, /Lido Example/);
  } finally {
    console.log = originalLog;
    await rm(projectRoot, { recursive: true, force: true });
  }
});
