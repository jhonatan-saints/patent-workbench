import { useState } from 'react';
import {
  Stack,
  Text,
  Group,
  ActionIcon,
  Box,
  Tooltip,
  ScrollArea,
  Modal,
  Button,
} from '@mantine/core';
import { IconTrash, IconClock, IconX, IconCloudCheck, IconCloudOff } from '@tabler/icons-react';
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

function DraftItem({
  session,
  onDelete,
  onLoad,
}: Readonly<{
  session: WorkflowSession;
  onDelete: () => void;
  onLoad: () => void;
}>) {
  const { t } = useI18n();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const completedCount = WORKFLOW_ORDER.filter((m) => session.artifact.sections[m]).length;
  const progress = Math.round((completedCount / WORKFLOW_ORDER.length) * 100);
  const tokensLabel =
    session.totalTokens >= 1000
      ? `${(session.totalTokens / 1000).toFixed(1)}k`
      : `${session.totalTokens}`;

  return (
    <>
      <Box
        onClick={onLoad}
        className="group relative cursor-pointer rounded-md overflow-hidden bg-surface-raised [transition:box-shadow_180ms_ease,border-color_180ms_ease,opacity_180ms_ease]"
        style={{
          border: session.persisted ? '1px solid var(--border)' : '1px dashed var(--border)',
          borderLeft: `2px solid ${session.persisted ? 'var(--accent)' : 'var(--text-muted)'}`,
          opacity: session.persisted ? 1 : 0.75,
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.boxShadow =
            '0 4px 20px var(--accent-glow), 0 0 0 1px var(--accent)';
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.boxShadow = 'none';
        }}
      >
        <Box className="px-3 py-2.5 relative">
          {/* Title + delete */}
          <Group justify="space-between" wrap="nowrap" gap={6} align="flex-start">
            <Text
              size="xs"
              fw={600}
              ff="var(--font-body)"
              lineClamp={2}
              className="flex-1 min-w-0 leading-[1.45] text-fg"
            >
              {session.artifact.inventionTitle ?? session.baseIdea}
            </Text>
            <Group gap={4} wrap="nowrap" align="center" className="shrink-0">
              <Tooltip
                label={session.persisted ? t('res_Saved') : t('res_Cached')}
                position="left"
                withArrow
              >
                <Box className="leading-none">
                  {session.persisted ? (
                    <IconCloudCheck size={14} style={{ color: 'var(--accent)' }} />
                  ) : (
                    <IconCloudOff size={14} style={{ color: 'var(--text-muted)', opacity: 0.6 }} />
                  )}
                </Box>
              </Tooltip>
              <Tooltip label={t('res_RemoveDraft')} position="left" withArrow>
                <ActionIcon
                  aria-label={t('res_RemoveDraft')}
                  variant="subtle"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    setConfirmOpen(true);
                  }}
                  className="opacity-0 transition-opacity duration-150 group-hover:opacity-100!"
                >
                  <IconX size={14} style={{ color: 'var(--danger)' }} />
                </ActionIcon>
              </Tooltip>
            </Group>
          </Group>

          {/* Progress bar */}
          <Box className="mt-2.25 h-0.5 rounded-full bg-stroke overflow-hidden">
            <Box
              className="h-full rounded-full [transition:width_600ms_cubic-bezier(0.4,0,0.2,1)]"
              style={{
                width: `${progress}%`,
                background:
                  progress === 100
                    ? 'linear-gradient(90deg, var(--accent-dim), var(--accent))'
                    : 'var(--accent)',
              }}
            />
          </Box>

          {/* Metadata chips row */}
          <Group gap={0} mt={8} wrap="nowrap" align="center">
            {/* Step badge */}
            <Box className="inline-flex items-center px-1.5 py-px rounded border border-accent bg-accent-glow text-[11px] font-mono text-accent font-bold tracking-[0.05em] leading-[1.7] shrink-0">
              {completedCount}/{WORKFLOW_ORDER.length}
            </Box>

            {/* Separator */}
            <Box className="w-px h-2.5 bg-stroke mx-1.75 shrink-0" />

            {/* Tokens */}
            <Text ff="monospace" className="text-[11px] text-fg-secondary shrink-0">
              {tokensLabel}t
            </Text>

            {/* Dot */}
            <Text ff="monospace" className="text-[11px] text-stroke mx-1.25 shrink-0">
              ·
            </Text>

            {/* Model */}
            <Text
              ff="monospace"
              className="text-[11px] text-fg-secondary flex-1 overflow-hidden text-ellipsis whitespace-nowrap"
            >
              {shortenModel(session.model)}
            </Text>

            {/* Time */}
            <Text ff="monospace" className="text-[11px] text-fg-secondary shrink-0 ml-1.25">
              {formatTime(session.startedAt)}
            </Text>
          </Group>
        </Box>
      </Box>

      {/* Delete confirmation modal */}
      <Modal
        opened={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title={t('res_DeleteDraftConfirmTitle')}
        centered
        size="sm"
        onClick={(e) => e.stopPropagation()}
      >
        <Text size="sm" mb="lg">
          {t('res_DeleteDraftConfirmMessage')}
        </Text>
        <Group justify="flex-end" gap={8}>
          <Button variant="default" size="xs" onClick={() => setConfirmOpen(false)}>
            {t('res_Cancel')}
          </Button>
          <Button
            color="red"
            size="xs"
            onClick={() => {
              setConfirmOpen(false);
              onDelete();
            }}
          >
            {t('res_Delete')}
          </Button>
        </Group>
      </Modal>
    </>
  );
}

export function DraftsPanel() {
  const { sessions, loadSession, deleteSession, clearSessions } = useWorkbenchStore();
  const { t } = useI18n();
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);

  if (sessions.length === 0) {
    return (
      <Box className="px-3 py-7 border border-dashed border-stroke rounded-lg bg-surface-raised text-center">
        <div className="w-9 h-9 rounded-full bg-accent-glow border border-accent flex items-center justify-center mx-auto mb-3 shrink-0 leading-none">
          <IconClock size={16} className="text-accent block" />
        </div>
        <Text size="xs" fw={600} ff="monospace" className="text-fg-secondary tracking-[0.04em]">
          {t('res_NoDraftsYet')}
        </Text>
        <Text size="xs" className="text-fg-muted mt-1 leading-[1.7]">
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
            className="text-[11px] text-fg-muted tracking-[0.12em]"
          >
            {t('res_Drafts')}
          </Text>
        </Group>

        <Tooltip label={t('res_Clear')} position="left" withArrow>
          <ActionIcon
            variant="subtle"
            size="sm"
            onClick={() => setClearConfirmOpen(true)}
            aria-label={t('res_Clear')}
            className="opacity-[0.55] transition-opacity duration-150 hover:opacity-100"
          >
            <IconTrash size={14} style={{ color: 'var(--danger)' }} />
          </ActionIcon>
        </Tooltip>
      </Group>

      <ScrollArea.Autosize mah={440}>
        <Stack gap={5}>
          {sessions.map((session) => (
            <DraftItem
              key={session.id}
              session={session}
              onLoad={() => loadSession(session)}
              onDelete={() => deleteSession(session.id)}
            />
          ))}
        </Stack>
      </ScrollArea.Autosize>

      {/* Clear all confirmation modal */}
      <Modal
        opened={clearConfirmOpen}
        onClose={() => setClearConfirmOpen(false)}
        title={t('res_ClearAllDraftsConfirmTitle')}
        centered
        size="sm"
      >
        <Text size="sm" mb="lg">
          {t('res_ClearAllDraftsConfirmMessage')}
        </Text>
        <Group justify="flex-end" gap={8}>
          <Button variant="default" size="xs" onClick={() => setClearConfirmOpen(false)}>
            {t('res_Cancel')}
          </Button>
          <Button
            color="red"
            size="xs"
            onClick={() => {
              setClearConfirmOpen(false);
              clearSessions();
            }}
          >
            {t('res_Delete')}
          </Button>
        </Group>
      </Modal>
    </Stack>
  );
}
