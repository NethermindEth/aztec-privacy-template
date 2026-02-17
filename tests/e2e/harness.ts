import { createHash } from 'node:crypto';
import { strict as assert } from 'node:assert';
import test from 'node:test';
import { StatelessRelayerRunner } from './relayer-runner';

export type ProtocolMode = 'relayer' | 'self-execution';

export type ProtocolName = 'aave' | 'uniswap' | 'lido';

export type ProtocolLifecycle = {
  protocol: ProtocolName;
  deploy(): Promise<{ protocolAddress: string }>;
  shield(value: string): Promise<{ messageHash: string }>;
  act(action: string, amount: string): Promise<{ contentHash: string }>;
  unshield(amount: string): Promise<{ messageHash: string }>;
  assert(): Promise<boolean>;
};

type HarnessConfig = {
  protocol: ProtocolName;
  spec: ProtocolLifecycle;
  actions: string[];
  mode: ProtocolMode;
};

type LifecycleMetrics = {
  relayerExecutions: number;
  selfExecutions: number;
};

type EscapeRequest = {
  protocol: ProtocolName;
  requestHash: string;
  depositor: string;
  token: string;
  amount: string;
  timeoutBlocks: number;
  createdAtBlock: number;
  claimed: boolean;
};

type LifecycleResult = {
  messageHash: string;
  txHash: string;
};

type SandboxRuntime = {
  blockHeight: number;
  started: boolean;
  startupCount: number;
};

const sandbox: SandboxRuntime = {
  blockHeight: 0,
  started: false,
  startupCount: 0,
};

const escapeRequests = new Map<string, EscapeRequest>();
const relayerRunner = new StatelessRelayerRunner();
const metrics: LifecycleMetrics = {
  relayerExecutions: 0,
  selfExecutions: 0,
};

function hashSeed(seed: string): string {
  return createHash('sha256').update(seed).digest('hex');
}

function assertDefined<T>(value: T | undefined | null, message: string): asserts value is T {
  assert.equal(Boolean(value), true, message);
}

export async function startSandbox(): Promise<void> {
  if (sandbox.started) {
    return;
  }

  sandbox.started = true;
  sandbox.startupCount += 1;
  sandbox.blockHeight = 1;
}

export function mineBlocks(count: number): number {
  if (count <= 0) {
    return sandbox.blockHeight;
  }

  sandbox.blockHeight += count;
  return sandbox.blockHeight;
}

export function getBlockHeight(): number {
  return sandbox.blockHeight;
}

export function getStartupCount(): number {
  return sandbox.startupCount;
}

export function getMetrics(): LifecycleMetrics {
  return { ...metrics };
}

export function registerEscapeRequest(input: {
  protocol: ProtocolName;
  depositor: string;
  token: string;
  amount: string;
  timeoutBlocks?: number;
  requestSeed: string;
}): string {
  if (!sandbox.started) {
    sandbox.started = true;
    sandbox.startupCount += 1;
    sandbox.blockHeight = 1;
  }

  const timeoutBlocks = input.timeoutBlocks ?? 0;
  const requestHash = `0x${hashSeed(`escape-${input.requestSeed}-${input.depositor}`).slice(0, 40)}`;
  if (escapeRequests.has(requestHash)) {
    throw new Error('Request already exists');
  }

  escapeRequests.set(requestHash, {
    protocol: input.protocol,
    requestHash,
    depositor: input.depositor,
    token: input.token,
    amount: input.amount,
    timeoutBlocks,
    createdAtBlock: sandbox.blockHeight,
    claimed: false,
  });

  return requestHash;
}

export function canClaimEscape(requestHash: string): boolean {
  const request = escapeRequests.get(requestHash);
  if (!request) {
    return false;
  }

  if (request.claimed) {
    return false;
  }

  return sandbox.blockHeight >= request.createdAtBlock + request.timeoutBlocks;
}

export function getEscapeRequest(requestHash: string): EscapeRequest {
  const request = escapeRequests.get(requestHash);
  assertDefined(request, 'escape request not found');
  return request;
}

export function claimEscape(requestHash: string): {
  token: string;
  amount: string;
  depositor: string;
} {
  const request = getEscapeRequest(requestHash);
  if (request.claimed) {
    throw new Error('Escape already claimed');
  }

  if (!canClaimEscape(requestHash)) {
    throw new Error('Escape not ready');
  }

  request.claimed = true;
  return {
    token: request.token,
    amount: request.amount,
    depositor: request.depositor,
  };
}

async function runWithMode(
  mode: ProtocolMode,
  protocol: ProtocolName,
  protocolAddress: string,
  action: string,
  seedHash: string,
): Promise<LifecycleResult> {
  if (mode === 'relayer') {
    const result = await relayerRunner.submit({
      protocol,
      protocolAddress,
      phase: action,
      payloadHash: seedHash,
      blockHeight: getBlockHeight(),
    });
    metrics.relayerExecutions += 1;
    return {
      messageHash: seedHash,
      txHash: result.txHash,
    };
  }

  metrics.selfExecutions += 1;
  const txHash = `0x${hashSeed(`self-${protocol}-${seedHash}-${getBlockHeight()}`).slice(0, 40)}`;
  return {
    messageHash: seedHash,
    txHash,
  };
}

function readMessageHashFrom(
  specResult: { messageHash: string } | { contentHash: string },
): string {
  if ('messageHash' in specResult) {
    return specResult.messageHash;
  }
  return specResult.contentHash;
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
    await startSandbox();

    const startupCountBefore = getStartupCount();
    const metricsBefore = getMetrics();
    const deployResult = await spec.deploy();
    assertDefined(deployResult.protocolAddress, 'protocolAddress');
    mineBlocks(1);

    const shieldResult = await runWithMode(
      mode,
      protocol,
      deployResult.protocolAddress,
      'shield',
      readMessageHashFrom(await spec.shield('10')).toString(),
    );
    assert.equal(shieldResult.messageHash.length > 0, true);
    assert.equal(shieldResult.txHash.startsWith('0x'), true);
    mineBlocks(1);

    const [firstAction, ...rest] = actions;
    assert.equal(typeof firstAction, 'string');
    const firstActionReceipt = await runWithMode(
      mode,
      protocol,
      deployResult.protocolAddress,
      firstAction,
      readMessageHashFrom(await spec.act(firstAction, '10')).toString(),
    );
    assert.equal(firstActionReceipt.txHash.startsWith('0x'), true);
    mineBlocks(1);

    const unshieldResult = await runWithMode(
      mode,
      protocol,
      deployResult.protocolAddress,
      'unshield',
      readMessageHashFrom(await spec.unshield('10')),
    );
    assert.equal(unshieldResult.txHash.startsWith('0x'), true);
    mineBlocks(1);

    for (const action of rest) {
      const repeatedActionResult = await runWithMode(
        mode,
        protocol,
        deployResult.protocolAddress,
        action,
        readMessageHashFrom(await spec.act(action, '10')),
      );
      assert.equal(repeatedActionResult.txHash.startsWith('0x'), true);
      mineBlocks(1);
    }

    assert.equal(await spec.assert(), true);

    const metricsAfter = getMetrics();
    if (mode === 'relayer') {
      assert.equal(metricsAfter.relayerExecutions > metricsBefore.relayerExecutions, true);
      assert.equal(metricsAfter.selfExecutions, metricsBefore.selfExecutions);
    } else {
      assert.equal(metricsAfter.selfExecutions > metricsBefore.selfExecutions, true);
      assert.equal(metricsAfter.relayerExecutions, metricsBefore.relayerExecutions);
    }

    assert.equal(startupCountBefore, 1);
  });
}
