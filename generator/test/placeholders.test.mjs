import assert from 'node:assert/strict';
import { access, cp, mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { applyPlaceholdersInSelectedFiles, getPlaceholderMap } from '../dist/placeholders.js';
import { scaffoldTemplate as scaffoldBaseTemplate } from '../dist/helpers/template-scaffold.js';

const PACKAGE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

test('getPlaceholderMap builds expected replacement map', () => {
  const map = getPlaceholderMap('my-app', 'pnpm');

  assert.equal(map.__PROJECT_NAME__, 'my-app');
  assert.equal(map.__INSTALL_COMMAND__, 'pnpm install');
});

test('applyPlaceholdersInSelectedFiles replaces README placeholders', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'capt-placeholders-'));

  try {
    await writeFile(join(dir, 'README.md'), '# __PROJECT_NAME__\n\n__INSTALL_COMMAND__\n', 'utf8');

    const map = getPlaceholderMap('demo', 'bun');
    await applyPlaceholdersInSelectedFiles(dir, map);

    const readme = await readFile(join(dir, 'README.md'), 'utf8');
    assert.match(readme, /^# demo/m);
    assert.match(readme, /bun install/);
    assert.doesNotMatch(readme, /__[A-Z0-9_]+__/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('scaffoldBaseTemplate emits project metadata with no unresolved placeholders', async () => {
  const target = await mkdtemp(join(tmpdir(), 'capt-scaffold-'));

  try {
    await scaffoldBaseTemplate({
      generatorRoot: PACKAGE_ROOT,
      absoluteTargetPath: target,
      projectName: 'placeholder-smoke',
      packageManager: 'npm',
    });

    const readme = await readFile(join(target, 'README.md'), 'utf8');
    assert.match(readme, /^# placeholder-smoke/m);
    assert.match(readme, /npm install/);
    assert.doesNotMatch(readme, /__[A-Z0-9_]+__/);

    const packageJsonRaw = await readFile(join(target, 'package.json'), 'utf8');
    const packageJson = JSON.parse(packageJsonRaw);
    assert.equal(packageJson.name, 'placeholder-smoke');

    await assert.rejects(() => access(join(target, 'examples', 'aave', 'README.md')));
  } finally {
    await rm(target, { recursive: true, force: true });
  }
});

test('scaffoldBaseTemplate applies requested single overlay', async () => {
  const target = await mkdtemp(join(tmpdir(), 'capt-overlay-single-'));

  try {
    await scaffoldBaseTemplate({
      generatorRoot: PACKAGE_ROOT,
      absoluteTargetPath: target,
      projectName: 'overlay-single',
      packageManager: 'bun',
      exampleSelection: 'aave',
    });

    const aaveReadme = await readFile(join(target, 'examples', 'aave', 'README.md'), 'utf8');
    assert.match(aaveReadme, /Aave Example/);
    await assert.rejects(() => access(join(target, 'examples', 'lido', 'README.md')));
  } finally {
    await rm(target, { recursive: true, force: true });
  }
});

for (const exampleSelection of ['lido', 'uniswap']) {
  test(`scaffoldBaseTemplate applies requested ${exampleSelection} overlay`, async () => {
    const target = await mkdtemp(join(tmpdir(), `capt-overlay-${exampleSelection}-`));

    try {
      await scaffoldBaseTemplate({
        generatorRoot: PACKAGE_ROOT,
        absoluteTargetPath: target,
        projectName: `overlay-${exampleSelection}`,
        packageManager: 'bun',
        exampleSelection,
      });

      const overlayReadme = await readFile(
        join(target, 'examples', exampleSelection, 'README.md'),
        'utf8',
      );
      assert.match(
        overlayReadme,
        new RegExp(`${exampleSelection[0].toUpperCase()}${exampleSelection.slice(1)} Example`),
      );
    } finally {
      await rm(target, { recursive: true, force: true });
    }
  });
}

test('scaffoldBaseTemplate applies all overlays in deterministic order', async () => {
  const target = await mkdtemp(join(tmpdir(), 'capt-overlay-all-'));

  try {
    await scaffoldBaseTemplate({
      generatorRoot: PACKAGE_ROOT,
      absoluteTargetPath: target,
      projectName: 'overlay-all',
      packageManager: 'pnpm',
      exampleSelection: 'all',
    });

    const aaveReadme = await readFile(join(target, 'examples', 'aave', 'README.md'), 'utf8');
    const lidoReadme = await readFile(join(target, 'examples', 'lido', 'README.md'), 'utf8');
    const uniswapReadme = await readFile(join(target, 'examples', 'uniswap', 'README.md'), 'utf8');

    assert.match(aaveReadme, /Aave Example/);
    assert.match(lidoReadme, /Lido Example/);
    assert.match(uniswapReadme, /Uniswap Example/);
  } finally {
    await rm(target, { recursive: true, force: true });
  }
});

test('scaffoldBaseTemplate applies overlay order deterministically on file collisions', async () => {
  const tempRoot = await mkdtemp(join(tmpdir(), 'capt-overlay-collision-'));
  const target = join(tempRoot, 'output');
  const fakeGeneratorRoot = join(tempRoot, 'generator');

  try {
    await mkdir(fakeGeneratorRoot, { recursive: true });
    await mkdir(join(fakeGeneratorRoot, 'overlays', 'examples', 'aave'), {
      recursive: true,
    });
    await mkdir(join(fakeGeneratorRoot, 'overlays', 'examples', 'lido'), {
      recursive: true,
    });
    await mkdir(join(fakeGeneratorRoot, 'overlays', 'examples', 'uniswap'), {
      recursive: true,
    });

    // Start from real scaffold content so required files exist for placeholder checks.
    await cp(join(PACKAGE_ROOT, 'scaffold'), join(fakeGeneratorRoot, 'scaffold'), {
      recursive: true,
    });
    await cp(
      join(PACKAGE_ROOT, 'scaffold', '.solhint.json'),
      join(fakeGeneratorRoot, 'scaffold', '.solhint.json'),
    );
    await writeFile(
      join(fakeGeneratorRoot, 'overlays', 'examples', 'aave', 'collision.txt'),
      'aave\n',
      'utf8',
    );
    await writeFile(
      join(fakeGeneratorRoot, 'overlays', 'examples', 'lido', 'collision.txt'),
      'lido\n',
      'utf8',
    );
    await writeFile(
      join(fakeGeneratorRoot, 'overlays', 'examples', 'uniswap', 'collision.txt'),
      'uniswap\n',
      'utf8',
    );

    await scaffoldBaseTemplate({
      generatorRoot: fakeGeneratorRoot,
      absoluteTargetPath: target,
      projectName: 'overlay-collision',
      packageManager: 'bun',
      exampleSelection: 'all',
    });

    const collision = await readFile(join(target, 'collision.txt'), 'utf8');
    assert.equal(collision, 'uniswap\n');
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});
