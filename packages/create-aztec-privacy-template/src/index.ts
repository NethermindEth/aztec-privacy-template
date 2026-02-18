import { INSTALL_COMMANDS } from './constants.js';
import { createApp } from './create-app.js';
import { parseArgs } from './helpers/cli-options.js';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export async function run(argv: string[], importMetaUrl: string): Promise<void> {
  const args = parseArgs(argv);
  const generatorRoot = resolveGeneratorRoot(importMetaUrl);
  const result = await createApp({
    generatorRoot,
    projectArg: args.projectArg,
    packageManager: args.packageManager,
    exampleSelection: args.exampleSelection,
    yes: args.yes,
  });

  console.log(`\nScaffolded Aztec privacy starter at ${result.displayPath}`);
  console.log('\nNext steps:');
  console.log(`  cd ${result.displayPath}`);
  console.log(`  ${INSTALL_COMMANDS[result.packageManager]}`);
  console.log('  make check');
}

function resolveGeneratorRoot(importMetaUrl: string): string {
  return resolve(dirname(fileURLToPath(importMetaUrl)), '..');
}
