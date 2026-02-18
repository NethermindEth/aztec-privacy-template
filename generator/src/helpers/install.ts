import { spawn } from 'node:child_process';

import type { PackageManager } from '../constants.js';

export interface InstallDependenciesOptions {
  packageManager: PackageManager;
  cwd: string;
}

export async function installDependencies(options: InstallDependenciesOptions): Promise<void> {
  const { packageManager, cwd } = options;
  const args = ['install'];

  await new Promise<void>((resolve, reject) => {
    const child = spawn(packageManager, args, {
      cwd,
      stdio: 'inherit',
      env: {
        ...process.env,
        NODE_ENV: 'development',
      },
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(
        new Error(
          `Dependency install failed: ${packageManager} ${args.join(' ')} (exit code ${code ?? 'unknown'})`,
        ),
      );
    });

    child.on('error', (error) => {
      const spawnError = error as NodeJS.ErrnoException;
      if (spawnError.code === 'ENOENT') {
        reject(
          new Error(
            `Package manager "${packageManager}" is not installed or not available on PATH. Install it or rerun with --pm <bun|npm|pnpm|yarn>.`,
          ),
        );
        return;
      }

      reject(new Error(`Failed to spawn installer ${packageManager}: ${error.message}`));
    });
  });
}
