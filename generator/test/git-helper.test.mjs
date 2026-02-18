import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { tryGitInit } from '../dist/helpers/git.js';

function withCleanGitEnv(envRoot) {
  return {
    HOME: envRoot,
    XDG_CONFIG_HOME: envRoot,
    GIT_CONFIG_NOSYSTEM: '1',
    GIT_CONFIG_GLOBAL: join(envRoot, 'nonexistent'),
    GIT_AUTHOR_NAME: 'capt-test',
    GIT_AUTHOR_EMAIL: 'capt-test@example.com',
    GIT_COMMITTER_NAME: 'capt-test',
    GIT_COMMITTER_EMAIL: 'capt-test@example.com',
  };
}

function restoreEnv(snapshot) {
  for (const key of Object.keys(process.env)) {
    if (!(key in snapshot)) {
      delete process.env[key];
    }
  }

  for (const [key, value] of Object.entries(snapshot)) {
    process.env[key] = value;
  }
}

test('tryGitInit initializes repository and creates initial commit', async () => {
  const tempRoot = await mkdtemp(join(tmpdir(), 'capt-git-helper-'));
  const target = join(tempRoot, 'app');
  const envRoot = join(tempRoot, 'git-env');
  const originalEnv = { ...process.env };

  try {
    await mkdir(target, { recursive: true });
    await mkdir(envRoot, { recursive: true });
    await writeFile(join(target, 'README.md'), '# test\n', 'utf8');
    Object.assign(process.env, withCleanGitEnv(envRoot));

    const initialized = tryGitInit(target);
    assert.equal(initialized, true);

    const branch = execSync('git symbolic-ref --short HEAD', {
      cwd: target,
      encoding: 'utf8',
    }).trim();
    const commitCount = execSync('git rev-list --count HEAD', {
      cwd: target,
      encoding: 'utf8',
    }).trim();

    assert.equal(branch, 'main');
    assert.equal(commitCount, '1');
  } finally {
    restoreEnv(originalEnv);
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('tryGitInit returns false when target is inside an existing git repository', async () => {
  const tempRoot = await mkdtemp(join(tmpdir(), 'capt-git-helper-parent-'));
  const repoRoot = join(tempRoot, 'workspace');
  const nestedTarget = join(repoRoot, 'nested', 'app');

  try {
    await mkdir(repoRoot, { recursive: true });
    execSync('git init', { cwd: repoRoot, stdio: 'ignore' });
    await mkdir(nestedTarget, { recursive: true });

    const initialized = tryGitInit(nestedTarget);
    assert.equal(initialized, false);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});
