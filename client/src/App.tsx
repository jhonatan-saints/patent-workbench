import { useState } from 'react';
import {
  AppShell,
  Group,
  Text,
  Divider,
  Stack,
  Box,
  Tabs,
  ScrollArea,
  ActionIcon,
  Tooltip,
  useMantineColorScheme,
  useComputedColorScheme,
} from '@mantine/core';
import {
  IconGavel,
  IconPencil,
  IconHistory,
  IconWand,
  IconSun,
  IconMoon,
} from '@tabler/icons-react';
import { StatusIndicator } from './components/StatusIndicator';
import { SectionSelector } from './components/SectionSelector';
import { TemplateBuilder } from './components/TemplateBuilder';
import { PromptInput } from './components/PromptInput';
import { ResultDisplay } from './components/ResultDisplay';
import { ExportPanel } from './components/ExportPanel';
import { HistoryPanel } from './components/HistoryPanel';
import { TokenMeter } from './components/TokenMeter';
import { useWorkbenchStore } from './store/workbench';

function ThemeToggle() {
  const { setColorScheme } = useMantineColorScheme();
  const scheme = useComputedColorScheme('dark');

  return (
    <Tooltip label={scheme === 'dark' ? 'Switch to light' : 'Switch to dark'} position="bottom">
      <ActionIcon
        variant="subtle"
        size="sm"
        onClick={() => setColorScheme(scheme === 'dark' ? 'light' : 'dark')}
        className="text-fg-muted hover:text-accent"
      >
        {scheme === 'dark' ? <IconSun size={15} /> : <IconMoon size={15} />}
      </ActionIcon>
    </Tooltip>
  );
}

export function App() {
  const { currentSection } = useWorkbenchStore();
  const [leftTab, setLeftTab] = useState<'template' | 'prompt'>('template');
  const isPatentSection = currentSection !== 'custom';

  return (
    <AppShell
      header={{ height: 52 }}
      navbar={{ width: 220, breakpoint: 'sm' }}
      aside={{ width: 300, breakpoint: 'lg' }}
      padding={0}
      styles={{
        root: { background: 'var(--bg)', minHeight: '100vh' },
        header: {
          background: 'var(--surface-raised)',
          borderBottom: '1px solid var(--border)',
          zIndex: 200,
        },
        navbar: {
          background: 'var(--surface)',
          borderRight: '1px solid var(--border)',
          zIndex: 100,
        },
        aside: {
          background: 'var(--surface)',
          borderLeft: '1px solid var(--border)',
          zIndex: 100,
        },
        main: { background: 'var(--bg)' },
      }}
    >
      {/* HEADER */}
      <AppShell.Header>
        <Group h="100%" px={20} justify="space-between">
          <Group gap={12}>
            <IconGavel size={18} className="text-accent" />
            <Text
              fw={700}
              size="sm"
              className="font-display tracking-[0.08em] text-fg uppercase"
            >
              Patent Workbench
            </Text>
            <Text
              size="xs"
              c="dimmed"
              ff="monospace"
              className="pl-3 border-l border-stroke"
            >
              local-first · zero telemetry
            </Text>
          </Group>
          <Group gap={8}>
            <ThemeToggle />
            <StatusIndicator />
          </Group>
        </Group>
      </AppShell.Header>

      {/* LEFT NAV */}
      <AppShell.Navbar>
        <Box className="h-full overflow-y-auto p-4">
          <SectionSelector />
        </Box>
      </AppShell.Navbar>

      {/* MAIN */}
      <AppShell.Main>
        <Box
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            height: 'calc(100vh - 52px)',
            overflow: 'hidden',
          }}
        >
          {/* LEFT PANE — Input */}
          <Box className="border-r border-stroke flex flex-col overflow-hidden">
            <Box className="px-5 pt-3 border-b border-stroke bg-surface-raised">
              <Tabs
                value={isPatentSection ? leftTab : 'prompt'}
                onChange={(v) => v && setLeftTab(v as 'template' | 'prompt')}
                styles={{
                  tab: {
                    fontFamily: 'var(--font-mono)',
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    color: 'var(--text-muted)',
                    padding: '8px 14px',
                  },
                  list: { borderBottom: 'none' },
                }}
              >
                <Tabs.List>
                  {isPatentSection && (
                    <Tabs.Tab value="template" leftSection={<IconWand size={12} />}>
                      Builder
                    </Tabs.Tab>
                  )}
                  <Tabs.Tab value="prompt" leftSection={<IconPencil size={12} />}>
                    Prompt
                  </Tabs.Tab>
                </Tabs.List>
              </Tabs>
            </Box>

            <ScrollArea className="flex-1">
              <Box p={20}>
                {isPatentSection && leftTab === 'template' ? (
                  <Stack gap={20}>
                    <TemplateBuilder
                      section={currentSection}
                      onApply={() => setLeftTab('prompt')}
                    />
                    <TokenMeter />
                  </Stack>
                ) : (
                  <Stack gap={16}>
                    <TokenMeter />
                    <PromptInput />
                  </Stack>
                )}
              </Box>
            </ScrollArea>
          </Box>

          {/* RIGHT PANE — Output */}
          <Box className="flex flex-col overflow-hidden">
            <Box className="px-5 py-4 border-b border-stroke bg-surface-raised">
              <Stack gap={2}>
                <Text size="xs" fw={700} tt="uppercase" c="dimmed" ff="monospace" className="tracking-[2px]">
                  Output
                </Text>
                <Text size="xs" c="dimmed">
                  Generated patent content — review before use
                </Text>
              </Stack>
            </Box>

            <ScrollArea className="flex-1">
              <Box p={20}>
                <ResultDisplay />
              </Box>
            </ScrollArea>

            <ExportPanel />
          </Box>
        </Box>
      </AppShell.Main>

      {/* RIGHT ASIDE — History */}
      <AppShell.Aside>
        <Box className="h-full flex flex-col p-4">
          <Group gap={8} mb={6}>
            <IconHistory size={14} className="text-accent" />
            <Text size="xs" fw={700} tt="uppercase" ff="monospace" className="text-accent tracking-[2px]">
              Session History
            </Text>
          </Group>
          <Text size="xs" c="dimmed" mb={12}>
            In-memory only · cleared on exit
          </Text>
          <Divider mb={14} style={{ borderColor: 'var(--border)' }} />
          <Box className="flex-1 overflow-hidden">
            <HistoryPanel />
          </Box>
        </Box>
      </AppShell.Aside>
    </AppShell>
  );
}
