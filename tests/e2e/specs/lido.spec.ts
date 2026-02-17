import { strict as assert } from 'node:assert';
import test from 'node:test';

import { lidoSpec } from './lido';

test('lido spec adapter exposes required lifecycle handlers', async () => {
  assert.equal(lidoSpec.protocol, 'lido');
  assert.equal(typeof lidoSpec.deploy, 'function');
  assert.equal(typeof lidoSpec.shield, 'function');
  assert.equal(typeof lidoSpec.act, 'function');
  assert.equal(typeof lidoSpec.unshield, 'function');
  assert.equal(typeof lidoSpec.assert, 'function');

  const [stake, unshieldResult] = await Promise.all([
    lidoSpec.act('stake', '10'),
    lidoSpec.unshield('10'),
  ]);

  assert.equal(!!stake.contentHash, true);
  assert.equal(!!unshieldResult.messageHash, true);
});
