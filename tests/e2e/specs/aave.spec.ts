import { strict as assert } from 'node:assert';
import test from 'node:test';

import { aaveSpec } from './aave';

test('aave spec adapter exposes required lifecycle handlers', async () => {
  assert.equal(aaveSpec.protocol, 'aave');
  assert.equal(typeof aaveSpec.deploy, 'function');
  assert.equal(typeof aaveSpec.shield, 'function');
  assert.equal(typeof aaveSpec.act, 'function');
  assert.equal(typeof aaveSpec.unshield, 'function');
  assert.equal(typeof aaveSpec.assert, 'function');

  const [deposit, unshieldResult] = await Promise.all([
    aaveSpec.act('deposit', '10'),
    aaveSpec.unshield('10'),
  ]);

  assert.equal(!!deposit.contentHash, true);
  assert.equal(!!unshieldResult.messageHash, true);
});
