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
import type { ContextFile } from '@/types';

const ACCEPTED_TEXT_TYPES = '.txt,.md,.json,.csv,.xml,.yaml,.yml,.log';
const MAX_FILE_BYTES = 500_000; // 500 KB per file

const INPUT_STYLES = {
  label: {
    fontFamily: 'var(--font-mono)',
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.06em',
    textTransform: 'uppercase' as const,
    color: 'var(--text-secondary)',
  },
  description: { color: 'var(--text-muted)', fontSize: 12 },
  input: {
    background: 'var(--surface-raised)',
    border: '1px solid var(--border)',
    color: 'var(--text-primary)',
  },
};

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
          <IconBrain size={35} style={{ color: 'var(--accent)' }} />
          <Text
            component="h2"
            fw={700}
            size="xl"
            className="font-display tracking-wide"
            style={{ color: 'var(--text-primary)' }}
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
              <Text size="xs" ff="monospace" style={{ color: 'var(--text-muted)' }}>
                Reference Documents <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(16k+ context length required)</span>
              </Text>
            }
          />
        )}

        {/* Context files panel */}
        {supportsContextFiles && (
          <Box>
            <Group justify="space-between" align="center" mb={6}>
              <Text style={INPUT_STYLES.label}>Reference Documents</Text>
              <Button
                size="xs"
                variant="subtle"
                leftSection={<IconPaperclip size={12} />}
                onClick={() => fileInputRef.current?.click()}
                style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--accent)' }}
              >
                ATTACH FILE
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
            <Text size="xs" c="var(--text-muted)" mb={contextFiles.length ? 8 : 0}>
              Attach text files (TXT, MD, JSON, CSV…) to include as context. Max 500 KB per file.
            </Text>
            {contextFiles.length > 0 && (
              <Stack gap={4}>
                {contextFiles.map((f) => (
                  <Group key={f.id} gap={8} wrap="nowrap"
                    style={{
                      background: 'var(--surface-raised)',
                      border: '1px solid var(--border)',
                      borderRadius: 4,
                      padding: '5px 10px',
                    }}
                  >
                    <IconFile size={12} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                    <Text size="xs" ff="monospace" style={{ flex: 1, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {f.name}
                    </Text>
                    <Text size="xs" ff="monospace" style={{ color: 'var(--text-muted)', flexShrink: 0 }}>
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
            style={{
              background: canStart ? 'var(--accent)' : 'var(--surface-raised)',
              color: canStart ? 'var(--accent-text)' : 'var(--text-muted)',
              fontFamily: 'var(--font-mono)',
              fontWeight: 700,
              fontSize: 12,
              letterSpacing: '0.08em',
              border: 'none',
            }}
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
        {/* Left animated line */}
        <div
          className="origin-left animate-grow-line-side"
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            height: '2px',
            width: '50%',
            background: 'linear-gradient(to left, transparent 0%, var(--accent) 80%)',
            borderRadius: '2px',
            boxShadow: '0 0 2px var(--accent-glow)',
            transform: 'translateY(-50%) scaleX(0)',
          }}
        />
        {/* Right animated line */}
        <div
          className="origin-right animate-grow-line-side"
          style={{
            position: 'absolute',
            right: '50%',
            top: '50%',
            height: '2px',
            width: '50%',
            background: 'linear-gradient(to right, transparent 0%, var(--accent) 80%)',
            borderRadius: '2px',
            boxShadow: '0 0 2px var(--accent-glow)',
            transform: 'translateY(-50%) scaleX(0)',
          }}
        />
        {/* Center dot (always visible) */}
        <div
          className="z-10"
          style={{
            width: 10,
            height: 10,
            borderRadius: '50%',
            background: 'var(--accent)',
            boxShadow: '0 0 8px var(--accent-glow)',
            position: 'absolute',
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%)',
          }}
        />
      </div>
    </Box>
  );
}
