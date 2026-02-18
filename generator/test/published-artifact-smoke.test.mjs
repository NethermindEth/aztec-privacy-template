import assert from 'node:assert/strict';
import { access, mkdir, mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const PACKAGE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SHOULD_RUN_SMOKE = process.env.CAPT_RUN_PUBLISHED_ARTIFACT_SMOKE === '1';

test('phase6 published artifact smoke scaffolds from npm pack output', async (t) => {
  if (!SHOULD_RUN_SMOKE) {
    t.skip('Set CAPT_RUN_PUBLISHED_ARTIFACT_SMOKE=1 to run published artifact smoke test.');
    return;
  }

  const tempRoot = await mkdtemp(join(tmpdir(), 'capt-phase6-pack-smoke-'));
  const packDir = join(tempRoot, 'pack');
  const unpackDir = join(tempRoot, 'unpack');
  const target = join(tempRoot, 'artifact-smoke-app');

  try {
    await mkdir(packDir, { recursive: true });
    await mkdir(unpackDir, { recursive: true });
    await runCommand('npm', ['pack', '--silent', '--pack-destination', packDir], PACKAGE_ROOT);

    const artifacts = (await readdir(packDir)).filter((name) => name.endsWith('.tgz'));
    assert.equal(artifacts.length, 1, 'npm pack should produce one tarball');

    const tarballPath = join(packDir, artifacts[0]);
    await runCommand('tar', ['-xzf', tarballPath, '-C', unpackDir], PACKAGE_ROOT);

    const packedCliPath = join(unpackDir, 'package', 'dist', 'cli.js');
    await access(packedCliPath);

    await runCommand(
      'node',
      [
        packedCliPath,
        target,
        '--pm',
        'npm',
        '--example',
        'aave',
        '--yes',
        '--skip-install',
        '--disable-git',
      ],
      PACKAGE_ROOT,
    );

    await access(join(target, 'README.md'));
    await access(join(target, 'examples', 'aave', 'README.md'));
    await access(join(target, 'package.json'));
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

async function runCommand(command, args, cwd) {
  await new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: process.env,
    });

    let stderr = '';
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
          `Command "${command} ${args.join(' ')}" exited with code ${code ?? 'unknown'}.\n${stderr}`,
        ),
      );
    });
  });
}
