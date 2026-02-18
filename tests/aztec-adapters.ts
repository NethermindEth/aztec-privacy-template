import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';
import test, { type TestContext } from 'node:test';
import { getInitialTestAccountsData } from '@aztec/accounts/testing/lazy';
import { loadContractArtifact } from '@aztec/aztec.js/abi';
import { AztecAddress, EthAddress } from '@aztec/aztec.js/addresses';
import { Contract } from '@aztec/aztec.js/contracts';
import { computeSecretHash } from '@aztec/aztec.js/crypto';
import { Fr } from '@aztec/aztec.js/fields';
import { L1Actor, L1ToL2Message, L2Actor } from '@aztec/aztec.js/messaging';
import { type AztecNode, createAztecNodeClient } from '@aztec/aztec.js/node';
import { poseidon2Hash } from '@aztec/foundation/crypto/poseidon';
import { computeL2ToL1MessageHash } from '@aztec/stdlib/hash';
import { TestWallet } from '@aztec/test-wallet/server';
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
} from './runtime';

const AAVE_AZTEC_DIR = 'packages/protocols/aave/aztec';
const LIDO_AZTEC_DIR = 'packages/protocols/lido/aztec';
const UNISWAP_AZTEC_DIR = 'packages/protocols/uniswap/aztec';

const AAVE_ARTIFACT_PATH =
  'packages/protocols/aave/aztec/target/aave_privacy_adapter-AavePrivacyAdapter.json';
const LIDO_ARTIFACT_PATH =
  'packages/protocols/lido/aztec/target/lido_privacy_adapter-LidoPrivacyAdapter.json';
const UNISWAP_ARTIFACT_PATH =
  'packages/protocols/uniswap/aztec/target/uniswap_privacy_adapter-UniswapPrivacyAdapter.json';

const CORE_MOCKS_SOLIDITY_DIR = 'tests/mocks/core/solidity';
const L1_TO_L2_TEST_SENDER_SOURCE =
  'tests/mocks/core/solidity/L1ToL2TestSender.sol:L1ToL2TestSender';

function readPositiveIntEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }
  const parsed = Number.parseInt(raw, 10);
  if (Number.isFinite(parsed) && parsed > 0) {
    return parsed;
  }
  return fallback;
}

const MESSAGE_READY_TIMEOUT_MS = readPositiveIntEnv('ADAPTER_MESSAGE_READY_TIMEOUT_MS', 90_000);
const MESSAGE_READY_POLL_INTERVAL_MS = readPositiveIntEnv('ADAPTER_POLL_INTERVAL_MS', 500);
const FINALIZE_RETRY_TIMEOUT_MS = readPositiveIntEnv('ADAPTER_FINALIZE_RETRY_TIMEOUT_MS', 90_000);
const FINALIZE_RETRY_INTERVAL_MS = readPositiveIntEnv('ADAPTER_POLL_INTERVAL_MS', 500);
const ADAPTER_FAIL_FAST_ENABLED = process.env.ADAPTER_FAIL_FAST !== '0';

let runtime: LocalRuntime | undefined;
let aztecNode: AztecNode;
let wallet: TestWallet | undefined;
let ownerAddress: AztecAddress;
let nodeInfo: Awaited<ReturnType<AztecNode['getNodeInfo']>>;
let aaveArtifact: ReturnType<typeof loadContractArtifact>;
let lidoArtifact: ReturnType<typeof loadContractArtifact>;
let uniswapArtifact: ReturnType<typeof loadContractArtifact>;
let adapterSuiteFatalError: Error | undefined;

function loadArtifactFromFile(path: string) {
  const artifactJson = JSON.parse(readFileSync(path, 'utf8'));
  return loadContractArtifact(artifactJson);
}

function parseUint(raw: string): bigint {
  return BigInt(raw.trim().split(' ')[0]);
}

async function assertInvalidConstructorArgs(
  artifact: ReturnType<typeof loadContractArtifact>,
  portalAddress: string,
): Promise<void> {
  await assert.rejects(async () => {
    await Contract.deploy(wallet, artifact, [
      AztecAddress.ZERO,
      EthAddress.fromString(portalAddress),
    ])
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
) {
  return Contract.deploy(wallet, artifact, [ownerAddress, EthAddress.fromString(portalAddress)])
    .send({ from: ownerAddress })
    .deployed();
}

async function assertRequestMessageSemantics(
  requestTxHash: Parameters<AztecNode['getTxEffect']>[0],
  adapterAddress: AztecAddress,
  portalAddress: string,
  content: Fr,
): Promise<void> {
  const txEffect = await aztecNode.getTxEffect(requestTxHash);
  assert.ok(txEffect, 'Expected tx effect for adapter request tx');

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
  testTag: string,
  l1SenderAddress: string,
  recipientAdapterAddress: AztecAddress,
  content: Fr,
  secret: Fr,
): Promise<Fr> {
  const secretHash = await computeSecretHash(secret);
  castSend(
    USER_PRIVATE_KEY,
    l1SenderAddress,
    'sendL2Message(address,bytes32,uint256,bytes32,bytes32)',
    [
      nodeInfo.l1ContractAddresses.inboxAddress.toString(),
      recipientAdapterAddress.toString(),
      nodeInfo.rollupVersion.toString(),
      content.toString(),
      secretHash.toString(),
    ],
  );

  const messageHashRaw = castCall(l1SenderAddress, 'lastMessageHash()(bytes32)');
  const messageLeafIndexRaw = castCall(l1SenderAddress, 'lastMessageIndex()(uint256)');
  const messageHashFromString = Fr.fromString(messageHashRaw.trim());
  const messageHashFromHex = Fr.fromHexString(messageHashRaw.trim());
  const messageLeafIndex = Fr.fromString(parseUint(messageLeafIndexRaw).toString());
  const canonicalMessageHash = new L1ToL2Message(
    new L1Actor(EthAddress.fromString(l1SenderAddress), nodeInfo.l1ChainId),
    new L2Actor(recipientAdapterAddress, nodeInfo.rollupVersion),
    content,
    secretHash,
    messageLeafIndex,
  ).hash();

  logValue(testTag, 'L1->L2 completion hash (raw)', messageHashRaw.trim());
  logValue(testTag, 'L1->L2 completion hash (Fr.fromString)', messageHashFromString.toString());
  logValue(testTag, 'L1->L2 completion hash (Fr.fromHexString)', messageHashFromHex.toString());
  logValue(testTag, 'L1->L2 completion hash (canonical)', canonicalMessageHash.toString());
  logValue(testTag, 'L1->L2 completion leaf index', messageLeafIndex.toString());

  const deadline = Date.now() + MESSAGE_READY_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const [messageBlockCanonical, messageBlockFromString, messageBlockFromHex, currentBlockNumber] =
      await Promise.all([
        aztecNode.getL1ToL2MessageBlock(canonicalMessageHash),
        aztecNode.getL1ToL2MessageBlock(messageHashFromString),
        aztecNode.getL1ToL2MessageBlock(messageHashFromHex),
        aztecNode.getBlockNumber(),
      ]);
    const resolvedMessageBlock =
      messageBlockCanonical !== undefined
        ? messageBlockCanonical
        : messageBlockFromString !== undefined
          ? messageBlockFromString
          : messageBlockFromHex;
    if (resolvedMessageBlock !== undefined && currentBlockNumber >= resolvedMessageBlock) {
      return messageLeafIndex;
    }
    await sleep(MESSAGE_READY_POLL_INTERVAL_MS);
  }

  throw new Error(
    `Timed out waiting for L1->L2 message to be ready after ${MESSAGE_READY_TIMEOUT_MS}ms`,
  );
}

async function finalizeWithRetry(label: string, finalize: () => Promise<void>): Promise<void> {
  const deadline = Date.now() + FINALIZE_RETRY_TIMEOUT_MS;
  let lastError: unknown;

  while (Date.now() < deadline) {
    try {
      await finalize();
      return;
    } catch (error) {
      lastError = error;
      await sleep(FINALIZE_RETRY_INTERVAL_MS);
    }
  }

  throw new Error(
    `${label} did not succeed within ${FINALIZE_RETRY_TIMEOUT_MS}ms.\n${
      lastError instanceof Error ? (lastError.stack ?? lastError.message) : String(lastError)
    }`,
  );
}

function toError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }
  return new Error(String(error));
}

function isAdapterSyncError(error: Error): boolean {
  const message = error.message;
  return (
    message.includes('Timed out waiting for L1->L2 message') ||
    message.includes('No L1 to L2 message found') ||
    message.includes('did not succeed within')
  );
}

async function withAdapterFailFast(
  t: TestContext,
  testTag: string,
  run: () => Promise<void>,
): Promise<void> {
  if (ADAPTER_FAIL_FAST_ENABLED && adapterSuiteFatalError) {
    t.skip(`Skipped due to prior adapter sync failure: ${adapterSuiteFatalError.message}`);
  }

  try {
    await run();
  } catch (error) {
    const typedError = toError(error);
    if (ADAPTER_FAIL_FAST_ENABLED && !adapterSuiteFatalError && isAdapterSyncError(typedError)) {
      adapterSuiteFatalError = typedError;
      logValue(testTag, 'Fail-fast trigger', typedError.message);
    }
    throw error;
  }
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
  'Aave adapter E2E: request/finalize lifecycle with failure cases',
  { timeout: 900_000 },
  async (t) => {
    const testTag = 'AZTEC-AAVE';
    await withAdapterFailFast(t, testTag, async () => {
      let step = 0;

      logStep(testTag, step++, 'Deploy L1 test sender and validate constructor failures');
      const l1SenderAddress = deployL1(L1_TO_L2_TEST_SENDER_SOURCE, CORE_MOCKS_SOLIDITY_DIR);
      await assertInvalidConstructorArgs(aaveArtifact, l1SenderAddress);

      logStep(testTag, step++, 'Deploy Aave adapter');
      const adapter = await deployAdapter(aaveArtifact, l1SenderAddress);
      logValue(testTag, 'Adapter', adapter.address.toString());
      logValue(testTag, 'L1 sender', l1SenderAddress);

      const asset = new Fr(111n);
      const amount = 1_000n;
      const referralCode = 7;
      const secret = new Fr(333_333n);
      const secretHash = await computeSecretHash(secret);

      logStep(testTag, step++, 'Assert invalid amount request fails');
      await assert.rejects(async () => {
        await adapter.methods
          .request_deposit(asset, 0n, referralCode, secretHash)
          .send({ from: ownerAddress })
          .wait();
      });

      const ownerHash = await poseidon2Hash([ownerAddress, secretHash]);
      const intentId = await poseidon2Hash([ownerHash, asset, amount, referralCode, 1]);
      const requestContent = await poseidon2Hash([
        intentId,
        ownerHash,
        asset,
        amount,
        referralCode,
        secretHash,
      ]);

      logStep(testTag, step++, 'Submit request_deposit and assert pending/message semantics');
      const requestReceipt = await adapter.methods
        .request_deposit(asset, amount, referralCode, secretHash)
        .send({ from: ownerAddress })
        .wait();
      assert.equal(
        await adapter.methods.is_deposit_pending(intentId).simulate({ from: ownerAddress }),
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
      logStep(testTag, step++, 'Enqueue completion message and finalize');
      const messageLeafIndex = await enqueueCompletionMessage(
        testTag,
        l1SenderAddress,
        adapter.address,
        finalizeContent,
        secret,
      );
      await finalizeWithRetry('finalize_deposit', async () => {
        await adapter.methods
          .finalize_deposit(intentId, shares, secret, messageLeafIndex)
          .send({ from: ownerAddress })
          .wait();
      });

      assert.equal(
        await adapter.methods.is_deposit_pending(intentId).simulate({ from: ownerAddress }),
        false,
      );

      logStep(testTag, step++, 'Assert finalize replay fails');
      await assert.rejects(async () => {
        await adapter.methods
          .finalize_deposit(intentId, shares, secret, messageLeafIndex)
          .send({ from: ownerAddress })
          .wait();
      });

      const withdrawAmount = 650n;
      const withdrawSecret = new Fr(444_444n);
      const withdrawSecretHash = await computeSecretHash(withdrawSecret);

      logStep(testTag, step++, 'Assert invalid withdraw amount request fails');
      await assert.rejects(async () => {
        await adapter.methods
          .request_withdraw(asset, 0n, withdrawSecretHash)
          .send({ from: ownerAddress })
          .wait();
      });

      const withdrawOwnerHash = await poseidon2Hash([ownerAddress, withdrawSecretHash]);
      const withdrawIntentId = await poseidon2Hash([withdrawOwnerHash, asset, withdrawAmount, 2]);
      const withdrawRequestContent = await poseidon2Hash([
        withdrawIntentId,
        withdrawOwnerHash,
        asset,
        withdrawAmount,
        withdrawSecretHash,
      ]);

      logStep(testTag, step++, 'Submit request_withdraw and assert pending/message semantics');
      const withdrawRequestReceipt = await adapter.methods
        .request_withdraw(asset, withdrawAmount, withdrawSecretHash)
        .send({ from: ownerAddress })
        .wait();
      assert.equal(
        await adapter.methods
          .is_withdraw_pending(withdrawIntentId)
          .simulate({ from: ownerAddress }),
        true,
      );
      await assertRequestMessageSemantics(
        withdrawRequestReceipt.txHash,
        adapter.address,
        l1SenderAddress,
        withdrawRequestContent,
      );

      const finalizedWithdrawAmount = 640n;
      const withdrawFinalizeContent = await poseidon2Hash([
        withdrawIntentId,
        finalizedWithdrawAmount,
        2,
      ]);
      logStep(testTag, step++, 'Enqueue withdraw completion message and finalize');
      const withdrawMessageLeafIndex = await enqueueCompletionMessage(
        testTag,
        l1SenderAddress,
        adapter.address,
        withdrawFinalizeContent,
        withdrawSecret,
      );
      await finalizeWithRetry('finalize_withdraw', async () => {
        await adapter.methods
          .finalize_withdraw(
            withdrawIntentId,
            finalizedWithdrawAmount,
            withdrawSecret,
            withdrawMessageLeafIndex,
          )
          .send({ from: ownerAddress })
          .wait();
      });

      assert.equal(
        await adapter.methods
          .is_withdraw_pending(withdrawIntentId)
          .simulate({ from: ownerAddress }),
        false,
      );

      logStep(testTag, step++, 'Assert finalize_withdraw replay fails');
      await assert.rejects(async () => {
        await adapter.methods
          .finalize_withdraw(
            withdrawIntentId,
            finalizedWithdrawAmount,
            withdrawSecret,
            withdrawMessageLeafIndex,
          )
          .send({ from: ownerAddress })
          .wait();
      });
    });
  },
);

test(
  'Lido adapter E2E: request/finalize lifecycle with failure cases',
  { timeout: 900_000 },
  async (t) => {
    const testTag = 'AZTEC-LIDO';
    await withAdapterFailFast(t, testTag, async () => {
      let step = 0;

      logStep(testTag, step++, 'Deploy L1 test sender and validate constructor failures');
      const l1SenderAddress = deployL1(L1_TO_L2_TEST_SENDER_SOURCE, CORE_MOCKS_SOLIDITY_DIR);
      await assertInvalidConstructorArgs(lidoArtifact, l1SenderAddress);

      logStep(testTag, step++, 'Deploy Lido adapter');
      const adapter = await deployAdapter(lidoArtifact, l1SenderAddress);
      logValue(testTag, 'Adapter', adapter.address.toString());
      logValue(testTag, 'L1 sender', l1SenderAddress);

      const amount = 1_500n;
      const recipient = new Fr(444n);
      const referral = new Fr(555n);
      const secret = new Fr(777_777n);
      const secretHash = await computeSecretHash(secret);

      logStep(testTag, step++, 'Assert invalid amount request fails');
      await assert.rejects(async () => {
        await adapter.methods
          .request_stake(0n, recipient, referral, secretHash)
          .send({ from: ownerAddress })
          .wait();
      });

      const ownerHash = await poseidon2Hash([ownerAddress, secretHash]);
      const intentId = await poseidon2Hash([ownerHash, amount, recipient, referral, 1, 1]);
      const requestContent = await poseidon2Hash([
        intentId,
        ownerHash,
        amount,
        recipient,
        referral,
        secretHash,
      ]);

      logStep(testTag, step++, 'Submit request_stake and assert pending/message semantics');
      const requestReceipt = await adapter.methods
        .request_stake(amount, recipient, referral, secretHash)
        .send({ from: ownerAddress })
        .wait();
      assert.equal(
        await adapter.methods.is_stake_pending(intentId).simulate({ from: ownerAddress }),
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
      logStep(testTag, step++, 'Enqueue completion message and finalize');
      const messageLeafIndex = await enqueueCompletionMessage(
        testTag,
        l1SenderAddress,
        adapter.address,
        finalizeContent,
        secret,
      );
      await finalizeWithRetry('finalize_stake', async () => {
        await adapter.methods
          .finalize_stake(intentId, shares, secret, messageLeafIndex)
          .send({ from: ownerAddress })
          .wait();
      });

      assert.equal(
        await adapter.methods.is_stake_pending(intentId).simulate({ from: ownerAddress }),
        false,
      );

      logStep(testTag, step++, 'Assert finalize replay fails');
      await assert.rejects(async () => {
        await adapter.methods
          .finalize_stake(intentId, shares, secret, messageLeafIndex)
          .send({ from: ownerAddress })
          .wait();
      });

      const unstakeAmount = 1_400n;
      const unstakeRecipient = new Fr(556n);
      const unstakeSecret = new Fr(888_888n);
      const unstakeSecretHash = await computeSecretHash(unstakeSecret);

      logStep(testTag, step++, 'Assert invalid unstake amount request fails');
      await assert.rejects(async () => {
        await adapter.methods
          .request_unstake(0n, unstakeRecipient, unstakeSecretHash)
          .send({ from: ownerAddress })
          .wait();
      });

      const unstakeOwnerHash = await poseidon2Hash([ownerAddress, unstakeSecretHash]);
      const unstakeIntentId = await poseidon2Hash([
        unstakeOwnerHash,
        unstakeAmount,
        unstakeRecipient,
        2,
      ]);
      const unstakeRequestContent = await poseidon2Hash([
        unstakeIntentId,
        unstakeOwnerHash,
        unstakeAmount,
        unstakeRecipient,
        unstakeSecretHash,
      ]);

      logStep(testTag, step++, 'Submit request_unstake and assert pending/message semantics');
      const unstakeRequestReceipt = await adapter.methods
        .request_unstake(unstakeAmount, unstakeRecipient, unstakeSecretHash)
        .send({ from: ownerAddress })
        .wait();
      assert.equal(
        await adapter.methods.is_unstake_pending(unstakeIntentId).simulate({ from: ownerAddress }),
        true,
      );
      await assertRequestMessageSemantics(
        unstakeRequestReceipt.txHash,
        adapter.address,
        l1SenderAddress,
        unstakeRequestContent,
      );

      const unlocked = 1_390n;
      const unstakeFinalizeContent = await poseidon2Hash([unstakeIntentId, unlocked, 2]);
      logStep(testTag, step++, 'Enqueue unstake completion message and finalize');
      const unstakeMessageLeafIndex = await enqueueCompletionMessage(
        testTag,
        l1SenderAddress,
        adapter.address,
        unstakeFinalizeContent,
        unstakeSecret,
      );
      await finalizeWithRetry('finalize_unstake', async () => {
        await adapter.methods
          .finalize_unstake(unstakeIntentId, unlocked, unstakeSecret, unstakeMessageLeafIndex)
          .send({ from: ownerAddress })
          .wait();
      });

      assert.equal(
        await adapter.methods.is_unstake_pending(unstakeIntentId).simulate({ from: ownerAddress }),
        false,
      );

      logStep(testTag, step++, 'Assert finalize_unstake replay fails');
      await assert.rejects(async () => {
        await adapter.methods
          .finalize_unstake(unstakeIntentId, unlocked, unstakeSecret, unstakeMessageLeafIndex)
          .send({ from: ownerAddress })
          .wait();
      });
    });
  },
);

test(
  'Uniswap adapter E2E: request/finalize lifecycle with failure cases',
  { timeout: 900_000 },
  async (t) => {
    const testTag = 'AZTEC-UNISWAP';
    await withAdapterFailFast(t, testTag, async () => {
      let step = 0;

      logStep(testTag, step++, 'Deploy L1 test sender and validate constructor failures');
      const l1SenderAddress = deployL1(L1_TO_L2_TEST_SENDER_SOURCE, CORE_MOCKS_SOLIDITY_DIR);
      await assertInvalidConstructorArgs(uniswapArtifact, l1SenderAddress);

      logStep(testTag, step++, 'Deploy Uniswap adapter');
      const adapter = await deployAdapter(uniswapArtifact, l1SenderAddress);
      logValue(testTag, 'Adapter', adapter.address.toString());
      logValue(testTag, 'L1 sender', l1SenderAddress);

      const tokenIn = new Fr(0x0abcdn);
      const tokenOut = new Fr(0x0beefn);
      const amountIn = 2_000n;
      const minAmountOut = 1_850n;
      const fee = 3_000;
      const recipient = new Fr(666n);
      const secret = new Fr(999_999n);
      const secretHash = await computeSecretHash(secret);

      logStep(testTag, step++, 'Assert invalid amount request fails');
      await assert.rejects(async () => {
        await adapter.methods
          .request_swap(tokenIn, tokenOut, 0n, minAmountOut, fee, recipient, secretHash)
          .send({ from: ownerAddress })
          .wait();
      });

      logStep(testTag, step++, 'Assert invalid fee request fails');
      await assert.rejects(async () => {
        await adapter.methods
          .request_swap(tokenIn, tokenOut, amountIn, minAmountOut, 0, recipient, secretHash)
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

      logStep(testTag, step++, 'Submit request_swap and assert pending/message semantics');
      const requestReceipt = await adapter.methods
        .request_swap(tokenIn, tokenOut, amountIn, minAmountOut, fee, recipient, secretHash)
        .send({ from: ownerAddress })
        .wait();
      assert.equal(
        await adapter.methods.is_swap_pending(intentId).simulate({ from: ownerAddress }),
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
      logStep(testTag, step++, 'Enqueue completion message and finalize');
      const messageLeafIndex = await enqueueCompletionMessage(
        testTag,
        l1SenderAddress,
        adapter.address,
        finalizeContent,
        secret,
      );
      await finalizeWithRetry('finalize_swap', async () => {
        await adapter.methods
          .finalize_swap(intentId, amountOut, secret, messageLeafIndex)
          .send({ from: ownerAddress })
          .wait();
      });

      assert.equal(
        await adapter.methods.is_swap_pending(intentId).simulate({ from: ownerAddress }),
        false,
      );

      logStep(testTag, step++, 'Assert finalize replay fails');
      await assert.rejects(async () => {
        await adapter.methods
          .finalize_swap(intentId, amountOut, secret, messageLeafIndex)
          .send({ from: ownerAddress })
          .wait();
      });
    });
  },
);
