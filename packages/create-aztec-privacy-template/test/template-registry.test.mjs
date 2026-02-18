import assert from 'node:assert/strict';
import { dirname, join, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { getOverlayTemplateNames, resolveTemplateInstallPlan } from '../dist/templates/index.js';

const PACKAGE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

test('resolveTemplateInstallPlan returns base template with deterministic overlays', () => {
  const nonePlan = resolveTemplateInstallPlan(PACKAGE_ROOT, 'none');
  assert.equal(nonePlan.base.name, 'base');
  assert.deepEqual(getOverlayTemplateNames(nonePlan), []);

  const aavePlan = resolveTemplateInstallPlan(PACKAGE_ROOT, 'aave');
  assert.deepEqual(getOverlayTemplateNames(aavePlan), ['aave']);

  const lidoPlan = resolveTemplateInstallPlan(PACKAGE_ROOT, 'lido');
  assert.deepEqual(getOverlayTemplateNames(lidoPlan), ['lido']);

  const uniswapPlan = resolveTemplateInstallPlan(PACKAGE_ROOT, 'uniswap');
  assert.deepEqual(getOverlayTemplateNames(uniswapPlan), ['uniswap']);

  const allPlan = resolveTemplateInstallPlan(PACKAGE_ROOT, 'all');
  assert.deepEqual(getOverlayTemplateNames(allPlan), ['aave', 'lido', 'uniswap']);
});

test('resolveTemplateInstallPlan resolves source paths from generator root', () => {
  const plan = resolveTemplateInstallPlan(PACKAGE_ROOT, 'aave');

  assert.equal(plan.base.sourceDir, join(PACKAGE_ROOT, 'scaffold'));
  assert.equal(plan.overlays[0].sourceDir, join(PACKAGE_ROOT, 'overlays', 'examples', 'aave'));
});
