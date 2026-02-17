import { strict as assert } from 'node:assert';
import test from 'node:test';
import { encodePrivateMessage, verifyPrivateMessage } from '../message-utils';

test('message encoding is stable and verifiable', () => {
  const encoded = encodePrivateMessage(1, '0xalice', 'deposit', { amount: 100 });

  assert.equal(typeof encoded.contentHash, 'string');
  assert.equal(encoded.payload.includes('"chainId":1'), true);
  assert.equal(verifyPrivateMessage(encoded, '0xalice', 'deposit'), true);
});

test('verifyPrivateMessage returns false for invalid payload json', () => {
  assert.equal(
    verifyPrivateMessage({ contentHash: 'abc', payload: 'not-json' }, '0xalice', 'deposit'),
    false,
  );
});
