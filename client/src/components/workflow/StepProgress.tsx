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
import { useI18n } from '@/i18n/useI18n';
import { MODULE_RESOURCE_KEYS } from '@/utils/workflowTemplates';
import type { StepStatus, WorkflowModuleId } from '@/types';

function StepIcon({ status }: Readonly<{ status: StepStatus }>) {
  if (status === 'done') return <IconCircleCheck size={14} className="text-accent shrink-0" />;
  if (status === 'generating')
    return <IconLoader2 size={14} className="spin text-accent shrink-0" />;
  if (status === 'selecting') return <IconCircleDot size={14} className="text-accent shrink-0" />;
  if (status === 'input') return <IconEdit size={14} className="text-accent shrink-0" />;
  return <IconCircle size={14} className="text-fg-muted shrink-0" />;
}

function stepTextClass(isActive: boolean, isDone: boolean): string {
  if (isActive) return 'text-accent';
  if (isDone) return 'text-fg';
  return 'text-fg-secondary';
}

function stepItemClass(isActive: boolean, isFuture: boolean, canNavigate: boolean): string {
  return [
    'px-[10px] py-2 rounded border transition-all duration-150',
    isActive ? 'border-accent bg-surface-active' : 'border-transparent',
    isFuture ? 'opacity-45' : '',
    canNavigate ? 'cursor-pointer' : 'cursor-default',
  ].join(' ');
}

function FiguresIcon({
  isActive,
  hasFigures,
}: Readonly<{ isActive: boolean; hasFigures: boolean }>) {
  if (isActive) return <IconEdit size={14} className="text-accent shrink-0" />;
  if (hasFigures) return <IconCircleCheck size={14} className="text-accent shrink-0" />;
  return <IconCircle size={14} className="text-fg-muted shrink-0" />;
}

interface WorkflowStepItemProps {
  step: {
    moduleId: string;
    selectedOption: unknown;
    status: string;
    label: string;
    promptTokens: number;
    completionTokens: number;
  };
  index: number;
  isActive: boolean;
  isDone: boolean;
  isFuture: boolean;
  canNavigate: boolean;
  onNavigate: () => void;
}

function WorkflowStepItem({
  step,
  index,
  isActive,
  isDone,
  isFuture,
  canNavigate,
  onNavigate,
}: Readonly<WorkflowStepItemProps>) {
  const { t } = useI18n();
  return (
    <Box
      key={step.moduleId}
      onClick={() => canNavigate && onNavigate()}
      className={stepItemClass(isActive, isFuture, canNavigate)}
    >
      <Group gap={8} wrap="nowrap">
        <StepIcon status={isDone && !isActive ? 'done' : (step.status as StepStatus)} />
        <Box className="flex-1 min-w-0">
          <Text
            size="xs"
            fw={isActive ? 700 : 600}
            ff="monospace"
            className={`text-[11px] tracking-[0.04em] truncate ${stepTextClass(isActive, isDone)}`}
          >
            {String(index + 1).padStart(2, '0')} · {t(MODULE_RESOURCE_KEYS[step.moduleId as WorkflowModuleId]).toUpperCase()}
          </Text>
          {step.status === 'done' && step.promptTokens + step.completionTokens > 0 && (
            <Text size="xs" ff="monospace" className="text-fg-muted text-[10px] mt-px">
              {step.promptTokens + step.completionTokens}t
            </Text>
          )}
        </Box>
      </Group>
    </Box>
  );
}

function SpecialStepItem({
  isActive,
  unlocked,
  hasDone,
  label,
  icon,
  onClick,
}: Readonly<{
  isActive: boolean;
  unlocked: boolean;
  hasDone: boolean;
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
}>) {
  const isLocked = !unlocked;
  return (
    <Box
      onClick={() => unlocked && onClick()}
      className={stepItemClass(isActive, isLocked, unlocked)}
      style={isLocked ? { opacity: 0.35 } : undefined}
    >
      <Group gap={8} wrap="nowrap">
        {icon}
        <Text
          size="xs"
          fw={isActive ? 700 : 600}
          ff="monospace"
          className={`text-[11px] tracking-[0.04em] truncate ${stepTextClass(isActive, hasDone)}`}
        >
          {label}
        </Text>
      </Group>
    </Box>
  );
}

export function StepProgress() {
  const {
    steps,
    currentStepIndex,
    workflowPhase,
    goToStep,
    goToPreview,
    goToInventors,
    goToFigures,
    artifact,
  } = useWorkbenchStore();
  const { t } = useI18n();

  const specialUnlocked =
    steps[0]?.selectedOption !== null && steps[0]?.selectedOption !== undefined;
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
        className="text-fg-muted tracking-widest"
      >
        {t('res_Workflow')}
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
      <SpecialStepItem
        isActive={isFiguresActive}
        unlocked={specialUnlocked}
        hasDone={!!artifact?.figures?.length}
        label={t('res_Step_Figures')}
        icon={<FiguresIcon isActive={isFiguresActive} hasFigures={!!artifact?.figures?.length} />}
        onClick={goToFigures}
      />

      {/* Step 09 · Inventors */}
      <SpecialStepItem
        isActive={isInventorsActive}
        unlocked={specialUnlocked}
        hasDone={!!artifact?.inventors.length}
        label={t('res_Step_Inventors')}
        icon={
          artifact?.inventors.length ? (
            <IconCircleCheck size={14} className="text-accent shrink-0" />
          ) : (
            <IconCircle size={14} className="text-fg-muted shrink-0" />
          )
        }
        onClick={goToInventors}
      />

      {/* Step 10 · Preview & Export */}
      <SpecialStepItem
        isActive={isPreviewActive}
        unlocked={specialUnlocked}
        hasDone={false}
        label={t('res_Step_PreviewExport')}
        icon={
          <IconFileText
            size={14}
            className={`shrink-0 ${isPreviewActive ? 'text-accent' : 'text-fg-muted'}`}
          />
        }
        onClick={goToPreview}
      />
    </Stack>
  );
}
