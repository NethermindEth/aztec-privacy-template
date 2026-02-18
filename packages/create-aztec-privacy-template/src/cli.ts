#!/usr/bin/env node

import { printUsage } from './helpers/cli-options.js';
import { run } from './index.js';

run(process.argv.slice(2), import.meta.url).catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Error: ${message}`);
  printUsage();
  process.exit(1);
});
