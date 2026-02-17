import { lidoSpec } from './lido';
import { runProtocolLifecycleHarness } from '../harness';

runProtocolLifecycleHarness({
  protocol: 'lido',
  spec: lidoSpec,
  actions: ['stake', 'unstake'],
  mode: 'relayer',
});

runProtocolLifecycleHarness({
  protocol: 'lido',
  spec: lidoSpec,
  actions: ['stake', 'unstake'],
  mode: 'self-execution',
});
