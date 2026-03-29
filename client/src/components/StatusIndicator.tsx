import { useEffect } from 'react';
import { Group, Badge, Text, Tooltip, ActionIcon } from '@mantine/core';
import { IconRefresh, IconCircleFilled } from '@tabler/icons-react';
import { useWorkbenchStore } from '../store/workbench';

export function StatusIndicator() {
  const { llmStatus, llmLatency, checkStatus } = useWorkbenchStore();

  useEffect(() => {
    checkStatus();
    const interval = setInterval(checkStatus, 30_000);
    return () => clearInterval(interval);
  }, [checkStatus]);


  let color;
  if (llmStatus === 'ok') {
    color = '#4ade80';
  } else if (llmStatus === 'unavailable') {
    color = '#f87171';
  } else {
    color = '#fbbf24';
  }

  let label;
  if (llmStatus === 'ok') {
    label = 'LLM ONLINE';
  } else if (llmStatus === 'unavailable') {
    label = 'LLM OFFLINE';
  } else {
    label = 'CHECKING...';
  }

  return (
    <Group gap={8}>
      <Tooltip
        label={llmLatency === null ? 'Checking connection...' : `Latency: ${llmLatency}ms`}
        position="bottom"
      >
        <Badge
          variant="outline"
          size="sm"
          leftSection={
            <IconCircleFilled
              size={8}
              style={{
                color,
                animation: llmStatus === 'checking' ? 'pulse 1s infinite' : undefined,
              }}
            />
          }
          style={{
            borderColor: color,
            color,
            fontFamily: 'var(--font-mono)',
            fontSize: '10px',
            letterSpacing: '0.08em',
          }}
        >
          {label}
        </Badge>
      </Tooltip>

      {llmLatency != null && llmStatus === 'ok' && (
        <Text size="xs" c="dimmed" ff="monospace">
          {llmLatency}ms
        </Text>
      )}

      <ActionIcon
        variant="subtle"
        size="xs"
        onClick={checkStatus}
        title="Refresh status"
        style={{ color: 'var(--mantine-color-dimmed)' }}
      >
        <IconRefresh size={12} />
      </ActionIcon>
    </Group>
  );
}
