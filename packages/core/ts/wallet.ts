import type { WalletProfile } from './env';

export type WalletType = 'local' | 'remote';

export type WalletConfig = {
  owner: string;
  network: WalletProfile;
  address?: string;
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
      address: config.address
        ? this.normalizeAddress(config.address)
        : this.deriveAddress(config.owner),
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

  public loadOrCreate(
    address: string,
    fallbackOwner: string,
    network: WalletProfile,
  ): WalletDescriptor {
    const normalizedAddress = this.normalizeAddress(address);
    const existing = this.get(normalizedAddress);
    if (existing) {
      return existing;
    }

    return this.createWallet({
      address: normalizedAddress,
      owner: fallbackOwner,
      network,
      type: 'remote',
    });
  }

  private deriveAddress(seed: string): string {
    const normalized = seed.trim();
    if (normalized.length === 42 && normalized.startsWith('0x')) {
      return this.normalizeAddress(normalized);
    }

    return `0x${normalized
      .split('')
      .reduce((acc, ch, idx) => {
        return (acc + ch.charCodeAt(0) + idx).toString(16);
      }, '')
      .padEnd(40, '0')
      .slice(0, 40)}`;
  }

  private normalizeAddress(address: string): string {
    const normalized = address.trim().toLowerCase();
    if (!/^0x[0-9a-f]{40}$/.test(normalized)) {
      throw new Error('Invalid wallet address');
    }

    return normalized;
  }
}
