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
}: Readonly<{
  session: WorkflowSession;
  onDelete: () => void;
}>) {
  const completedCount = WORKFLOW_ORDER.filter((m) => session.artifact.sections[m]).length;

  return (
    <Box
      style={{
        padding: '10px 12px',
        borderRadius: 4,
        border: '1px solid var(--border)',
        background: 'var(--surface)',
      }}
    >
      <Group justify="space-between" wrap="nowrap" gap={8}>
        <Stack gap={4} style={{ flex: 1, minWidth: 0 }}>
          <Group gap={6} wrap="nowrap">
            <Badge
              size="xs"
              variant="outline"
              style={{
                borderColor: 'var(--accent)',
                color: 'var(--accent)',
                fontFamily: 'var(--font-mono)',
                fontSize: 9,
                flexShrink: 0,
              }}
            >
              {completedCount}/{WORKFLOW_ORDER.length}
            </Badge>
            <Text size="xs" c="var(--text-muted)" ff="monospace" style={{ flexShrink: 0 }}>
              {formatTime(session.startedAt)}
            </Text>
          </Group>
          <Text
            size="xs"
            style={{
              color: 'var(--text-primary)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {session.baseIdea.slice(0, 70)}
            {session.baseIdea.length > 70 ? '...' : ''}
          </Text>
          <Text size="xs" c="var(--text-muted)" ff="monospace">
            {session.model.split(':')[0]} · {session.totalTokens}t
          </Text>
        </Stack>
        <Tooltip label="Remove session">
          <ActionIcon
            variant="subtle"
            size="xs"
            onClick={onDelete}
            style={{ color: 'var(--text-muted)', flexShrink: 0 }}
          >
            <IconX size={12} />
          </ActionIcon>
        </Tooltip>
      </Group>
    </Box>
  );
}

export function SessionsPanel() {
  const { sessions, deleteSession, clearSessions } = useWorkbenchStore();

  if (sessions.length === 0) {
    return (
      <Box
        style={{
          padding: '24px 16px',
          border: '1px dashed var(--border)',
          borderRadius: 6,
          textAlign: 'center',
        }}
      >
        <IconClock size={25} style={{ color: 'var(--text-muted)', marginBottom: 4 }} />
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
          style={{ letterSpacing: '0.1em' }}
        >
          Sessions ({sessions.length})
        </Text>
        <Button
          variant="subtle"
          size="xs"
          color="red"
          leftSection={<IconTrash size={12} />}
          onClick={clearSessions}
          style={{ fontSize: 11, fontFamily: 'var(--font-mono)' }}
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
              onDelete={() => deleteSession(session.id)}
            />
          ))}
        </Stack>
      </ScrollArea.Autosize>
    </Stack>
  );
}
