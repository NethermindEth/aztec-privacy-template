import assert from 'node:assert/strict';
import { access, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { SUPPORTED_EXAMPLE_SELECTIONS, SUPPORTED_PACKAGE_MANAGERS } from '../dist/constants.js';

const PACKAGE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CLI_PATH = join(PACKAGE_ROOT, 'dist', 'cli.js');
const E2E_PM = process.env.CAPT_E2E_PM;
const E2E_EXAMPLE = process.env.CAPT_E2E_EXAMPLE;
const E2E_INSTALL_MODE = process.env.CAPT_E2E_INSTALL_MODE;

const LOCKFILE_BY_PM = {
  bun: 'bun.lock',
  npm: 'package-lock.json',
  pnpm: 'pnpm-lock.yaml',
  yarn: 'yarn.lock',
};

const EXAMPLE_DIRS_BY_SELECTION = {
  none: [],
  aave: ['aave'],
  lido: ['lido'],
  uniswap: ['uniswap'],
  all: ['aave', 'lido', 'uniswap'],
};

test('generator e2e matrix case', async (t) => {
  if (!E2E_PM || !E2E_EXAMPLE || !E2E_INSTALL_MODE) {
    t.skip('CAPT_E2E_PM, CAPT_E2E_EXAMPLE, and CAPT_E2E_INSTALL_MODE are required for this test.');
    return;
  }

  assert.ok(
    SUPPORTED_PACKAGE_MANAGERS.includes(E2E_PM),
    `Unsupported CAPT_E2E_PM "${E2E_PM}". Expected one of: ${SUPPORTED_PACKAGE_MANAGERS.join(', ')}`,
  );
  assert.ok(
    SUPPORTED_EXAMPLE_SELECTIONS.includes(E2E_EXAMPLE),
    `Unsupported CAPT_E2E_EXAMPLE "${E2E_EXAMPLE}". Expected one of: ${SUPPORTED_EXAMPLE_SELECTIONS.join(', ')}`,
  );
  assert.ok(
    E2E_INSTALL_MODE === 'skip' || E2E_INSTALL_MODE === 'install',
    `Unsupported CAPT_E2E_INSTALL_MODE "${E2E_INSTALL_MODE}". Expected "skip" or "install".`,
  );

  const root = await mkdtemp(join(tmpdir(), 'capt-generator-e2e-'));
  const target = join(root, `matrix-${E2E_PM}-${E2E_EXAMPLE}-${E2E_INSTALL_MODE}`);

  try {
    const args = [
      CLI_PATH,
      target,
      '--pm',
      E2E_PM,
      '--example',
      E2E_EXAMPLE,
      '--yes',
      '--disable-git',
    ];

    if (E2E_INSTALL_MODE === 'skip') {
      args.push('--skip-install');
    }

    await runCommand('node', args, PACKAGE_ROOT);

    await access(join(target, 'README.md'));
    const packageJson = JSON.parse(await readFile(join(target, 'package.json'), 'utf8'));
    assert.equal(packageJson.name, `matrix-${E2E_PM}-${E2E_EXAMPLE}-${E2E_INSTALL_MODE}`);

    for (const exampleDir of EXAMPLE_DIRS_BY_SELECTION[E2E_EXAMPLE]) {
      await access(join(target, 'examples', exampleDir, 'README.md'));
    }

    const lockfile = LOCKFILE_BY_PM[E2E_PM];
    if (E2E_INSTALL_MODE === 'install') {
      await access(join(target, lockfile));
    } else {
      await assert.rejects(() => access(join(target, lockfile)));
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

async function runCommand(command, args, cwd) {
  await new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: process.env,
    });

    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', (error) => {
      reject(new Error(`Failed to run "${command} ${args.join(' ')}": ${error.message}`));
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolvePromise();
        return;
      }

      reject(
        new Error(
          `Command "${command} ${args.join(' ')}" exited with code ${code ?? 'unknown'}.\nstdout:\n${stdout}\nstderr:\n${stderr}`,
        ),
      );
    });
  });
}
