import { useRef } from 'react';
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
import { WORKFLOW_MODULES, SECTION_LABELS, WORKFLOW_ORDER } from '@/utils/workflowTemplates';
import type { WorkflowModuleId, InputMode, PatentArtifact } from '@/types';
import { generateId } from '@/utils/sanitize';

const MAX_FILE_BYTES = 500_000;
const ACCEPTED_TEXT_TYPES = '.txt,.md,.json,.csv,.xml,.yaml,.yml,.log';

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

const GENERATE_BTN = {
  background: 'var(--accent)',
  color: 'var(--accent-text)',
  fontFamily: 'var(--font-mono)',
  fontWeight: 700,
  fontSize: 12,
  letterSpacing: '0.08em',
  border: 'none',
} as const;

const STOP_BTN = {
  background: '#c0392b',
  color: '#fff',
  fontFamily: 'var(--font-mono)',
  fontWeight: 700,
  fontSize: 12,
  letterSpacing: '0.08em',
  border: 'none',
} as const;

// Context summary shown in sections 02+ auto tab
function ContextSummary({ artifact, moduleId }: { artifact: PatentArtifact; moduleId: WorkflowModuleId }) {
  const tr = (s: string, max: number) => (s.length > max ? `${s.slice(0, max)}…` : s);

  const stopIdx = WORKFLOW_ORDER.indexOf(moduleId);
  const priorDone = WORKFLOW_ORDER.slice(0, stopIdx)
    .filter((m) => artifact.sections[m])
    .slice(-3);

  return (
    <Box
      style={{
        background: 'var(--surface-raised)',
        border: '1px solid var(--border)',
        borderRadius: 6,
        padding: '12px 14px',
      }}
    >
      <Text
        size="xs"
        ff="monospace"
        fw={700}
        style={{ color: 'var(--text-muted)', letterSpacing: '0.08em', marginBottom: 10 }}
      >
        CONTEXT FOR GENERATION
      </Text>
      <Stack gap={10}>
        <Box>
          <Text
            size="xs"
            ff="monospace"
            fw={600}
            style={{ color: 'var(--accent)', letterSpacing: '0.05em', marginBottom: 3 }}
          >
            INVENTION CONCEPT
          </Text>
          <Text size="xs" style={{ color: 'var(--text-primary)', lineHeight: 1.5 }}>
            {tr(artifact.baseIdea, 200)}
          </Text>
        </Box>

        {artifact.baseDomain && (
          <Box>
            <Text
              size="xs"
              ff="monospace"
              fw={600}
              style={{ color: 'var(--accent)', letterSpacing: '0.05em', marginBottom: 3 }}
            >
              DOMAIN
            </Text>
            <Text size="xs" style={{ color: 'var(--text-primary)' }}>
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
              style={{ color: 'var(--accent)', letterSpacing: '0.05em', marginBottom: 3 }}
            >
              NOTES
            </Text>
            <Text size="xs" style={{ color: 'var(--text-primary)', lineHeight: 1.5 }}>
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
              style={{ color: 'var(--accent)', letterSpacing: '0.05em', marginBottom: 6 }}
            >
              PRIOR SECTIONS
            </Text>
            <Stack gap={6}>
              {priorDone.map((m) => (
                <Box key={m}>
                  <Text
                    size="xs"
                    ff="monospace"
                    style={{ color: 'var(--text-muted)', marginBottom: 2 }}
                  >
                    [{SECTION_LABELS[m]}]
                  </Text>
                  <Text size="xs" style={{ color: 'var(--text-primary)', lineHeight: 1.4 }}>
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
              style={{ color: 'var(--accent)', letterSpacing: '0.05em', marginBottom: 3 }}
            >
              REFERENCE DOCUMENTS
            </Text>
            <Text size="xs" ff="monospace" style={{ color: 'var(--text-primary)' }}>
              {artifact.contextFiles.map((f) => f.name).join(', ')}
            </Text>
            <Text size="xs" style={{ color: 'var(--text-muted)', marginTop: 3 }}>
              Included as RAG context (token-optimized)
            </Text>
          </Box>
        ) : null}
      </Stack>
    </Box>
  );
}

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
    updateArtifactBase,
    updateContextFiles,
  } = useWorkbenchStore();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const module = WORKFLOW_MODULES[moduleId];
  const isGenerating = generationStatus === 'loading';
  const isFirstStep = currentStepIndex === 0;

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
      leftSection={<IconPlayerStop size={13} />}
      onClick={cancelGeneration}
      size="sm"
      style={STOP_BTN}
    >
      STOP GENERATION
    </Button>
  ) : (
    <Button
      leftSection={<IconWand size={13} />}
      onClick={handleGenerate}
      size="sm"
      style={GENERATE_BTN}
    >
      GENERATE
    </Button>
  );

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
          {isFirstStep ? (
            /* Section 01: editable base fields + file management */
            artifact && (
              <Stack gap={14}>
                <Textarea
                  label="Invention Concept"
                  description="What does your invention do? What problem does it solve?"
                  placeholder="Describe the core idea, mechanism, or technical approach of your invention..."
                  value={artifact.baseIdea}
                  onChange={(e) =>
                    updateArtifactBase(e.currentTarget.value, artifact.baseDomain, artifact.constraints)
                  }
                  minRows={5}
                  maxRows={10}
                  disabled={isGenerating}
                  styles={INPUT_STYLES}
                />
                <TextInput
                  label="Technology Domain"
                  description="e.g., Telecommunications, Medical Devices, Software, Mechanical Systems"
                  placeholder="e.g., Artificial Intelligence / Natural Language Processing"
                  value={artifact.baseDomain}
                  onChange={(e) =>
                    updateArtifactBase(artifact.baseIdea, e.currentTarget.value, artifact.constraints)
                  }
                  disabled={isGenerating}
                  styles={INPUT_STYLES}
                />
                <Textarea
                  label="Constraints & Notes"
                  description="Optional. Key prior art, technical scope constraints, or inventor notes."
                  placeholder="e.g., Must work offline, targets embedded devices, prior art includes..."
                  value={artifact.constraints ?? ''}
                  onChange={(e) =>
                    updateArtifactBase(
                      artifact.baseIdea,
                      artifact.baseDomain,
                      e.currentTarget.value || undefined
                    )
                  }
                  minRows={3}
                  maxRows={6}
                  disabled={isGenerating}
                  styles={INPUT_STYLES}
                />

                {/* Context files */}
                <Box>
                  <Group justify="space-between" align="center" mb={6}>
                    <Text style={LABEL_STYLES}>Reference Documents</Text>
                    <Button
                      size="xs"
                      variant="subtle"
                      leftSection={<IconPaperclip size={12} />}
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isGenerating}
                      style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--accent)' }}
                    >
                      ATTACH
                    </Button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept={ACCEPTED_TEXT_TYPES}
                      multiple
                      style={{ display: 'none' }}
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
                          style={{
                            background: 'var(--surface-raised)',
                            border: '1px solid var(--border)',
                            borderRadius: 4,
                            padding: '5px 10px',
                          }}
                        >
                          <IconFile size={12} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                          <Text
                            size="xs"
                            ff="monospace"
                            style={{
                              flex: 1,
                              color: 'var(--text-primary)',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {f.name}
                          </Text>
                          <Text
                            size="xs"
                            ff="monospace"
                            style={{ color: 'var(--text-muted)', flexShrink: 0 }}
                          >
                            {(f.size / 1024).toFixed(1)} KB
                          </Text>
                          <ActionIcon
                            size="xs"
                            variant="subtle"
                            color="red"
                            onClick={() => removeContextFile(f.id)}
                            disabled={isGenerating}
                            aria-label={`Remove ${f.name}`}
                          >
                            <IconX size={11} />
                          </ActionIcon>
                        </Group>
                      ))}
                    </Stack>
                  ) : (
                    <Text size="xs" c="var(--text-muted)">
                      Attach text files (TXT, MD, JSON…) to include as RAG context.
                    </Text>
                  )}
                </Box>
              </Stack>
            )
          ) : (
            /* Sections 02+: read-only context summary */
            artifact && <ContextSummary artifact={artifact} moduleId={moduleId} />
          )}

          {generateBtn}
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
              style={STOP_BTN}
            >
              STOP GENERATION
            </Button>
          ) : (
            <Button
              leftSection={<IconForms size={13} />}
              onClick={handleGenerate}
              size="sm"
              style={GENERATE_BTN}
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
