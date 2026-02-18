import { strict as assert } from 'node:assert';
import test from 'node:test';
import { type ProtocolFlowSpec, runProtocolE2EHappyPath } from './e2e-flow';
import {
  L1_RPC_URL,
  type LocalRuntime,
  RELAYER_ADDRESS,
  RELAYER_PRIVATE_KEY,
  USER_ADDRESS,
  USER_PRIVATE_KEY,
  castCall,
  castKeccak,
  castSend,
  compileAztecContract,
  deployL1,
  ensureAztecLocalNetwork,
  provisionPrivateTokenBalance,
  run,
  stopProcess,
} from './runtime';

const PROTOCOL_ID = `0x${'22'.repeat(32)}`;
const UNISWAP_AZTEC_DIR = 'packages/protocols/uniswap/aztec';
const UNISWAP_SOLIDITY_DIR = 'packages/protocols/uniswap/solidity';
const UNISWAP_MOCKS_SOLIDITY_DIR = 'tests/mocks/uniswap/solidity';
const UNISWAP_TOKEN_MOCKS_SOLIDITY_DIR = 'tests/mocks/aave/solidity';
const TEST_TAG = 'UNISWAP';
const TOKEN_IN = '0x000000000000000000000000000000000000ABCD';
const TOKEN_OUT = '0x000000000000000000000000000000000000BEEF';
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const SIMULATED_AMOUNT_OUT = '1200';
const DEFAULT_TIMEOUT_BLOCKS = '20';
const NONCE_ONE = '1';
const FEE_BPS = '3000';

type EscapeRequest = {
  depositor: string;
  token: string;
  amount: bigint;
  createdAtBlock: bigint;
  timeoutBlocks: bigint;
  claimed: boolean;
};

type UniswapTestContext = {
  runtime: LocalRuntime;
  content: string;
  portalAddress: string;
  mocks: {
    UNISWAP_MOCK_ROUTER: string;
    UNISWAP_MOCK_TOKEN_IN: string;
  };
};

async function buildUniswapTestContext(): Promise<UniswapTestContext> {
  const runtime = await ensureAztecLocalNetwork();
  compileAztecContract(UNISWAP_AZTEC_DIR);

  const aztecState = await provisionPrivateTokenBalance('Uniswap Privacy Token', 'UPT', 5_000n);
  const content = castKeccak(`uniswap-swap:${aztecState.ownerAddress}:${aztecState.balance}`);

  const router = deployL1(
    'tests/mocks/uniswap/solidity/MockUniswapV3Router.sol:MockUniswapV3Router',
    UNISWAP_MOCKS_SOLIDITY_DIR,
  );
  const mockTokenIn = deployL1(
    'tests/mocks/aave/solidity/MockERC20.sol:MockERC20',
    UNISWAP_TOKEN_MOCKS_SOLIDITY_DIR,
  );

  const portalAddress = deployL1(
    'packages/protocols/uniswap/solidity/UniswapPortal.sol:UniswapPortal',
    UNISWAP_SOLIDITY_DIR,
    [PROTOCOL_ID, USER_ADDRESS, RELAYER_ADDRESS, router],
  );

  castSend(USER_PRIVATE_KEY, router, 'setSimulatedAmountOut(uint256)', [SIMULATED_AMOUNT_OUT]);

  return {
    runtime,
    content,
    portalAddress,
    mocks: {
      UNISWAP_MOCK_ROUTER: router,
      UNISWAP_MOCK_TOKEN_IN: mockTokenIn,
    },
  };
}

async function withUniswapFlowTeardown(
  fn: (context: UniswapTestContext) => Promise<void> | void,
): Promise<void> {
  const context = await buildUniswapTestContext();

  try {
    await fn(context);
  } finally {
    await stopProcess(context.runtime.process);
  }
}

function requestHash(portalAddress: string, content: string, nonce: string): string {
  return castCall(portalAddress, 'messageHashFor(bytes32,address,uint64)(bytes32)', [
    content,
    USER_ADDRESS,
    nonce,
  ]);
}

function requestArgs(content: string, tokenIn = TOKEN_IN): string[] {
  return [content, tokenIn, TOKEN_OUT, '1000', '900', FEE_BPS, USER_ADDRESS];
}

function executeArgs(
  content: string,
  amount = '1000',
  recipient = USER_ADDRESS,
  tokenIn = TOKEN_IN,
): string[] {
  return [
    content,
    USER_ADDRESS,
    tokenIn,
    TOKEN_OUT,
    amount,
    '900',
    FEE_BPS,
    recipient,
    NONCE_ONE,
    DEFAULT_TIMEOUT_BLOCKS,
  ];
}

const UNISWAP_FLOW: ProtocolFlowSpec = {
  tag: TEST_TAG,
  protocolId: PROTOCOL_ID,
  aztec: {
    dir: UNISWAP_AZTEC_DIR,
    tokenName: 'Uniswap Privacy Token',
    tokenSymbol: 'UPT',
    tokenAmount: 5_000n,
  },
  buildContent: (ownerAddress, balance) => `uniswap-swap:${ownerAddress}:${balance}`,
  portal: {
    source: 'packages/protocols/uniswap/solidity/UniswapPortal.sol:UniswapPortal',
    contractsDir: UNISWAP_SOLIDITY_DIR,
    constructorArgs: ({ protocolId, userAddress, relayerAddress, deployedMocks }) => [
      protocolId,
      userAddress,
      relayerAddress,
      deployedMocks.UNISWAP_MOCK_ROUTER,
    ],
  },
  mocks: [
    {
      label: 'UNISWAP_MOCK_ROUTER',
      source: 'tests/mocks/uniswap/solidity/MockUniswapV3Router.sol:MockUniswapV3Router',
      contractsDir: UNISWAP_MOCKS_SOLIDITY_DIR,
    },
  ],
  setup: ({ mocks }) => {
    castSend(USER_PRIVATE_KEY, mocks.UNISWAP_MOCK_ROUTER, 'setSimulatedAmountOut(uint256)', [
      SIMULATED_AMOUNT_OUT,
    ]);
  },
  request: {
    signature: 'requestSwap(bytes32,address,address,uint256,uint256,uint24,address)',
    args: ({ content, userAddress }) => [
      content,
      TOKEN_IN,
      TOKEN_OUT,
      '1000',
      '900',
      FEE_BPS,
      userAddress,
    ],
  },
  execute: {
    signature:
      'executeSwap(bytes32,address,address,address,uint256,uint256,uint24,address,uint64,uint64)',
    args: ({ content, userAddress }) => [
      content,
      userAddress,
      TOKEN_IN,
      TOKEN_OUT,
      '1000',
      '900',
      FEE_BPS,
      userAddress,
      NONCE_ONE,
      DEFAULT_TIMEOUT_BLOCKS,
    ],
  },
  assertState: ({ mocks, userAddress }) => {
    const lastAmountInRaw = castCall(mocks.UNISWAP_MOCK_ROUTER, 'lastAmountIn()(uint256)');
    assert.equal(BigInt(lastAmountInRaw), 1000n);

    const lastFeeRaw = castCall(mocks.UNISWAP_MOCK_ROUTER, 'lastFee()(uint24)');
    assert.equal(Number(lastFeeRaw), Number(FEE_BPS));

    const lastRecipient = castCall(mocks.UNISWAP_MOCK_ROUTER, 'lastRecipient()(address)');
    assert.equal(lastRecipient.toLowerCase(), userAddress);
  },
};

function mineBlocks(count: number): void {
  for (let i = 0; i < count; i++) {
    try {
      run('cast', ['rpc', '--rpc-url', L1_RPC_URL, 'evm_mine']);
    } catch {
      run('cast', ['rpc', '--rpc-url', L1_RPC_URL, 'anvil_mine']);
    }
  }
}

function parseEscapeRequest(raw: string): EscapeRequest {
  const cleaned = raw.replace(/\[[^\]]*]/g, '').trim();
  const addresses = cleaned.match(/0x[a-fA-F0-9]{40}/g) ?? [];
  const numbers = cleaned.match(/\b\d+\b/g) ?? [];
  const claimed = /\btrue\b/.test(cleaned);

  if (addresses.length < 2 || numbers.length < 3) {
    throw new Error(`Unable to parse escape request output: ${raw}`);
  }

  return {
    depositor: addresses[0],
    token: addresses[1],
    amount: BigInt(numbers[0]),
    createdAtBlock: BigInt(numbers[1]),
    timeoutBlocks: BigInt(numbers[2]),
    claimed,
  };
}

function getEscapeRequest(portalAddress: string, requestHash: string): EscapeRequest {
  const raw = castCall(
    portalAddress,
    'getEscapeRequest(bytes32)(address,address,uint256,uint64,uint64,bool)',
    [requestHash],
  );
  return parseEscapeRequest(raw);
}

test(
  'Uniswap E2E: Aztec private state + L1 Uniswap portal flow',
  { timeout: 900_000 },
  async () => {
    await runProtocolE2EHappyPath(UNISWAP_FLOW);
  },
);

test('Uniswap E2E: unauthorized relayer cannot execute swap', { timeout: 900_000 }, async () => {
  await withUniswapFlowTeardown((context) => {
    castSend(
      USER_PRIVATE_KEY,
      context.portalAddress,
      'requestSwap(bytes32,address,address,uint256,uint256,uint24,address)',
      requestArgs(context.content),
    );
    const hash = requestHash(context.portalAddress, context.content, NONCE_ONE);

    assert.throws(() => {
      castSend(
        USER_PRIVATE_KEY,
        context.portalAddress,
        'executeSwap(bytes32,address,address,address,uint256,uint256,uint24,address,uint64,uint64)',
        executeArgs(context.content),
      );
    });

    assert.equal(
      castCall(context.portalAddress, 'hasMessageBeenConsumed(bytes32)(bool)', [hash]),
      'false',
    );
  });
});

test('Uniswap E2E: request validation rejects zero recipient', { timeout: 900_000 }, async () => {
  await withUniswapFlowTeardown((context) => {
    assert.throws(() => {
      castSend(
        USER_PRIVATE_KEY,
        context.portalAddress,
        'requestSwap(bytes32,address,address,uint256,uint256,uint24,address)',
        [context.content, TOKEN_IN, TOKEN_OUT, '1000', '900', FEE_BPS, ZERO_ADDRESS],
      );
    });

    const hash = requestHash(context.portalAddress, context.content, NONCE_ONE);
    assert.equal(
      castCall(context.portalAddress, 'hasMessageBeenIssued(bytes32)(bool)', [hash]),
      'false',
    );
  });
});

test(
  'Uniswap E2E: duplicate execute for same request is rejected',
  { timeout: 900_000 },
  async () => {
    await withUniswapFlowTeardown((context) => {
      castSend(
        USER_PRIVATE_KEY,
        context.portalAddress,
        'requestSwap(bytes32,address,address,uint256,uint256,uint24,address)',
        requestArgs(context.content),
      );

      castSend(
        RELAYER_PRIVATE_KEY,
        context.portalAddress,
        'executeSwap(bytes32,address,address,address,uint256,uint256,uint24,address,uint64,uint64)',
        executeArgs(context.content),
      );

      const hash = requestHash(context.portalAddress, context.content, NONCE_ONE);
      assert.equal(
        castCall(context.portalAddress, 'hasMessageBeenConsumed(bytes32)(bool)', [hash]),
        'true',
      );

      assert.throws(() => {
        castSend(
          RELAYER_PRIVATE_KEY,
          context.portalAddress,
          'executeSwap(bytes32,address,address,address,uint256,uint256,uint24,address,uint64,uint64)',
          executeArgs(context.content),
        );
      });
    });
  },
);

test('Uniswap E2E: request mismatch blocks execution', { timeout: 900_000 }, async () => {
  await withUniswapFlowTeardown((context) => {
    castSend(
      USER_PRIVATE_KEY,
      context.portalAddress,
      'requestSwap(bytes32,address,address,uint256,uint256,uint24,address)',
      requestArgs(context.content),
    );
    const hash = requestHash(context.portalAddress, context.content, NONCE_ONE);

    assert.equal(
      castCall(context.portalAddress, 'hasMessageBeenConsumed(bytes32)(bool)', [hash]),
      'false',
    );

    assert.throws(() => {
      castSend(
        RELAYER_PRIVATE_KEY,
        context.portalAddress,
        'executeSwap(bytes32,address,address,address,uint256,uint256,uint24,address,uint64,uint64)',
        executeArgs(context.content, '999'),
      );
    });

    assert.equal(
      castCall(context.portalAddress, 'hasMessageBeenConsumed(bytes32)(bool)', [hash]),
      'false',
    );
  });
});

test(
  'Uniswap E2E: failed execution registers escape and can be claimed after timeout',
  { timeout: 900_000 },
  async () => {
    await withUniswapFlowTeardown((context) => {
      castSend(USER_PRIVATE_KEY, context.mocks.UNISWAP_MOCK_ROUTER, 'setShouldFail(bool)', [
        'true',
      ]);
      castSend(USER_PRIVATE_KEY, context.mocks.UNISWAP_MOCK_TOKEN_IN, 'mint(address,uint256)', [
        context.portalAddress,
        '1000',
      ]);

      castSend(
        USER_PRIVATE_KEY,
        context.portalAddress,
        'requestSwap(bytes32,address,address,uint256,uint256,uint24,address)',
        requestArgs(context.content, context.mocks.UNISWAP_MOCK_TOKEN_IN),
      );

      const requestHashValue = requestHash(context.portalAddress, context.content, NONCE_ONE);

      castSend(
        RELAYER_PRIVATE_KEY,
        context.portalAddress,
        'executeSwap(bytes32,address,address,address,uint256,uint256,uint24,address,uint64,uint64)',
        executeArgs(context.content, '1000', USER_ADDRESS, context.mocks.UNISWAP_MOCK_TOKEN_IN),
      );

      const escapeRequest = getEscapeRequest(context.portalAddress, requestHashValue);
      assert.equal(escapeRequest.depositor.toLowerCase(), USER_ADDRESS.toLowerCase());
      assert.equal(
        escapeRequest.token.toLowerCase(),
        context.mocks.UNISWAP_MOCK_TOKEN_IN.toLowerCase(),
      );
      assert.equal(escapeRequest.amount, 1000n);
      assert.equal(escapeRequest.timeoutBlocks, BigInt(DEFAULT_TIMEOUT_BLOCKS));
      assert.equal(escapeRequest.claimed, false);

      assert.equal(
        castCall(context.portalAddress, 'hasMessageBeenConsumed(bytes32)(bool)', [
          requestHashValue,
        ]),
        'true',
      );

      assert.throws(() => {
        castSend(USER_PRIVATE_KEY, context.portalAddress, 'claimEscape(bytes32)', [
          requestHashValue,
        ]);
      });

      mineBlocks(Number(DEFAULT_TIMEOUT_BLOCKS));

      castSend(USER_PRIVATE_KEY, context.portalAddress, 'claimEscape(bytes32)', [requestHashValue]);

      const claimedRequest = getEscapeRequest(context.portalAddress, requestHashValue);
      assert.equal(claimedRequest.claimed, true);
    });
  },
);
