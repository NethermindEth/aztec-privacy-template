import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import test from "node:test";
import { getInitialTestAccountsData } from "@aztec/accounts/testing/lazy";
import { loadContractArtifact } from "@aztec/aztec.js/abi";
import { AztecAddress, EthAddress } from "@aztec/aztec.js/addresses";
import { Contract } from "@aztec/aztec.js/contracts";
import { computeSecretHash } from "@aztec/aztec.js/crypto";
import { Fr } from "@aztec/aztec.js/fields";
import { waitForL1ToL2MessageReady } from "@aztec/aztec.js/messaging";
import { type AztecNode, createAztecNodeClient } from "@aztec/aztec.js/node";
import { poseidon2Hash } from "@aztec/foundation/crypto/poseidon";
import { computeL2ToL1MessageHash } from "@aztec/stdlib/hash";
import { TestWallet } from "@aztec/test-wallet/server";
import {
	AZTEC_NODE_URL,
	compileAztecContract,
	castCall,
	castSend,
	deployL1,
	ensureAztecLocalNetwork,
	logStep,
	logValue,
	stopProcess,
	type LocalRuntime,
	USER_PRIVATE_KEY,
} from "./runtime";

const AAVE_AZTEC_DIR = "packages/protocols/aave/aztec";
const LIDO_AZTEC_DIR = "packages/protocols/lido/aztec";
const UNISWAP_AZTEC_DIR = "packages/protocols/uniswap/aztec";

const AAVE_ARTIFACT_PATH =
	"packages/protocols/aave/aztec/target/aave_privacy_adapter-AavePrivacyAdapter.json";
const LIDO_ARTIFACT_PATH =
	"packages/protocols/lido/aztec/target/lido_privacy_adapter-LidoPrivacyAdapter.json";
const UNISWAP_ARTIFACT_PATH =
	"packages/protocols/uniswap/aztec/target/uniswap_privacy_adapter-UniswapPrivacyAdapter.json";

const CORE_MOCKS_SOLIDITY_DIR = "tests/mocks/core/solidity";
const L1_TO_L2_TEST_SENDER_SOURCE =
	"tests/mocks/core/solidity/L1ToL2TestSender.sol:L1ToL2TestSender";

let runtime: LocalRuntime | undefined;
let aztecNode: AztecNode;
let wallet: TestWallet | undefined;
let ownerAddress: AztecAddress;
let nodeInfo: Awaited<AztecNode["getNodeInfo"]>;
let aaveArtifact: ReturnType<typeof loadContractArtifact>;
let lidoArtifact: ReturnType<typeof loadContractArtifact>;
let uniswapArtifact: ReturnType<typeof loadContractArtifact>;

function loadArtifactFromFile(path: string) {
	const artifactJson = JSON.parse(readFileSync(path, "utf8"));
	return loadContractArtifact(artifactJson);
}

function parseUint(raw: string): bigint {
	return BigInt(raw.trim().split(" ")[0]);
}

async function assertInvalidConstructorArgs(
	artifact: ReturnType<typeof loadContractArtifact>,
	portalAddress: string,
): Promise<void> {
	await assert.rejects(async () => {
		await Contract.deploy(wallet, artifact, [AztecAddress.ZERO, EthAddress.fromString(portalAddress)])
			.send({ from: ownerAddress })
			.wait();
	});

	await assert.rejects(async () => {
		await Contract.deploy(wallet, artifact, [ownerAddress, EthAddress.ZERO])
			.send({ from: ownerAddress })
			.wait();
	});
}

async function deployAdapter(
	artifact: ReturnType<typeof loadContractArtifact>,
	portalAddress: string,
): Promise<any> {
	return Contract.deploy(wallet, artifact, [ownerAddress, EthAddress.fromString(portalAddress)])
		.send({ from: ownerAddress })
		.deployed();
}

async function assertRequestMessageSemantics(
	requestTxHash: any,
	adapterAddress: AztecAddress,
	portalAddress: string,
	content: Fr,
): Promise<void> {
	const txEffect = await aztecNode.getTxEffect(requestTxHash);
	assert.ok(txEffect, "Expected tx effect for adapter request tx");

	const expectedMessageHash = computeL2ToL1MessageHash({
		l2Sender: adapterAddress,
		l1Recipient: EthAddress.fromString(portalAddress),
		content,
		rollupVersion: new Fr(nodeInfo.rollupVersion),
		chainId: new Fr(nodeInfo.l1ChainId),
	});

	const hasExpectedMessage = txEffect.data.l2ToL1Msgs.some((messageHash) =>
		messageHash.equals(expectedMessageHash),
	);
	assert.equal(hasExpectedMessage, true);
}

async function enqueueCompletionMessage(
	l1SenderAddress: string,
	recipientAdapterAddress: AztecAddress,
	content: Fr,
	secret: Fr,
): Promise<Fr> {
	const secretHash = await computeSecretHash(secret);
	castSend(
		USER_PRIVATE_KEY,
		l1SenderAddress,
		"sendL2Message(address,bytes32,uint256,bytes32,bytes32)",
		[
			nodeInfo.l1ContractAddresses.inboxAddress.toString(),
			recipientAdapterAddress.toString(),
			nodeInfo.rollupVersion.toString(),
			content.toString(),
			secretHash.toString(),
		],
	);

	const messageHashRaw = castCall(l1SenderAddress, "lastMessageHash()(bytes32)");
	const messageLeafIndexRaw = castCall(l1SenderAddress, "lastMessageIndex()(uint256)");
	const messageHash = Fr.fromString(messageHashRaw);

	await waitForL1ToL2MessageReady(aztecNode, messageHash, {
		timeoutSeconds: 120,
		forPublicConsumption: false,
	});

	return Fr.fromString(parseUint(messageLeafIndexRaw).toString());
}

test.before(async () => {
	runtime = await ensureAztecLocalNetwork();

	compileAztecContract(AAVE_AZTEC_DIR);
	compileAztecContract(LIDO_AZTEC_DIR);
	compileAztecContract(UNISWAP_AZTEC_DIR);

	aaveArtifact = loadArtifactFromFile(AAVE_ARTIFACT_PATH);
	lidoArtifact = loadArtifactFromFile(LIDO_ARTIFACT_PATH);
	uniswapArtifact = loadArtifactFromFile(UNISWAP_ARTIFACT_PATH);

	aztecNode = createAztecNodeClient(AZTEC_NODE_URL);
	wallet = await TestWallet.create(aztecNode);

	const [ownerData] = await getInitialTestAccountsData();
	const owner = await wallet.createSchnorrAccount(
		ownerData.secret,
		ownerData.salt,
		ownerData.signingKey,
	);
	ownerAddress = owner.address;
	nodeInfo = await aztecNode.getNodeInfo();
});

test.after(async () => {
	if (wallet) {
		await wallet.stop();
	}
	await stopProcess(runtime?.process ?? null);
});

test(
	"Aave adapter E2E: request/finalize lifecycle with failure cases",
	{ timeout: 900_000 },
	async () => {
		const testTag = "AZTEC-AAVE";
		let step = 0;

		logStep(testTag, step++, "Deploy L1 test sender and validate constructor failures");
		const l1SenderAddress = deployL1(
			L1_TO_L2_TEST_SENDER_SOURCE,
			CORE_MOCKS_SOLIDITY_DIR,
		);
		await assertInvalidConstructorArgs(aaveArtifact, l1SenderAddress);

		logStep(testTag, step++, "Deploy Aave adapter");
		const adapter = await deployAdapter(aaveArtifact, l1SenderAddress);
		logValue(testTag, "Adapter", adapter.address.toString());
		logValue(testTag, "L1 sender", l1SenderAddress);

		const asset = new Fr(111n);
		const amount = 1_000n;
		const referralCode = 7;
		const secret = new Fr(333_333n);
		const secretHash = await computeSecretHash(secret);

		logStep(testTag, step++, "Assert invalid amount request fails");
		await assert.rejects(async () => {
			await adapter.methods
				.request_deposit(asset, 0n, referralCode, secretHash)
				.send({ from: ownerAddress })
				.wait();
		});

		const ownerHash = await poseidon2Hash([ownerAddress, secretHash]);
		const intentId = await poseidon2Hash([
			ownerHash,
			asset,
			amount,
			referralCode,
			1,
		]);
		const requestContent = await poseidon2Hash([
			intentId,
			ownerHash,
			asset,
			amount,
			referralCode,
			secretHash,
		]);

		logStep(testTag, step++, "Submit request_deposit and assert pending/message semantics");
		const requestReceipt = await adapter.methods
			.request_deposit(asset, amount, referralCode, secretHash)
			.send({ from: ownerAddress })
			.wait();
		assert.equal(
			await adapter.methods
				.is_deposit_pending(intentId)
				.simulate({ from: ownerAddress }),
			true,
		);
		await assertRequestMessageSemantics(
			requestReceipt.txHash,
			adapter.address,
			l1SenderAddress,
			requestContent,
		);

		const shares = 777n;
		const finalizeContent = await poseidon2Hash([intentId, shares, 1]);
		logStep(testTag, step++, "Enqueue completion message and finalize");
		const messageLeafIndex = await enqueueCompletionMessage(
			l1SenderAddress,
			adapter.address,
			finalizeContent,
			secret,
		);
		await adapter.methods
			.finalize_deposit(intentId, shares, secret, messageLeafIndex)
			.send({ from: ownerAddress })
			.wait();

		assert.equal(
			await adapter.methods
				.is_deposit_pending(intentId)
				.simulate({ from: ownerAddress }),
			false,
		);

		logStep(testTag, step++, "Assert finalize replay fails");
		await assert.rejects(async () => {
			await adapter.methods
				.finalize_deposit(intentId, shares, secret, messageLeafIndex)
				.send({ from: ownerAddress })
				.wait();
		});
	},
);

test(
	"Lido adapter E2E: request/finalize lifecycle with failure cases",
	{ timeout: 900_000 },
	async () => {
		const testTag = "AZTEC-LIDO";
		let step = 0;

		logStep(testTag, step++, "Deploy L1 test sender and validate constructor failures");
		const l1SenderAddress = deployL1(
			L1_TO_L2_TEST_SENDER_SOURCE,
			CORE_MOCKS_SOLIDITY_DIR,
		);
		await assertInvalidConstructorArgs(lidoArtifact, l1SenderAddress);

		logStep(testTag, step++, "Deploy Lido adapter");
		const adapter = await deployAdapter(lidoArtifact, l1SenderAddress);
		logValue(testTag, "Adapter", adapter.address.toString());
		logValue(testTag, "L1 sender", l1SenderAddress);

		const amount = 1_500n;
		const recipient = new Fr(444n);
		const referral = new Fr(555n);
		const secret = new Fr(777_777n);
		const secretHash = await computeSecretHash(secret);

		logStep(testTag, step++, "Assert invalid amount request fails");
		await assert.rejects(async () => {
			await adapter.methods
				.request_stake(0n, recipient, referral, secretHash)
				.send({ from: ownerAddress })
				.wait();
		});

		const ownerHash = await poseidon2Hash([ownerAddress, secretHash]);
		const intentId = await poseidon2Hash([
			ownerHash,
			amount,
			recipient,
			referral,
			1,
			1,
		]);
		const requestContent = await poseidon2Hash([
			intentId,
			ownerHash,
			amount,
			recipient,
			referral,
			secretHash,
		]);

		logStep(testTag, step++, "Submit request_stake and assert pending/message semantics");
		const requestReceipt = await adapter.methods
			.request_stake(amount, recipient, referral, secretHash)
			.send({ from: ownerAddress })
			.wait();
		assert.equal(
			await adapter.methods
				.is_stake_pending(intentId)
				.simulate({ from: ownerAddress }),
			true,
		);
		await assertRequestMessageSemantics(
			requestReceipt.txHash,
			adapter.address,
			l1SenderAddress,
			requestContent,
		);

		const shares = 1_501n;
		const finalizeContent = await poseidon2Hash([intentId, shares, 1]);
		logStep(testTag, step++, "Enqueue completion message and finalize");
		const messageLeafIndex = await enqueueCompletionMessage(
			l1SenderAddress,
			adapter.address,
			finalizeContent,
			secret,
		);
		await adapter.methods
			.finalize_stake(intentId, shares, secret, messageLeafIndex)
			.send({ from: ownerAddress })
			.wait();

		assert.equal(
			await adapter.methods
				.is_stake_pending(intentId)
				.simulate({ from: ownerAddress }),
			false,
		);

		logStep(testTag, step++, "Assert finalize replay fails");
		await assert.rejects(async () => {
			await adapter.methods
				.finalize_stake(intentId, shares, secret, messageLeafIndex)
				.send({ from: ownerAddress })
				.wait();
		});
	},
);

test(
	"Uniswap adapter E2E: request/finalize lifecycle with failure cases",
	{ timeout: 900_000 },
	async () => {
		const testTag = "AZTEC-UNISWAP";
		let step = 0;

		logStep(testTag, step++, "Deploy L1 test sender and validate constructor failures");
		const l1SenderAddress = deployL1(
			L1_TO_L2_TEST_SENDER_SOURCE,
			CORE_MOCKS_SOLIDITY_DIR,
		);
		await assertInvalidConstructorArgs(uniswapArtifact, l1SenderAddress);

		logStep(testTag, step++, "Deploy Uniswap adapter");
		const adapter = await deployAdapter(uniswapArtifact, l1SenderAddress);
		logValue(testTag, "Adapter", adapter.address.toString());
		logValue(testTag, "L1 sender", l1SenderAddress);

		const tokenIn = new Fr(0x0abcdn);
		const tokenOut = new Fr(0x0beefn);
		const amountIn = 2_000n;
		const minAmountOut = 1_850n;
		const fee = 3_000;
		const recipient = new Fr(666n);
		const secret = new Fr(999_999n);
		const secretHash = await computeSecretHash(secret);

		logStep(testTag, step++, "Assert invalid amount request fails");
		await assert.rejects(async () => {
			await adapter.methods
				.request_swap(tokenIn, tokenOut, 0n, minAmountOut, fee, recipient, secretHash)
				.send({ from: ownerAddress })
				.wait();
		});

		const ownerHash = await poseidon2Hash([ownerAddress, secretHash]);
		const intentId = await poseidon2Hash([
			ownerHash,
			tokenIn,
			tokenOut,
			amountIn,
			minAmountOut,
			fee,
			recipient,
			1,
		]);
		const requestContent = await poseidon2Hash([
			intentId,
			ownerHash,
			tokenIn,
			tokenOut,
			amountIn,
			minAmountOut,
			fee,
			recipient,
			secretHash,
		]);

		logStep(testTag, step++, "Submit request_swap and assert pending/message semantics");
		const requestReceipt = await adapter.methods
			.request_swap(
				tokenIn,
				tokenOut,
				amountIn,
				minAmountOut,
				fee,
				recipient,
				secretHash,
			)
			.send({ from: ownerAddress })
			.wait();
		assert.equal(
			await adapter.methods
				.is_swap_pending(intentId)
				.simulate({ from: ownerAddress }),
			true,
		);
		await assertRequestMessageSemantics(
			requestReceipt.txHash,
			adapter.address,
			l1SenderAddress,
			requestContent,
		);

		const amountOut = 1_900n;
		const finalizeContent = await poseidon2Hash([intentId, amountOut]);
		logStep(testTag, step++, "Enqueue completion message and finalize");
		const messageLeafIndex = await enqueueCompletionMessage(
			l1SenderAddress,
			adapter.address,
			finalizeContent,
			secret,
		);
		await adapter.methods
			.finalize_swap(intentId, amountOut, secret, messageLeafIndex)
			.send({ from: ownerAddress })
			.wait();

		assert.equal(
			await adapter.methods
				.is_swap_pending(intentId)
				.simulate({ from: ownerAddress }),
			false,
		);

		logStep(testTag, step++, "Assert finalize replay fails");
		await assert.rejects(async () => {
			await adapter.methods
				.finalize_swap(intentId, amountOut, secret, messageLeafIndex)
				.send({ from: ownerAddress })
				.wait();
		});
	},
);
