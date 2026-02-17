import { strict as assert } from 'node:assert';
import test from 'node:test';

import {
  claimEscape,
  canClaimEscape,
  mineBlocks,
  registerEscapeRequest,
  startSandbox,
} from '../harness';

test('escape hatch blocks are started once for the entire E2E suite', async () => {
  await startSandbox();
  const first = registerEscapeRequest({
    protocol: 'aave',
    depositor: '0xb000000000000000000000000000000000000001',
    token: '0xb000000000000000000000000000000000000001',
    amount: '100',
    timeoutBlocks: 2,
    requestSeed: 'escape-suite',
  });

  assert.equal(first.startsWith('0x'), true);
  assert.equal(canClaimEscape(first), false);

  mineBlocks(2);
  assert.equal(canClaimEscape(first), true);
});

test('escape hatch claims after timeout and rejects duplicate claim', async () => {
  await startSandbox();
  const requestHash = registerEscapeRequest({
    protocol: 'aave',
    depositor: '0xb000000000000000000000000000000000000002',
    token: '0xb000000000000000000000000000000000000002',
    amount: '42',
    timeoutBlocks: 1,
    requestSeed: 'escape-dupe-claim',
  });

  assert.equal(canClaimEscape(requestHash), false);
  mineBlocks(1);
  assert.equal(canClaimEscape(requestHash), true);

  const firstClaim = claimEscape(requestHash);
  assert.equal(firstClaim.amount, '42');

  assert.throws(() => {
    claimEscape(requestHash);
  }, /Escape already claimed/);
});
