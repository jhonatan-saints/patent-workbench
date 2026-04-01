import {
  Stack,
  Text,
  Group,
  ActionIcon,
  Box,
  Badge,
  Button,
  ScrollArea,
  Tooltip,
} from '@mantine/core';
import { IconTrash, IconClock, IconX } from '@tabler/icons-react';
import { useWorkbenchStore } from '@/store/workbench';
import { WORKFLOW_ORDER } from '@/utils/workflowTemplates';
import type { WorkflowSession } from '@/types';

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
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
  const completedCount = WORKFLOW_ORDER.filter((m) => session.artifact.sections[m]).length;

  return (
    <Box
      onClick={onLoad}
      className="p-[10px_12px] rounded border border-stroke bg-surface cursor-pointer transition-colors duration-150 hover:border-accent"
    >
      <Group justify="space-between" wrap="nowrap" gap={8}>
        <Stack gap={4} className="flex-1 min-w-0">
          <Group gap={6} wrap="nowrap">
            <Badge
              size="xs"
              variant="outline"
              className="border-accent text-accent font-mono text-[9px] shrink-0"
            >
              {completedCount}/{WORKFLOW_ORDER.length}
            </Badge>
            <Text size="xs" c="var(--text-muted)" ff="monospace" className="shrink-0">
              {formatTime(session.startedAt)}
            </Text>
          </Group>
          <Text size="xs" className="text-fg truncate">
            {session.baseIdea.slice(0, 70)}
            {session.baseIdea.length > 70 ? '...' : ''}
          </Text>
          <Text size="xs" c="var(--text-muted)" ff="monospace">
            {session.model.split(':')[0]} · {session.totalTokens}t
          </Text>
        </Stack>
        <Tooltip label="Remove session">
          <ActionIcon
            aria-label="Remove session"
            variant="subtle"
            size="xs"
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="text-fg-muted shrink-0"
          >
            <IconX size={12} />
          </ActionIcon>
        </Tooltip>
      </Group>
    </Box>
  );
}

export function SessionsPanel() {
  const { sessions, loadSession, deleteSession, clearSessions } = useWorkbenchStore();

  if (sessions.length === 0) {
    return (
      <Box className="px-4 py-6 border border-dashed border-stroke rounded-md text-center">
        <IconClock size={25} className="text-fg-muted mb-1" />
        <Text size="xs" c="var(--text-muted)" ff="monospace" style={{ lineHeight: 1.7 }}>
          No sessions yet.
          <br />
          Completed workflows appear here.
        </Text>
      </Box>
    );
  }

  return (
    <Stack gap={8}>
      <Group justify="space-between">
        <Text
          size="xs"
          fw={700}
          tt="uppercase"
          c="var(--text-muted)"
          ff="monospace"
          className="tracking-widest"
        >
          Sessions ({sessions.length})
        </Text>
        <Button
          variant="subtle"
          size="xs"
          color="red"
          leftSection={<IconTrash size={12} />}
          onClick={clearSessions}
          className="text-[11px] font-mono"
        >
          Clear
        </Button>
      </Group>

      <ScrollArea.Autosize mah={420}>
        <Stack gap={6}>
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
