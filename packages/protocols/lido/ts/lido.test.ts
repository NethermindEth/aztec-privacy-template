import { strict as assert } from 'node:assert';
import test from 'node:test';

import { verifyPrivateMessage } from '../../../core/ts/message-utils';
import { LIDO_STAKE_ACTION, LIDO_UNSTAKE_ACTION, LidoProtocolClient } from './lido';

test('builds valid stake payload', () => {
  const client = new LidoProtocolClient();
  const payload = client.buildStakePayload({
    recipient: '0xb000000000000000000000000000000000000001',
    amount: 123n,
    referral: '0xb000000000000000000000000000000000000002',
  });

  assert.equal(payload.recipient, '0xb000000000000000000000000000000000000001');
  assert.equal(payload.amount, '123');
  assert.equal(payload.referral, '0xb000000000000000000000000000000000000002');
});

test('validates invalid stake amount', () => {
  const client = new LidoProtocolClient();
  assert.throws(() => {
    client.buildStakePayload({
      recipient: '0xb000000000000000000000000000000000000001',
      amount: '0',
    });
  }, /Invalid amount/);
  assert.throws(() => {
    client.buildStakePayload({
      recipient: '0xb000000000000000000000000000000000000001',
      amount: '-1' as never,
    });
  }, /Invalid amount/);
});

test('builds valid unstake payload', () => {
  const client = new LidoProtocolClient();
  const payload = client.buildUnstakePayload({
    recipient: '0xb000000000000000000000000000000000000003',
    amount: '250',
  });

  assert.equal(payload.recipient, '0xb000000000000000000000000000000000000003');
  assert.equal(payload.amount, '250');
});

test('builds and verifies stake message', () => {
  const client = new LidoProtocolClient();
  const encoded = client.buildStakeMessage({
    recipient: '0xb000000000000000000000000000000000000001',
    amount: 100,
    referral: '0xb000000000000000000000000000000000000004',
  });

  assert.equal(verifyPrivateMessage(encoded, client.protocolName, LIDO_STAKE_ACTION), true);
});

test('builds and verifies unstake message', () => {
  const client = new LidoProtocolClient();
  const encoded = client.buildUnstakeMessage({
    recipient: '0xb000000000000000000000000000000000000005',
    amount: 77,
  });

  assert.equal(verifyPrivateMessage(encoded, client.protocolName, LIDO_UNSTAKE_ACTION), true);
});

test('normalizes string amounts to canonical decimal', () => {
  const client = new LidoProtocolClient();
  const payload = client.buildUnstakePayload({
    recipient: '0xb000000000000000000000000000000000000006',
    amount: '00042',
  });

  assert.equal(payload.amount, '42');
});

test('validates invalid recipient format', () => {
  const client = new LidoProtocolClient();
  assert.throws(() => {
    client.buildUnstakePayload({
      recipient: 'not-an-address',
      amount: 10,
    });
  }, /Invalid address/);
});
