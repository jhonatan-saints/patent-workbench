import { Group, Button, Text, Box, Select } from '@mantine/core';
import { IconFileText, IconMarkdown } from '@tabler/icons-react';
import { useState } from 'react';
import { useWorkbenchStore } from '@/store/workbench';
import { WORKFLOW_ORDER } from '@/utils/workflowTemplates';
import type { PatentArtifact, WorkflowModuleId } from '@/types';

type ExportFormat = 'txt' | 'md';

const SECTION_LABELS: Record<WorkflowModuleId, string> = {
  idea_analysis: 'Invention Framing',
  title: 'Title',
  field: 'Field of Invention',
  background: 'Background of the Invention',
  summary: 'Summary of the Invention',
  claims: 'Claims',
  description: 'Detailed Description',
  abstract: 'Abstract',
};

function buildMarkdown(artifact: PatentArtifact): string {
  const date = new Date().toISOString();
  let content = `---\nidea: ${artifact.baseIdea.replaceAll('\n', ' ').slice(0, 120)}\ndomain: ${artifact.baseDomain}\nmodel: ${artifact.model}\ngenerated: ${date}\n---\n\n# Patent Draft\n\n`;
  for (const moduleId of WORKFLOW_ORDER) {
    const section = artifact.sections[moduleId];
    if (section) {
      content += `## ${SECTION_LABELS[moduleId]}\n\n${section.content}\n\n`;
    }
  }
  return content;
}

function buildText(artifact: PatentArtifact): string {
  const sep = '─'.repeat(48);
  let content = `PATENT DRAFT\nGenerated: ${new Date().toISOString()}\nModel: ${artifact.model}\n\n${sep}\n\n`;
  for (const moduleId of WORKFLOW_ORDER) {
    const section = artifact.sections[moduleId];
    if (section) {
      content += `${SECTION_LABELS[moduleId].toUpperCase()}\n${sep}\n${section.content}\n\n`;
    }
  }
  return content;
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
  const { artifact, workflowPhase } = useWorkbenchStore();
  const [format, setFormat] = useState<ExportFormat>('md');

  if (workflowPhase !== 'preview' || !artifact) return null;

  const handleExport = () => {
    const date = new Date().toISOString().split('T')[0];
    if (format === 'md') {
      downloadFile(buildMarkdown(artifact), `patent-draft-${date}.md`, 'text/markdown');
    } else {
      downloadFile(buildText(artifact), `patent-draft-${date}.txt`, 'text/plain');
    }
  };

  return (
    <Box
      style={{
        padding: '10px 16px',
        borderTop: '1px solid var(--border)',
        background: 'var(--surface-raised)',
        flexShrink: 0,
      }}
    >
      <Group gap={8} justify="flex-end">
        <Text size="xs" c="var(--text-muted)" ff="monospace">
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
