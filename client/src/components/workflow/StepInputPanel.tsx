import { useRef, useEffect } from 'react';
import {
  Box,
  Stack,
  Text,
  Button,
  Textarea,
  TextInput,
  Group,
  SegmentedControl,
  ActionIcon,
} from '@mantine/core';
import {
  IconWand,
  IconForms,
  IconPencil,
  IconPlayerStop,
  IconPaperclip,
  IconX,
  IconFile,
} from '@tabler/icons-react';
import { useWorkbenchStore } from '@/store/workbench';
import { useShallow } from 'zustand/react/shallow';
import { WORKFLOW_MODULES, WORKFLOW_ORDER, resolveLabel, generateId } from '@/utils';
import { INPUT_STYLES, BTN_STOP, btnPrimary } from '@/theme/styles';
import type { InputMode, PatentArtifact } from '@/types';
import { useI18n } from '@/i18n/useI18n';

const MAX_FILE_BYTES = 500_000;
const ACCEPTED_TEXT_TYPES = '.txt,.md,.json,.csv,.xml,.yaml,.yml,.log';

// Context summary shown in sections 02+ auto tab
function ContextSummary({
  artifact,
  moduleId,
}: Readonly<{
  artifact: PatentArtifact;
  moduleId: string;
}>) {
  const tr = (s: string, max: number) => (s.length > max ? `${s.slice(0, max)}…` : s);
  const { t } = useI18n();

  const stopIdx = WORKFLOW_ORDER.indexOf(moduleId);
  const priorDone = WORKFLOW_ORDER.slice(0, stopIdx)
    .filter((m) => artifact.sections[m])
    .slice(-3);

  return (
    <Box className="bg-surface-raised border border-stroke rounded-md px-3.5 py-3">
      <Text
        size="xs"
        ff="monospace"
        fw={700}
        className="text-fg-muted tracking-[0.08em] mb-2.5 uppercase"
      >
        {t('res_ContextForGeneration')}
      </Text>
      <Stack gap={10}>
        <Box>
          <Text
            size="xs"
            ff="monospace"
            fw={600}
            className="text-accent tracking-[0.05em] mb-0.5 uppercase"
          >
            {t('res_InventionConcept')}
          </Text>
          <Text size="xs" className="text-fg leading-normal">
            {tr(artifact.baseIdea, 200)}
          </Text>
        </Box>

        {artifact.baseDomain && (
          <Box>
            <Text
              size="xs"
              ff="monospace"
              fw={600}
              className="text-accent tracking-[0.05em] mb-0.5 uppercase"
            >
              {t('res_Domain')}
            </Text>
            <Text size="xs" className="text-fg">
              {artifact.baseDomain}
            </Text>
          </Box>
        )}

        {artifact.constraints && (
          <Box>
            <Text
              size="xs"
              ff="monospace"
              fw={600}
              className="text-accent tracking-[0.05em] mb-0.5 uppercase"
            >
              {t('res_Notes')}
            </Text>
            <Text size="xs" className="text-fg leading-normal">
              {tr(artifact.constraints, 120)}
            </Text>
          </Box>
        )}

        {priorDone.length > 0 && (
          <Box>
            <Text
              size="xs"
              ff="monospace"
              fw={600}
              className="text-accent tracking-[0.05em] mb-1.5 uppercase"
            >
              {t('res_PriorSections')}
            </Text>
            <Stack gap={6}>
              {priorDone.map((m) => (
                <Box key={m}>
                  <Text size="xs" ff="monospace" className="text-fg-muted mb-0.5">
                    [{resolveLabel(m, t)}]
                  </Text>
                  <Text size="xs" className="text-fg leading-[1.4]">
                    {tr(artifact.sections[m]!.content, 200)}
                  </Text>
                </Box>
              ))}
            </Stack>
          </Box>
        )}

        {artifact.contextFiles?.length ? (
          <Box>
            <Text
              size="xs"
              ff="monospace"
              fw={600}
              className="text-accent tracking-[0.05em] mb-0.5 uppercase"
            >
              {t('res_ReferenceDocuments')}
            </Text>
            <Text size="xs" ff="monospace" className="text-fg">
              {artifact.contextFiles.map((f) => f.name).join(', ')}
            </Text>
            <Text size="xs" className="text-fg-muted mt-0.5">
              {t('res_IncludedAsRagContext')}
            </Text>
          </Box>
        ) : null}
      </Stack>
    </Box>
  );
}

interface Props {
  readonly moduleId: string;
  readonly hideModeSelector?: boolean;
}

export function StepInputPanel({ moduleId, hideModeSelector = false }: Props) {
  const {
    artifact,
    steps,
    currentStepIndex,
    generationStatus,
    generateStepOptions,
    cancelGeneration,
    submitManualContent,
    setStepInputState,
    updateArtifactBase,
    updateContextFiles,
    llmStatus,
    appSettings,
  } = useWorkbenchStore(
    useShallow((s) => ({
      artifact: s.artifact,
      steps: s.steps,
      currentStepIndex: s.currentStepIndex,
      generationStatus: s.generationStatus,
      generateStepOptions: s.generateStepOptions,
      cancelGeneration: s.cancelGeneration,
      submitManualContent: s.submitManualContent,
      setStepInputState: s.setStepInputState,
      updateArtifactBase: s.updateArtifactBase,
      updateContextFiles: s.updateContextFiles,
      llmStatus: s.llmStatus,
      appSettings: s.appSettings,
    }))
  );

  const fileInputRef = useRef<HTMLInputElement>(null);
  const module = WORKFLOW_MODULES[moduleId];
  const isGenerating = generationStatus === 'loading';
  const isFirstStep = currentStepIndex === 0;
  const { t } = useI18n();
  const llmOffline = llmStatus !== 'ok';

  const step = steps[currentStepIndex];
  const mode: InputMode = step?.inputMode ?? 'auto';

  // Force manual mode when LLM is offline
  useEffect(() => {
    if (llmOffline && (mode === 'auto' || mode === 'guided')) {
      setStepInputState(currentStepIndex, { inputMode: 'manual' });
    }
  }, [llmOffline, mode, currentStepIndex, setStepInputState]);
  const guidedFields: Record<string, string> = step?.guidedFields ?? {};
  const manualText: string = step?.manualDraft ?? '';
  const hasAnyGuidedInput = Object.values(guidedFields).some((v) => v.trim().length > 0);

  const setMode = (m: InputMode) => setStepInputState(currentStepIndex, { inputMode: m });
  const setField = (key: string, value: string) =>
    setStepInputState(currentStepIndex, { guidedFields: { ...guidedFields, [key]: value } });
  const setManualText = (value: string) =>
    setStepInputState(currentStepIndex, { manualDraft: value });

  const handleGenerate = () => {
    if (mode === 'auto') {
      generateStepOptions();
    } else if (mode === 'guided' && artifact) {
      const guidedPrompt = `${module.systemContext(appSettings.numOptions)}\n\n---\n\n${module.buildGuidedPrompt(artifact, guidedFields, appSettings.numOptions)}`;
      generateStepOptions(guidedPrompt);
    }
  };

  const handleManualConfirm = () => {
    if (manualText.trim()) submitManualContent(manualText.trim());
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []).filter((f) => f.size <= MAX_FILE_BYTES);
    Promise.all(
      files.map(async (file) => ({
        id: generateId(),
        name: file.name,
        content: await file.text(),
        size: file.size,
      }))
    ).then((newFiles) => {
      const existing = artifact?.contextFiles ?? [];
      updateContextFiles([...existing, ...newFiles]);
    });
    e.target.value = '';
  };

  const removeContextFile = (id: string) => {
    const updated = (artifact?.contextFiles ?? []).filter((f) => f.id !== id);
    updateContextFiles(updated);
  };

  const generateBtn = isGenerating ? (
    <Button
      leftSection={<IconPlayerStop size={14} />}
      onClick={cancelGeneration}
      size="sm"
      style={BTN_STOP}
    >
      <span className="uppercase">{t('res_StopGeneration')}</span>
    </Button>
  ) : (
    <Button
      leftSection={<IconWand size={14} />}
      onClick={handleGenerate}
      size="sm"
      style={btnPrimary(true)}
    >
      <span className="uppercase">{t('res_Generate')}</span>
    </Button>
  );

  return (
    <Box style={{ maxWidth: 540, margin: '0 auto', padding: '24px 0' }}>
      {/* Mode selector — active label color set via .step-seg CSS in styles.css */}
      {!hideModeSelector && (
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
              disabled: llmOffline,
              label: (
                <Group gap={5} justify="center">
                  <IconWand size={14} />
                  <span>{t('res_Mode_Auto')}</span>
                </Group>
              ),
            },
            {
              value: 'guided',
              disabled: llmOffline,
              label: (
                <Group gap={5} justify="center">
                  <IconForms size={14} />
                  <span>{t('res_Mode_Guided')}</span>
                </Group>
              ),
            },
            {
              value: 'manual',
              label: (
                <Group gap={5} justify="center">
                  <IconPencil size={14} />
                  <span>{t('res_Mode_Manual')}</span>
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
      )}

      {/* AUTO mode */}
      {mode === 'auto' && (
        <Stack gap={12}>
          {isFirstStep
            ? artifact && (
                <Stack gap={14}>
                  <Textarea
                    label={t('res_InventionConcept')}
                    description={t('res_InventionConcept_Description')}
                    placeholder={t('res_InventionConcept_Placeholder')}
                    value={artifact.baseIdea}
                    onChange={(e) =>
                      updateArtifactBase(
                        e.currentTarget.value,
                        artifact.baseDomain,
                        artifact.constraints
                      )
                    }
                    minRows={5}
                    autosize
                    disabled={isGenerating}
                    styles={INPUT_STYLES}
                  />
                  <TextInput
                    label={t('res_TechnologyDomain')}
                    description={t('res_TechnologyDomain_Description')}
                    placeholder={t('res_TechnologyDomain_Placeholder')}
                    value={artifact.baseDomain}
                    onChange={(e) =>
                      updateArtifactBase(
                        artifact.baseIdea,
                        e.currentTarget.value,
                        artifact.constraints
                      )
                    }
                    disabled={isGenerating}
                    styles={INPUT_STYLES}
                  />
                  <Textarea
                    label={t('res_ConstraintsNotes')}
                    description={t('res_ConstraintsNotes_Description')}
                    placeholder={t('res_ConstraintsNotes_Placeholder')}
                    value={artifact.constraints ?? ''}
                    onChange={(e) =>
                      updateArtifactBase(
                        artifact.baseIdea,
                        artifact.baseDomain,
                        e.currentTarget.value || undefined
                      )
                    }
                    minRows={3}
                    autosize
                    disabled={isGenerating}
                    styles={INPUT_STYLES}
                  />

                  {/* Context files */}
                  <Box>
                    <Group justify="space-between" align="center" mb={6}>
                      <Text className="font-mono text-[11px] font-bold tracking-[0.06em] uppercase text-fg-secondary">
                        {t('res_ReferenceDocuments')}
                      </Text>
                      <Button
                        size="xs"
                        variant="subtle"
                        leftSection={<IconPaperclip size={14} />}
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isGenerating}
                        className="font-mono text-[11px] text-accent uppercase"
                      >
                        {t('res_Attach')}
                      </Button>
                      <input
                        aria-label={t('res_Attach')}
                        ref={fileInputRef}
                        type="file"
                        accept={ACCEPTED_TEXT_TYPES}
                        multiple
                        className="hidden"
                        onChange={handleFileChange}
                      />
                    </Group>

                    {artifact.contextFiles?.length ? (
                      <Stack gap={4}>
                        {artifact.contextFiles.map((f) => (
                          <Group
                            key={f.id}
                            gap={8}
                            wrap="nowrap"
                            className="bg-surface-raised border border-stroke rounded py-1.25 px-2.5"
                          >
                            <IconFile size={14} className="text-fg-muted shrink-0" />
                            <Text size="xs" ff="monospace" className="flex-1 text-fg truncate">
                              {f.name}
                            </Text>
                            <Text size="xs" ff="monospace" className="text-fg-muted shrink-0">
                              {(f.size / 1024).toFixed(1)} KB
                            </Text>
                            <ActionIcon
                              size="xs"
                              variant="subtle"
                              color="red"
                              onClick={() => removeContextFile(f.id)}
                              disabled={isGenerating}
                              aria-label={`${t('res_Remove')} ${f.name}`}
                            >
                              <IconX size={11} />
                            </ActionIcon>
                          </Group>
                        ))}
                      </Stack>
                    ) : (
                      <Text size="xs" c="var(--text-muted)">
                        {t('res_AttachFiles_Hint')}
                      </Text>
                    )}
                  </Box>
                </Stack>
              )
            : artifact && <ContextSummary artifact={artifact} moduleId={moduleId} />}

          {generateBtn}
        </Stack>
      )}

      {/* GUIDED mode */}
      {mode === 'guided' && (
        <Stack gap={14}>
          <Text size="sm" c="var(--text-muted)" style={{ lineHeight: 1.6 }}>
            {t('res_Guided_Instructions')}
          </Text>

          {module.guidedFields.map((field) => (
            <Textarea
              aria-label={t(field.labelKey)}
              key={field.key}
              label={t(field.labelKey)}
              placeholder={t(field.placeholderKey)}
              value={guidedFields[field.key] ?? ''}
              onChange={(e) => setField(field.key, e.currentTarget.value)}
              minRows={3}
              autosize
              disabled={isGenerating}
              styles={INPUT_STYLES}
            />
          ))}

          {isGenerating ? (
            <Button
              leftSection={<IconPlayerStop size={14} />}
              onClick={cancelGeneration}
              size="sm"
              style={BTN_STOP}
            >
              <span className="uppercase">{t('res_StopGeneration')}</span>
            </Button>
          ) : (
            <Button
              leftSection={<IconForms size={14} />}
              onClick={handleGenerate}
              disabled={!hasAnyGuidedInput}
              size="sm"
              style={btnPrimary(hasAnyGuidedInput)}
            >
              <span className="uppercase">{t('res_Generate')}</span>
            </Button>
          )}
        </Stack>
      )}

      {/* MANUAL mode */}
      {mode === 'manual' && (
        <Stack gap={14}>
          <Text size="sm" c="var(--text-muted)" style={{ lineHeight: 1.6 }}>
            {t('res_Manual_Instructions')}
          </Text>
          <Textarea
            label={`${resolveLabel(moduleId, t)} — ${t('res_ManualEntry')}`}
            placeholder={t('res_Manual_Placeholder', {
              section: resolveLabel(moduleId, t).toLowerCase(),
            })}
            value={manualText}
            onChange={(e) => setManualText(e.currentTarget.value)}
            minRows={8}
            autosize
            styles={INPUT_STYLES}
          />
          <Button
            leftSection={<IconPencil size={14} />}
            onClick={handleManualConfirm}
            disabled={!manualText.trim()}
            size="sm"
            style={btnPrimary(!!manualText.trim())}
          >
            <span className="uppercase">{t('res_ConfirmManualEntry')}</span>
          </Button>
        </Stack>
      )}
    </Box>
  );
}
