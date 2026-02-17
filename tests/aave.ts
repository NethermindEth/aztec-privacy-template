import { strict as assert } from "node:assert";
import test from "node:test";
import { type ProtocolFlowSpec, runProtocolE2EHappyPath } from "./e2e-flow";
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
} from "./runtime";

const PROTOCOL_ID = `0x${"11".repeat(32)}`;
const AAVE_AZTEC_DIR = "packages/protocols/aave/aztec";
const AAVE_SOLIDITY_DIR = "packages/protocols/aave/solidity";
const AAVE_MOCKS_SOLIDITY_DIR = "tests/mocks/aave/solidity";
const TEST_TAG = "AAVE";
const LP_TOKEN_MOCK_LIQUIDITY = "1000000000000000000000";
const AAVE_REQUEST_AMOUNT = "1000";
const AAVE_REFERRAL_CODE = "0";
const DEFAULT_TIMEOUT_BLOCKS = "20";
const NONCE_ONE = "1";

type AaveTestContext = {
	runtime: LocalRuntime;
	content: string;
	portalAddress: string;
	mocks: {
		AAVE_MOCK_ERC20: string;
		AAVE_MOCK_POOL: string;
	};
};

type EscapeRequest = {
	depositor: string;
	token: string;
	amount: bigint;
	createdAtBlock: bigint;
	timeoutBlocks: bigint;
	claimed: boolean;
};

function mineBlocks(count: number): void {
	for (let i = 0; i < count; i++) {
		try {
			run("cast", ["rpc", "--rpc-url", L1_RPC_URL, "evm_mine"]);
		} catch {
			run("cast", ["rpc", "--rpc-url", L1_RPC_URL, "anvil_mine"]);
		}
	}
}

function parseEscapeRequest(raw: string): EscapeRequest {
	const parts = raw
		.replace(/^\s*\(/, "")
		.replace(/\)\s*$/, "")
		.split(",")
		.map((part) => part.trim());

	return {
		depositor: parts[0],
		token: parts[1],
		amount: BigInt(parts[2]),
		createdAtBlock: BigInt(parts[3]),
		timeoutBlocks: BigInt(parts[4]),
		claimed: parts[5] === "true",
	};
}

function getEscapeRequest(
	portalAddress: string,
	requestHash: string,
): EscapeRequest {
	const raw = castCall(
		portalAddress,
		"getEscapeRequest(bytes32)(address,address,uint256,uint64,uint64,bool)",
		[requestHash],
	);
	return parseEscapeRequest(raw);
}

async function buildAaveTestContext(): Promise<AaveTestContext> {
	const runtime = await ensureAztecLocalNetwork();
	compileAztecContract(AAVE_AZTEC_DIR);

	const aztecState = await provisionPrivateTokenBalance(
		"Aave Privacy Token",
		"APT",
		1_000n,
	);
	const content = castKeccak(
		`aave-deposit:${aztecState.ownerAddress}:${aztecState.balance}`,
	);

	const mockERC20 = deployL1(
		"tests/mocks/aave/solidity/MockERC20.sol:MockERC20",
		AAVE_MOCKS_SOLIDITY_DIR,
	);
	const mockPool = deployL1(
		"tests/mocks/aave/solidity/MockAavePool.sol:MockAavePool",
		AAVE_MOCKS_SOLIDITY_DIR,
	);
	const portalAddress = deployL1(
		"packages/protocols/aave/solidity/AavePortal.sol:AavePortal",
		AAVE_SOLIDITY_DIR,
		[PROTOCOL_ID, USER_ADDRESS, RELAYER_ADDRESS, mockPool, mockERC20],
	);

	castSend(USER_PRIVATE_KEY, mockERC20, "mint(address,uint256)", [
		mockPool,
		LP_TOKEN_MOCK_LIQUIDITY,
	]);

	return {
		runtime,
		content,
		portalAddress,
		mocks: {
			AAVE_MOCK_ERC20: mockERC20,
			AAVE_MOCK_POOL: mockPool,
		},
	};
}

async function withAaveFlowTeardown(
	fn: (context: AaveTestContext) => Promise<void> | void,
): Promise<void> {
	const context = await buildAaveTestContext();

	try {
		await fn(context);
	} finally {
		await stopProcess(context.runtime.process);
	}
}

function aaveRequestArgs(content: string): string[] {
	return [content, AAVE_REQUEST_AMOUNT, AAVE_REFERRAL_CODE];
}

function aaveExecuteArgs(
	content: string,
	amount = AAVE_REQUEST_AMOUNT,
): string[] {
	return [
		content,
		USER_ADDRESS,
		amount,
		AAVE_REFERRAL_CODE,
		NONCE_ONE,
		DEFAULT_TIMEOUT_BLOCKS,
	];
}

function aaveRequestHash(
	portalAddress: string,
	content: string,
	nonce: string,
): string {
	return castCall(
		portalAddress,
		"messageHashFor(bytes32,address,uint64)(bytes32)",
		[content, USER_ADDRESS, nonce],
	);
}

const AAVE_FLOW: ProtocolFlowSpec = {
	tag: TEST_TAG,
	protocolId: PROTOCOL_ID,
	aztec: {
		dir: AAVE_AZTEC_DIR,
		tokenName: "Aave Privacy Token",
		tokenSymbol: "APT",
		tokenAmount: 1_000n,
	},
	buildContent: (ownerAddress, balance) =>
		`aave-deposit:${ownerAddress}:${balance}`,
	portal: {
		source: "packages/protocols/aave/solidity/AavePortal.sol:AavePortal",
		contractsDir: AAVE_SOLIDITY_DIR,
		constructorArgs: ({
			protocolId,
			userAddress,
			relayerAddress,
			deployedMocks,
		}) => [
			protocolId,
			userAddress,
			relayerAddress,
			deployedMocks.AAVE_MOCK_POOL,
			deployedMocks.AAVE_MOCK_ERC20,
		],
	},
	mocks: [
		{
			label: "AAVE_MOCK_ERC20",
			source: "tests/mocks/aave/solidity/MockERC20.sol:MockERC20",
			contractsDir: AAVE_MOCKS_SOLIDITY_DIR,
		},
		{
			label: "AAVE_MOCK_POOL",
			source: "tests/mocks/aave/solidity/MockAavePool.sol:MockAavePool",
			contractsDir: AAVE_MOCKS_SOLIDITY_DIR,
		},
	],
	setup: ({ mocks }) => {
		castSend(USER_PRIVATE_KEY, mocks.AAVE_MOCK_ERC20, "mint(address,uint256)", [
			mocks.AAVE_MOCK_POOL,
			LP_TOKEN_MOCK_LIQUIDITY,
		]);
	},
	request: {
		signature: "requestDeposit(bytes32,uint256,uint16)",
		args: ({ content }) => aaveRequestArgs(content),
	},
	execute: {
		signature: "executeDeposit(bytes32,address,uint256,uint16,uint64,uint64)",
		args: ({ content }) => aaveExecuteArgs(content),
	},
	assertState: ({ mocks, userAddress }) => {
		const lastAmountRaw = castCall(
			mocks.AAVE_MOCK_POOL,
			"lastAmount()(uint256)",
		);
		assert.equal(BigInt(lastAmountRaw), BigInt(AAVE_REQUEST_AMOUNT));

		const lastOnBehalfOf = castCall(
			mocks.AAVE_MOCK_POOL,
			"lastOnBehalfOf()(address)",
		);
		assert.equal(lastOnBehalfOf.toLowerCase(), userAddress);

		const lastReferralCodeRaw = castCall(
			mocks.AAVE_MOCK_POOL,
			"lastReferralCode()(uint16)",
		);
		assert.equal(Number(lastReferralCodeRaw), Number(AAVE_REFERRAL_CODE));
	},
};

test(
	"Aave E2E: Aztec private token + L1 Aave portal flow",
	{ timeout: 900_000 },
	async () => {
		await runProtocolE2EHappyPath(AAVE_FLOW);
	},
);

test(
	"Aave E2E: unauthorized relayer cannot execute deposit",
	{ timeout: 900_000 },
	async () => {
		await withAaveFlowTeardown(async (context) => {
			castSend(
				USER_PRIVATE_KEY,
				context.portalAddress,
				"requestDeposit(bytes32,uint256,uint16)",
				aaveRequestArgs(context.content),
			);
			const requestHash = aaveRequestHash(
				context.portalAddress,
				context.content,
				NONCE_ONE,
			);

			assert.throws(() => {
				castSend(
					USER_PRIVATE_KEY,
					context.portalAddress,
					"executeDeposit(bytes32,address,uint256,uint16,uint64,uint64)",
					aaveExecuteArgs(context.content),
				);
			});

			assert.equal(
				castCall(
					context.portalAddress,
					"hasMessageBeenConsumed(bytes32)(bool)",
					[requestHash],
				),
				"false",
			);
		});
	},
);

test(
	"Aave E2E: invalid deposit request amount is rejected",
	{ timeout: 900_000 },
	async () => {
		await withAaveFlowTeardown((context) => {
			assert.throws(() => {
				castSend(
					USER_PRIVATE_KEY,
					context.portalAddress,
					"requestDeposit(bytes32,uint256,uint16)",
					[context.content, "0", AAVE_REFERRAL_CODE],
				);
			});

			const requestHash = aaveRequestHash(
				context.portalAddress,
				context.content,
				NONCE_ONE,
			);
			assert.equal(
				castCall(context.portalAddress, "hasMessageBeenIssued(bytes32)(bool)", [
					requestHash,
				]),
				"false",
			);
		});
	},
);

test(
	"Aave E2E: duplicate execute for same request is rejected",
	{ timeout: 900_000 },
	async () => {
		await withAaveFlowTeardown((context) => {
			castSend(
				USER_PRIVATE_KEY,
				context.portalAddress,
				"requestDeposit(bytes32,uint256,uint16)",
				aaveRequestArgs(context.content),
			);
			castSend(
				RELAYER_PRIVATE_KEY,
				context.portalAddress,
				"executeDeposit(bytes32,address,uint256,uint16,uint64,uint64)",
				aaveExecuteArgs(context.content),
			);

			const requestHash = aaveRequestHash(
				context.portalAddress,
				context.content,
				NONCE_ONE,
			);
			assert.equal(
				castCall(
					context.portalAddress,
					"hasMessageBeenConsumed(bytes32)(bool)",
					[requestHash],
				),
				"true",
			);

			assert.throws(() => {
				castSend(
					RELAYER_PRIVATE_KEY,
					context.portalAddress,
					"executeDeposit(bytes32,address,uint256,uint16,uint64,uint64)",
					aaveExecuteArgs(context.content),
				);
			});
		});
	},
);

test(
	"Aave E2E: request mismatch blocks execution",
	{ timeout: 900_000 },
	async () => {
		await withAaveFlowTeardown((context) => {
			castSend(
				USER_PRIVATE_KEY,
				context.portalAddress,
				"requestDeposit(bytes32,uint256,uint16)",
				aaveRequestArgs(context.content),
			);
			const requestHash = aaveRequestHash(
				context.portalAddress,
				context.content,
				NONCE_ONE,
			);

			assert.equal(
				castCall(
					context.portalAddress,
					"hasMessageBeenConsumed(bytes32)(bool)",
					[requestHash],
				),
				"false",
			);

			assert.throws(() => {
				castSend(
					RELAYER_PRIVATE_KEY,
					context.portalAddress,
					"executeDeposit(bytes32,address,uint256,uint16,uint64,uint64)",
					aaveExecuteArgs(context.content, "999"),
				);
			});

			assert.equal(
				castCall(
					context.portalAddress,
					"hasMessageBeenConsumed(bytes32)(bool)",
					[requestHash],
				),
				"false",
			);
		});
	},
);

test(
	"Aave E2E: failed execution registers escape and can be claimed after timeout",
	{
		timeout: 900_000,
	},
	async () => {
		await withAaveFlowTeardown((context) => {
			castSend(
				USER_PRIVATE_KEY,
				context.mocks.AAVE_MOCK_POOL,
				"setShouldFail(bool)",
				["true"],
			);
			castSend(
				USER_PRIVATE_KEY,
				context.mocks.AAVE_MOCK_ERC20,
				"mint(address,uint256)",
				[context.portalAddress, AAVE_REQUEST_AMOUNT],
			);

			castSend(
				USER_PRIVATE_KEY,
				context.portalAddress,
				"requestDeposit(bytes32,uint256,uint16)",
				aaveRequestArgs(context.content),
			);
			const requestHash = aaveRequestHash(
				context.portalAddress,
				context.content,
				NONCE_ONE,
			);

			castSend(
				RELAYER_PRIVATE_KEY,
				context.portalAddress,
				"executeDeposit(bytes32,address,uint256,uint16,uint64,uint64)",
				aaveExecuteArgs(context.content),
			);

			const escapeRequest = getEscapeRequest(
				context.portalAddress,
				requestHash,
			);
			assert.equal(escapeRequest.depositor.toLowerCase(), USER_ADDRESS);
			assert.equal(
				escapeRequest.token.toLowerCase(),
				context.mocks.AAVE_MOCK_ERC20,
			);
			assert.equal(escapeRequest.amount, BigInt(AAVE_REQUEST_AMOUNT));
			assert.equal(escapeRequest.timeoutBlocks, BigInt(DEFAULT_TIMEOUT_BLOCKS));
			assert.equal(escapeRequest.claimed, false);

			assert.equal(
				castCall(
					context.portalAddress,
					"hasMessageBeenConsumed(bytes32)(bool)",
					[requestHash],
				),
				"true",
			);

			assert.throws(() => {
				castSend(
					USER_PRIVATE_KEY,
					context.portalAddress,
					"claimEscape(bytes32)",
					[requestHash],
				);
			});

			mineBlocks(Number(DEFAULT_TIMEOUT_BLOCKS));

			castSend(
				USER_PRIVATE_KEY,
				context.portalAddress,
				"claimEscape(bytes32)",
				[requestHash],
			);

			const claimedRequest = getEscapeRequest(
				context.portalAddress,
				requestHash,
			);
			assert.equal(claimedRequest.claimed, true);
		});
	},
);
