import { Box, Stack, Text, Group } from '@mantine/core';
import {
  IconCircleCheck,
  IconCircleDot,
  IconCircle,
  IconLoader2,
  IconFileText,
  IconEdit,
} from '@tabler/icons-react';
import { useWorkbenchStore } from '@/store/workbench';
import type { StepStatus } from '@/types';

function StepIcon({ status }: Readonly<{ status: StepStatus }>) {
  if (status === 'done')
    return <IconCircleCheck size={14} style={{ color: 'var(--accent)', flexShrink: 0 }} />;
  if (status === 'generating')
    return (
      <IconLoader2 size={14} className="spin" style={{ color: 'var(--accent)', flexShrink: 0 }} />
    );
  if (status === 'selecting')
    return <IconCircleDot size={14} style={{ color: 'var(--accent)', flexShrink: 0 }} />;
  if (status === 'input')
    return <IconEdit size={14} style={{ color: 'var(--accent)', flexShrink: 0 }} />;
  return <IconCircle size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />;
}

function stepTextColor(isActive: boolean, isDone: boolean): string {
  if (isActive) return 'var(--accent)';
  if (isDone) return 'var(--text-primary)';
  return 'var(--text-secondary)';
}

export function StepProgress() {
  const { steps, currentStepIndex, workflowPhase, goToStep, goToPreview, goToInventors, artifact } =
    useWorkbenchStore();

  const step01Done = steps[0]?.status === 'done';
  const specialUnlocked = step01Done;
  const isInventorsActive = workflowPhase === 'inventors';
  const isPreviewActive = workflowPhase === 'preview';

  return (
    <Stack gap={2} p={16}>
      <Text
        size="xs"
        fw={700}
        tt="uppercase"
        ff="monospace"
        mb={10}
        style={{ color: 'var(--text-muted)', letterSpacing: '0.1em' }}
      >
        Workflow
      </Text>

      {steps.map((step, i) => {
        const isActive = i === currentStepIndex && workflowPhase === 'working';
        const isDone = step.status === 'done';
        const isFuture = i > currentStepIndex && step.status === 'pending';
        const canNavigate = step.status !== 'pending';

        return (
          <Box
            key={step.moduleId}
            onClick={() => canNavigate && goToStep(i)}
            style={{
              padding: '8px 10px',
              borderRadius: 4,
              border: isActive ? '1px solid var(--accent)' : '1px solid transparent',
              background: isActive ? 'var(--surface-active)' : 'transparent',
              cursor: canNavigate ? 'pointer' : 'default',
              opacity: isFuture ? 0.45 : 1,
              transition: 'all 0.15s ease',
            }}
          >
            <Group gap={8} wrap="nowrap">
              <StepIcon status={step.status} />
              <Box style={{ flex: 1, minWidth: 0 }}>
                <Text
                  size="xs"
                  fw={isActive ? 700 : 600}
                  ff="monospace"
                  style={{
                    fontSize: 11,
                    letterSpacing: '0.04em',
                    color: stepTextColor(isActive, isDone),
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {String(i + 1).padStart(2, '0')} · {step.label.toUpperCase()}
                </Text>
                {isDone && step.promptTokens + step.completionTokens > 0 && (
                  <Text
                    size="xs"
                    ff="monospace"
                    style={{ color: 'var(--text-muted)', fontSize: 10, marginTop: 1 }}
                  >
                    {step.promptTokens + step.completionTokens}t
                  </Text>
                )}
              </Box>
            </Group>
          </Box>
        );
      })}

      {/* Step 09 · Inventors */}
      <Box
        onClick={() => specialUnlocked && goToInventors()}
        style={{
          padding: '8px 10px',
          borderRadius: 4,
          border: isInventorsActive ? '1px solid var(--accent)' : '1px solid transparent',
          background: isInventorsActive ? 'var(--surface-active)' : 'transparent',
          cursor: specialUnlocked ? 'pointer' : 'default',
          opacity: specialUnlocked ? 1 : 0.35,
          transition: 'all 0.15s ease',
        }}
      >
        <Group gap={8} wrap="nowrap">
          {artifact?.inventors.length ? (
            <IconCircleCheck size={14} style={{ color: 'var(--accent)', flexShrink: 0 }} />
          ) : (
            <IconCircle size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          )}
          <Text
            size="xs"
            fw={isInventorsActive ? 700 : 600}
            ff="monospace"
            style={{
              fontSize: 11,
              letterSpacing: '0.04em',
              color: isInventorsActive ? 'var(--accent)' : 'var(--text-secondary)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            09 · INVENTORS
          </Text>
        </Group>
      </Box>

      {/* Step 10 · Preview & Export */}
      <Box
        onClick={() => specialUnlocked && goToPreview()}
        style={{
          padding: '8px 10px',
          borderRadius: 4,
          border: isPreviewActive ? '1px solid var(--accent)' : '1px solid transparent',
          background: isPreviewActive ? 'var(--surface-active)' : 'transparent',
          cursor: specialUnlocked ? 'pointer' : 'default',
          opacity: specialUnlocked ? 1 : 0.35,
          transition: 'all 0.15s ease',
        }}
      >
        <Group gap={8} wrap="nowrap">
          <IconFileText
            size={14}
            style={{
              color: isPreviewActive ? 'var(--accent)' : 'var(--text-muted)',
              flexShrink: 0,
            }}
          />
          <Text
            size="xs"
            fw={isPreviewActive ? 700 : 600}
            ff="monospace"
            style={{
              fontSize: 11,
              letterSpacing: '0.04em',
              color: isPreviewActive ? 'var(--accent)' : 'var(--text-secondary)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            10 · PREVIEW & EXPORT
          </Text>
        </Group>
      </Box>
    </Stack>
  );
}
