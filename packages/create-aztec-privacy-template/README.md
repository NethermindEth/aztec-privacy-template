# create-aztec-privacy-template

CLI package for scaffolding a protocol-agnostic Aztec privacy starter:

```bash
npx create-aztec-privacy-template my-app
```

## Package structure

1. `src/` generator TypeScript source
2. `dist/` compiled CLI output (published)
3. `scaffold/` files copied into generated projects

## Local development

```bash
bun run typecheck
bun run build
node dist/cli.js /tmp/my-aztec-app
```

Scaffold quality checks are run from the scaffold directory:

```bash
make -C scaffold check
```
