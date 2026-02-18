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

const PROTOCOL_ID = `0x${'33'.repeat(32)}`;
const LIDO_AZTEC_DIR = 'packages/protocols/lido/aztec';
const LIDO_SOLIDITY_DIR = 'packages/protocols/lido/solidity';
const LIDO_MOCKS_SOLIDITY_DIR = 'tests/mocks/lido/solidity';
const TEST_TAG = 'LIDO';
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const ONE_ETH_WEI = '1000000000000000000';
const DEFAULT_TIMEOUT_BLOCKS = '20';
const NONCE_ONE = '1';
const NONCE_TWO = '2';

type EscapeRequest = {
  depositor: string;
  token: string;
  amount: bigint;
  createdAtBlock: bigint;
  timeoutBlocks: bigint;
  claimed: boolean;
};

type LidoTestContext = {
  runtime: LocalRuntime;
  content: string;
  portalAddress: string;
  mocks: {
    LIDO_MOCK_PROTOCOL: string;
  };
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

async function buildLidoTestContext(): Promise<LidoTestContext> {
  const runtime = await ensureAztecLocalNetwork();
  compileAztecContract(LIDO_AZTEC_DIR);

  const aztecState = await provisionPrivateTokenBalance('Lido Privacy Receipt', 'LPR', 1_000n);
  const content = castKeccak(`lido-stake:${aztecState.ownerAddress}:${aztecState.balance}`);

  const protocol = deployL1(
    'tests/mocks/lido/solidity/MockLidoProtocol.sol:MockLidoProtocol',
    LIDO_MOCKS_SOLIDITY_DIR,
  );

  const portalAddress = deployL1(
    'packages/protocols/lido/solidity/LidoPortal.sol:LidoPortal',
    LIDO_SOLIDITY_DIR,
    [PROTOCOL_ID, USER_ADDRESS, RELAYER_ADDRESS, protocol],
  );

  return {
    runtime,
    content,
    portalAddress,
    mocks: {
      LIDO_MOCK_PROTOCOL: protocol,
    },
  };
}

async function withLidoFlowTeardown(
  fn: (context: LidoTestContext) => Promise<void> | void,
): Promise<void> {
  const context = await buildLidoTestContext();

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

function requestArgs(content: string): string[] {
  return [content, ONE_ETH_WEI, USER_ADDRESS, ZERO_ADDRESS];
}

function executeArgs(content: string, amount = ONE_ETH_WEI, sender = USER_ADDRESS): string[] {
  return [content, sender, amount, USER_ADDRESS, ZERO_ADDRESS, NONCE_ONE, DEFAULT_TIMEOUT_BLOCKS];
}

function requestUnstakeArgs(content: string): string[] {
  return [content, ONE_ETH_WEI, USER_ADDRESS];
}

function executeUnstakeArgs(
  content: string,
  nonce = NONCE_TWO,
  amount = ONE_ETH_WEI,
  sender = USER_ADDRESS,
  recipient = USER_ADDRESS,
): string[] {
  return [content, sender, amount, recipient, nonce, DEFAULT_TIMEOUT_BLOCKS];
}

const LIDO_FLOW: ProtocolFlowSpec = {
  tag: TEST_TAG,
  protocolId: PROTOCOL_ID,
  aztec: {
    dir: LIDO_AZTEC_DIR,
    tokenName: 'Lido Privacy Receipt',
    tokenSymbol: 'LPR',
    tokenAmount: 1_000n,
  },
  buildContent: (ownerAddress, balance) => `lido-stake:${ownerAddress}:${balance}`,
  portal: {
    source: 'packages/protocols/lido/solidity/LidoPortal.sol:LidoPortal',
    contractsDir: LIDO_SOLIDITY_DIR,
    constructorArgs: ({ protocolId, userAddress, relayerAddress, deployedMocks }) => [
      protocolId,
      userAddress,
      relayerAddress,
      deployedMocks.LIDO_MOCK_PROTOCOL,
    ],
  },
  mocks: [
    {
      label: 'LIDO_MOCK_PROTOCOL',
      source: 'tests/mocks/lido/solidity/MockLidoProtocol.sol:MockLidoProtocol',
      contractsDir: LIDO_MOCKS_SOLIDITY_DIR,
    },
  ],
  request: {
    signature: 'requestStake(bytes32,uint256,address,address)',
    args: ({ content, userAddress }) => [content, ONE_ETH_WEI, userAddress, ZERO_ADDRESS],
  },
  execute: {
    signature: 'executeStake(bytes32,address,uint256,address,address,uint64,uint64)',
    args: ({ content, userAddress }) => [
      content,
      userAddress,
      ONE_ETH_WEI,
      userAddress,
      ZERO_ADDRESS,
      NONCE_ONE,
      DEFAULT_TIMEOUT_BLOCKS,
    ],
    valueWei: ONE_ETH_WEI,
  },
  assertState: ({ mocks, userAddress }) => {
    const lastAmountRaw = castCall(mocks.LIDO_MOCK_PROTOCOL, 'lastAmount()(uint256)');
    const lastAmount = BigInt(lastAmountRaw.split(' ')[0]);
    assert.equal(lastAmount, BigInt(ONE_ETH_WEI));

    const lastStakeRecipient = castCall(mocks.LIDO_MOCK_PROTOCOL, 'lastStakeRecipient()(address)');
    assert.equal(lastStakeRecipient.toLowerCase(), userAddress);
  },
};

test('Lido E2E: Aztec private state + L1 Lido portal flow', { timeout: 900_000 }, async () => {
  await runProtocolE2EHappyPath(LIDO_FLOW);
});

test('Lido E2E: unauthorized relayer cannot execute stake', { timeout: 900_000 }, async () => {
  await withLidoFlowTeardown((context) => {
    castSend(
      USER_PRIVATE_KEY,
      context.portalAddress,
      'requestStake(bytes32,uint256,address,address)',
      requestArgs(context.content),
    );
    const hash = requestHash(context.portalAddress, context.content, NONCE_ONE);

    assert.throws(() => {
      castSend(
        USER_PRIVATE_KEY,
        context.portalAddress,
        'executeStake(bytes32,address,uint256,address,address,uint64,uint64)',
        executeArgs(context.content),
        ONE_ETH_WEI,
      );
    });

    assert.equal(
      castCall(context.portalAddress, 'hasMessageBeenConsumed(bytes32)(bool)', [hash]),
      'false',
    );
  });
});

test('Lido E2E: request validation rejects zero recipient', { timeout: 900_000 }, async () => {
  await withLidoFlowTeardown((context) => {
    assert.throws(() => {
      castSend(
        USER_PRIVATE_KEY,
        context.portalAddress,
        'requestStake(bytes32,uint256,address,address)',
        [context.content, ONE_ETH_WEI, ZERO_ADDRESS, ZERO_ADDRESS],
      );
    });

    const hash = requestHash(context.portalAddress, context.content, NONCE_ONE);
    assert.equal(
      castCall(context.portalAddress, 'hasMessageBeenIssued(bytes32)(bool)', [hash]),
      'false',
    );
  });
});

test('Lido E2E: duplicate execute for same request is rejected', { timeout: 900_000 }, async () => {
  await withLidoFlowTeardown((context) => {
    castSend(
      USER_PRIVATE_KEY,
      context.portalAddress,
      'requestStake(bytes32,uint256,address,address)',
      requestArgs(context.content),
    );

    castSend(
      RELAYER_PRIVATE_KEY,
      context.portalAddress,
      'executeStake(bytes32,address,uint256,address,address,uint64,uint64)',
      executeArgs(context.content),
      ONE_ETH_WEI,
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
        'executeStake(bytes32,address,uint256,address,address,uint64,uint64)',
        executeArgs(context.content),
        ONE_ETH_WEI,
      );
    });
  });
});

test('Lido E2E: request mismatch blocks execution', { timeout: 900_000 }, async () => {
  await withLidoFlowTeardown((context) => {
    castSend(
      USER_PRIVATE_KEY,
      context.portalAddress,
      'requestStake(bytes32,uint256,address,address)',
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
        'executeStake(bytes32,address,uint256,address,address,uint64,uint64)',
        executeArgs(context.content, ONE_ETH_WEI, ZERO_ADDRESS),
        ONE_ETH_WEI,
      );
    });

    assert.equal(
      castCall(context.portalAddress, 'hasMessageBeenConsumed(bytes32)(bool)', [hash]),
      'false',
    );
  });
});

test(
  'Lido E2E: failed execution registers escape and can be claimed after timeout',
  {
    timeout: 900_000,
  },
  async () => {
    await withLidoFlowTeardown((context) => {
      castSend(USER_PRIVATE_KEY, context.mocks.LIDO_MOCK_PROTOCOL, 'setShouldFail(bool)', ['true']);

      castSend(
        USER_PRIVATE_KEY,
        context.portalAddress,
        'requestStake(bytes32,uint256,address,address)',
        requestArgs(context.content),
      );
      const requestHashValue = requestHash(context.portalAddress, context.content, NONCE_ONE);

      castSend(
        RELAYER_PRIVATE_KEY,
        context.portalAddress,
        'executeStake(bytes32,address,uint256,address,address,uint64,uint64)',
        executeArgs(context.content),
        ONE_ETH_WEI,
      );

      const escapeRequest = getEscapeRequest(context.portalAddress, requestHashValue);
      assert.equal(escapeRequest.depositor.toLowerCase(), USER_ADDRESS.toLowerCase());
      assert.equal(escapeRequest.token.toLowerCase(), ZERO_ADDRESS.toLowerCase());
      assert.equal(escapeRequest.amount, BigInt(ONE_ETH_WEI));
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

test(
  'Lido E2E: failed unstake execution registers escape and can be claimed after timeout',
  {
    timeout: 900_000,
  },
  async () => {
    await withLidoFlowTeardown((context) => {
      castSend(USER_PRIVATE_KEY, context.mocks.LIDO_MOCK_PROTOCOL, 'setShouldFail(bool)', ['true']);

      castSend(
        USER_PRIVATE_KEY,
        context.portalAddress,
        'requestStake(bytes32,uint256,address,address)',
        requestArgs(context.content),
      );
      castSend(
        RELAYER_PRIVATE_KEY,
        context.portalAddress,
        'executeStake(bytes32,address,uint256,address,address,uint64,uint64)',
        executeArgs(context.content),
        ONE_ETH_WEI,
      );

      castSend(
        USER_PRIVATE_KEY,
        context.portalAddress,
        'requestUnstake(bytes32,uint256,address)',
        requestUnstakeArgs(context.content),
      );
      const requestHashValue = requestHash(context.portalAddress, context.content, NONCE_TWO);

      castSend(
        RELAYER_PRIVATE_KEY,
        context.portalAddress,
        'executeUnstake(bytes32,address,uint256,address,uint64,uint64)',
        executeUnstakeArgs(context.content),
      );

      const escapeRequest = getEscapeRequest(context.portalAddress, requestHashValue);
      assert.equal(escapeRequest.depositor.toLowerCase(), USER_ADDRESS.toLowerCase());
      assert.equal(escapeRequest.token.toLowerCase(), ZERO_ADDRESS.toLowerCase());
      assert.equal(escapeRequest.amount, BigInt(ONE_ETH_WEI));
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
