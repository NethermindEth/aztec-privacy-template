import {
  spawn,
  spawnSync,
  type ChildProcessWithoutNullStreams,
  type SpawnSyncReturns,
} from 'node:child_process';
import { strict as assert } from 'node:assert';
import { setTimeout as sleep } from 'node:timers/promises';

export const REPO_ROOT = process.cwd();

export const AZTEC_NODE_URL = process.env.AZTEC_NODE_URL ?? 'http://127.0.0.1:8080';
export const AZTEC_NODE_PORT = process.env.AZTEC_NODE_PORT ?? '8080';
export const AZTEC_ADMIN_PORT = process.env.AZTEC_ADMIN_PORT ?? '8880';
export const L1_RPC_URL = process.env.L1_RPC_URL ?? 'http://127.0.0.1:8545';
const AZTEC_CLI_VERSION = process.env.AZTEC_VERSION ?? process.env.VERSION;

export const DEPLOYER_PRIVATE_KEY =
  process.env.L1_DEPLOYER_PRIVATE_KEY ??
  '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
export const RELAYER_PRIVATE_KEY =
  process.env.L1_RELAYER_PRIVATE_KEY ??
  '0x59c6995e998f97a5a0044966f094538e7d4f4cf67f6ff8f5f4f8f400f9f0f3e1';
export const USER_PRIVATE_KEY =
  process.env.L1_USER_PRIVATE_KEY ??
  '0x5de4111afa1a4b94908f83103e5acb4f5cccbf8f35b21f7f6d95de7f16a46312';

function addressFromPrivateKey(privateKey: string): string {
  const result = spawnSync('cast', ['wallet', 'address', '--private-key', privateKey], {
    encoding: 'utf8',
    timeout: 5_000,
  });
  if (result.status !== 0) {
    const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`.trim();
    throw new Error(`Failed to derive address from private key.\n${output}`);
  }
  return result.stdout.trim().toLowerCase();
}

export const RELAYER_ADDRESS = addressFromPrivateKey(RELAYER_PRIVATE_KEY);
export const USER_ADDRESS = addressFromPrivateKey(USER_PRIVATE_KEY);

type RunOptions = {
  timeoutMs?: number;
  cwd?: string;
};

export type LocalRuntime = {
  process: ChildProcessWithoutNullStreams | null;
  logs: string[];
};

export function logStep(protocol: string, step: number, message: string): void {
  console.log(`[${protocol}] Step ${step}: ${message}`);
}

export function logValue(
  protocol: string,
  label: string,
  value: string | number | bigint | boolean,
): void {
  console.log(`[${protocol}] ${label}: ${value}`);
}

export function run(
  command: string,
  args: string[],
  options?: RunOptions,
): SpawnSyncReturns<string> {
  const result = spawnSync(command, args, {
    cwd: options?.cwd ?? REPO_ROOT,
    encoding: 'utf8',
    timeout: options?.timeoutMs ?? 180_000,
  });

  if (result.status !== 0) {
    const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`.trim();
    throw new Error(`Command failed: ${command} ${args.join(' ')}\n${output}`);
  }

  return result;
}

export function compileAztecContract(relativeDir: string): void {
  run('bash', [`${REPO_ROOT}/scripts/compile-aztec-contract.sh`, `${REPO_ROOT}/${relativeDir}`], {
    cwd: REPO_ROOT,
    timeoutMs: 240_000,
  });
}

function pushLogs(logs: string[], chunk: Buffer): void {
  const text = chunk.toString('utf8');
  if (!text.trim()) {
    return;
  }
  logs.push(text.trimEnd());
  if (logs.length > 40) {
    logs.shift();
  }
}

function getAztecCliEnv(): NodeJS.ProcessEnv {
  if (!AZTEC_CLI_VERSION) {
    return process.env;
  }
  return {
    ...process.env,
    VERSION: AZTEC_CLI_VERSION,
  };
}

function resolveAztecStartArgs(env: NodeJS.ProcessEnv): string[] {
  const help = spawnSync('aztec', ['start', '--help'], {
    encoding: 'utf8',
    timeout: 30_000,
    env,
  });
  const helpText = `${help.stdout ?? ''}\n${help.stderr ?? ''}`;

  if (helpText.includes('--local-network')) {
    return [
      'start',
      '--local-network',
      '--port',
      AZTEC_NODE_PORT,
      '--admin-port',
      AZTEC_ADMIN_PORT,
    ];
  }

  if (helpText.includes('--network <value>')) {
    return [
      'start',
      '--network',
      'local',
      '--port',
      AZTEC_NODE_PORT,
      '--admin-port',
      AZTEC_ADMIN_PORT,
    ];
  }

  return ['start', '--local-network', '--port', AZTEC_NODE_PORT, '--admin-port', AZTEC_ADMIN_PORT];
}

function alternateAztecStartArgs(args: string[]): string[] | null {
  if (args.includes('--local-network')) {
    return [
      'start',
      '--network',
      'local',
      '--port',
      AZTEC_NODE_PORT,
      '--admin-port',
      AZTEC_ADMIN_PORT,
    ];
  }
  if (args.includes('--network')) {
    return [
      'start',
      '--local-network',
      '--port',
      AZTEC_NODE_PORT,
      '--admin-port',
      AZTEC_ADMIN_PORT,
    ];
  }
  return null;
}

function spawnAztecStartProcess(
  args: string[],
  logs: string[],
  env: NodeJS.ProcessEnv,
): ChildProcessWithoutNullStreams {
  const process = spawn('aztec', args, {
    cwd: REPO_ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
    env,
  });
  process.stdout.on('data', (chunk: Buffer) => pushLogs(logs, chunk));
  process.stderr.on('data', (chunk: Buffer) => pushLogs(logs, chunk));
  return process;
}

async function waitForAztecRuntimeReady(
  process: ChildProcessWithoutNullStreams,
  logs: string[],
  timeoutMs: number,
): Promise<'ready' | 'exited' | 'timeout'> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const [aztecReady, l1Ready] = await Promise.all([isAztecNodeReady(), isL1Ready()]);
    if (aztecReady && l1Ready) {
      return 'ready';
    }
    if (process.exitCode !== null) {
      return 'exited';
    }
    await sleep(1_500);
  }
  return 'timeout';
}

async function isJsonRpcEndpointReady(url: string, method: string): Promise<boolean> {
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method,
        params: [],
      }),
      signal: AbortSignal.timeout(3_000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function isAztecNodeReady(): Promise<boolean> {
  const checks = await Promise.all([
    isJsonRpcEndpointReady(AZTEC_NODE_URL, 'node_getL2Tips'),
    isJsonRpcEndpointReady(AZTEC_NODE_URL, 'web3_clientVersion'),
  ]);
  return checks.some(Boolean);
}

async function isL1Ready(): Promise<boolean> {
  return isJsonRpcEndpointReady(L1_RPC_URL, 'eth_blockNumber');
}

function setAnvilBalance(address: string, amountHexWei: string): void {
  const result = spawnSync(
    'cast',
    ['rpc', '--rpc-url', L1_RPC_URL, 'anvil_setBalance', address, amountHexWei],
    {
      encoding: 'utf8',
      timeout: 10_000,
    },
  );

  if (result.status !== 0) {
    const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`.trim();
    throw new Error(`Failed to set anvil balance for ${address}\n${output}`);
  }
}

function ensureL1TestAccountBalances(): void {
  const richBalance = '0x3635C9ADC5DEA00000';
  setAnvilBalance(USER_ADDRESS, richBalance);
  setAnvilBalance(RELAYER_ADDRESS, richBalance);
}

export async function ensureAztecLocalNetwork(): Promise<LocalRuntime> {
  if ((await isAztecNodeReady()) && (await isL1Ready())) {
    ensureL1TestAccountBalances();
    return { process: null, logs: [] };
  }

  const aztecEnv = getAztecCliEnv();
  const timeoutMs = 240_000;
  const logs: string[] = [];
  let startArgs = resolveAztecStartArgs(aztecEnv);
  let process = spawnAztecStartProcess(startArgs, logs, aztecEnv);

  let status = await waitForAztecRuntimeReady(process, logs, timeoutMs);
  if (status !== 'ready') {
    const tail = logs.slice(-30).join('\n');
    const hasUnknownOption =
      tail.includes("unknown option '--local-network'") ||
      tail.includes("unknown option '--network'");

    if (status === 'exited' && hasUnknownOption) {
      const alternateArgs = alternateAztecStartArgs(startArgs);
      if (alternateArgs) {
        process.kill('SIGKILL');
        logs.length = 0;
        startArgs = alternateArgs;
        process = spawnAztecStartProcess(startArgs, logs, aztecEnv);
        status = await waitForAztecRuntimeReady(process, logs, timeoutMs);
      }
    }
  }

  if (status === 'ready') {
    ensureL1TestAccountBalances();
    return { process, logs };
  }

  const tail = logs.slice(-30).join('\n');
  if (process.exitCode === null) {
    process.kill('SIGKILL');
  }
  throw new Error(`Aztec local network failed to start.\n${tail}`);
}

export async function stopProcess(process: ChildProcessWithoutNullStreams | null): Promise<void> {
  if (!process) {
    return;
  }

  process.kill('SIGTERM');
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    if (process.exitCode !== null) {
      return;
    }
    await sleep(250);
  }
  process.kill('SIGKILL');
}

export function deployL1(
  contract: string,
  contractsDir: string,
  constructorArgs: string[] = [],
): string {
  const args = [
    'create',
    '--root',
    REPO_ROOT,
    '--contracts',
    contractsDir,
    '--rpc-url',
    L1_RPC_URL,
    '--private-key',
    DEPLOYER_PRIVATE_KEY,
    '--broadcast',
    contract,
  ];

  if (constructorArgs.length > 0) {
    args.push('--constructor-args', ...constructorArgs);
  }

  const result = run('forge', args, { timeoutMs: 240_000 });
  const output = `${result.stdout}\n${result.stderr}`;
  const address = output.match(/Deployed to:\s*(0x[a-fA-F0-9]{40})/)?.[1];
  if (!address) {
    throw new Error(`Could not parse deployed address for ${contract}\n${output}`);
  }

  return address;
}

export function castSend(
  privateKey: string,
  contractAddress: string,
  signature: string,
  args: string[] = [],
  valueWei?: string,
): void {
  const command = ['send', '--rpc-url', L1_RPC_URL, '--private-key', privateKey];
  if (valueWei) {
    command.push('--value', valueWei);
  }
  command.push(contractAddress, signature, ...args);
  run('cast', command);
}

export function castCall(contractAddress: string, signature: string, args: string[] = []): string {
  return run('cast', [
    'call',
    '--rpc-url',
    L1_RPC_URL,
    contractAddress,
    signature,
    ...args,
  ]).stdout.trim();
}

export function castKeccak(value: string): string {
  return run('cast', ['keccak', value]).stdout.trim();
}

type AztecAccountsTesting = typeof import('@aztec/accounts/testing/lazy');

type AztecSdkModules = {
  getInitialTestAccountsData: AztecAccountsTesting['getInitialTestAccountsData'];
  createAztecNodeClient: typeof import('@aztec/aztec.js/node').createAztecNodeClient;
  TokenContract: typeof import('@aztec/noir-contracts.js/Token').TokenContract;
  TestWallet: typeof import('@aztec/test-wallet/server').TestWallet;
};

async function loadAztecSdk(): Promise<AztecSdkModules> {
  const aztecAccountsTesting = await import('@aztec/accounts/testing/lazy');
  const aztecNode = await import('@aztec/aztec.js/node');
  const noirToken = await import('@aztec/noir-contracts.js/Token');
  const testWallet = await import('@aztec/test-wallet/server');

  return {
    getInitialTestAccountsData: aztecAccountsTesting.getInitialTestAccountsData,
    createAztecNodeClient: aztecNode.createAztecNodeClient,
    TokenContract: noirToken.TokenContract,
    TestWallet: testWallet.TestWallet,
  };
}

export async function provisionPrivateTokenBalance(
  tokenName: string,
  tokenSymbol: string,
  amount: bigint,
): Promise<{ ownerAddress: string; balance: bigint }> {
  const { getInitialTestAccountsData, createAztecNodeClient, TestWallet, TokenContract } =
    await loadAztecSdk();
  const aztecNode = createAztecNodeClient(AZTEC_NODE_URL);
  const wallet = await TestWallet.create(aztecNode);
  try {
    const [ownerData] = await getInitialTestAccountsData();
    const owner = await wallet.createSchnorrAccount(
      ownerData.secret,
      ownerData.salt,
      ownerData.signingKey,
    );

    const token = await TokenContract.deploy(wallet, owner.address, tokenName, tokenSymbol, 18)
      .send({ from: owner.address })
      .deployed();

    const balanceBefore = await token.methods
      .balance_of_private(owner.address)
      .simulate({ from: owner.address });
    assert.equal(BigInt(balanceBefore), 0n);

    const mintTx = token.methods
      .mint_to_private(owner.address, amount)
      .send({ from: owner.address });
    const mintReceipt = await mintTx.wait();
    assert.equal(Boolean(mintReceipt), true);

    const balanceAfter = await token.methods
      .balance_of_private(owner.address)
      .simulate({ from: owner.address });
    assert.equal(BigInt(balanceAfter), amount);

    return {
      ownerAddress: owner.address.toString(),
      balance: BigInt(balanceAfter),
    };
  } finally {
    await wallet.stop();
  }
}
