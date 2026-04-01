import { Box, Stack, Text, Group, ScrollArea, Badge, Divider } from '@mantine/core';
import { IconFileText } from '@tabler/icons-react';
import { useWorkbenchStore } from '@/store/workbench';
import { WORKFLOW_ORDER, SECTION_LABELS } from '@/utils/workflowTemplates';

export function ArtifactPreview() {
  const { artifact, steps } = useWorkbenchStore();

  const completedModules = WORKFLOW_ORDER.filter((m) => artifact?.sections[m]);
  const totalTokens = steps.reduce((acc, s) => acc + s.promptTokens + s.completionTokens, 0);

  return (
    <Stack gap={0} style={{ height: '100%' }}>
      {/* Header */}
      <Box className="px-4 py-3.5 border-b border-stroke bg-surface-raised shrink-0">
        <Group gap={8} mb={3}>
          <IconFileText size={13} className="text-accent" />
          <Text
            size="xs"
            fw={700}
            tt="uppercase"
            ff="monospace"
            className="text-accent tracking-widest"
          >
            Live Preview
          </Text>
        </Group>
        <Text size="xs" c="var(--text-muted)" ff="monospace">
          {completedModules.length}/{WORKFLOW_ORDER.length} sections
          {totalTokens > 0 ? ` · ${totalTokens}t used` : ''}
        </Text>
      </Box>

      {/* Content */}
      <ScrollArea style={{ flex: 1 }}>
        <Box p={16}>
          {completedModules.length === 0 ? (
            <Box className="px-4 py-6 border border-dashed border-stroke rounded-md text-center">
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
                    {i > 0 && <Divider mb={14} className="border-stroke-subtle" />}
                    <Badge
                      size="xs"
                      variant="outline"
                      mb={6}
                      className="border-accent text-accent font-mono text-[11px] tracking-[0.06em]"
                    >
                      {SECTION_LABELS[moduleId]}
                    </Badge>
                    <Text
                      className="text-fg font-serif text-[14px] leading-[1.7] whitespace-pre-wrap"
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
