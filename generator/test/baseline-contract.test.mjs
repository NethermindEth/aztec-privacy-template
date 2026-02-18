import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  INSTALL_COMMANDS,
  SUPPORTED_EXAMPLE_SELECTIONS,
  SUPPORTED_PACKAGE_MANAGERS,
} from '../dist/constants.js';
import { scaffoldTemplate as scaffoldBaseTemplate } from '../dist/helpers/template-scaffold.js';

const PACKAGE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SNAPSHOT_ROOT = join(PACKAGE_ROOT, 'test', 'fixtures', 'baseline-structure');
const EXAMPLE_SNAPSHOT_MAP = {
  none: 'none.json',
  aave: 'aave.json',
  lido: 'lido.json',
  uniswap: 'uniswap.json',
  all: 'all.json',
};

const CAPT_MATRIX_PM = process.env.CAPT_MATRIX_PM;
const CAPT_MATRIX_EXAMPLE = process.env.CAPT_MATRIX_EXAMPLE;

function assertMatrixInputsSupported() {
  if (CAPT_MATRIX_PM && !SUPPORTED_PACKAGE_MANAGERS.includes(CAPT_MATRIX_PM)) {
    throw new Error(`Unsupported CAPT_MATRIX_PM: ${CAPT_MATRIX_PM}`);
  }

  if (CAPT_MATRIX_EXAMPLE && !SUPPORTED_EXAMPLE_SELECTIONS.includes(CAPT_MATRIX_EXAMPLE)) {
    throw new Error(`Unsupported CAPT_MATRIX_EXAMPLE: ${CAPT_MATRIX_EXAMPLE}`);
  }
}

async function walkTree(dir, prefix = '') {
  const entries = (await readdir(dir, { withFileTypes: true })).sort((a, b) =>
    a.name.localeCompare(b.name),
  );
  const files = [];

  for (const entry of entries) {
    const relPath = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      files.push(`${relPath}/`);
      files.push(...(await walkTree(join(dir, entry.name), relPath)));
      continue;
    }

    files.push(relPath);
  }

  return files;
}

async function loadSnapshot(exampleSelection) {
  const snapshotFile = EXAMPLE_SNAPSHOT_MAP[exampleSelection];
  const snapshotJson = await readFile(join(SNAPSHOT_ROOT, snapshotFile), 'utf8');
  return JSON.parse(snapshotJson);
}

function expectedExampleDirs(exampleSelection) {
  if (exampleSelection === 'none') {
    return [];
  }

  if (exampleSelection === 'all') {
    return ['examples/aave/', 'examples/lido/', 'examples/uniswap/'];
  }

  return [`examples/${exampleSelection}/`];
}

test('baseline fixture snapshots are valid JSON arrays', async () => {
  for (const exampleSelection of Object.keys(EXAMPLE_SNAPSHOT_MAP)) {
    const snapshot = await loadSnapshot(exampleSelection);
    assert.ok(Array.isArray(snapshot), `${exampleSelection} snapshot must be an array`);
    assert.ok(snapshot.length > 0, `${exampleSelection} snapshot cannot be empty`);
  }
});

test('baseline scaffold contract is stable for selected matrix combinations', async () => {
  assertMatrixInputsSupported();

  const packageManagers = CAPT_MATRIX_PM ? [CAPT_MATRIX_PM] : SUPPORTED_PACKAGE_MANAGERS;
  const exampleSelections = CAPT_MATRIX_EXAMPLE
    ? [CAPT_MATRIX_EXAMPLE]
    : SUPPORTED_EXAMPLE_SELECTIONS;

  for (const packageManager of packageManagers) {
    for (const exampleSelection of exampleSelections) {
      const caseLabel = `${packageManager}/${exampleSelection}`;
      const projectName = `phase0-${packageManager}-${exampleSelection}`;
      const target = await mkdtemp(join(tmpdir(), 'capt-phase0-'));

      try {
        await scaffoldBaseTemplate({
          generatorRoot: PACKAGE_ROOT,
          absoluteTargetPath: target,
          projectName,
          packageManager,
          exampleSelection,
        });

        const readme = await readFile(join(target, 'README.md'), 'utf8');
        const packageJson = JSON.parse(await readFile(join(target, 'package.json'), 'utf8'));
        const generatedTree = await walkTree(target);
        const expectedTree = await loadSnapshot(exampleSelection);

        assert.match(
          readme,
          new RegExp(`^# ${projectName}$`, 'm'),
          `${caseLabel}: README title mismatch`,
        );
        assert.match(
          readme,
          new RegExp(INSTALL_COMMANDS[packageManager].replace(' ', '\\s+')),
          `${caseLabel}: README install command mismatch`,
        );
        assert.doesNotMatch(
          readme,
          /__[A-Z0-9_]+__/,
          `${caseLabel}: unresolved placeholders in README`,
        );
        assert.equal(packageJson.name, projectName, `${caseLabel}: package name mismatch`);
        assert.deepEqual(generatedTree, expectedTree, `${caseLabel}: scaffold structure drift`);

        const presentExampleDirs = generatedTree.filter(
          (path) => path.startsWith('examples/') && path.endsWith('/'),
        );
        assert.deepEqual(
          presentExampleDirs.filter((path) => path.split('/').length === 3).sort(),
          expectedExampleDirs(exampleSelection).sort(),
          `${caseLabel}: example directory mismatch`,
        );
      } finally {
        await rm(target, { recursive: true, force: true });
      }
    }
  }
});
