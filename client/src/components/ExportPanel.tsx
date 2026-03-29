import { Group, Button, Text, Box, Select } from '@mantine/core';
import { IconFileText, IconMarkdown } from '@tabler/icons-react';
import { useState } from 'react';
import { useWorkbenchStore } from '../store/workbench';

type ExportFormat = 'txt' | 'md';

function buildMarkdown(
  response: string,
  section: string,
  model: string,
  timestamp: number
): string {
  const date = new Date(timestamp).toISOString();
  return `---
section: ${section}
model: ${model}
generated: ${date}
---

# Patent Draft — ${section.toUpperCase()}

${response}
`;
}

function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function ExportPanel() {
  const { lastResponse, currentSection, selectedModel } = useWorkbenchStore();
  const [format, setFormat] = useState<ExportFormat>('md');

  if (!lastResponse) return null;

  const handleExport = () => {
    const ts = Date.now();
    const date = new Date(ts).toISOString().split('T')[0];
    const sectionLabel = currentSection === 'custom' ? 'custom' : currentSection;

    if (format === 'md') {
      const content = buildMarkdown(lastResponse, sectionLabel, selectedModel, ts);
      downloadFile(content, `patent-${sectionLabel}-${date}.md`, 'text/markdown');
    } else {
      downloadFile(lastResponse, `patent-${sectionLabel}-${date}.txt`, 'text/plain');
    }
  };

  return (
    <Box
      style={{
        padding: '10px 16px',
        borderTop: '1px solid var(--border)',
        background: 'var(--surface-raised)',
      }}
    >
      <Group gap={8} justify="flex-end">
        <Text size="xs" c="dimmed" ff="monospace">
          Export:
        </Text>
        <Select
          size="xs"
          value={format}
          onChange={(v) => v && setFormat(v as ExportFormat)}
          data={[
            { value: 'md', label: '.md' },
            { value: 'txt', label: '.txt' },
          ]}
          style={{ width: 80 }}
          styles={{
            input: {
              fontFamily: 'var(--font-mono)',
              fontSize: 12,
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              color: 'var(--text-primary)',
              height: 28,
              minHeight: 28,
            },
            dropdown: {
              background: 'var(--surface)',
              border: '1px solid var(--border)',
            },
          }}
        />
        <Button
          size="xs"
          variant="outline"
          leftSection={format === 'md' ? <IconMarkdown size={13} /> : <IconFileText size={13} />}
          onClick={handleExport}
          style={{
            borderColor: 'var(--accent)',
            color: 'var(--accent)',
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.05em',
            height: 28,
          }}
        >
          DOWNLOAD
        </Button>
      </Group>
    </Box>
  );
}
