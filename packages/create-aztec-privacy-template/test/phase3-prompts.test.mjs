import assert from 'node:assert/strict';
import test from 'node:test';

import { resolvePromptOptions } from '../dist/prompts.js';

function createDependencies({ answers = [], interactive = true, preferences = {} } = {}) {
  const askedPrompts = [];
  let answerIndex = 0;
  let savedPreferences = undefined;

  return {
    deps: {
      ask: async (prompt) => {
        askedPrompts.push(prompt);
        const answer = answers[answerIndex] ?? '';
        answerIndex += 1;
        return answer;
      },
      isInteractive: () => interactive,
      loadPreferences: async () => preferences,
      savePreferences: async (value) => {
        savedPreferences = value;
      },
    },
    getAskedPrompts: () => askedPrompts,
    getSavedPreferences: () => savedPreferences,
  };
}

test('--yes resolves omitted options from saved preferences/defaults without prompting', async () => {
  const mock = createDependencies({
    interactive: false,
    preferences: {
      packageManager: 'pnpm',
      exampleSelection: 'uniswap',
    },
  });

  const resolved = await resolvePromptOptions(
    {
      projectArg: undefined,
      packageManager: 'bun',
      exampleSelection: 'none',
      yes: true,
      packageManagerProvided: false,
      exampleSelectionProvided: false,
    },
    mock.deps,
  );

  assert.equal(resolved.projectArg, 'my-aztec-app');
  assert.equal(resolved.packageManager, 'pnpm');
  assert.equal(resolved.exampleSelection, 'uniswap');
  assert.deepEqual(mock.getAskedPrompts(), []);
  assert.deepEqual(mock.getSavedPreferences(), {
    packageManager: 'pnpm',
    exampleSelection: 'uniswap',
  });
});

test('interactive mode prompts for omitted project, package manager, and example', async () => {
  const mock = createDependencies({
    answers: ['demo-app', 'yarn', 'all'],
    interactive: true,
  });

  const resolved = await resolvePromptOptions(
    {
      projectArg: undefined,
      packageManager: 'bun',
      exampleSelection: 'none',
      yes: false,
      packageManagerProvided: false,
      exampleSelectionProvided: false,
    },
    mock.deps,
  );

  assert.equal(resolved.projectArg, 'demo-app');
  assert.equal(resolved.packageManager, 'yarn');
  assert.equal(resolved.exampleSelection, 'all');
  assert.equal(mock.getAskedPrompts().length, 3);
  assert.deepEqual(mock.getSavedPreferences(), {
    packageManager: 'yarn',
    exampleSelection: 'all',
  });
});

test('non-interactive mode without --yes fails when project argument is missing', async () => {
  const mock = createDependencies({ interactive: false });

  await assert.rejects(
    () =>
      resolvePromptOptions(
        {
          projectArg: undefined,
          packageManager: 'bun',
          exampleSelection: 'none',
          yes: false,
          packageManagerProvided: false,
          exampleSelectionProvided: false,
        },
        mock.deps,
      ),
    /Project name\/path is required/,
  );
});

test('non-interactive mode without --yes uses defaults for omitted optional flags', async () => {
  const mock = createDependencies({ interactive: false });

  const resolved = await resolvePromptOptions(
    {
      projectArg: 'ci-app',
      packageManager: 'bun',
      exampleSelection: 'none',
      yes: false,
      packageManagerProvided: false,
      exampleSelectionProvided: false,
    },
    mock.deps,
  );

  assert.equal(resolved.projectArg, 'ci-app');
  assert.equal(resolved.packageManager, 'bun');
  assert.equal(resolved.exampleSelection, 'none');
  assert.deepEqual(mock.getAskedPrompts(), []);
});

test('non-interactive mode uses saved preferences for omitted optional flags', async () => {
  const mock = createDependencies({
    interactive: false,
    preferences: {
      packageManager: 'yarn',
      exampleSelection: 'all',
    },
  });

  const resolved = await resolvePromptOptions(
    {
      projectArg: 'ci-app',
      packageManager: 'bun',
      exampleSelection: 'none',
      yes: false,
      packageManagerProvided: false,
      exampleSelectionProvided: false,
    },
    mock.deps,
  );

  assert.equal(resolved.packageManager, 'yarn');
  assert.equal(resolved.exampleSelection, 'all');
  assert.deepEqual(mock.getAskedPrompts(), []);
});

test('preference write errors do not fail resolution', async () => {
  const mock = createDependencies({
    interactive: false,
  });

  const resolved = await resolvePromptOptions(
    {
      projectArg: 'resilient-app',
      packageManager: 'pnpm',
      exampleSelection: 'lido',
      yes: false,
      packageManagerProvided: true,
      exampleSelectionProvided: true,
    },
    {
      ...mock.deps,
      savePreferences: async () => {
        throw new Error('disk full');
      },
    },
  );

  assert.equal(resolved.projectArg, 'resilient-app');
  assert.equal(resolved.packageManager, 'pnpm');
  assert.equal(resolved.exampleSelection, 'lido');
});
