export const SUPPORTED_PACKAGE_MANAGERS = ['bun', 'npm', 'pnpm', 'yarn'] as const;

export type PackageManager = (typeof SUPPORTED_PACKAGE_MANAGERS)[number];
export type ExampleOverlayName = 'aave' | 'lido' | 'uniswap';
export type ExampleSelection = 'none' | 'all' | ExampleOverlayName;

export const SCAFFOLD_DIR = 'scaffold' as const;
export const OVERLAY_EXAMPLES_DIR = 'overlays/examples' as const;
export const EXAMPLE_OVERLAY_ORDER = ['aave', 'lido', 'uniswap'] as const;
export const SUPPORTED_EXAMPLE_SELECTIONS = ['none', ...EXAMPLE_OVERLAY_ORDER, 'all'] as const;

export const TEMPLATE_COPY_ENTRIES = [
  '.solhint.json',
  'gitignore',
  'Makefile',
  'README.md',
  'contracts',
  'scripts',
] as const;

export const PLACEHOLDER_TEXT_FILES = ['README.md'] as const;

export const STARTER_PACKAGE_JSON_BASE = {
  private: true,
  version: '0.1.0',
  description: 'Protocol-agnostic starter for Aztec privacy integrations',
  license: 'MIT',
  scripts: {
    fmt: 'make fmt',
    'fmt:check': 'make fmt-check',
    lint: 'make lint',
    test: 'make test',
  },
  devDependencies: {
    solhint: '^6.0.3',
  },
} as const;

export const INSTALL_COMMANDS: Record<PackageManager, string> = {
  bun: 'bun install',
  npm: 'npm install',
  pnpm: 'pnpm install',
  yarn: 'yarn install',
};
