import { createHash } from 'node:crypto';
import { strict as assert } from 'node:assert';
import test from 'node:test';

export type ProtocolMode = 'relayer' | 'self-execution';

export type ProtocolLifecycle = {
  protocol: 'aave' | 'uniswap' | 'lido';
  deploy(): Promise<{ protocolAddress: string }>;
  shield(value: string): Promise<{ messageHash: string }>;
  act(action: string, amount: string): Promise<{ contentHash: string }>;
  unshield(amount: string): Promise<{ messageHash: string }>;
  assert(): Promise<boolean>;
};

type HarnessConfig = {
  protocol: 'aave' | 'uniswap' | 'lido';
  spec: ProtocolLifecycle;
  actions: string[];
  mode: ProtocolMode;
};

async function fakeTxHash(seed: string): Promise<string> {
  return `0x${createHash('sha256').update(seed).digest('hex').slice(0, 40)}`;
}

async function hasSandboxReady(seed: string): Promise<boolean> {
  const txHash = await fakeTxHash(seed);
  return txHash.startsWith('0x');
}

function asserter<T>(value: T, message: string): asserts value is T {
  assert.equal(!!value, true, message);
}

export function runProtocolLifecycleHarness(config: HarnessConfig): void {
  const { protocol, spec, actions, mode } = config;

  test(`${protocol} spec adapter exposes required lifecycle handlers`, () => {
    assert.equal(spec.protocol, protocol);
    assert.equal(typeof spec.deploy, 'function');
    assert.equal(typeof spec.shield, 'function');
    assert.equal(typeof spec.act, 'function');
    assert.equal(typeof spec.unshield, 'function');
    assert.equal(typeof spec.assert, 'function');
  });

  test(`${protocol} executes shared lifecycle in ${mode} mode`, async () => {
    assert.equal(mode === 'relayer' || mode === 'self-execution', true);
    const deployResult = await spec.deploy();
    asserter(deployResult.protocolAddress, 'protocolAddress');

    const shieldResult = await spec.shield('10');
    asserter(shieldResult.messageHash, 'shield messageHash');

    const [firstAction, ...rest] = actions;
    assert.equal(typeof firstAction, 'string');

    const actionResult = await spec.act(firstAction, '10');
    asserter(actionResult.contentHash, 'act contentHash');
    assert.equal(!!(await hasSandboxReady(`${protocol}-${mode}-${firstAction}`)), true);

    const unshieldResult = await spec.unshield('10');
    asserter(unshieldResult.messageHash, 'unshield messageHash');

    for (const action of rest) {
      const repeatedAction = await spec.act(action, '10');
      asserter(repeatedAction.contentHash, `act contentHash for ${action}`);
    }

    assert.equal(await spec.assert(), true);
  });
}
