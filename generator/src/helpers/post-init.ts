import { access, chmod } from 'node:fs/promises';
import { join } from 'node:path';

import type { ExampleSelection } from '../constants.js';

export interface PostInitContext {
  absoluteTargetPath: string;
  exampleSelection: ExampleSelection;
  installedDependencies: boolean;
}

type PostInitHook = (context: PostInitContext) => Promise<void>;

const POST_INIT_HOOKS: PostInitHook[] = [
  verifyRequiredLayoutHook,
  ensureScriptExecutablesHook,
];

export async function runPostInitHooks(context: PostInitContext): Promise<void> {
  for (const hook of POST_INIT_HOOKS) {
    await hook(context);
  }
}

async function verifyRequiredLayoutHook(context: PostInitContext): Promise<void> {
  const requiredPaths = [
    'README.md',
    'package.json',
    join('contracts', 'l1'),
    join('contracts', 'aztec'),
    join('scripts', 'compile-aztec-contract.sh'),
    join('scripts', 'deploy.sh'),
    join('scripts', 'integration-test-deployment.sh'),
    join('scripts', 'verify-deployment.sh'),
  ];

  if (context.exampleSelection === 'all') {
    requiredPaths.push(
      join('examples', 'aave'),
      join('examples', 'lido'),
      join('examples', 'uniswap'),
    );
  } else if (context.exampleSelection !== 'none') {
    requiredPaths.push(join('examples', context.exampleSelection));
  }

  for (const relativePath of requiredPaths) {
    await access(join(context.absoluteTargetPath, relativePath));
  }
}

async function ensureScriptExecutablesHook(context: PostInitContext): Promise<void> {
  const compileScript = join(context.absoluteTargetPath, 'scripts', 'compile-aztec-contract.sh');
  const deployScript = join(context.absoluteTargetPath, 'scripts', 'deploy.sh');
  const integrationDeploymentScript = join(
    context.absoluteTargetPath,
    'scripts',
    'integration-test-deployment.sh',
  );
  const verifyDeploymentScript = join(context.absoluteTargetPath, 'scripts', 'verify-deployment.sh');
  await chmod(compileScript, 0o755);
  await chmod(deployScript, 0o755);
  await chmod(integrationDeploymentScript, 0o755);
  await chmod(verifyDeploymentScript, 0o755);
}
