import { Box, Stack, Text, Group, ScrollArea, Badge, Divider } from '@mantine/core';
import { useI18n } from '@/i18n/useI18n';
import { IconFileText } from '@tabler/icons-react';
import { useWorkbenchStore } from '@/store/workbench';
import { useShallow } from 'zustand/react/shallow';
import { WORKFLOW_ORDER, resolveLabel } from '@/utils';

export function ArtifactPreview() {
  const { artifact, steps } = useWorkbenchStore(
    useShallow((s) => ({ artifact: s.artifact, steps: s.steps }))
  );

  const completedModules = WORKFLOW_ORDER.filter((m) => artifact?.sections[m]);
  const totalTokens = steps.reduce((acc, s) => acc + s.promptTokens + s.completionTokens, 0);

  const { t } = useI18n();

  return (
    <Stack gap={0} className="h-full">
      {/* Header */}
      <Box className="px-4 py-3.5 border-b border-stroke bg-surface-raised shrink-0">
        <Group gap={8} mb={3}>
          <IconFileText size={14} className="text-accent" />
          <Text
            size="xs"
            fw={700}
            tt="uppercase"
            ff="monospace"
            className="text-accent tracking-widest"
          >
            {t('res_ArtifactLivePreview')}
          </Text>
        </Group>
        <Text size="xs" c="var(--text-muted)" ff="monospace">
          {completedModules.length}/{WORKFLOW_ORDER.length} {t('res_Sections')}
          {totalTokens > 0 ? ` · ${t('res_ArtifactTokensUsed', { tokens: totalTokens })}` : ''}
        </Text>
      </Box>

      {/* Content */}
      <ScrollArea className="flex-1">
        <Box p={16}>
          {completedModules.length === 0 ? (
            <Box className="px-4 py-6 border border-dashed border-stroke rounded-md text-center">
              <Text size="xs" c="var(--text-muted)" ff="monospace" className="leading-[1.7]">
                {t('res_ArtifactEmptyHint')}
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
                      {resolveLabel(moduleId, t)}
                    </Badge>
                    <Text className="text-fg font-serif text-[14px] leading-[1.7] whitespace-pre-wrap">
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
