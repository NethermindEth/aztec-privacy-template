import { INSTALL_COMMANDS } from './constants.js';
import { createApp } from './create-app.js';
import { parseArgs } from './helpers/cli-options.js';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolvePromptOptions } from './prompts.js';

export async function run(argv: string[], importMetaUrl: string): Promise<void> {
  const parsedArgs = parseArgs(argv);
  const args = await resolvePromptOptions(parsedArgs);
  const generatorRoot = resolveGeneratorRoot(importMetaUrl);
  const result = await createApp({
    generatorRoot,
    projectArg: args.projectArg,
    packageManager: args.packageManager,
    exampleSelection: args.exampleSelection,
    exampleSource: args.exampleSource,
    skipInstall: args.skipInstall,
    disableGit: args.disableGit,
  });

  console.log(`\nScaffolded Aztec privacy starter at ${result.displayPath}`);
  if (result.gitInitialized) {
    console.log('Initialized a git repository.');
  } else if (args.disableGit) {
    console.log('Skipped git initialization.');
  } else {
    console.log('Git initialization was skipped (git unavailable or commit failed).');
  }

  if (result.remoteExample) {
    if (result.remoteExample.applied) {
      console.log(`Applied remote example source: ${result.remoteExample.source}`);
    } else {
      const reason = result.remoteExample.fallbackReason
        ? ` (${result.remoteExample.fallbackReason})`
        : '';
      console.log(
        `Remote example source unavailable${reason}. Falling back to local built-in examples.`,
      );
    }
  }

  console.log('\nNext steps:');
  console.log(`  cd ${result.displayPath}`);

  if (!result.installedDependencies) {
    console.log(`  ${INSTALL_COMMANDS[result.packageManager]}`);
  }

  console.log('  make check');
}

function resolveGeneratorRoot(importMetaUrl: string): string {
  return resolve(dirname(fileURLToPath(importMetaUrl)), '..');
}
