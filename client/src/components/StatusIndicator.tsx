import { useEffect } from 'react';
import { Group, Badge, Tooltip, ActionIcon } from '@mantine/core';
import { IconRefresh, IconCircleFilled } from '@tabler/icons-react';
import { useWorkbenchStore } from '@/store/workbench';
import { useI18n } from '@/i18n';

export function StatusIndicator() {
  const { llmStatus, llmLatency, checkStatus } = useWorkbenchStore();
  const { t } = useI18n();

  useEffect(() => {
    checkStatus();
    const interval = setInterval(checkStatus, 30_000);
    return () => clearInterval(interval);
  }, [checkStatus]);

  const STATUS_MAP = {
    ok: { color: 'var(--status-online)', label: t('res_LlmOnline') },
    unavailable: { color: 'var(--status-offline)', label: t('res_LlmOffline') },
    checking: { color: 'var(--status-checking)', label: t('res_Checking') },
  } satisfies Record<string, { color: string; label: string }>;

  const { color, label } = STATUS_MAP[llmStatus] ?? STATUS_MAP.checking;

  return (
    <Group gap={6} align="center" wrap="nowrap">
      <Tooltip label={t('res_RefreshStatus')} position="bottom">
        <ActionIcon
          variant="subtle"
          size="md"
          onClick={checkStatus}
          title={t('res_RefreshStatus')}
          className="text-fg-muted hover:text-accent"
        >
          <IconRefresh size={18} />
        </ActionIcon>
      </Tooltip>

      <Tooltip
        label={
          llmLatency === null ? t('res_CheckingConnection') : t('res_LatencyMs', { ms: llmLatency })
        }
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
          className="font-mono text-[11px] tracking-[0.08em] uppercase"
          style={{ borderColor: color, color }}
        >
          {label}
        </Badge>
      </Tooltip>
    </Group>
  );
}
