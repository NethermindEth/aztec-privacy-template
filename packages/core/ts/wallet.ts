import type { WalletProfile } from './env';

export type WalletType = 'local' | 'remote';

export type WalletConfig = {
  owner: string;
  network: WalletProfile;
  mnemonic?: string;
  privateKey?: string;
  type?: WalletType;
};

export type WalletDescriptor = {
  address: string;
  owner: string;
  type: WalletType;
  chainId: number;
};

function normalizeWalletType(type?: WalletType): WalletType {
  return type ?? 'local';
}

export class WalletManager {
  private readonly wallets = new Map<string, WalletDescriptor>();

  public createWallet(config: WalletConfig): WalletDescriptor {
    if (!config.owner || config.owner.length < 2) {
      throw new Error('Invalid wallet owner');
    }

    if (!config.network?.chainId) {
      throw new Error('Invalid wallet network');
    }

    const descriptor: WalletDescriptor = {
      address: this.deriveAddress(config.owner),
      owner: config.owner,
      type: normalizeWalletType(config.type),
      chainId: config.network.chainId,
    };

    this.wallets.set(descriptor.address, descriptor);
    return descriptor;
  }

  public list(): WalletDescriptor[] {
    return Array.from(this.wallets.values());
  }

  public get(address: string): WalletDescriptor | undefined {
    return this.wallets.get(address);
  }

  public loadOrCreate(address: string, fallbackOwner: string, network: WalletProfile): WalletDescriptor {
    const existing = this.get(address);
    if (existing) {
      return existing;
    }

    return this.createWallet({
      owner: fallbackOwner,
      network,
      type: 'remote',
    });
  }

  private deriveAddress(seed: string): string {
    const normalized = seed.trim();
    if (normalized.length >= 42 && normalized.startsWith('0x')) {
      return normalized;
    }

    return '0x' + normalized.split('').reduce((acc, ch, idx) => {
      return (acc + ch.charCodeAt(0) + idx).toString(16);
    }, '').padEnd(40, '0').slice(0, 40);
  }
}
