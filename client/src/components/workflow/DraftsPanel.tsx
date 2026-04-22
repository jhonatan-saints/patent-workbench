import { useState, useRef, useEffect } from 'react';
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
import {
  IconClock,
  IconX,
  IconFileCheckFilled,
  IconFile,
  IconGripVertical,
} from '@tabler/icons-react';
import { useWorkbenchStore } from '@/store/workbench';
import { useShallow } from 'zustand/react/shallow';
import { useI18n } from '@/i18n/useI18n';
import { WORKFLOW_ORDER } from '@/utils';
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
  isDragging,
  onDragStart,
  onDragOver,
  onDragEnd,
}: Readonly<{
  session: WorkflowSession;
  onDelete: () => void;
  onLoad: () => void;
  isDragging: boolean;
  onDragStart: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragEnd: () => void;
}>) {
  const { t } = useI18n();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const completedCount = WORKFLOW_ORDER.filter((m) => session.artifact.sections[m]).length;
  const progress = Math.round((completedCount / WORKFLOW_ORDER.length) * 100);
  const tokensLabel =
    session.totalTokens >= 1000
      ? `${(session.totalTokens / 1000).toFixed(1)}k`
      : `${session.totalTokens}`;

  const baseOpacity = session.persisted ? 1 : 0.75;

  return (
    <>
      <Box
        component="article"
        draggable
        onDragStart={(e) => {
          e.dataTransfer.effectAllowed = 'move';
          onDragStart();
        }}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
        className="group relative rounded-md overflow-hidden bg-surface-raised [transition:box-shadow_180ms_ease,border-color_180ms_ease,opacity_180ms_ease]"
        style={{
          border: session.persisted ? '1px solid var(--border)' : '1px dashed var(--border)',
          borderLeft: `2px solid ${session.persisted ? 'var(--accent)' : 'var(--text-muted)'}`,
          opacity: isDragging ? 0.35 : baseOpacity,
          transform: isDragging ? 'scale(0.98)' : undefined,
        }}
      >
        {/* Clickable / focusable load area */}
        <button
          type="button"
          onClick={onLoad}
          onKeyDown={(e) => e.key === 'Enter' && onLoad()}
          aria-label={session.artifact.inventionTitle ?? session.baseIdea}
          className="block w-full text-left bg-transparent border-0 p-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-accent focus-visible:-outline-offset-2 rounded-md"
          onFocus={(e) => {
            (e.currentTarget.closest('article') as HTMLElement).style.boxShadow =
              '0 4px 20px var(--accent-glow), 0 0 0 1px var(--accent)';
          }}
          onBlur={(e) => {
            if (!e.currentTarget.closest('article')?.contains(e.relatedTarget as Node)) {
              (e.currentTarget.closest('article') as HTMLElement).style.boxShadow = 'none';
            }
          }}
          onMouseEnter={(e) => {
            if (!isDragging)
              (e.currentTarget.closest('article') as HTMLElement).style.boxShadow =
                '0 4px 20px var(--accent-glow), 0 0 0 1px var(--accent)';
          }}
          onMouseLeave={(e) => {
            if (!e.currentTarget.closest('article')?.contains(e.relatedTarget as Node)) {
              (e.currentTarget.closest('article') as HTMLElement).style.boxShadow = 'none';
            }
          }}
        >
          <Box className="px-3 py-2.5 relative">
            {/* Title + delete */}
            <Group justify="space-between" wrap="nowrap" gap={6} align="flex-start">
              {/* Grip handle */}
              <Box
                className="shrink-0 opacity-0 group-hover:opacity-40 transition-opacity duration-150 cursor-grab active:cursor-grabbing mt-0.5"
                aria-hidden="true"
              >
                <IconGripVertical size={13} style={{ color: 'var(--text-muted)' }} />
              </Box>
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
                  <Box className="leading-none" aria-hidden="true">
                    {session.persisted ? (
                      <IconFileCheckFilled size={14} style={{ color: 'var(--accent)' }} />
                    ) : (
                      <IconFile size={14} style={{ color: 'var(--text-muted)', opacity: 0.6 }} />
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
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.stopPropagation();
                        setConfirmOpen(true);
                      }
                    }}
                    className="opacity-0 transition-opacity duration-150 group-hover:opacity-100! focus-visible:opacity-100!"
                  >
                    <IconX size={14} style={{ color: 'var(--text-muted)' }} />
                  </ActionIcon>
                </Tooltip>
              </Group>
            </Group>

            {/* Progress bar */}
            <Box
              className="mt-2.25 h-0.5 rounded-full bg-stroke overflow-hidden"
              aria-hidden="true"
            >
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
            <Group gap={0} mt={8} wrap="nowrap" align="center" aria-hidden="true">
              {/* Step badge */}
              <Box className="inline-flex items-center px-1.5 py-px rounded border border-accent bg-accent-glow text-[11px] font-mono text-accent font-bold tracking-[0.05em] leading-[1.7] shrink-0">
                {completedCount}/{WORKFLOW_ORDER.length}
              </Box>

              {/* Separator */}
              <Box className="w-px h-2.5 bg-stroke mx-1.75 shrink-0" />

              {/* Tokens */}
              <Text ff="monospace" className="text-[11px] text-muted shrink-0">
                {tokensLabel}t
              </Text>

              {/* Dot */}
              <Text ff="monospace" className="text-[11px] text-fg-secondary mx-1.25 shrink-0">
                ·
              </Text>

              {/* Model */}
              <Text
                ff="monospace"
                className="text-[11px] text-muted flex-1 overflow-hidden text-ellipsis whitespace-nowrap"
              >
                {shortenModel(session.model)}
              </Text>

              {/* Time */}
              <Text ff="monospace" className="text-[11px] text-fg-secondary shrink-0 ml-1.25">
                {formatTime(session.startedAt)}
              </Text>
            </Group>
          </Box>
        </button>
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
  const { sessions, loadSession, deleteSession } = useWorkbenchStore(
    useShallow((s) => ({
      sessions: s.sessions,
      loadSession: s.loadSession,
      deleteSession: s.deleteSession,
    }))
  );
  const { t } = useI18n();

  const [ordered, setOrdered] = useState<WorkflowSession[]>([]);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const dragIndexRef = useRef<number | null>(null);

  const sessionMap = useRef<Map<string, WorkflowSession>>(new Map());

  const initialSort = (list: WorkflowSession[]) =>
    [...list].sort((a, b) => {
      if (a.persisted !== b.persisted) return a.persisted ? 1 : -1;
      return (a.artifact.inventionTitle ?? a.baseIdea).localeCompare(
        b.artifact.inventionTitle ?? b.baseIdea
      );
    });

  // Keep a fast lookup map in sync
  useEffect(() => {
    sessions.forEach((s) => sessionMap.current.set(s.id, s));
  }, [sessions]);

  // Sync ordered list when sessions are added or removed
  useEffect(() => {
    const storeIds = new Set(sessions.map((s) => s.id));
    setOrdered((prev) => {
      const prevIds = new Set(prev.map((s) => s.id));
      const sameSet =
        prevIds.size === storeIds.size && [...storeIds].every((id) => prevIds.has(id));
      if (sameSet) {
        return prev.map((p) => sessionMap.current.get(p.id) ?? p);
      }
      return initialSort(sessions);
    });
  }, [sessions]);

  const handleDragStart = (index: number, id: string) => {
    dragIndexRef.current = index;
    setDraggingId(id);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (dragIndexRef.current === null || dragIndexRef.current === index) return;
    setOrdered((prev) => {
      const next = [...prev];
      const [moved] = next.splice(dragIndexRef.current!, 1);
      next.splice(index, 0, moved);
      return next;
    });
    dragIndexRef.current = index;
  };

  const handleDragEnd = () => {
    dragIndexRef.current = null;
    setDraggingId(null);
  };

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
    <Stack>
      <ScrollArea.Autosize mah={440}>
        <Stack gap={7}>
          {ordered.map((session, index) => (
            <DraftItem
              key={session.id}
              session={session}
              isDragging={draggingId === session.id}
              onLoad={() => loadSession(session)}
              onDelete={() => deleteSession(session.id)}
              onDragStart={() => handleDragStart(index, session.id)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragEnd={handleDragEnd}
            />
          ))}
        </Stack>
      </ScrollArea.Autosize>
    </Stack>
  );
}
