import { Box, Text, Group, ActionIcon, Tooltip, Skeleton, Alert, ScrollArea } from '@mantine/core';
import { IconCopy, IconCheck, IconAlertTriangle } from '@tabler/icons-react';
import { useState } from 'react';
import { useWorkbenchStore } from '../store/workbench';
import { estimateTokens } from '../utils/templates';

export function ResultDisplay() {
  const { lastResponse, lastError, generationStatus, currentSection, selectedModel } =
    useWorkbenchStore();
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!lastResponse) return;
    await navigator.clipboard.writeText(lastResponse);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (generationStatus === 'idle') {
    return (
      <Box
        style={{
          height: '100%',
          minHeight: 300,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: '1px dashed var(--border)',
          borderRadius: 6,
        }}
      >
        <Text size="sm" c="dimmed" ff="monospace" ta="center">
          Output will appear here.
          <br />
          <Text component="span" size="xs" c="dimmed" style={{ opacity: 0.5 }}>
            Select a section and generate.
          </Text>
        </Text>
      </Box>
    );
  }

  if (generationStatus === 'loading') {
    return (
      <Box
        style={{
          border: '1px solid var(--border)',
          borderRadius: 6,
          padding: 20,
          minHeight: 300,
        }}
      >
        <Skeleton height={16} mb={10} />
        <Skeleton height={16} mb={10} width="85%" />
        <Skeleton height={16} mb={10} />
        <Skeleton height={16} mb={10} width="72%" />
        <Skeleton height={16} mb={10} width="90%" />
        <Skeleton height={16} mb={10} width="60%" />
        <Box mt={24}>
          <Text size="xs" c="dimmed" ff="monospace" ta="center">
            Model is thinking...
          </Text>
        </Box>
      </Box>
    );
  }

  if (generationStatus === 'error') {
    return (
      <Alert
        icon={<IconAlertTriangle size={16} />}
        color="red"
        variant="outline"
        style={{
          background: 'var(--surface)',
          borderColor: '#f87171',
          minHeight: 300,
        }}
      >
        <Text size="sm" ff="monospace">
          {lastError ?? 'An unknown error occurred.'}
        </Text>
      </Alert>
    );
  }

  if (!lastResponse) return null;

  const tokenCount = estimateTokens(lastResponse);

  return (
    <Box
      style={{
        border: '1px solid var(--border)',
        borderRadius: 6,
        background: 'var(--surface)',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <Group
        justify="space-between"
        px={16}
        py={10}
        style={{
          borderBottom: '1px solid var(--border)',
          background: 'var(--surface-raised)',
        }}
      >
        <Group gap={10}>
          <Text size="xs" ff="monospace" c="var(--accent)" tt="uppercase" fw={700}>
            {currentSection === 'custom' ? 'Custom' : currentSection}
          </Text>
          <Text size="xs" c="dimmed" ff="monospace">
            {selectedModel}
          </Text>
        </Group>

        <Group gap={8}>
          <Text size="xs" c="dimmed" ff="monospace">
            ~{tokenCount}t
          </Text>
          <Tooltip label={copied ? 'Copied!' : 'Copy to clipboard'}>
            <ActionIcon
              variant="subtle"
              size="sm"
              onClick={handleCopy}
              style={{ color: copied ? '#4ade80' : 'var(--text-muted)' }}
            >
              {copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
            </ActionIcon>
          </Tooltip>
        </Group>
      </Group>

      {/* Content */}
      <ScrollArea.Autosize mah={520}>
        <Box p={20}>
          <Text
            size="sm"
            style={{
              fontFamily: 'var(--font-serif)',
              lineHeight: 1.8,
              color: 'var(--text-primary)',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            {lastResponse}
          </Text>
        </Box>
      </ScrollArea.Autosize>
    </Box>
  );
}
