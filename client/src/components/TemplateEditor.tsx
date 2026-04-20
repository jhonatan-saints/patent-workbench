import { Accordion, Textarea, Text, Stack } from '@mantine/core';
import type { RegTemplate } from '@/types';
import { WORKFLOW_ORDER } from '@/utils/workflowTemplates';
import { useI18n } from '@/i18n';

const FIELD = { label: { fontFamily: 'monospace', fontSize: 11 } } as const;

interface Props {
  readonly steps: RegTemplate['steps'];
  readonly patchStep: (id: string, key: string, value: string) => void;
}

export function TemplateEditor({ steps, patchStep }: Props) {
  const { t } = useI18n();

  return (
    <Accordion variant="separated" chevronSize={14}>
      {WORKFLOW_ORDER.map((id) => {
        const step = steps[id];
        if (!step) return null;
        return (
          <Accordion.Item key={id} value={id}>
            <Accordion.Control py={6}>
              <Text size="xs" ff="monospace">
                {step.label || id}
              </Text>
            </Accordion.Control>
            <Accordion.Panel>
              <Stack gap="xs">
                <Textarea
                  label={t('res_TemplateSystemContext')}
                  value={step.systemContext}
                  onChange={(e) => patchStep(id, 'systemContext', e.target.value)}
                  maxLength={8_000}
                  autosize
                  minRows={3}
                  maxRows={10}
                  styles={FIELD}
                />
                <Textarea
                  label={t('res_TemplatePromptSuffix')}
                  value={step.promptSuffix ?? ''}
                  onChange={(e) => patchStep(id, 'promptSuffix', e.target.value)}
                  maxLength={512}
                  autosize
                  minRows={2}
                  maxRows={5}
                  styles={FIELD}
                />
                {step.guidedPromptSuffix !== undefined && (
                  <Textarea
                    label={t('res_TemplateGuidedPromptSuffix')}
                    value={step.guidedPromptSuffix}
                    onChange={(e) => patchStep(id, 'guidedPromptSuffix', e.target.value)}
                    maxLength={1_024}
                    autosize
                    minRows={2}
                    maxRows={5}
                    styles={FIELD}
                  />
                )}
              </Stack>
            </Accordion.Panel>
          </Accordion.Item>
        );
      })}
    </Accordion>
  );
}
