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
    startWorkflow(idea, domain, constraints || undefined, contextFiles.length ? contextFiles : undefined);
  };

  return (
    <Box style={{ maxWidth: 660, margin: '0 auto', padding: '48px 24px' }}>
      {/* Header */}
      <Stack gap={6} mb={32}>
        <Group gap={10}>
          <IconBrain size={35} className="text-accent" />
          <Text
            component="h2"
            fw={700}
            size="xl"
            className="font-display tracking-wide text-fg"
          >
            Describe Your Invention
          </Text>
        </Group>
        <Text size="sm" c="var(--text-muted)" style={{ lineHeight: 1.6 }}>
          The guided workflow will analyze your idea and generate 3 distinct options at each
          patent section — you pick the best one at every step.
        </Text>
      </Stack>

      <Stack gap={18}>
        <Textarea
          label="Invention Concept"
          description="What does your invention do? What problem does it solve?"
          placeholder="Describe the core idea, mechanism, or technical approach of your invention..."
          value={idea}
          onChange={(e) => setIdea(e.currentTarget.value)}
          minRows={5}
          maxRows={10}
          required
          styles={INPUT_STYLES}
        />

        <TextInput
          label="Technology Domain"
          description="e.g., Telecommunications, Medical Devices, Software, Mechanical Systems"
          placeholder="e.g., Artificial Intelligence / Natural Language Processing"
          value={domain}
          onChange={(e) => setDomain(e.currentTarget.value)}
          styles={INPUT_STYLES}
        />

        <Textarea
          label="Constraints & Notes"
          description="Optional. Key prior art, technical scope constraints, or inventor notes."
          placeholder="e.g., Must work offline, targets embedded devices, prior art includes..."
          value={constraints}
          onChange={(e) => setConstraints(e.currentTarget.value)}
          minRows={3}
          maxRows={6}
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
                Reference Documents{' '}
                <span className="font-normal text-fg-muted">(16k+ context length required)</span>
              </Text>
            }
          />
        )}

        {/* Context files panel */}
        {supportsContextFiles && (
          <Box>
            <Group justify="space-between" align="center" mb={6}>
              <Text className="font-mono text-[11px] font-bold tracking-[0.06em] uppercase text-fg-secondary">
                Reference Documents
              </Text>
              <Button
                size="xs"
                variant="subtle"
                leftSection={<IconPaperclip size={12} />}
                onClick={() => fileInputRef.current?.click()}
                className="font-mono text-[11px] text-accent"
              >
                ATTACH FILE
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
              Attach text files (TXT, MD, JSON, CSV…) to include as context. Max 500 KB per file.
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
                      aria-label={`Remove ${f.name}`}
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
            label="Model"
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
          >
            START WORKFLOW
          </Button>
        </Group>

        {llmStatus !== 'ok' && (
          <Text
            size="xs"
            c={llmStatus === 'checking' ? 'var(--text-muted)' : 'red'}
            ff="monospace"
          >
            {llmStatus === 'checking'
              ? 'Checking LLM status...'
              : 'LLM is offline. Start Ollama before beginning.'}
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
