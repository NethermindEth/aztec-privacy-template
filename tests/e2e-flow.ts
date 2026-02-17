import { strict as assert } from 'node:assert';
import {
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
  logStep,
  logValue,
  provisionPrivateTokenBalance,
  stopProcess,
  type LocalRuntime,
} from './runtime';

export type ProtocolMock = {
  label: string;
  source: string;
  contractsDir: string;
};

type PortalConstructorArgsContext = {
  protocolId: string;
  userAddress: string;
  relayerAddress: string;
  deployedMocks: Record<string, string>;
};

export type ProtocolFlowContext = {
  tag: string;
  protocolId: string;
  userAddress: string;
  relayerAddress: string;
  ownerAddress: string;
  privateBalance: string;
  content: string;
  portalAddress: string;
  requestHash: string;
  mocks: Record<string, string>;
  runtime: LocalRuntime;
};

export type ProtocolFlowSpec = {
  tag: string;
  protocolId: string;
  aztec: {
    dir: string;
    tokenName: string;
    tokenSymbol: string;
    tokenAmount: bigint;
  };
  buildContent: (ownerAddress: string, balance: string) => string;
  portal: {
    source: string;
    contractsDir: string;
    constructorArgs: (ctx: PortalConstructorArgsContext) => string[];
  };
  mocks: ProtocolMock[];
  request: {
    signature: string;
    args: (ctx: ProtocolFlowContext) => string[];
  };
  requestHashArgs?: (ctx: ProtocolFlowContext) => string[];
  execute: {
    signature: string;
    args: (ctx: ProtocolFlowContext) => string[];
    valueWei?: string;
  };
  setup?: (ctx: ProtocolFlowContext) => Promise<void> | void;
  assertState: (ctx: ProtocolFlowContext) => Promise<void> | void;
};

const DEFAULT_REQUEST_HASH_ARGS = (ctx: ProtocolFlowContext): string[] => [
  ctx.content,
  ctx.userAddress,
  '1',
];

export async function runProtocolE2EHappyPath(spec: ProtocolFlowSpec): Promise<void> {
  let step = 0;

  logStep(spec.tag, step++, 'Start local Aztec + L1 runtime');
  const runtime: LocalRuntime = await ensureAztecLocalNetwork();

  try {
    logStep(spec.tag, step++, 'Compile Aztec adapter');
    compileAztecContract(spec.aztec.dir);

    logStep(spec.tag, step++, 'Provision private Aztec token balance');
    const aztecState = await provisionPrivateTokenBalance(
      spec.aztec.tokenName,
      spec.aztec.tokenSymbol,
      spec.aztec.tokenAmount,
    );
    logValue(spec.tag, 'Aztec owner', aztecState.ownerAddress);
    logValue(spec.tag, 'Aztec private balance', aztecState.balance);

    logStep(spec.tag, step++, 'Build request content hash');
    const content = castKeccak(
      spec.buildContent(aztecState.ownerAddress, aztecState.balance.toString()),
    );
    logValue(spec.tag, 'Request content hash', content);

    logStep(spec.tag, step++, 'Deploy L1 dependencies');
    const deployedMocks: Record<string, string> = {};
    for (const mock of spec.mocks) {
      const deployed = deployL1(mock.source, mock.contractsDir);
      deployedMocks[mock.label] = deployed;
      logValue(spec.tag, `Mock ${mock.label}`, deployed);
    }

    const portalArgs = spec.portal.constructorArgs({
      protocolId: spec.protocolId,
      userAddress: USER_ADDRESS,
      relayerAddress: RELAYER_ADDRESS,
      deployedMocks,
    });

    const portalAddress = deployL1(spec.portal.source, spec.portal.contractsDir, portalArgs);
    logValue(spec.tag, 'Portal', portalAddress);

    const baseContext: ProtocolFlowContext = {
      tag: spec.tag,
      protocolId: spec.protocolId,
      userAddress: USER_ADDRESS,
      relayerAddress: RELAYER_ADDRESS,
      ownerAddress: aztecState.ownerAddress,
      privateBalance: aztecState.balance.toString(),
      content,
      portalAddress,
      requestHash: '',
      mocks: deployedMocks,
      runtime,
    };

    if (spec.setup) {
      logStep(spec.tag, step++, 'Protocol-specific setup');
      await spec.setup(baseContext);
    }

    logStep(spec.tag, step++, 'Submit request to portal');
    const requestArgs = spec.request.args(baseContext);
    castSend(USER_PRIVATE_KEY, portalAddress, spec.request.signature, requestArgs);

    const requestHashArgs = (spec.requestHashArgs ?? DEFAULT_REQUEST_HASH_ARGS)(baseContext);
    const requestHash = castCall(
      portalAddress,
      'messageHashFor(bytes32,address,uint64)(bytes32)',
      requestHashArgs,
    );
    logValue(spec.tag, 'Request hash', requestHash);

    logStep(spec.tag, step++, 'Execute request on relayer');
    const executionContext: ProtocolFlowContext = {
      ...baseContext,
      requestHash,
    };

    const executeArgs = spec.execute.args(executionContext);
    castSend(
      RELAYER_PRIVATE_KEY,
      portalAddress,
      spec.execute.signature,
      executeArgs,
      spec.execute.valueWei,
    );

    logStep(spec.tag, step++, 'Assert consumed request state');
    const consumed = castCall(portalAddress, 'hasMessageBeenConsumed(bytes32)(bool)', [
      requestHash,
    ]);
    assert.equal(consumed, 'true');

    await spec.assertState(executionContext);
  } finally {
    await stopProcess(runtime.process);
  }
}
