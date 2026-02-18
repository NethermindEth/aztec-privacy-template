# create-aztec-privacy-template

CLI package that scaffolds a protocol-agnostic Aztec privacy starter:

```bash
npx create-aztec-privacy-template my-app
```

## Layout

1. `src/` generator TypeScript source
2. `dist/` compiled CLI output (published)
3. `scaffold/` files copied into generated projects

## Development workflow

Run these from the repo root (`/home/ametel/source/aztec-privacy-template`):

```bash
make generator-typecheck
make generator-build
make generator-test
make scaffold-check
```

There is no package-local `Makefile`; root `Makefile` is the single entrypoint.

If you want to run commands directly inside this package:

```bash
cd packages/create-aztec-privacy-template
bun run typecheck
bun run build
bun run test
node dist/cli.js /tmp/my-aztec-app --pm bun --yes
```
