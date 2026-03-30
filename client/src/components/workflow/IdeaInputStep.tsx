import { useState } from 'react';
import {
  Stack,
  Textarea,
  TextInput,
  Button,
  Text,
  Group,
  Box,
  Select,
} from '@mantine/core';
import { IconBrain, IconWand } from '@tabler/icons-react';
import { useWorkbenchStore } from '@/store/workbench';

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
  const { startWorkflow, llmStatus, selectedModel, availableModels, setModel } =
    useWorkbenchStore();

  const [idea, setIdea] = useState('');
  const [domain, setDomain] = useState('');
  const [constraints, setConstraints] = useState('');

  const canStart = idea.trim().length > 0 && llmStatus === 'ok';

  const handleStart = () => {
    startWorkflow(idea, domain, constraints || undefined);
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
