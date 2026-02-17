import { uniswapSpec } from './uniswap';
import { runProtocolLifecycleHarness } from '../harness';

runProtocolLifecycleHarness({
  protocol: 'uniswap',
  spec: uniswapSpec,
  actions: ['swap'],
  mode: 'relayer',
});

runProtocolLifecycleHarness({
  protocol: 'uniswap',
  spec: uniswapSpec,
  actions: ['swap'],
  mode: 'self-execution',
});
