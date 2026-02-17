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
