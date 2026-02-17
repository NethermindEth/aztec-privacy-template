import { strict as assert } from 'node:assert';
import test from 'node:test';
import { WalletManager } from '../wallet';
import { Environment } from '../env';

test('wallet manager creates and reuses wallets', () => {
  const walletManager = new WalletManager();
  const network = Environment.default().network;

  const wallet = walletManager.createWallet({
    owner: 'alice',
    network,
    type: 'local',
  });

  assert.equal(wallet.owner, 'alice');
  assert.equal(wallet.chainId, network.chainId);

  const same = walletManager.loadOrCreate(wallet.address, 'alice', network);
  assert.equal(same.address, wallet.address);
  assert.equal(walletManager.list().length, 1);
});

test('loadOrCreate preserves requested address when missing', () => {
  const walletManager = new WalletManager();
  const network = Environment.default().network;
  const requestedAddress = '0x000000000000000000000000000000000000beef';

  const wallet = walletManager.loadOrCreate(requestedAddress, 'alice', network);

  assert.equal(wallet.address, requestedAddress);
  assert.equal(wallet.type, 'remote');
});
