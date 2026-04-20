import type { RegTemplate } from '@/types';
import { WORKFLOW_ORDER } from '@/utils/workflowTemplates';

export const TEMPLATE_REQUIRED_VARS = ['{{numOptions}}', '{{plural}}'] as const;

export interface TemplateErrors {
  [stepId: string]: {
    systemContext?: string;
    promptSuffix?: string;
    guidedPromptSuffix?: string;
  };
}

type TFn = (key: string, params?: Record<string, string>) => string;

function missingVarErrors(value: string, t: TFn): string {
  return TEMPLATE_REQUIRED_VARS.filter((v) => !value.includes(v))
    .map((v) => t('res_TemplateVarMissing', { var: v }))
    .join('  ');
}

export function collectTemplateErrors(steps: RegTemplate['steps'], t: TFn): TemplateErrors {
  const errors: TemplateErrors = {};
  for (const id of WORKFLOW_ORDER) {
    const step = steps[id];
    if (!step) continue;
    const stepErrors: TemplateErrors[string] = {};

    const syserr = missingVarErrors(step.systemContext, t);
    if (syserr) stepErrors.systemContext = syserr;

    const sufferr = missingVarErrors(step.promptSuffix ?? '', t);
    if (sufferr) stepErrors.promptSuffix = sufferr;

    if (step.guidedPromptSuffix !== undefined) {
      const guerr = missingVarErrors(step.guidedPromptSuffix, t);
      if (guerr) stepErrors.guidedPromptSuffix = guerr;
    }

    if (Object.keys(stepErrors).length) errors[id] = stepErrors;
  }
  return errors;
}
