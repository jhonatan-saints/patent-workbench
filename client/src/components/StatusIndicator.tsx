import { useEffect } from 'react';
import { Group, Badge, Text, Tooltip, ActionIcon } from '@mantine/core';
import { IconRefresh, IconCircleFilled } from '@tabler/icons-react';
import { useWorkbenchStore } from '@/store/workbench';

export function StatusIndicator() {
  const { llmStatus, llmLatency, checkStatus } = useWorkbenchStore();

  useEffect(() => {
    checkStatus();
    const interval = setInterval(checkStatus, 30_000);
    return () => clearInterval(interval);
  }, [checkStatus]);

  let label;
  let color;

  if (llmStatus === 'ok') {
    color = 'var(--status-online)';
    label = 'LLM ONLINE';
  } else if (llmStatus === 'unavailable') {
    color = 'var(--status-offline)';
    label = 'LLM OFFLINE';
  } else {
    color = 'var(--status-checking)';
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
                color: color,
                animation: llmStatus === 'checking' ? 'pulse 1s infinite' : undefined,
              }}
            />
          }
          style={{
            borderColor: color,
            color: color,
            fontFamily: 'var(--font-mono)',
            fontSize: '11px',
            letterSpacing: '0.08em',
          }}
        >
          {label}
        </Badge>
      </Tooltip>

      {llmLatency != null && llmStatus === 'ok' && (
        <Text style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
          {llmLatency}ms
        </Text>
      )}

      <ActionIcon
        variant="subtle"
        size="xs"
        onClick={checkStatus}
        title="Refresh status"
        style={{ color: 'var(--text-muted)' }}
      >
        <IconRefresh size={14} />
      </ActionIcon>
    </Group>
  );
}
