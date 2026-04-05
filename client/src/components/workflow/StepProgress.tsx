import { Box, Stack, Text, Group, Tooltip, Divider, Button } from '@mantine/core';
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
  IconCloudUpload,
} from '@tabler/icons-react';
import type { ComponentType } from 'react';
import { useState, useCallback } from 'react';
import { useWorkbenchStore } from '@/store/workbench';
import { useI18n } from '@/i18n/useI18n';
import { MODULE_RESOURCE_KEYS } from '@/utils/workflowTemplates';
import { BTN_PRIMARY } from '@/theme/styles';
import type { StepStatus, WorkflowModuleId } from '@/types';

// Icon registry

const MODULE_ICONS: Record<
  WorkflowModuleId,
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
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 34,
          height: 34,
          margin: '0 auto',
          borderRadius: 6,
          cursor: canNavigate ? 'pointer' : 'default',
          opacity: isFuture ? 0.4 : 1,
          background: isActive ? 'var(--surface-active)' : undefined,
          border: isActive ? '1px solid var(--accent)' : '1px solid transparent',
          transition: 'background 150ms ease, border-color 150ms ease',
        }}
        className={`${isActive ? '' : 'hover:bg-surface-raised'}`}
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
        'px-2.5 py-1.75 rounded border transition-all duration-150',
        isActive ? 'border-accent bg-surface-active' : 'border-transparent',
        isFuture ? 'opacity-40' : '',
        canNavigate ? 'cursor-pointer hover:bg-surface-raised' : 'cursor-default',
      ].join(' ')}
    >
      <Group gap={7} wrap="nowrap" align="center">
        <StepStatusIcon status={isDone && !isActive ? 'done' : (step.status as StepStatus)} />
        <Box style={{ flex: 1 }}>
          <Text
            size="xs"
            fw={isActive ? 700 : 600}
            ff="monospace"
            className={`text-[10.5px] tracking-[0.04em] leading-snug ${stepTextClass(isActive, isDone)}`}
            style={{ whiteSpace: 'nowrap' }}
          >
            {t(MODULE_RESOURCE_KEYS[step.moduleId as WorkflowModuleId]).toUpperCase()}
          </Text>
          {isDone && totalTokens > 0 && (
            <Text
              size="xs"
              ff="monospace"
              className="text-fg-muted text-[9.5px] mt-px leading-none"
            >
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
        'px-2.5 py-1.75 rounded border transition-all duration-150',
        isActive ? 'border-accent bg-surface-active' : 'border-transparent',
        unlocked ? 'cursor-pointer hover:bg-surface-raised' : 'cursor-default',
      ].join(' ')}
    >
      <Group gap={7} wrap="nowrap" align="center">
        {icon}
        {stepNumber ? (
          <Group gap={4} wrap="nowrap" align="center" style={{ flex: 1 }}>
            <Text
              size="xs"
              fw={isActive ? 700 : 600}
              ff="monospace"
              className={`text-[10.5px] tracking-[0.04em] ${stepTextClass(isActive, hasDone)}`}
              style={{ flexShrink: 0, whiteSpace: 'nowrap' }}
            >
              {stepNumber} ·
            </Text>
            <Text
              size="xs"
              fw={isActive ? 700 : 600}
              ff="monospace"
              className={`text-[10.5px] tracking-[0.04em] leading-snug ${stepTextClass(isActive, hasDone)}`}
            >
              {stepLabel}
            </Text>
          </Group>
        ) : (
          <Text
            size="xs"
            fw={isActive ? 700 : 600}
            ff="monospace"
            className={`text-[10.5px] tracking-[0.04em] leading-snug ${stepTextClass(isActive, hasDone)}`}
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
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 34,
              height: 34,
              margin: '0 auto',
              borderRadius: 6,
              cursor: saving ? 'default' : 'pointer',
              border: '1px solid var(--accent)',
              background: 'var(--accent-glow)',
              transition: 'opacity 150ms ease',
              opacity: saving ? 0.6 : 1,
            }}
          >
            <IconCloudUpload size={15} style={{ color: 'var(--accent)' }} />
          </Box>
        </Tooltip>
      </Box>
    );
  }

  return (
    <Box style={animStyle}>
      <Divider mb={10} mt={6} className="border-stroke" />
      <Box style={{ display: 'flex', justifyContent: 'center' }}>
        <Button
          size="xs"
          leftSection={<IconCloudUpload size={14} />}
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
    artifact,
    persistDraft,
  } = useWorkbenchStore();
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

  // Collapsed rail
  if (collapsed) {
    return (
      <Stack gap={2} py={14} px={0} align="center">
        {steps.map((step, i) => {
          const isActive = i === currentStepIndex && workflowPhase === 'working';
          const isDone = step.selectedOption !== null;
          const isFuture = i > currentStepIndex && step.status === 'pending';
          const Icon = MODULE_ICONS[step.moduleId];
          return (
            <CollapsedItem
              key={step.moduleId}
              tooltipLabel={t(MODULE_RESOURCE_KEYS[step.moduleId])}
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
    <Stack gap={2} p={14}>
      <Text
        size="xs"
        fw={700}
        tt="uppercase"
        ff="monospace"
        mb={8}
        className="text-fg-muted tracking-widest text-[10px]"
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
