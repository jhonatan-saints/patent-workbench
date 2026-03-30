import { Box, Stack, Text, Group, Button, Skeleton, Alert } from '@mantine/core';
import {
  IconArrowLeft,
  IconAlertCircle,
  IconHome,
  IconRefresh,
} from '@tabler/icons-react';
import { useWorkbenchStore } from '@/store/workbench';
import { WORKFLOW_MODULES } from '@/utils/workflowTemplates';
import { OptionCard } from '@/components/workflow/OptionCard';
import { StepInputPanel } from '@/components/workflow/StepInputPanel';

function CardSkeleton() {
  return (
    <Box
      style={{
        border: '1px solid var(--border)',
        borderRadius: 6,
        overflow: 'hidden',
        background: 'var(--surface)',
      }}
    >
      <Box
        style={{
          padding: '10px 14px',
          background: 'var(--surface-raised)',
          borderBottom: '1px solid var(--border)',
        }}
      >
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
  } = useWorkbenchStore();

  const step = steps[currentStepIndex];
  if (!step) return null;

  const module = WORKFLOW_MODULES[step.moduleId];
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
      <Box
        style={{
          padding: '14px 20px',
          borderBottom: '1px solid var(--border)',
          background: 'var(--surface-raised)',
          flexShrink: 0,
        }}
      >
        <Group justify="space-between" align="center" wrap="nowrap">
          <Stack gap={2} style={{ minWidth: 0 }}>
            <Text
              size="xs"
              ff="monospace"
              style={{ color: 'var(--text-muted)', letterSpacing: '0.1em' }}
            >
              STEP {currentStepIndex + 1} OF {steps.length}
            </Text>
            <Text fw={700} size="md" style={{ color: 'var(--text-primary)' }}>
              {module.label}
            </Text>
            <Text size="xs" c="var(--text-muted)">
              {module.description}
              {!showInputPanel && !isGenerating && ' · select one option to continue'}
            </Text>
          </Stack>

          <Group gap={8} wrap="nowrap" style={{ flexShrink: 0 }}>
            <Button
              variant="subtle"
              size="xs"
              leftSection={isFirstStep ? <IconHome size={12} /> : <IconArrowLeft size={12} />}
              onClick={handleBack}
              disabled={isGenerating}
              style={{
                color: 'var(--text-muted)',
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
              }}
            >
              {isFirstStep ? 'START OVER' : 'BACK'}
            </Button>

            {!showInputPanel && !isGenerating && hasOptions && (
              <Button
                variant="outline"
                size="xs"
                leftSection={<IconRefresh size={12} />}
                onClick={regenerateOptions}
                style={{
                  borderColor: 'var(--border)',
                  color: 'var(--text-secondary)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                  letterSpacing: '0.06em',
                }}
              >
                REGENERATE
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
