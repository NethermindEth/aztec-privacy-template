import { strict as assert } from 'node:assert';
import test from 'node:test';
import { Environment } from '../env';

test('environment creates and normalizes values', () => {
  const env = Environment.create({
    network: 'testnet',
    chainId: 1,
    rpcUrl: 'https://example-rpc.test',
    timeoutMs: 15_000,
  });

  assert.equal(env.network.chainId, 1);
  assert.equal(env.network.networkKind, 'testnet');
  assert.equal(env.network.rpcUrl, 'https://example-rpc.test');
  assert.equal(env.network.timeoutMs, 15_000);
  assert.equal(env.asClientOptions().timeoutMs, 15_000);
});

test('environment rejects invalid rpc url', () => {
  assert.throws(() => {
    Environment.create({
      network: 'mainnet',
      chainId: 1,
      rpcUrl: 'not-a-url',
    });
  });
});

test('environment rejects invalid timeout', () => {
  assert.throws(() => {
    Environment.create({
      network: 'mainnet',
      chainId: 1,
      rpcUrl: 'https://rpc.example',
      timeoutMs: 0,
    });
  });
});
