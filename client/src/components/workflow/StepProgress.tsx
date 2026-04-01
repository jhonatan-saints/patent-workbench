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

function FiguresIcon({ isActive, hasFigures }: Readonly<{ isActive: boolean; hasFigures: boolean }>) {
  if (isActive) return <IconEdit size={14} style={{ color: 'var(--accent)', flexShrink: 0 }} />;
  if (hasFigures) return <IconCircleCheck size={14} style={{ color: 'var(--accent)', flexShrink: 0 }} />;
  return <IconCircle size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />;
}

interface WorkflowStepItemProps {
  step: { moduleId: string; selectedOption: unknown; status: string; label: string; promptTokens: number; completionTokens: number };
  index: number;
  isActive: boolean;
  isDone: boolean;
  isFuture: boolean;
  canNavigate: boolean;
  onNavigate: () => void;
}

function WorkflowStepItem({ step, index, isActive, isDone, isFuture, canNavigate, onNavigate }: Readonly<WorkflowStepItemProps>) {
  return (
    <Box
      key={step.moduleId}
      onClick={() => canNavigate && onNavigate()}
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
        <StepIcon status={isDone && !isActive ? 'done' : (step.status as StepStatus)} />
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
            {String(index + 1).padStart(2, '0')} · {step.label.toUpperCase()}
          </Text>
          {step.status === 'done' && step.promptTokens + step.completionTokens > 0 && (
            <Text size="xs" ff="monospace" style={{ color: 'var(--text-muted)', fontSize: 10, marginTop: 1 }}>
              {step.promptTokens + step.completionTokens}t
            </Text>
          )}
        </Box>
      </Group>
    </Box>
  );
}

export function StepProgress() {
  const { steps, currentStepIndex, workflowPhase, goToStep, goToPreview, goToInventors, goToFigures, artifact } =
    useWorkbenchStore();

  const specialUnlocked = steps[0]?.selectedOption !== null && steps[0]?.selectedOption !== undefined;
  const isFiguresActive = workflowPhase === 'figures';
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
        const isDone = step.selectedOption !== null;
        const isFuture = i > currentStepIndex && step.status === 'pending';
        const canNavigate = step.status !== 'pending';
        return (
          <WorkflowStepItem
            key={step.moduleId}
            step={step}
            index={i}
            isActive={isActive}
            isDone={isDone}
            isFuture={isFuture}
            canNavigate={canNavigate}
            onNavigate={() => goToStep(i)}
          />
        );
      })}

      {/* Step 08 · Figures */}
      <Box
        onClick={() => specialUnlocked && goToFigures()}
        style={{
          padding: '8px 10px',
          borderRadius: 4,
          border: isFiguresActive ? '1px solid var(--accent)' : '1px solid transparent',
          background: isFiguresActive ? 'var(--surface-active)' : 'transparent',
          cursor: specialUnlocked ? 'pointer' : 'default',
          opacity: specialUnlocked ? 1 : 0.35,
          transition: 'all 0.15s ease',
        }}
      >
        <Group gap={8} wrap="nowrap">
          <FiguresIcon isActive={isFiguresActive} hasFigures={!!artifact?.figures?.length} />
          <Text
            size="xs"
            fw={isFiguresActive ? 700 : 600}
            ff="monospace"
            style={{
              fontSize: 11,
              letterSpacing: '0.04em',
              color: isFiguresActive ? 'var(--accent)' : 'var(--text-secondary)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            08 · FIGURES
          </Text>
        </Group>
      </Box>

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
