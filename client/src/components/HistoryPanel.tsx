import {
  Stack,
  Text,
  Group,
  ActionIcon,
  ScrollArea,
  Box,
  UnstyledButton,
  Badge,
  Tooltip,
  Button,
} from '@mantine/core';
import { IconTrash, IconClock, IconX } from '@tabler/icons-react';
import { useWorkbenchStore } from '../store/workbench';
import type { GenerationRecord } from '../types';

function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function HistoryItem({
  record,
  onDelete,
  onRestore,
}: Readonly<{
  record: GenerationRecord;
  onDelete: () => void;
  onRestore: () => void;
}>) {
  return (
    <UnstyledButton
      onClick={onRestore}
      style={{
        width: '100%',
        padding: '10px 12px',
        borderRadius: 4,
        border: '1px solid var(--border)',
        background: 'var(--surface)',
        transition: 'border-color 0.15s ease',
        cursor: 'pointer',
        '&:hover': { borderColor: 'var(--accent)' },
      }}
    >
      <Group justify="space-between" wrap="nowrap">
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
              {record.section}
            </Badge>
            <Text size="xs" c="dimmed" ff="monospace" style={{ flexShrink: 0 }}>
              {formatTime(record.timestamp)}
            </Text>
          </Group>
          <Text
            size="xs"
            c="var(--text-primary)"
            style={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              maxWidth: '100%',
            }}
          >
            {record.response.slice(0, 80)}...
          </Text>
          <Text size="xs" c="dimmed" ff="monospace">
            {record.model.split(':')[0]} · {record.promptTokens + record.completionTokens}t
          </Text>
        </Stack>

        <Tooltip label="Remove from history">
          <ActionIcon
            variant="subtle"
            size="xs"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            style={{ color: 'var(--text-muted)', flexShrink: 0 }}
          >
            <IconX size={12} />
          </ActionIcon>
        </Tooltip>
      </Group>
    </UnstyledButton>
  );
}

export function HistoryPanel() {
  const { history, deleteRecord, clearHistory, setPrompt, setSection } = useWorkbenchStore();

  const handleRestore = (record: GenerationRecord) => {
    setSection(record.section);
    setPrompt(record.prompt);
  };

  if (history.length === 0) {
    return (
      <Box
        style={{
          padding: '24px 16px',
          border: '1px dashed var(--border)',
          borderRadius: 6,
          textAlign: 'center',
        }}
      >
        <IconClock size={20} style={{ color: 'var(--text-muted)', marginBottom: 8 }} />
        <Text size="xs" c="dimmed" ff="monospace">
          No history yet.
          <br />
          Generated content appears here.
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
          c="dimmed"
          className="tracking-[2px]"
          style={{ fontFamily: 'var(--font-mono)' }}
        >
          History ({history.length})
        </Text>
        <Button
          variant="subtle"
          size="xs"
          color="red"
          leftSection={<IconTrash size={12} />}
          onClick={clearHistory}
          style={{ fontSize: 11, fontFamily: 'var(--font-mono)' }}
        >
          Clear
        </Button>
      </Group>

      <ScrollArea.Autosize mah={400}>
        <Stack gap={6}>
          {history.map((record) => (
            <HistoryItem
              key={record.id}
              record={record}
              onDelete={() => deleteRecord(record.id)}
              onRestore={() => handleRestore(record)}
            />
          ))}
        </Stack>
      </ScrollArea.Autosize>
    </Stack>
  );
}
