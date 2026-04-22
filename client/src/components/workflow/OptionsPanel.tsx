import { Box, Stack, Text, Group, Button, Skeleton, Alert, SegmentedControl } from '@mantine/core';
import {
  IconArrowBackUp,
  IconAlertCircle,
  IconRefresh,
  IconPlayerStop,
  IconWand,
  IconForms,
  IconPencil,
  IconAlertTriangle,
} from '@tabler/icons-react';
import { useWorkbenchStore } from '@/store/workbench';
import { useShallow } from 'zustand/react/shallow';
import { resolveLabel, resolveDescription } from '@/utils';
import { OptionCard } from '@/components/workflow/OptionCard';
import { StepInputPanel } from '@/components/workflow/StepInputPanel';
import { useI18n } from '@/i18n/useI18n';
import type { InputMode } from '@/types';

function CardSkeleton() {
  return (
    <Box className="border border-stroke rounded-md overflow-hidden bg-surface">
      <Box className="px-3.5 py-2.5 bg-surface-raised border-b border-stroke">
        <Skeleton height={14} width={72} radius="sm" />
      </Box>
      <Box style={{ padding: 14 }}>
        <Stack gap={8}>
          {([100, 90, 80, 75, 85, 70] as const).map((w) => (
            <Skeleton key={w} height={11} width={`${w}%`} radius="sm" />
          ))}
        </Stack>
      </Box>
    </Box>
  );
}

export function OptionsPanel() {
  const {
    steps,
    currentStepIndex,
    generationStatus,
    lastError,
    selectOption,
    regenerateOptions,
    generateStepOptions,
    goToStep,
    resetWorkflow,
    cancelGeneration,
    setStepInputState,
    llmStatus,
    pendingCascadeFromStep,
    dismissCascade,
    cascadeRegenerateDownstream,
    streamingOptions,
  } = useWorkbenchStore(
    useShallow((s) => ({
      steps: s.steps,
      currentStepIndex: s.currentStepIndex,
      generationStatus: s.generationStatus,
      lastError: s.lastError,
      selectOption: s.selectOption,
      regenerateOptions: s.regenerateOptions,
      generateStepOptions: s.generateStepOptions,
      goToStep: s.goToStep,
      resetWorkflow: s.resetWorkflow,
      cancelGeneration: s.cancelGeneration,
      setStepInputState: s.setStepInputState,
      llmStatus: s.llmStatus,
      pendingCascadeFromStep: s.pendingCascadeFromStep,
      dismissCascade: s.dismissCascade,
      cascadeRegenerateDownstream: s.cascadeRegenerateDownstream,
      streamingOptions: s.streamingOptions,
    }))
  );

  const { t } = useI18n();

  const step = steps[currentStepIndex];
  if (!step) return null;

  const isGenerating = generationStatus === 'loading' || step.status === 'generating';
  const isFirstStep = currentStepIndex === 0;
  const llmOffline = llmStatus !== 'ok';

  const currentModeOptions =
    step.inputMode === 'guided' ? step.optionsByMode.guided : step.optionsByMode.auto;
  const anyOptionsExist =
    step.optionsByMode.auto.length > 0 || step.optionsByMode.guided.length > 0;

  // Show the mode tab bar whenever any options have been generated
  const hasPreviouslyGenerated = anyOptionsExist || step.status === 'selecting';

  // Body logic: per-tab — show options if the current mode has them, else show input form
  const showOptionsBody =
    hasPreviouslyGenerated && currentModeOptions.length > 0 && step.inputMode !== 'manual';
  const showAltInputBody =
    hasPreviouslyGenerated &&
    !isGenerating &&
    (currentModeOptions.length === 0 || step.inputMode === 'manual');

  // Normal input panel: before any generation
  const showRegularInput = !hasPreviouslyGenerated && !isGenerating;

  const handleBack = () => {
    if (isFirstStep) {
      resetWorkflow();
    } else {
      goToStep(currentStepIndex - 1);
    }
  };

  const handleModeChange = (mode: InputMode) => {
    setStepInputState(currentStepIndex, { inputMode: mode });
  };

  // Regenerate: shown per tab only when that tab has previously generated options
  const handleRegenerate = () => {
    if (step.inputMode === 'auto') {
      void generateStepOptions();
    } else {
      regenerateOptions();
    }
  };

  const showRegenerate =
    hasPreviouslyGenerated && step.inputMode !== 'manual' && currentModeOptions.length > 0;

  return (
    <Stack gap={0} style={{ height: '100%' }}>
      {/* Header */}
      <Box className="px-5 pt-3.5 border-b border-stroke bg-surface-raised shrink-0">
        <Group
          justify="space-between"
          align="center"
          wrap="nowrap"
          mb={hasPreviouslyGenerated ? 10 : 14}
        >
          <Stack gap={2} className="min-w-0">
            <Text size="xs" ff="monospace" className="text-fg-muted tracking-widest">
              {t('res_Step')} {currentStepIndex + 1} {t('res_Of')} {steps.length}
            </Text>
            <Text fw={700} size="md" className="text-fg">
              {resolveLabel(step.moduleId, t)}
            </Text>
            <Text size="xs" c="var(--text-muted)">
              {resolveDescription(step.moduleId, t)}
              {showOptionsBody && ` · ${t('res_SelectOneOption')}`}
            </Text>
          </Stack>

          <Group gap={8} wrap="nowrap" className="shrink-0">
            <Button
              variant="subtle"
              size="xs"
              leftSection={<IconArrowBackUp size={16} />}
              onClick={handleBack}
              disabled={isGenerating}
              className="uppercase text-fg-muted font-mono text-[11px]"
            >
              {t('res_Back')}
            </Button>

            {isGenerating && (
              <Button
                variant="filled"
                color="red"
                size="xs"
                leftSection={<IconPlayerStop size={16} />}
                onClick={cancelGeneration}
                className="uppercase font-mono text-[11px]"
              >
                {t('res_Stop')}
              </Button>
            )}
          </Group>
        </Group>

        {/* Mode tab bar — only shown after options have been generated */}
        {hasPreviouslyGenerated && (
          <Group gap={8} pb={10} justify="space-between">
            <SegmentedControl
              classNames={{ root: 'step-seg' }}
              value={step.inputMode}
              onChange={(v) => handleModeChange(v as InputMode)}
              size="xs"
              data={[
                {
                  value: 'auto',
                  label: (
                    <Group gap={4} px={2} wrap="nowrap">
                      <IconWand size={12} />
                      <Text
                        ff="monospace"
                        size="xs"
                        fw={600}
                        className="tracking-[0.05em] uppercase"
                      >
                        {t('res_Mode_Auto')}
                      </Text>
                    </Group>
                  ),
                },
                {
                  value: 'guided',
                  disabled: llmOffline,
                  label: (
                    <Group gap={4} px={2} wrap="nowrap">
                      <IconForms size={12} />
                      <Text
                        ff="monospace"
                        size="xs"
                        fw={600}
                        className="tracking-[0.05em] uppercase"
                      >
                        {t('res_Mode_Guided')}
                      </Text>
                    </Group>
                  ),
                },
                {
                  value: 'manual',
                  label: (
                    <Group gap={4} px={2} wrap="nowrap">
                      <IconPencil size={12} />
                      <Text
                        ff="monospace"
                        size="xs"
                        fw={600}
                        className="tracking-[0.05em] uppercase"
                      >
                        {t('res_Mode_Manual')}
                      </Text>
                    </Group>
                  ),
                },
              ]}
              styles={{
                root: { background: 'var(--surface)', border: '1px solid var(--border)' },
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
            {showRegenerate && (
              <Button
                variant="outline"
                size="xs"
                leftSection={<IconRefresh size={14} />}
                onClick={handleRegenerate}
                className="uppercase border-stroke text-fg-secondary font-mono text-[11px] tracking-[0.06em] shrink-0"
              >
                {t('res_Regenerate')}
              </Button>
            )}
          </Group>
        )}
      </Box>

      {/* Body */}
      <Box style={{ flex: 1, overflowY: 'auto' }}>
        {lastError && generationStatus === 'error' && (
          <Alert
            icon={<IconAlertCircle size={14} />}
            color="red"
            m={20}
            mb={0}
            styles={{ message: { fontFamily: 'var(--font-mono)', fontSize: 12 } }}
          >
            {lastError}
          </Alert>
        )}

        {/* Cascade update banner */}
        {pendingCascadeFromStep !== null && (
          <Alert
            icon={<IconAlertTriangle size={14} />}
            color="yellow"
            m={20}
            mb={0}
            styles={{ message: { fontFamily: 'var(--font-mono)', fontSize: 12 } }}
          >
            <Group justify="space-between" wrap="nowrap">
              <Text size="xs" ff="monospace">
                {t('res_CascadeUpdatePrompt')}
              </Text>
              <Group gap={8} wrap="nowrap">
                <Button
                  size="xs"
                  variant="filled"
                  color="yellow"
                  onClick={() => void cascadeRegenerateDownstream()}
                  className="font-mono text-[11px] uppercase"
                >
                  {t('res_CascadeUpdateConfirm')}
                </Button>
                <Button
                  size="xs"
                  variant="subtle"
                  color="yellow"
                  onClick={dismissCascade}
                  className="font-mono text-[11px] uppercase"
                >
                  {t('res_Dismiss')}
                </Button>
              </Group>
            </Group>
          </Alert>
        )}

        {/* Normal input panel (before first generation) */}
        {showRegularInput && (
          <Box style={{ padding: '0 20px' }}>
            <StepInputPanel moduleId={step.moduleId} />
          </Box>
        )}

        {/* Generating: partial option cards when content arrives, skeletons while connecting */}
        {isGenerating && (
          <Box
            style={{
              padding: 20,
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
              gap: 16,
              alignItems: 'start',
            }}
          >
            {streamingOptions.length > 0
              ? streamingOptions.map((content, i) => (
                  <OptionCard
                    key={`streaming-${i}`}
                    option={{ id: `streaming-${i}`, index: i, content }}
                    onSelect={() => {}}
                    disabled
                  />
                ))
              : ['sk-0', 'sk-1', 'sk-2'].map((k) => <CardSkeleton key={k} />)}
          </Box>
        )}

        {/* AUTO tab: show generated options */}
        {showOptionsBody && (
          <Box
            style={{
              padding: 20,
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
              gap: 16,
              alignItems: 'start',
            }}
          >
            {currentModeOptions.map((option) => (
              <OptionCard key={option.id} option={option} onSelect={selectOption} />
            ))}
          </Box>
        )}

        {/* GUIDED or MANUAL tab: show input form without internal mode selector */}
        {showAltInputBody && (
          <Box style={{ padding: '0 20px' }}>
            <StepInputPanel moduleId={step.moduleId} hideModeSelector />
          </Box>
        )}
      </Box>
    </Stack>
  );
}
