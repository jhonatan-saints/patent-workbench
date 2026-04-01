import { useEffect } from 'react';
import { Group, Badge, Text, Tooltip, ActionIcon } from '@mantine/core';
import { IconRefresh, IconCircleFilled } from '@tabler/icons-react';
import { useWorkbenchStore } from '@/store/workbench';

const STATUS_MAP = {
  ok:          { color: 'var(--status-online)',   label: 'LLM ONLINE'  },
  unavailable: { color: 'var(--status-offline)',  label: 'LLM OFFLINE' },
  checking:    { color: 'var(--status-checking)', label: 'CHECKING...' },
} satisfies Record<string, { color: string; label: string }>;

export function StatusIndicator() {
  const { llmStatus, llmLatency, checkStatus } = useWorkbenchStore();

  useEffect(() => {
    checkStatus();
    const interval = setInterval(checkStatus, 30_000);
    return () => clearInterval(interval);
  }, [checkStatus]);

  const { color, label } = STATUS_MAP[llmStatus] ?? STATUS_MAP.checking;

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
              style={{ color }}
              className={llmStatus === 'checking' ? 'animate-[pulse_1s_infinite]' : undefined}
            />
          }
          className="font-mono text-[11px] tracking-[0.08em]"
          style={{ borderColor: color, color }}
        >
          {label}
        </Badge>
      </Tooltip>

      {llmLatency != null && llmStatus === 'ok' && (
        <Text className="text-[11px] text-fg-muted font-mono">
          {llmLatency}ms
        </Text>
      )}

      <ActionIcon
        variant="subtle"
        size="xs"
        onClick={checkStatus}
        title="Refresh status"
        className="text-fg-muted"
      >
        <IconRefresh size={14} />
      </ActionIcon>
    </Group>
  );
}
