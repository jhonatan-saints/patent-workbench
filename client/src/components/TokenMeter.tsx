import { Box, Text, Group, Progress, Tooltip } from '@mantine/core';
import { useWorkbenchStore } from '@/store/workbench';
import { estimateTokens } from '@/utils/templates';

// Approximate context window sizes per model (TBD: fetch this from API)
const MODEL_CONTEXT: Record<string, number> = {
  mistral: 8192,
  llama3: 8192,
  'llama3.1': 128000,
  phi3: 4096,
  gemma2: 8192,
  codellama: 16384,
};

const DEFAULT_CONTEXT = 8192;

export function TokenMeter() {
  const { currentPrompt, selectedModel, history } = useWorkbenchStore();

  const contextLimit = MODEL_CONTEXT[selectedModel.split(':')[0]] ?? DEFAULT_CONTEXT;
  const promptTokens = estimateTokens(currentPrompt);
  const sessionTokens = history.reduce((acc, r) => acc + r.promptTokens + r.completionTokens, 0);
  const usagePercent = Math.min((promptTokens / contextLimit) * 100, 100);

  let color = '#4ade80';
  if (usagePercent > 80) color = '#f87171';
  else if (usagePercent > 50) color = '#fbbf24';

  return (
    <Box
      style={{
        padding: '8px 12px',
        border: '1px solid var(--border)',
        borderRadius: 4,
        background: 'var(--surface)',
      }}
    >
      <Group justify="space-between" mb={6}>
        <Text size="xs" fw={600} tt="uppercase" ff="monospace" c="var(--text-muted)" className="tracking-[1px]">
          Token Budget
        </Text>
        <Text size="xs" ff="monospace" style={{ color }}>
          {promptTokens.toLocaleString()} / {contextLimit.toLocaleString()}
        </Text>
      </Group>

      <Tooltip
        label={`${usagePercent.toFixed(1)}% of ${selectedModel} context window`}
        position="top"
      >
        <Progress
          value={usagePercent}
          size={4}
          style={{ cursor: 'default' }}
          styles={{
            root: { background: 'var(--border)' },
            section: { background: color, transition: 'width 0.3s ease' },
          }}
        />
      </Tooltip>

      <Group justify="space-between" mt={6}>
        <Text size="xs" c="var(--text-muted)" ff="monospace">
          session: {sessionTokens.toLocaleString()}t total
        </Text>
        <Text size="xs" c="var(--text-muted)" ff="monospace">
          {selectedModel.split(':')[0]}
        </Text>
      </Group>
    </Box>
  );
}
