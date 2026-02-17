import { Environment, type NetworkConfig, type WalletProfile } from './env';
import { WalletManager, type WalletConfig, type WalletDescriptor } from './wallet';
import { encodePrivateMessage } from './message-utils';

export type AztecClientOptions = {
  network: NetworkConfig;
};

export interface MessagePayload {
  recipient: string;
  action: string;
  payload: Record<string, unknown>;
}

export class AztecClient {
  private readonly env: Environment;
  private readonly walletManager: WalletManager;

  private constructor(env: Environment) {
    this.env = env;
    this.walletManager = new WalletManager();
  }

  public static connect(options: AztecClientOptions): AztecClient {
    const env = Environment.create(options.network);
    return new AztecClient(env);
  }

  public static sandbox(): AztecClient {
    return AztecClient.connect({
      network: {
        network: 'sandbox',
        rpcUrl: 'http://localhost:8545',
        chainId: 31337,
      },
    });
  }

  public getNetwork(): WalletProfile {
    return this.env.network;
  }

  public createWallet(config: { owner: string; network?: WalletProfile; privateKey?: string }) {
    const network = this.env.network;
    const wallet: WalletConfig = {
      owner: config.owner,
      network,
      privateKey: config.privateKey,
      type: 'local',
    };

    return this.walletManager.createWallet(wallet);
  }

  public listWallets(): WalletDescriptor[] {
    return this.walletManager.list();
  }

  public sendMessage(message: MessagePayload) {
    return encodePrivateMessage(this.env.network.chainId, message.recipient, message.action, message.payload);
  }
}
