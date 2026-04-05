import {
  Stack,
  Text,
  Group,
  ActionIcon,
  Box,
  Tooltip,
  ScrollArea,
} from '@mantine/core';
import { IconTrash, IconClock, IconX } from '@tabler/icons-react';
import { useWorkbenchStore } from '@/store/workbench';
import { useI18n } from '@/i18n/useI18n';
import { WORKFLOW_ORDER } from '@/utils/workflowTemplates';
import type { WorkflowSession } from '@/types';

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function shortenModel(model: string): string {
  const base = model.split(':')[0];
  const part = base.includes('/') ? base.split('/').pop()! : base;
  const m = /claude-(\d+)-?(\d+)?-(\w+)/.exec(part);
  if (m) {
    const ver = m[2] ? `${m[1]}.${m[2]}` : m[1];
    return `c${ver}-${m[3]}`;
  }
  return part.slice(0, 14);
}

function SessionItem({
  session,
  onDelete,
  onLoad,
}: Readonly<{
  session: WorkflowSession;
  onDelete: () => void;
  onLoad: () => void;
}>) {
  const { t } = useI18n();
  const completedCount = WORKFLOW_ORDER.filter((m) => session.artifact.sections[m]).length;
  const progress = Math.round((completedCount / WORKFLOW_ORDER.length) * 100);
  const tokensLabel =
    session.totalTokens >= 1000
      ? `${(session.totalTokens / 1000).toFixed(1)}k`
      : `${session.totalTokens}`;

  return (
    <Box
      onClick={onLoad}
      className="group relative cursor-pointer rounded-md overflow-hidden"
      style={{
        background: 'var(--surface-raised)',
        border: '1px solid var(--border)',
        borderLeft: '2px solid var(--accent)',
        transition: 'box-shadow 180ms ease, border-color 180ms ease',
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.boxShadow =
          '0 4px 20px var(--accent-glow), 0 0 0 1px var(--accent)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.boxShadow = 'none';
      }}
    >
      {/* Left ambient glow */}
      <Box
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: 48,
          background: 'linear-gradient(90deg, var(--accent-glow) 0%, transparent 100%)',
          pointerEvents: 'none',
        }}
      />

      <Box style={{ padding: '10px 12px', position: 'relative' }}>
        {/* Title + delete */}
        <Group justify="space-between" wrap="nowrap" gap={6} align="flex-start">
          <Text
            size="xs"
            fw={600}
            ff="var(--font-body)"
            lineClamp={2}
            style={{ flex: 1, minWidth: 0, lineHeight: 1.45, color: 'var(--text-primary)' }}
          >
            {session.artifact.inventionTitle ?? session.baseIdea}
          </Text>
          <Tooltip label={t('res_RemoveSession')} position="left" withArrow>
            <ActionIcon
              aria-label={t('res_RemoveSession')}
              variant="subtle"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              style={{ opacity: 0, transition: 'opacity 150ms ease', flexShrink: 0 }}
              className="group-hover:opacity-100!"
            >
              <IconX size={14} style={{ color: 'var(--danger)' }} />
            </ActionIcon>
          </Tooltip>
        </Group>

        {/* Progress bar */}
        <Box
          style={{
            marginTop: 9,
            height: 2,
            borderRadius: 99,
            background: 'var(--border)',
            overflow: 'hidden',
          }}
        >
          <Box
            style={{
              width: `${progress}%`,
              height: '100%',
              borderRadius: 99,
              background:
                progress === 100
                  ? 'linear-gradient(90deg, var(--accent-dim), var(--accent))'
                  : 'var(--accent)',
              transition: 'width 600ms cubic-bezier(0.4, 0, 0.2, 1)',
            }}
          />
        </Box>

        {/* Metadata chips row */}
        <Group gap={0} mt={8} wrap="nowrap" align="center">
          {/* Step badge */}
          <Box
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '1px 6px',
              borderRadius: 4,
              border: '1px solid var(--accent)',
              background: 'var(--accent-glow)',
              fontSize: 11,
              fontFamily: 'var(--font-mono)',
              color: 'var(--accent)',
              fontWeight: 700,
              letterSpacing: '0.05em',
              lineHeight: 1.7,
              flexShrink: 0,
            }}
          >
            {completedCount}/{WORKFLOW_ORDER.length}
          </Box>

          {/* Separator */}
          <Box
            style={{ width: 1, height: 10, background: 'var(--border)', margin: '0 7px', flexShrink: 0 }}
          />

          {/* Tokens */}
          <Text
            ff="monospace"
            style={{ fontSize: 11, color: 'var(--text-secondary)', flexShrink: 0 }}
          >
            {tokensLabel}t
          </Text>

          {/* Dot */}
          <Text ff="monospace" style={{ fontSize: 11, color: 'var(--border)', margin: '0 5px', flexShrink: 0 }}>
            ·
          </Text>

          {/* Model */}
          <Text
            ff="monospace"
            style={{
              fontSize: 11,
              color: 'var(--text-secondary)',
              flex: 1,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {shortenModel(session.model)}
          </Text>

          {/* Time */}
          <Text
            ff="monospace"
            style={{ fontSize: 11, color: 'var(--text-secondary)', flexShrink: 0, marginLeft: 5 }}
          >
            {formatTime(session.startedAt)}
          </Text>
        </Group>
      </Box>
    </Box>
  );
}

export function SessionsPanel() {
  const { sessions, loadSession, deleteSession, clearSessions } = useWorkbenchStore();
  const { t } = useI18n();

  if (sessions.length === 0) {
    return (
      <Box
        style={{
          padding: '28px 12px',
          border: '1px dashed var(--border)',
          borderRadius: 8,
          background: 'var(--surface-raised)',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: '50%',
            background: 'var(--accent-glow)',
            border: '1px solid var(--accent)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 12px',
            boxSizing: 'border-box',
            flexShrink: 0,
            lineHeight: 0,
          }}
        >
          <IconClock size={16} style={{ color: 'var(--accent)', display: 'block' }} />
        </div>
        <Text
          size="xs"
          fw={600}
          ff="monospace"
          style={{ color: 'var(--text-secondary)', letterSpacing: '0.04em' }}
        >
          {t('res_NoSessionsYet')}
        </Text>
        <Text
          size="xs"
          style={{ color: 'var(--text-muted)', marginTop: 4, lineHeight: 1.7 }}
        >
          {t('res_CompletedWorkflowsHere')}
        </Text>
      </Box>
    );
  }

  return (
    <Stack gap={8}>
      {/* Count + clear row */}
      <Group justify="space-between" align="center">
        <Group gap={6} align="center">
          <Text
            ff="monospace"
            tt="uppercase"
            fw={700}
            style={{
              fontSize: 11,
              color: 'var(--text-muted)',
              letterSpacing: '0.12em',
            }}
          >
            {t('res_Sessions')}
          </Text>
          <Box
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              minWidth: 18,
              height: 16,
              padding: '0 5px',
              borderRadius: 99,
              background: 'var(--accent-glow)',
              border: '1px solid var(--accent)',
              fontSize: 11,
              fontFamily: 'var(--font-mono)',
              color: 'var(--accent)',
              fontWeight: 700,
            }}
          >
            {sessions.length}
          </Box>
        </Group>

        <Tooltip label={t('res_Clear')} position="left" withArrow>
          <ActionIcon
            variant="subtle"
            size="sm"
            onClick={clearSessions}
            aria-label={t('res_Clear')}
            style={{ opacity: 0.55, transition: 'opacity 150ms ease' }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.opacity = '1')}
            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.opacity = '0.55')}
          >
            <IconTrash size={14} style={{ color: 'var(--danger)' }} />
          </ActionIcon>
        </Tooltip>
      </Group>

      <ScrollArea.Autosize mah={440}>
        <Stack gap={5}>
          {sessions.map((session) => (
            <SessionItem
              key={session.id}
              session={session}
              onLoad={() => loadSession(session)}
              onDelete={() => deleteSession(session.id)}
            />
          ))}
        </Stack>
      </ScrollArea.Autosize>
    </Stack>
  );
}
