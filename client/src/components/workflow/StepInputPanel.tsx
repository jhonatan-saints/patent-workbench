import {
  Box,
  Stack,
  Text,
  Button,
  Textarea,
  TextInput,
  Group,
  SegmentedControl,
} from '@mantine/core';
import {
  IconWand,
  IconForms,
  IconPencil,
  IconPlayerStop,
} from '@tabler/icons-react';
import { useWorkbenchStore } from '@/store/workbench';
import { WORKFLOW_MODULES } from '@/utils/workflowTemplates';
import type { WorkflowModuleId, InputMode } from '@/types';

const LABEL_STYLES = {
  fontFamily: 'var(--font-mono)',
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: '0.06em',
  textTransform: 'uppercase' as const,
  color: 'var(--text-secondary)',
};

const INPUT_STYLES = {
  label: LABEL_STYLES,
  description: { color: 'var(--text-muted)', fontSize: 12 },
  input: {
    background: 'var(--surface-raised)',
    border: '1px solid var(--border)',
    color: 'var(--text-primary)',
  },
};


interface Props {
  readonly moduleId: WorkflowModuleId;
}

export function StepInputPanel({ moduleId }: Props) {
  const {
    artifact,
    steps,
    currentStepIndex,
    generationStatus,
    generateStepOptions,
    cancelGeneration,
    submitManualContent,
    setStepInputState,
  } = useWorkbenchStore();

  const module = WORKFLOW_MODULES[moduleId];
  const isGenerating = generationStatus === 'loading';

  const step = steps[currentStepIndex];
  const mode: InputMode = step?.inputMode ?? 'auto';
  const guidedFields: Record<string, string> = step?.guidedFields ?? {};
  const manualText: string = step?.manualDraft ?? '';

  const setMode = (m: InputMode) => setStepInputState(currentStepIndex, { inputMode: m });
  const setField = (key: string, value: string) =>
    setStepInputState(currentStepIndex, { guidedFields: { ...guidedFields, [key]: value } });
  const setManualText = (value: string) =>
    setStepInputState(currentStepIndex, { manualDraft: value });

  const handleGenerate = () => {
    if (mode === 'auto') {
      generateStepOptions();
    } else if (mode === 'guided' && artifact) {
      const guidedPrompt = `${module.systemContext}\n\n---\n\n${module.buildGuidedPrompt(artifact, guidedFields)}`;
      generateStepOptions(guidedPrompt);
    }
  };

  const handleManualConfirm = () => {
    if (manualText.trim()) submitManualContent(manualText.trim());
  };

  return (
    <Box style={{ maxWidth: 540, margin: '0 auto', padding: '24px 0' }}>
      <style>{`.step-seg [data-active] { color: var(--accent-text) !important; font-weight: 700; }`}</style>
      {/* Mode selector */}
      <SegmentedControl
        classNames={{ root: 'step-seg' }}
        fullWidth
        value={mode}
        onChange={(v) => setMode(v as InputMode)}
        disabled={isGenerating}
        mb={20}
        data={[
          {
            value: 'auto',
            label: (
              <Group gap={5} justify="center">
                <IconWand size={12} />
                <span>Auto</span>
              </Group>
            ),
          },
          {
            value: 'guided',
            label: (
              <Group gap={5} justify="center">
                <IconForms size={12} />
                <span>Guided</span>
              </Group>
            ),
          },
          {
            value: 'manual',
            label: (
              <Group gap={5} justify="center">
                <IconPencil size={12} />
                <span>Manual</span>
              </Group>
            ),
          },
        ]}
        styles={{
          root: {
            background: 'var(--surface)',
            border: '1px solid var(--border)',
          },
          indicator: { background: 'var(--accent)' },
          label: {
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: '0.05em',
            color: 'var(--text-secondary)',
          },
        }}
      />

      {/* AUTO mode */}
      {mode === 'auto' && (
        <Stack gap={12}>
          {artifact && (
            <Box
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                  padding: '10px 14px',
                }}
              >
                <Stack gap={6}>
                  <Text size="xs" ff="monospace" fw={700} style={{ color: 'var(--text-muted)', letterSpacing: '0.08em' }}>
                    CONTEXT
                  </Text>
                  <Text size="xs" style={{ color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>Idea · </span>
                    {artifact.baseIdea}
                  </Text>
                  {artifact.baseDomain && (
                    <Text size="xs" style={{ color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                      <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>Domain · </span>
                      {artifact.baseDomain}
                    </Text>
                  )}
                  {artifact.constraints && (
                    <Text size="xs" style={{ color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                      <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>Notes · </span>
                      {artifact.constraints}
                    </Text>
                  )}
                </Stack>
              </Box>
          )}
          {isGenerating ? (
            <Button
              leftSection={<IconPlayerStop size={13} />}
              onClick={cancelGeneration}
              size="sm"
              style={{
                background: '#c0392b',
                color: '#fff',
                fontFamily: 'var(--font-mono)',
                fontWeight: 700,
                fontSize: 12,
                letterSpacing: '0.08em',
                border: 'none',
              }}
            >
              STOP GENERATION
            </Button>
          ) : (
            <Button
              leftSection={<IconWand size={13} />}
              onClick={handleGenerate}
              size="sm"
              style={{
                background: 'var(--accent)',
                color: 'var(--accent-text)',
                fontFamily: 'var(--font-mono)',
                fontWeight: 700,
                fontSize: 12,
                letterSpacing: '0.08em',
                border: 'none',
              }}
            >
              GENERATE
            </Button>
          )}
        </Stack>
      )}

      {/* GUIDED mode */}
      {mode === 'guided' && (
        <Stack gap={14}>
          <Text size="sm" c="var(--text-muted)" style={{ lineHeight: 1.6 }}>
            Fill in specific details to guide the generation for this section.
          </Text>

          {module.guidedFields.map((field) =>
            field.type === 'textarea' ? (
              <Textarea
                aria-label={field.label}
                key={field.key}
                label={field.label}
                placeholder={field.placeholder}
                value={guidedFields[field.key] ?? ''}
                onChange={(e) => setField(field.key, e.currentTarget.value)}
                minRows={3}
                maxRows={6}
                disabled={isGenerating}
                styles={INPUT_STYLES}
              />
            ) : (
              <TextInput
                key={field.key}
                label={field.label}
                placeholder={field.placeholder}
                value={guidedFields[field.key] ?? ''}
                onChange={(e) => setField(field.key, e.currentTarget.value)}
                disabled={isGenerating}
                styles={INPUT_STYLES}
              />
            )
          )}

          {isGenerating ? (
            <Button
              leftSection={<IconPlayerStop size={13} />}
              onClick={cancelGeneration}
              size="sm"
              style={{
                background: '#c0392b',
                color: '#fff',
                fontFamily: 'var(--font-mono)',
                fontWeight: 700,
                fontSize: 12,
                letterSpacing: '0.08em',
                border: 'none',
              }}
            >
              STOP GENERATION
            </Button>
          ) : (
            <Button
              leftSection={<IconForms size={13} />}
              onClick={handleGenerate}
              size="sm"
              style={{
                background: 'var(--accent)',
                color: 'var(--accent-text)',
                fontFamily: 'var(--font-mono)',
                fontWeight: 700,
                fontSize: 12,
                letterSpacing: '0.08em',
                border: 'none',
              }}
            >
              GENERATE
            </Button>
          )}
        </Stack>
      )}

      {/* MANUAL mode */}
      {mode === 'manual' && (
        <Stack gap={14}>
          <Text size="sm" c="var(--text-muted)" style={{ lineHeight: 1.6 }}>
            Write or paste the content directly. This will be used as-is for this section.
          </Text>
          <Textarea
            label={`${module.label} — Manual Entry`}
            placeholder={`Write the ${module.label.toLowerCase()} content directly...`}
            value={manualText}
            onChange={(e) => setManualText(e.currentTarget.value)}
            minRows={8}
            maxRows={16}
            styles={INPUT_STYLES}
          />
          <Button
            leftSection={<IconPencil size={13} />}
            onClick={handleManualConfirm}
            disabled={!manualText.trim()}
            size="sm"
            style={{
              background: manualText.trim() ? 'var(--accent)' : 'var(--surface-raised)',
              color: manualText.trim() ? 'var(--accent-text)' : 'var(--text-muted)',
              fontFamily: 'var(--font-mono)',
              fontWeight: 700,
              fontSize: 12,
              letterSpacing: '0.08em',
              border: 'none',
            }}
          >
            CONFIRM MANUAL ENTRY
          </Button>
        </Stack>
      )}
    </Box>
  );
}
