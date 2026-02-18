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
    packageManager: 'bun',
    exampleSelection: 'none',
    yes: false,
  });

  assert.deepEqual(parseArgs(['my-app', '--pm', 'npm', '--example', 'aave', '--yes']), {
    projectArg: 'my-app',
    packageManager: 'npm',
    exampleSelection: 'aave',
    yes: true,
  });

  assert.deepEqual(parseArgs(['my-app', '--pm=pnpm', '--example=all']), {
    projectArg: 'my-app',
    packageManager: 'pnpm',
    exampleSelection: 'all',
    yes: false,
  });
});

test('parseArgs rejects unsupported or malformed inputs', () => {
  assert.throws(() => parseArgs([]), /Project name\/path is required/);
  assert.throws(() => parseArgs(['my-app', '--pm', 'pip']), /Unsupported package manager "pip"/);
  assert.throws(() => parseArgs(['my-app', '--example', 'foo']), /Unsupported example "foo"/);
  assert.throws(() => parseArgs(['my-app', '--bogus']), /Unknown option: --bogus/);
});

test('run scaffolds successfully through new index/create-app boundary', async () => {
  const projectRoot = await mkdtemp(join(tmpdir(), 'capt-phase1-run-'));
  const target = join(projectRoot, 'legacy-flags-app');
  const originalLog = console.log;

  try {
    console.log = () => {};
    await run([target, '--pm', 'npm', '--example', 'lido', '--yes'], import.meta.url);

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
