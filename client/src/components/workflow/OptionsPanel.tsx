import { Box, Stack, Text, Group, Button, Skeleton, Alert } from '@mantine/core';
import {
  IconArrowLeft,
  IconAlertCircle,
  IconHome,
  IconRefresh,
  IconPlayerStop,
} from '@tabler/icons-react';
import { useWorkbenchStore } from '@/store/workbench';
import { MODULE_RESOURCE_KEYS, MODULE_DESCRIPTION_RESOURCE_KEYS } from '@/utils/workflowTemplates';
import { OptionCard } from '@/components/workflow/OptionCard';
import { StepInputPanel } from '@/components/workflow/StepInputPanel';
import { useI18n } from '@/i18n/useI18n';

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
    goToStep,
    resetWorkflow,
    cancelGeneration,
  } = useWorkbenchStore();

  const { t } = useI18n();

  const step = steps[currentStepIndex];
  if (!step) return null;

  const isGenerating = generationStatus === 'loading' || step.status === 'generating';
  const showInputPanel = step.status === 'input' || step.status === 'pending';
  const hasOptions = step.options.length > 0;
  const isFirstStep = currentStepIndex === 0;

  const handleBack = () => {
    if (isFirstStep) {
      resetWorkflow();
    } else {
      goToStep(currentStepIndex - 1);
    }
  };

  return (
    <Stack gap={0} style={{ height: '100%' }}>
      {/* Header */}
      <Box className="px-5 py-3.5 border-b border-stroke bg-surface-raised shrink-0">
        <Group justify="space-between" align="center" wrap="nowrap">
          <Stack gap={2} className="min-w-0">
            <Text size="xs" ff="monospace" className="text-fg-muted tracking-widest">
              {t('res_Step')} {currentStepIndex + 1} {t('res_Of')} {steps.length}
            </Text>
            <Text fw={700} size="md" className="text-fg">
              {t(MODULE_RESOURCE_KEYS[step.moduleId])}
            </Text>
            <Text size="xs" c="var(--text-muted)">
              {t(MODULE_DESCRIPTION_RESOURCE_KEYS[step.moduleId])}
              {!showInputPanel && !isGenerating && ` · ${t('res_SelectOneOption')}`}
            </Text>
          </Stack>

          <Group gap={8} wrap="nowrap" className="shrink-0">
            <Button
              variant="subtle"
              size="xs"
              leftSection={isFirstStep ? <IconHome size={14} /> : <IconArrowLeft size={14} />}
              onClick={handleBack}
              disabled={isGenerating}
              className="uppercase text-fg-muted font-mono text-[11px]"
            >
              {isFirstStep ? t('res_StartOver') : t('res_Back')}
            </Button>

            {!isFirstStep && !isGenerating && (
              <Button
                variant="subtle"
                size="xs"
                leftSection={<IconHome size={14} />}
                onClick={resetWorkflow}
                disabled={isGenerating}
                className="uppercase text-fg-muted font-mono text-[11px]"
              >
                {t('res_StartOver')}
              </Button>
            )}

            {isGenerating && (
              <Button
                variant="filled"
                color="red"
                size="xs"
                leftSection={<IconPlayerStop size={14} />}
                onClick={cancelGeneration}
                className="uppercase font-mono text-[11px]"
              >
                {t('res_Stop')}
              </Button>
            )}

            {!showInputPanel && !isGenerating && hasOptions && (
              <Button
                variant="outline"
                size="xs"
                leftSection={<IconRefresh size={14} />}
                onClick={regenerateOptions}
                className="uppercase border-stroke text-fg-secondary font-mono text-[11px] tracking-[0.06em]"
              >
                {t('res_Regenerate')}
              </Button>
            )}
          </Group>
        </Group>
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

        {showInputPanel && !isGenerating && (
          <Box style={{ padding: '0 20px' }}>
            <StepInputPanel moduleId={step.moduleId} />
          </Box>
        )}

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
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
          </Box>
        )}

        {!showInputPanel && !isGenerating && hasOptions && (
          <Box
            style={{
              padding: 20,
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
              gap: 16,
              alignItems: 'start',
            }}
          >
            {step.options.map((option) => (
              <OptionCard key={option.id} option={option} onSelect={selectOption} />
            ))}
          </Box>
        )}
      </Box>
    </Stack>
  );
}
