import { Box, Stack, Text, Group, Tooltip, Divider, Button, ActionIcon } from '@mantine/core';
import {
  IconCircleCheck,
  IconCircleDot,
  IconCircle,
  IconLoader2,
  IconPhoto,
  IconUsers,
  IconEye,
  IconAlertTriangle,
  IconHistory,
  IconGitBranch,
  IconBulb,
  IconAdjustmentsHorizontal,
  IconWorld,
  IconAlignLeft,
  IconEdit,
  IconFileUploadFilled,
  IconRestore,
  IconListCheckFilled,
} from '@tabler/icons-react';
import type { ComponentType } from 'react';
import { useState, useCallback } from 'react';
import { useWorkbenchStore } from '@/store/workbench';
import { useShallow } from 'zustand/react/shallow';
import { useI18n } from '@/i18n/useI18n';
import { resolveLabel } from '@/utils';
import { BTN_PRIMARY } from '@/theme/styles';
import type { StepStatus } from '@/types';

const MODULE_ICONS: Record<
  string,
  ComponentType<{ size?: number; className?: string; style?: React.CSSProperties }>
> = {
  problem: IconAlertTriangle,
  previous_solutions: IconHistory,
  differences: IconGitBranch,
  invention_summary: IconBulb,
  variations: IconAdjustmentsHorizontal,
  other_applications: IconWorld,
  full_description: IconAlignLeft,
};

// Shared helpers

function stepTextClass(isActive: boolean, isDone: boolean): string {
  if (isActive) return 'text-accent';
  if (isDone) return 'text-fg';
  return 'text-fg-secondary';
}

function accentIconClass(isActive: boolean, isDone: boolean): string {
  return isActive || isDone ? 'text-accent shrink-0' : 'text-fg-muted shrink-0';
}

// Status icon (expanded)

function StepStatusIcon({ status }: Readonly<{ status: StepStatus }>) {
  if (status === 'done') return <IconCircleCheck size={14} className="text-accent shrink-0" />;
  if (status === 'generating')
    return <IconLoader2 size={14} className="spin text-accent shrink-0" />;
  if (status === 'selecting') return <IconCircleDot size={14} className="text-accent shrink-0" />;
  if (status === 'input') return <IconEdit size={14} className="text-accent shrink-0" />;
  return <IconCircle size={14} className="text-fg-muted shrink-0" />;
}

// Collapsed icon item

function CollapsedItem({
  icon,
  tooltipLabel,
  isActive,
  isFuture,
  canNavigate,
  onClick,
}: Readonly<{
  icon: React.ReactNode;
  tooltipLabel: string;
  isActive: boolean;
  isFuture: boolean;
  canNavigate: boolean;
  onClick: () => void;
}>) {
  return (
    <Tooltip label={tooltipLabel} position="right" withArrow offset={6}>
      <Box
        onClick={() => canNavigate && onClick()}
        className={[
          'flex items-center justify-center w-8.5 h-8.5 mx-auto rounded-md',
          '[transition:background_150ms_ease,border-color_150ms_ease]',
          isActive
            ? 'bg-surface-active border border-accent'
            : 'border border-transparent hover:bg-surface-raised',
          isFuture ? 'opacity-40' : '',
          canNavigate ? 'cursor-pointer' : 'cursor-default',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {icon}
      </Box>
    </Tooltip>
  );
}

// Expanded workflow step

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
  isActive,
  isDone,
  isFuture,
  canNavigate,
  onNavigate,
}: Readonly<WorkflowStepItemProps>) {
  const { t } = useI18n();
  const totalTokens = step.promptTokens + step.completionTokens;
  return (
    <Box
      onClick={() => canNavigate && onNavigate()}
      className={[
        'px-2.5 py-2 rounded border transition-all duration-150',
        isActive ? 'border-accent bg-surface-active' : 'border-transparent',
        isFuture ? 'opacity-40' : '',
        canNavigate ? 'cursor-pointer hover:bg-surface-raised' : 'cursor-default',
      ].join(' ')}
    >
      <Group gap={7} wrap="nowrap" align="center">
        <StepStatusIcon status={isDone && !isActive ? 'done' : (step.status as StepStatus)} />
        <Box className="flex-1">
          <Text
            size="xs"
            fw={isActive ? 700 : 600}
            ff="monospace"
            className={`tracking-[0.04em] leading-snug ${stepTextClass(isActive, isDone)}`}
            style={{ whiteSpace: 'nowrap' }}
          >
            {resolveLabel(step.moduleId, t).toUpperCase()}
          </Text>
          {isDone && totalTokens > 0 && (
            <Text size="xs" ff="monospace" className="text-fg-muted mt-px leading-none">
              {totalTokens >= 1000 ? `${(totalTokens / 1000).toFixed(1)}k` : totalTokens}t
            </Text>
          )}
        </Box>
      </Group>
    </Box>
  );
}

// Expanded special step

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
  const separatorIdx = label.indexOf(' · ');
  const stepNumber = separatorIdx === -1 ? null : label.slice(0, separatorIdx);
  const stepLabel = separatorIdx === -1 ? label : label.slice(separatorIdx + 3);
  const isLocked = !unlocked;

  return (
    <Box
      onClick={() => unlocked && onClick()}
      style={isLocked ? { opacity: 0.35 } : undefined}
      className={[
        'px-2.5 py-2 rounded border transition-all duration-150',
        isActive ? 'border-accent bg-surface-active' : 'border-transparent',
        unlocked ? 'cursor-pointer hover:bg-surface-raised' : 'cursor-default',
      ].join(' ')}
    >
      <Group gap={7} wrap="nowrap" align="center">
        {icon}
        {stepNumber ? (
          <Group gap={4} wrap="nowrap" align="center" className="flex-1">
            <Text
              size="xs"
              fw={isActive ? 700 : 600}
              ff="monospace"
              className={`tracking-[0.04em] shrink-0 whitespace-nowrap ${stepTextClass(isActive, hasDone)}`}
            >
              {stepNumber} ·
            </Text>
            <Text
              size="xs"
              fw={isActive ? 700 : 600}
              ff="monospace"
              className={`tracking-[0.04em] leading-snug ${stepTextClass(isActive, hasDone)}`}
            >
              {stepLabel}
            </Text>
          </Group>
        ) : (
          <Text
            size="xs"
            fw={isActive ? 700 : 600}
            ff="monospace"
            className={`tracking-[0.04em] leading-snug ${stepTextClass(isActive, hasDone)}`}
          >
            {stepLabel}
          </Text>
        )}
      </Group>
    </Box>
  );
}

// Animated save section — shared by both views

function SaveSection({
  visible,
  saving,
  isAllDone,
  onSave,
  collapsed,
}: Readonly<{
  visible: boolean;
  saving: boolean;
  isAllDone: boolean;
  onSave: () => void;
  collapsed: boolean;
}>) {
  const { t } = useI18n();
  const animStyle: React.CSSProperties = {
    overflow: 'hidden',
    maxHeight: visible ? 64 : 0,
    opacity: visible ? 1 : 0,
    transform: visible ? 'translateY(0)' : 'translateY(-6px)',
    transition: 'max-height 280ms ease, opacity 280ms ease, transform 280ms ease',
  };

  if (collapsed) {
    return (
      <Box style={animStyle}>
        <Divider w={24} my={4} mx="auto" className="border-stroke" />
        <Tooltip
          label={isAllDone ? t('res_Save') : t('res_SaveDraft')}
          position="right"
          withArrow
          offset={6}
        >
          <Box
            onClick={() => !saving && onSave()}
            className={`flex items-center justify-center w-8.5 h-8.5 mx-auto rounded-md border border-accent bg-accent-glow transition-opacity duration-150 ${saving ? 'opacity-60 cursor-default' : 'cursor-pointer'}`}
          >
            <IconFileUploadFilled size={15} style={{ color: 'var(--accent)' }} />
          </Box>
        </Tooltip>
      </Box>
    );
  }

  return (
    <Box style={animStyle}>
      <Divider mb={10} mt={6} pt={6} className="border-stroke" />
      <Box className="flex justify-center">
        <Button
          size="xs"
          leftSection={<IconFileUploadFilled size={15} />}
          loading={saving}
          onClick={onSave}
          style={{ ...BTN_PRIMARY, width: '80%', justifyContent: 'center' }}
        >
          {isAllDone ? t('res_Save') : t('res_SaveDraft')}
        </Button>
      </Box>
    </Box>
  );
}

// Main component

interface StepProgressProps {
  collapsed: boolean;
}

export function StepProgress({ collapsed }: Readonly<StepProgressProps>) {
  const {
    steps,
    currentStepIndex,
    workflowPhase,
    goToStep,
    goToPreview,
    goToInventors,
    goToFigures,
    goToReview,
    artifact,
    persistDraft,
    resetWorkflow,
  } = useWorkbenchStore(
    useShallow((s) => ({
      steps: s.steps,
      currentStepIndex: s.currentStepIndex,
      workflowPhase: s.workflowPhase,
      goToStep: s.goToStep,
      goToPreview: s.goToPreview,
      goToInventors: s.goToInventors,
      goToFigures: s.goToFigures,
      goToReview: s.goToReview,
      artifact: s.artifact,
      persistDraft: s.persistDraft,
      resetWorkflow: s.resetWorkflow,
    }))
  );
  const { t } = useI18n();

  const [saving, setSaving] = useState(false);
  const isAllDone = steps.every((s) => s.selectedOption !== null);
  const handleSave = useCallback(async () => {
    setSaving(true);
    await persistDraft();
    setSaving(false);
  }, [persistDraft]);

  const specialUnlocked =
    steps[0]?.selectedOption !== null && steps[0]?.selectedOption !== undefined;
  const isFiguresActive = workflowPhase === 'figures';
  const isInventorsActive = workflowPhase === 'inventors';
  const isPreviewActive = workflowPhase === 'preview';
  const isReviewActive = workflowPhase === 'review';

  // Collapsed rail
  if (collapsed) {
    return (
      <Stack gap={2} py={14} px={0} align="center">
        {steps.map((step, i) => {
          const isActive = i === currentStepIndex && workflowPhase === 'working';
          const isDone = step.selectedOption !== null;
          const isFuture = i > currentStepIndex && step.status === 'pending';
          const Icon = MODULE_ICONS[step.moduleId] ?? MODULE_ICONS['problem'];
          return (
            <CollapsedItem
              key={step.moduleId}
              tooltipLabel={resolveLabel(step.moduleId, t)}
              isActive={isActive}
              isFuture={isFuture}
              canNavigate={step.status !== 'pending'}
              onClick={() => goToStep(i)}
              icon={<Icon size={15} className={accentIconClass(isActive, isDone)} />}
            />
          );
        })}

        <Divider w={24} my={4} className="border-stroke" />

        <CollapsedItem
          tooltipLabel={t('res_Figures')}
          isActive={isFiguresActive}
          isFuture={!specialUnlocked}
          canNavigate={specialUnlocked}
          onClick={goToFigures}
          icon={
            <IconPhoto
              size={15}
              className={accentIconClass(isFiguresActive, !!artifact?.figures?.length)}
            />
          }
        />
        <CollapsedItem
          tooltipLabel={t('res_Inventors')}
          isActive={isInventorsActive}
          isFuture={!specialUnlocked}
          canNavigate={specialUnlocked}
          onClick={goToInventors}
          icon={
            <IconUsers
              size={15}
              className={accentIconClass(isInventorsActive, !!artifact?.inventors.length)}
            />
          }
        />
        <CollapsedItem
          tooltipLabel={t('res_PreviewExport')}
          isActive={isPreviewActive}
          isFuture={!specialUnlocked}
          canNavigate={specialUnlocked}
          onClick={goToPreview}
          icon={<IconEye size={15} className={accentIconClass(isPreviewActive, false)} />}
        />
        <CollapsedItem
          tooltipLabel={t('res_IdfReview')}
          isActive={isReviewActive}
          isFuture={!isAllDone}
          canNavigate={isAllDone}
          onClick={goToReview}
          icon={<IconListCheckFilled size={15} className={accentIconClass(isReviewActive, false)} />}
        />

        <SaveSection
          visible={specialUnlocked}
          saving={saving}
          isAllDone={isAllDone}
          onSave={() => void handleSave()}
          collapsed
        />
      </Stack>
    );
  }

  // Expanded
  return (
    <Stack gap={4} p={14}>
      <Group justify="space-between" align="center" mb={8}>
        <Text
          size="xs"
          fw={700}
          tt="uppercase"
          ff="monospace"
          className="text-fg-muted tracking-widest border-l-2 border-accent pl-2"
        >
          {t('res_Workflow')}
        </Text>
        {workflowPhase !== 'input' && (
          <Tooltip label={t('res_StartOver')} position="right" withArrow>
            <ActionIcon
              variant="subtle"
              size="xs"
              onClick={resetWorkflow}
              aria-label={t('res_StartOver')}
              className="text-fg-muted hover:text-accent"
            >
              <IconRestore size={18} />
            </ActionIcon>
          </Tooltip>
        )}
      </Group>

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

      <Divider my={6} className="border-stroke" />

      {/* Figures */}
      <SpecialStepItem
        isActive={isFiguresActive}
        unlocked={specialUnlocked}
        hasDone={!!artifact?.figures?.length}
        label={t('res_Step_Figures')}
        icon={
          <IconPhoto
            size={14}
            className={`shrink-0 ${isFiguresActive || !!artifact?.figures?.length ? 'text-accent' : 'text-fg-muted'}`}
          />
        }
        onClick={goToFigures}
      />

      {/* Inventors */}
      <SpecialStepItem
        isActive={isInventorsActive}
        unlocked={specialUnlocked}
        hasDone={!!artifact?.inventors.length}
        label={t('res_Step_Inventors')}
        icon={
          <IconUsers
            size={14}
            className={`shrink-0 ${isInventorsActive || !!artifact?.inventors.length ? 'text-accent' : 'text-fg-muted'}`}
          />
        }
        onClick={goToInventors}
      />

      {/* Preview */}
      <SpecialStepItem
        isActive={isPreviewActive}
        unlocked={specialUnlocked}
        hasDone={false}
        label={t('res_Step_PreviewExport')}
        icon={
          <IconEye
            size={14}
            className={`shrink-0 ${isPreviewActive ? 'text-accent' : 'text-fg-muted'}`}
          />
        }
        onClick={goToPreview}
      />

      {/* IDF Review */}
      <SpecialStepItem
        isActive={isReviewActive}
        unlocked={isAllDone}
        hasDone={false}
        label={t('res_Step_Review')}
        icon={
          <IconListCheckFilled
            size={14}
            className={`shrink-0 ${isReviewActive ? 'text-accent' : 'text-fg-muted'}`}
          />
        }
        onClick={goToReview}
      />

      <SaveSection
        visible={specialUnlocked}
        saving={saving}
        isAllDone={isAllDone}
        onSave={() => void handleSave()}
        collapsed={false}
      />
    </Stack>
  );
}
