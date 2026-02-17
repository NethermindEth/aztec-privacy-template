import { strict as assert } from 'node:assert';
import test from 'node:test';

import { verifyPrivateMessage } from '../../../core/ts/message-utils';
import { AAVE_DEPOSIT_ACTION, AAVE_WITHDRAW_ACTION, AaveProtocolClient } from './aave';

test('builds valid deposit payload', () => {
  const client = new AaveProtocolClient();
  const payload = client.buildDepositPayload({
    amount: 123n,
    referralCode: 7,
  });

  assert.equal(payload.token, '0xb000000000000000000000000000000000000000');
  assert.equal(payload.amount, '123');
  assert.equal(payload.referralCode, 7);
});

test('validates invalid deposit amount', () => {
  const client = new AaveProtocolClient();
  assert.throws(() => {
    client.buildDepositPayload({
      amount: '-1' as never,
    });
  }, /Invalid amount/);
  assert.throws(() => {
    client.buildDepositPayload({
      amount: 0,
    });
  }, /Invalid amount/);
});

test('builds and verifies deposit message', () => {
  const client = new AaveProtocolClient();
  const encoded = client.buildDepositMessage({
    amount: 100,
    referralCode: 3,
  });

  const ok = verifyPrivateMessage(encoded, client.protocolName, AAVE_DEPOSIT_ACTION);
  assert.equal(ok, true);
});

test('builds valid withdraw payload and message', () => {
  const client = new AaveProtocolClient();
  const payload = client.buildWithdrawPayload({
    amount: '456',
  });

  const encoded = client.buildWithdrawMessage({
    amount: 456,
  });

  assert.equal(payload.token, '0xb000000000000000000000000000000000000000');
  assert.equal(payload.amount, '456');
  assert.equal(verifyPrivateMessage(encoded, client.protocolName, AAVE_WITHDRAW_ACTION), true);
});

test('normalizes string amounts to canonical decimal', () => {
  const client = new AaveProtocolClient();
  const payload = client.buildDepositPayload({
    amount: '00042',
  });

  assert.equal(payload.amount, '42');
});
