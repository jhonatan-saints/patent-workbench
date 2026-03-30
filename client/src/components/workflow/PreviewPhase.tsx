import { Box, Stack, Text, Group, Badge, Button, ScrollArea, Divider } from '@mantine/core';
import { IconArrowLeft, IconCircleCheck } from '@tabler/icons-react';
import { useWorkbenchStore } from '@/store/workbench';
import { WORKFLOW_ORDER } from '@/utils/workflowTemplates';
import { ExportPanel } from '@/components/ExportPanel';
import type { WorkflowModuleId } from '@/types';

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

export function PreviewPhase() {
  const { artifact, resetWorkflow, steps } = useWorkbenchStore();
  if (!artifact) return null;

  const totalTokens = steps.reduce((acc, s) => acc + s.promptTokens + s.completionTokens, 0);

  return (
    <Stack gap={0} style={{ height: '100%' }}>
      {/* Header */}
      <Box
        style={{
          padding: '14px 20px',
          borderBottom: '1px solid var(--border)',
          background: 'var(--surface-raised)',
          flexShrink: 0,
        }}
      >
        <Group justify="space-between" wrap="nowrap">
          <Stack gap={2}>
            <Group gap={8}>
              <IconCircleCheck size={14} style={{ color: 'var(--accent)' }} />
              <Text
                fw={700}
                size="sm"
                ff="monospace"
                style={{ color: 'var(--text-primary)', letterSpacing: '0.06em' }}
              >
                PATENT DRAFT COMPLETE
              </Text>
            </Group>
            <Text size="xs" c="var(--text-muted)" ff="monospace">
              {WORKFLOW_ORDER.length} sections · {totalTokens}t total ·{' '}
              {artifact.model.split(':')[0]}
            </Text>
          </Stack>
          <Button
            variant="subtle"
            size="xs"
            leftSection={<IconArrowLeft size={12} />}
            onClick={resetWorkflow}
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              color: 'var(--text-muted)',
            }}
          >
            NEW INVENTION
          </Button>
        </Group>
      </Box>

      {/* Document */}
      <ScrollArea style={{ flex: 1 }}>
        <Box p={28} style={{ maxWidth: 800, margin: '0 auto' }}>
          <Stack gap={24}>
            {WORKFLOW_ORDER.map((moduleId, i) => {
              const section = artifact.sections[moduleId];
              if (!section) return null;

              return (
                <Box key={moduleId}>
                  {i > 0 && (
                    <Divider mb={22} style={{ borderColor: 'var(--border-subtle)' }} />
                  )}
                  <Badge
                    size="sm"
                    variant="outline"
                    mb={10}
                    style={{
                      borderColor: 'var(--accent)',
                      color: 'var(--accent)',
                      fontFamily: 'var(--font-mono)',
                      fontSize: 10,
                      letterSpacing: '0.08em',
                    }}
                  >
                    {SECTION_LABELS[moduleId]}
                  </Badge>
                  <Text
                    style={{
                      color: 'var(--text-primary)',
                      fontFamily:
                        moduleId === 'title' ? 'var(--font-display)' : 'var(--font-serif)',
                      fontSize: moduleId === 'title' ? 18 : 14,
                      lineHeight: 1.8,
                      whiteSpace: 'pre-wrap',
                    }}
                  >
                    {section.content}
                  </Text>
                </Box>
              );
            })}
          </Stack>
        </Box>
      </ScrollArea>

      <ExportPanel />
    </Stack>
  );
}
