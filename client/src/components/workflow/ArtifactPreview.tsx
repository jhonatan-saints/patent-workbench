import { Box, Stack, Text, Group, ScrollArea, Badge, Divider } from '@mantine/core';
import { IconFileText } from '@tabler/icons-react';
import { useWorkbenchStore } from '@/store/workbench';
import { WORKFLOW_ORDER } from '@/utils/workflowTemplates';
import type { WorkflowModuleId } from '@/types';

const SECTION_LABELS: Record<WorkflowModuleId, string> = {
  idea_analysis: 'Invention Framing',
  title: 'Title',
  field: 'Field of Invention',
  background: 'Background',
  summary: 'Summary of the Invention',
  claims: 'Claims',
  description: 'Detailed Description',
  abstract: 'Abstract',
};

export function ArtifactPreview() {
  const { artifact, steps } = useWorkbenchStore();

  const completedModules = WORKFLOW_ORDER.filter((m) => artifact?.sections[m]);
  const totalTokens = steps.reduce((acc, s) => acc + s.promptTokens + s.completionTokens, 0);

  return (
    <Stack gap={0} style={{ height: '100%' }}>
      {/* Header */}
      <Box
        style={{
          padding: '14px 16px',
          borderBottom: '1px solid var(--border)',
          background: 'var(--surface-raised)',
          flexShrink: 0,
        }}
      >
        <Group gap={8} mb={3}>
          <IconFileText size={13} style={{ color: 'var(--accent)' }} />
          <Text
            size="xs"
            fw={700}
            tt="uppercase"
            ff="monospace"
            style={{ color: 'var(--accent)', letterSpacing: '0.1em' }}
          >
            Live Preview
          </Text>
        </Group>
          <Text style={{ fontSize: '11px' }} c="var(--text-muted)" ff="monospace">
          {completedModules.length}/{WORKFLOW_ORDER.length} sections
          {totalTokens > 0 ? ` · ${totalTokens}t used` : ''}
        </Text>
      </Box>

      {/* Content */}
      <ScrollArea style={{ flex: 1 }}>
        <Box p={16}>
          {completedModules.length === 0 ? (
            <Box
              style={{
                padding: '24px 16px',
                border: '1px dashed var(--border)',
                borderRadius: 6,
                textAlign: 'center',
              }}
            >
              <Text size="xs" c="var(--text-muted)" ff="monospace" style={{ lineHeight: 1.7 }}>
                The draft will appear here as you progress through each step.
              </Text>
            </Box>
          ) : (
            <Stack gap={14}>
              {completedModules.map((moduleId, i) => {
                const section = artifact!.sections[moduleId]!;
                return (
                  <Box key={moduleId}>
                    {i > 0 && (
                      <Divider mb={14} style={{ borderColor: 'var(--border-subtle)' }} />
                    )}
                    <Badge
                      size="xs"
                      variant="outline"
                      mb={6}
                      style={{
                        borderColor: 'var(--accent)',
                        color: 'var(--accent)',
                        fontFamily: 'var(--font-mono)',
                        fontSize: 11,
                        letterSpacing: '0.06em',
                      }}
                    >
                      {SECTION_LABELS[moduleId]}
                    </Badge>
                    <Text
                      style={{
                        color: 'var(--text-primary)',
                        fontFamily:
                          moduleId === 'title' ? 'var(--font-display)' : 'var(--font-serif)',
                        fontSize: moduleId === 'title' ? 20 : 14,
                        lineHeight: 1.7,
                        whiteSpace: 'pre-wrap',
                      }}
                    >
                      {section.content}
                    </Text>
                  </Box>
                );
              })}
            </Stack>
          )}
        </Box>
      </ScrollArea>
    </Stack>
  );
}
