export type PrivacyConfig = {
  recipientPrivate: boolean;
  amountPrivate: boolean;
  senderPrivate: boolean;
  memoPrivate: boolean;
};

export type RuntimeConfig = {
  l1ChainId: number;
  l2ChainId: number;
  escapeTimeoutBlocks: number;
  defaultGasLimit: number;
};

export type AddressConfig = {
  l1Portal: string;
  protocolContract: string;
  tokenAddress: string;
};

export type ModuleFlags = {
  enableBorrow: boolean;
  enableRepay: boolean;
  enableLp: boolean;
  enableQueue: boolean;
  enableYield: boolean;
};

export type TemplateMetadata = {
  name: string;
};

export type GeneratedConfig = {
  templateVersion: number;
  metadata: TemplateMetadata;
  privacy: PrivacyConfig;
  runtime: RuntimeConfig;
  addresses: AddressConfig;
  modules: ModuleFlags;
};

export type RawConfigFile = {
  template_version?: number;
  metadata?: {
    name?: string;
  };
  privacy?: {
    recipient_private?: boolean;
    amount_private?: boolean;
    sender_private?: boolean;
    memo_private?: boolean;
  };
  runtime?: {
    l1_chain_id?: number;
    l2_chain_id?: number;
    escape_timeout_blocks?: number;
    default_gas_limit?: number;
  };
  addresses?: {
    l1_portal?: string;
    protocol_contract?: string;
    token_address?: string;
  };
  modules?: {
    enable_borrow?: boolean;
    enable_repay?: boolean;
    enable_lp?: boolean;
    enable_queue?: boolean;
    enable_yield?: boolean;
  };
};
