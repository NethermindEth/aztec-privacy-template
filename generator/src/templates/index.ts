import { cp, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

import {
  EXAMPLE_OVERLAY_ORDER,
  type ExampleOverlayName,
  type ExampleSelection,
  OVERLAY_EXAMPLES_DIR,
  SCAFFOLD_DIR,
  TEMPLATE_COPY_ENTRIES,
} from '../constants.js';
import type {
  BaseTemplateDefinition,
  OverlayTemplateDefinition,
  TemplateInstallPlan,
  OverlayTemplateName,
} from './types.js';

export function resolveTemplateInstallPlan(
  generatorRoot: string,
  exampleSelection: ExampleSelection,
): TemplateInstallPlan {
  return {
    base: getBaseTemplate(generatorRoot),
    overlays: resolveOverlayTemplates(generatorRoot, exampleSelection),
  };
}

export async function installTemplatePlan(
  absoluteTargetPath: string,
  plan: TemplateInstallPlan,
): Promise<void> {
  await mkdir(absoluteTargetPath, { recursive: true });

  for (const entry of plan.base.copyEntries) {
    const sourcePath = join(plan.base.sourceDir, entry);
    const destinationEntry = entry === 'gitignore' ? '.gitignore' : entry;
    const destinationPath = join(absoluteTargetPath, destinationEntry);

    await cp(sourcePath, destinationPath, {
      recursive: true,
      errorOnExist: true,
      force: false,
      preserveTimestamps: true,
    });
  }

  for (const overlay of plan.overlays) {
    await cp(overlay.sourceDir, absoluteTargetPath, {
      recursive: true,
      errorOnExist: false,
      force: true,
      preserveTimestamps: true,
    });
  }
}

function getBaseTemplate(generatorRoot: string): BaseTemplateDefinition {
  return {
    mode: 'base',
    name: 'base',
    sourceDir: join(generatorRoot, SCAFFOLD_DIR),
    copyEntries: TEMPLATE_COPY_ENTRIES,
  };
}

function resolveOverlayTemplates(
  generatorRoot: string,
  exampleSelection: ExampleSelection,
): OverlayTemplateDefinition[] {
  if (exampleSelection === 'none') {
    return [];
  }

  const overlayNames = exampleSelection === 'all' ? [...EXAMPLE_OVERLAY_ORDER] : [exampleSelection];

  return overlayNames.map((name) => getOverlayTemplate(generatorRoot, name));
}

function getOverlayTemplate(
  generatorRoot: string,
  overlayName: OverlayTemplateName,
): OverlayTemplateDefinition {
  return {
    mode: 'overlay',
    name: overlayName,
    sourceDir: join(generatorRoot, OVERLAY_EXAMPLES_DIR, overlayName),
  };
}

export function getOverlayTemplateNames(plan: TemplateInstallPlan): ExampleOverlayName[] {
  return plan.overlays.map((overlay) => overlay.name);
}
