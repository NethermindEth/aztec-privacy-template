import type { ExampleOverlayName } from '../constants.js';

export type TemplateMode = 'base' | 'overlay';
export type BaseTemplateName = 'base';
export type OverlayTemplateName = ExampleOverlayName;
export type TemplateName = BaseTemplateName | OverlayTemplateName;

export interface BaseTemplateDefinition {
  mode: 'base';
  name: BaseTemplateName;
  sourceDir: string;
  copyEntries: readonly string[];
}

export interface OverlayTemplateDefinition {
  mode: 'overlay';
  name: OverlayTemplateName;
  sourceDir: string;
}

export interface TemplateInstallPlan {
  base: BaseTemplateDefinition;
  overlays: OverlayTemplateDefinition[];
}
