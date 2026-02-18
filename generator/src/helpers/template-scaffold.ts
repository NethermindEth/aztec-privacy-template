import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import {
  type ExampleSelection,
  STARTER_PACKAGE_JSON_BASE,
  type PackageManager,
} from '../constants.js';
import {
  applyPlaceholdersInSelectedFiles,
  assertNoUnresolvedPlaceholders,
  getPlaceholderMap,
} from '../placeholders.js';
import { installTemplatePlan, resolveTemplateInstallPlan } from '../templates/index.js';

export interface ScaffoldTemplateOptions {
  generatorRoot: string;
  absoluteTargetPath: string;
  projectName: string;
  packageManager: PackageManager;
  exampleSelection?: ExampleSelection;
}

export async function scaffoldTemplate(options: ScaffoldTemplateOptions): Promise<void> {
  const {
    generatorRoot,
    absoluteTargetPath,
    projectName,
    packageManager,
    exampleSelection = 'none',
  } = options;

  const templatePlan = resolveTemplateInstallPlan(generatorRoot, exampleSelection);
  await installTemplatePlan(absoluteTargetPath, templatePlan);

  const packageJson = {
    ...STARTER_PACKAGE_JSON_BASE,
    name: projectName,
  };

  await writeFile(
    join(absoluteTargetPath, 'package.json'),
    `${JSON.stringify(packageJson, null, 2)}\n`,
    'utf8',
  );

  const placeholderMap = getPlaceholderMap(projectName, packageManager);
  await applyPlaceholdersInSelectedFiles(absoluteTargetPath, placeholderMap);
  await assertNoUnresolvedPlaceholders(absoluteTargetPath);
}
