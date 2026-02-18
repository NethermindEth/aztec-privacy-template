import { scaffoldTemplate, type ScaffoldTemplateOptions } from './helpers/template-scaffold.js';

export type ScaffoldOptions = ScaffoldTemplateOptions;

export async function scaffoldBaseTemplate(options: ScaffoldOptions): Promise<void> {
  await scaffoldTemplate(options);
}
