import { strict as assert } from 'node:assert';
import test from 'node:test';
import { AztecClient } from '../aztec';

test('createWallet uses provided network override', () => {
  const client = AztecClient.sandbox();
  const wallet = client.createWallet({
    owner: 'alice',
    network: {
      networkKind: 'testnet',
      chainId: 11155111,
      rpcUrl: 'https://rpc.testnet.example',
      timeoutMs: 20_000,
    },
  });

  assert.equal(wallet.chainId, 11155111);
});

test('sendMessage includes active network chainId in payload', () => {
  const client = AztecClient.sandbox();
  const encoded = client.sendMessage({
    recipient: '0xalice',
    action: 'deposit',
    payload: { amount: 100 },
  });

  const parsed = JSON.parse(encoded.payload) as { chainId: number };
  assert.equal(parsed.chainId, 31337);
});
