import { execSync } from 'node:child_process';
import { join } from 'node:path';
import { rmSync } from 'node:fs';

function isInsideGitRepository(cwd: string): boolean {
  try {
    execSync('git rev-parse --is-inside-work-tree', { cwd, stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function isInsideMercurialRepository(cwd: string): boolean {
  try {
    execSync('hg --cwd . root', { cwd, stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function hasGitBinary(): boolean {
  try {
    execSync('git --version', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function hasDefaultBranchConfig(cwd: string): boolean {
  try {
    execSync('git config init.defaultBranch', { cwd, stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

export function tryGitInit(root: string): boolean {
  if (!hasGitBinary()) {
    return false;
  }

  if (isInsideGitRepository(root) || isInsideMercurialRepository(root)) {
    return false;
  }

  let initialized = false;

  try {
    execSync('git init', { cwd: root, stdio: 'ignore' });
    initialized = true;

    if (!hasDefaultBranchConfig(root)) {
      // Use branch -M so this remains safe if HEAD is already "main".
      execSync('git branch -M main', { cwd: root, stdio: 'ignore' });
    }

    execSync('git add -A', { cwd: root, stdio: 'ignore' });
    execSync('git commit -m "Initial commit from create-aztec-privacy-template"', {
      cwd: root,
      stdio: 'ignore',
    });
    return true;
  } catch {
    if (initialized) {
      try {
        rmSync(join(root, '.git'), { recursive: true, force: true });
      } catch {
        // Ignore cleanup failures after a failed git init attempt.
      }
    }
    return false;
  }
}
