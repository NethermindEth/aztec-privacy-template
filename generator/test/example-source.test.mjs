import assert from 'node:assert/strict';
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { createApp } from '../dist/create-app.js';
import { installExampleSource, parseGithubExampleSource } from '../dist/helpers/examples.js';

const PACKAGE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

test('parseGithubExampleSource accepts GitHub URL and repo path formats', () => {
  assert.deepEqual(parseGithubExampleSource('acme/capt-starter/examples/foo#main'), {
    owner: 'acme',
    repo: 'capt-starter',
    ref: 'main',
    subPath: 'examples/foo',
    normalizedSource: 'https://github.com/acme/capt-starter/tree/main/examples/foo',
  });

  assert.deepEqual(
    parseGithubExampleSource('https://github.com/acme/capt-starter/tree/canary/templates/base'),
    {
      owner: 'acme',
      repo: 'capt-starter',
      ref: 'canary',
      subPath: 'templates/base',
      normalizedSource: 'https://github.com/acme/capt-starter/tree/canary/templates/base',
    },
  );

  assert.deepEqual(
    parseGithubExampleSource('https://github.com/acme/capt-starter#release%2Fcandidate'),
    {
      owner: 'acme',
      repo: 'capt-starter',
      ref: 'release/candidate',
      subPath: '',
      normalizedSource: 'https://github.com/acme/capt-starter/tree/release/candidate',
    },
  );

  assert.deepEqual(
    parseGithubExampleSource(
      'https://github.com/acme/capt-starter/tree/canary/templates/base#release%2Fcandidate',
    ),
    {
      owner: 'acme',
      repo: 'capt-starter',
      ref: 'release/candidate',
      subPath: 'templates/base',
      normalizedSource:
        'https://github.com/acme/capt-starter/tree/release/candidate/templates/base',
    },
  );
});

test('parseGithubExampleSource rejects malformed refs', () => {
  assert.throws(
    () => parseGithubExampleSource('https://github.com/acme/capt-starter#'),
    /cannot be empty after "#"/,
  );
  assert.throws(
    () => parseGithubExampleSource('https://github.com/acme/capt-starter#%E0%A4'),
    /not valid URL encoding/,
  );
});

test('installExampleSource retries transient failures and applies on a later attempt', async () => {
  const target = await mkdtemp(join(tmpdir(), 'capt-example-source-retry-success-'));
  let fetchAttempts = 0;

  try {
    const result = await installExampleSource(
      {
        absoluteTargetPath: target,
        exampleSource: 'acme/capt-starter/examples/remote#main',
        maxAttempts: 3,
        retryDelayMs: 0,
      },
      {
        fetchImpl: async () => {
          fetchAttempts += 1;
          if (fetchAttempts < 3) {
            throw new Error('temporary network failure');
          }

          return new Response('archive-bytes', {
            status: 200,
            statusText: 'OK',
          });
        },
        extractArchive: async (_archivePath, extractDir) => {
          const sourceDir = join(extractDir, 'capt-starter-main', 'examples', 'remote');
          await mkdir(sourceDir, { recursive: true });
          await writeFile(join(sourceDir, 'README.md'), '# Remote Overlay\n', 'utf8');
        },
        sleep: async () => {},
      },
    );

    assert.equal(fetchAttempts, 3);
    assert.equal(result.applied, true);
    assert.equal(result.attempts, 3);
    assert.equal(result.fallbackReason, undefined);

    const copiedReadme = await readFile(join(target, 'README.md'), 'utf8');
    assert.match(copiedReadme, /Remote Overlay/);
  } finally {
    await rm(target, { recursive: true, force: true });
  }
});

test('installExampleSource returns fallback metadata after retry exhaustion', async () => {
  const target = await mkdtemp(join(tmpdir(), 'capt-example-source-retry-fallback-'));
  let fetchAttempts = 0;

  try {
    const result = await installExampleSource(
      {
        absoluteTargetPath: target,
        exampleSource: 'acme/capt-starter',
        maxAttempts: 2,
        retryDelayMs: 0,
      },
      {
        fetchImpl: async () => {
          fetchAttempts += 1;
          throw new Error('network timeout');
        },
        extractArchive: async () => {
          throw new Error('extract should not be called on failed fetch');
        },
        sleep: async () => {},
      },
    );

    assert.equal(fetchAttempts, 2);
    assert.equal(result.applied, false);
    assert.equal(result.attempts, 2);
    assert.match(result.fallbackReason, /network timeout/);
  } finally {
    await rm(target, { recursive: true, force: true });
  }
});

test('createApp falls back to local examples when remote source installation fails', async () => {
  const tempRoot = await mkdtemp(join(tmpdir(), 'capt-example-source-create-app-'));
  const target = join(tempRoot, 'example-source-fallback-app');
  const calls = {
    install: [],
    postInit: [],
    gitInit: [],
    installExampleSource: [],
  };

  try {
    const result = await createApp(
      {
        generatorRoot: PACKAGE_ROOT,
        projectArg: target,
        packageManager: 'npm',
        exampleSelection: 'none',
        exampleSource: 'acme/capt-starter',
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
          return false;
        },
        installExampleSource: async (options) => {
          calls.installExampleSource.push(options);
          return {
            source: 'https://github.com/acme/capt-starter/tree/HEAD',
            applied: false,
            attempts: 3,
            fallbackReason: 'network timeout',
          };
        },
      },
    );

    assert.equal(calls.install.length, 0);
    assert.equal(calls.postInit.length, 1);
    assert.equal(calls.gitInit.length, 0);
    assert.equal(calls.installExampleSource.length, 1);
    assert.equal(calls.installExampleSource[0].absoluteTargetPath, target);
    assert.equal(calls.installExampleSource[0].exampleSource, 'acme/capt-starter');

    assert.equal(result.installedDependencies, false);
    assert.equal(result.gitInitialized, false);
    assert.equal(result.remoteExample?.applied, false);
    assert.match(result.remoteExample?.fallbackReason ?? '', /network timeout/);

    await access(join(target, 'README.md'));
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});
