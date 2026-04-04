import { useState, useRef } from 'react';
import {
  Stack,
  Textarea,
  TextInput,
  Button,
  Text,
  Group,
  Box,
  Select,
  ActionIcon,
  Switch,
} from '@mantine/core';
import { IconBrain, IconWand, IconPaperclip, IconX, IconFile } from '@tabler/icons-react';
import { useWorkbenchStore } from '@/store/workbench';
import { generateId } from '@/utils/sanitize';
import { INPUT_STYLES, btnPrimary } from '@/theme/styles';
import type { ContextFile } from '@/types';
import { useI18n } from '@/i18n/useI18n';

const ACCEPTED_TEXT_TYPES = '.txt,.md,.json,.csv,.xml,.yaml,.yml,.log';
const MAX_FILE_BYTES = 500_000; // 500 KB per file
const ALLOWED_MIME_TYPES = new Set([
  'text/plain',
  'text/markdown',
  'text/csv',
  'text/xml',
  'application/json',
  'application/xml',
  'application/yaml',
]);

function formatModelLabel(name: string): string {
  return name.split(':')[0];
}

export function IdeaInputStep() {
  const { startWorkflow, llmStatus, selectedModel, availableModels, modelContextLength, setModel } =
    useWorkbenchStore();

  const { t } = useI18n();

  const [idea, setIdea] = useState('');
  const [domain, setDomain] = useState('');
  const [constraints, setConstraints] = useState('');
  const [contextFiles, setContextFiles] = useState<ContextFile[]>([]);
  const [contextFilesEnabled, setContextFilesEnabled] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canStart = idea.trim().length > 0 && llmStatus === 'ok';
  const autoDetected = modelContextLength !== null && modelContextLength >= 16384;
  const supportsContextFiles = autoDetected || contextFilesEnabled;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    for (const file of files) {
      if (file.size > MAX_FILE_BYTES) continue;
      // Reject non-text MIME types — defense-in-depth against renamed binary uploads
      const mime = file.type.toLowerCase();
      const isText = mime.startsWith('text/') || ALLOWED_MIME_TYPES.has(mime) || mime === '';
      if (!isText) continue;
      void file.text().then((content) => {
        setContextFiles((prev) => [
          ...prev,
          { id: generateId(), name: file.name, content, size: file.size },
        ]);
      });
    }
    e.target.value = '';
  };

  const removeContextFile = (id: string) =>
    setContextFiles((prev) => prev.filter((f) => f.id !== id));

  const handleStart = () => {
    startWorkflow(
      idea,
      domain,
      constraints || undefined,
      contextFiles.length ? contextFiles : undefined
    );
  };

  return (
    <Box style={{ maxWidth: 660, margin: '0 auto', padding: '48px 24px' }}>
      {/* Header */}
      <Stack gap={6} mb={32}>
        <Group gap={10}>
          <IconBrain size={35} className="text-accent" />
          <Text component="h2" fw={700} size="xl" className="font-display tracking-wide text-fg">
            {t('res_DescribeYourInvention')}
          </Text>
        </Group>
        <Text size="sm" c="var(--text-muted)" style={{ lineHeight: 1.6 }}>
          {t('res_GuidedWorkflowIntro')}
        </Text>
      </Stack>

      <Stack gap={18}>
        <Textarea
          label={t('res_InventionConcept')}
          description={t('res_InventionConcept_Description')}
          placeholder={t('res_InventionConcept_Placeholder')}
          value={idea}
          onChange={(e) => setIdea(e.currentTarget.value)}
          minRows={5}
          autosize
          required
          styles={INPUT_STYLES}
        />

        <TextInput
          label={t('res_TechnologyDomain')}
          description={t('res_TechnologyDomain_Description')}
          placeholder={t('res_TechnologyDomain_Placeholder')}
          value={domain}
          onChange={(e) => setDomain(e.currentTarget.value)}
          styles={INPUT_STYLES}
        />

        <Textarea
          label={t('res_ConstraintsNotes')}
          description={t('res_ConstraintsNotes_Description')}
          placeholder={t('res_ConstraintsNotes_Placeholder')}
          value={constraints}
          onChange={(e) => setConstraints(e.currentTarget.value)}
          minRows={3}
          autosize
          styles={INPUT_STYLES}
        />

        {/* Context files toggle — shown when not auto-detected */}
        {!autoDetected && (
          <Switch
            size="xs"
            checked={contextFilesEnabled}
            onChange={(e) => {
              const enabled = e.currentTarget.checked;
              setContextFilesEnabled(enabled);
              if (!enabled) setContextFiles([]);
            }}
            label={
              <Text size="xs" ff="monospace" className="text-fg-muted">
                {t('res_ReferenceDocuments')}{' '}
                <span className="font-normal text-fg-muted">{t('res_ContextLengthHint')}</span>
              </Text>
            }
          />
        )}

        {/* Context files panel */}
        {supportsContextFiles && (
          <Box>
            <Group justify="space-between" align="center" mb={6}>
              <Text className="font-mono text-[11px] font-bold tracking-[0.06em] uppercase text-fg-secondary">
                {t('res_ReferenceDocuments')}
              </Text>
              <Button
                size="xs"
                variant="subtle"
                leftSection={<IconPaperclip size={12} />}
                onClick={() => fileInputRef.current?.click()}
                className="uppercase font-mono text-[11px] text-accent"
              >
                {t('res_Attach')}
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPTED_TEXT_TYPES}
                multiple
                className="hidden"
                onChange={handleFileChange}
              />
            </Group>
            <Text size="xs" c="var(--text-muted)" mb={contextFiles.length ? 8 : 0}>
              {t('res_AttachFiles_Hint')}
            </Text>
            {contextFiles.length > 0 && (
              <Stack gap={4}>
                {contextFiles.map((f) => (
                  <Group
                    key={f.id}
                    gap={8}
                    wrap="nowrap"
                    className="bg-surface-raised border border-stroke rounded py-1.25 px-2.5"
                  >
                    <IconFile size={12} className="text-fg-muted shrink-0" />
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
                      aria-label={`${t('res_Remove')} ${f.name}`}
                    >
                      <IconX size={11} />
                    </ActionIcon>
                  </Group>
                ))}
              </Stack>
            )}
          </Box>
        )}

        {/* Model + Start */}
        <Group justify="space-between" align="flex-end" mt={4}>
          <Select
            label={t('res_Model')}
            value={selectedModel}
            onChange={(v) => v && setModel(v)}
            data={availableModels.map((m) => ({ value: m, label: formatModelLabel(m) }))}
            size="sm"
            style={{ width: 200 }}
            styles={{
              label: INPUT_STYLES.label,
              input: {
                ...INPUT_STYLES.input,
                fontFamily: 'var(--font-mono)',
                fontSize: 13,
              },
              dropdown: {
                background: 'var(--surface)',
                border: '1px solid var(--border)',
              },
            }}
          />

          <Button
            leftSection={<IconWand size={14} />}
            onClick={handleStart}
            disabled={!canStart}
            size="md"
            style={btnPrimary(canStart)}
            className="uppercase"
          >
            {t('res_StartWorkflow')}
          </Button>
        </Group>

        {llmStatus !== 'ok' && (
          <Text size="xs" c={llmStatus === 'checking' ? 'var(--text-muted)' : 'red'} ff="monospace">
            {llmStatus === 'checking' ? t('res_CheckingLLM') : t('res_LLMOffline')}
          </Text>
        )}
      </Stack>

      {/* Animated border with center dot (from center outwards) */}
      <div className="relative flex items-center justify-center h-7 mb-6 pt-30 select-none">
        <div
          className="origin-left animate-grow-line-side absolute top-1/2 left-1/2 h-0.5 w-1/2 rounded-sm"
          style={{
            background: 'linear-gradient(to left, transparent 0%, var(--accent) 80%)',
            boxShadow: '0 0 2px var(--accent-glow)',
            transform: 'translateY(-50%) scaleX(0)',
          }}
        />
        <div
          className="origin-right animate-grow-line-side absolute top-1/2 right-1/2 h-0.5 w-1/2 rounded-sm"
          style={{
            background: 'linear-gradient(to right, transparent 0%, var(--accent) 80%)',
            boxShadow: '0 0 2px var(--accent-glow)',
            transform: 'translateY(-50%) scaleX(0)',
          }}
        />
        <div
          className="z-10 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-accent"
          style={{ boxShadow: '0 0 8px var(--accent-glow)' }}
        />
      </div>
    </Box>
  );
}
