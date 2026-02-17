import { aaveSpec } from './aave';
import { runProtocolLifecycleHarness } from '../harness';

runProtocolLifecycleHarness({
  protocol: 'aave',
  spec: aaveSpec,
  actions: ['deposit', 'withdraw'],
  mode: 'relayer',
});

runProtocolLifecycleHarness({
  protocol: 'aave',
  spec: aaveSpec,
  actions: ['deposit', 'withdraw'],
  mode: 'self-execution',
});
