import { strict as assert } from 'node:assert';
import test from 'node:test';

import { uniswapSpec } from './uniswap';

test('uniswap spec adapter exposes required lifecycle handlers', async () => {
  assert.equal(uniswapSpec.protocol, 'uniswap');
  assert.equal(typeof uniswapSpec.deploy, 'function');
  assert.equal(typeof uniswapSpec.shield, 'function');
  assert.equal(typeof uniswapSpec.act, 'function');
  assert.equal(typeof uniswapSpec.unshield, 'function');
  assert.equal(typeof uniswapSpec.assert, 'function');

  const swap = await uniswapSpec.act('swap', '10');
  const unshieldResult = await uniswapSpec.unshield('10');

  assert.equal(!!swap.contentHash, true);
  assert.equal(!!unshieldResult.messageHash, true);
});
