export type NetworkKind = 'sandbox' | 'testnet' | 'mainnet';

export type NetworkConfig = {
  network: NetworkKind;
  rpcUrl: string;
  chainId: number;
  pxeUrl?: string;
  timeoutMs?: number;
};

export type WalletProfile = {
  networkKind: NetworkKind;
  chainId: number;
  rpcUrl: string;
  pxeUrl?: string;
};

const DEFAULT_TIMEOUT_MS = 30_000;

function normalizeKind(kind: NetworkKind): NetworkKind {
  return kind;
}

function isValidRpcUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export class Environment {
  public readonly network: WalletProfile;

  private constructor(profile: WalletProfile) {
    this.network = Object.freeze(profile);
  }

  public static create(config: NetworkConfig): Environment {
    const kind = normalizeKind(config.network);

    if (!Number.isSafeInteger(config.chainId) || config.chainId <= 0) {
      throw new Error('Invalid chainId');
    }

    if (!isValidRpcUrl(config.rpcUrl)) {
      throw new Error('Invalid rpcUrl');
    }

    return new Environment({
      networkKind: kind,
      chainId: config.chainId,
      rpcUrl: config.rpcUrl,
      pxeUrl: config.pxeUrl,
    });
  }

  public static default(): Environment {
    return Environment.create({
      network: 'sandbox',
      rpcUrl: 'http://localhost:8545',
      chainId: 31337,
      timeoutMs: DEFAULT_TIMEOUT_MS,
    });
  }

  public asClientOptions() {
    return {
      chainId: this.network.chainId,
      rpcUrl: this.network.rpcUrl,
      pxeUrl: this.network.pxeUrl,
      timeoutMs: DEFAULT_TIMEOUT_MS,
    };
  }
}
