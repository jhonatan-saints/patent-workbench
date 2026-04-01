import {
  AppShell,
  Group,
  Text,
  Divider,
  Box,
  ActionIcon,
  Tooltip,
  ScrollArea,
  useMantineColorScheme,
  useComputedColorScheme,
} from '@mantine/core';
import { IconGavel, IconHistory, IconSun, IconMoon } from '@tabler/icons-react';
import { useRef, useState, useEffect, type ReactNode } from 'react';
import { StatusIndicator } from '@/components/StatusIndicator';
import { StepProgress } from '@/components/workflow/StepProgress';
import { IdeaInputStep } from '@/components/workflow/IdeaInputStep';
import { OptionsPanel } from '@/components/workflow/OptionsPanel';
import { ArtifactPreview } from '@/components/workflow/ArtifactPreview';
import { PreviewPhase } from '@/components/workflow/PreviewPhase';
import { InventorsStep } from '@/components/workflow/InventorsStep';
import { FiguresStep } from '@/components/workflow/FiguresStep';
import { SessionsPanel } from '@/components/workflow/SessionsPanel';
import { useWorkbenchStore } from '@/store/workbench';
import { AppLoader } from '@/components/AppLoader';

function ResizableSplit({ left, right }: { readonly left: ReactNode; readonly right: ReactNode }) {
  const [leftPct, setLeftPct] = useState(50);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragging.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const pct = ((e.clientX - rect.left) / rect.width) * 100;
      setLeftPct(Math.min(70, Math.max(30, pct)));
    };
    const onUp = () => { dragging.current = false; };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
  }, []);

  return (
    <div ref={containerRef} className="flex h-full overflow-hidden">
      <div style={{ width: `${leftPct}%` }} className="overflow-hidden shrink-0 flex flex-col">
        {left}
      </div>
      <button
        type="button"
        aria-label="Resize panels"
        onMouseDown={() => { dragging.current = true; }}
        className="w-[2.5px] cursor-col-resize bg-stroke shrink-0 transition-colors duration-150 border-0 p-0 hover:bg-accent"
      />
      <div className="flex-1 overflow-hidden flex flex-col">{right}</div>
    </div>
  );
}

function ThemeToggle() {
  const { setColorScheme } = useMantineColorScheme();
  const scheme = useComputedColorScheme('dark');
  return (
    <Tooltip label={scheme === 'dark' ? 'Switch to light' : 'Switch to dark'} position="bottom">
      <ActionIcon
        aria-label="theme toggle"
        variant="subtle"
        size="sm"
        onClick={() => setColorScheme(scheme === 'dark' ? 'light' : 'dark')}
        className="text-fg-muted hover:text-accent"
      >
        {scheme === 'dark' ? <IconSun size={14} /> : <IconMoon size={14} />}
      </ActionIcon>
    </Tooltip>
  );
}

export function App() {
  const { workflowPhase } = useWorkbenchStore();
  const isWorking = workflowPhase === 'working';
  const isFigures = workflowPhase === 'figures';
  const isInventors = workflowPhase === 'inventors';
  const isPreview = workflowPhase === 'preview';

  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const handle = setTimeout(() => setLoading(false), 2500);
    return () => clearTimeout(handle);
  }, []);

  if (loading) return <AppLoader />;

  return (
    <AppShell
      header={{ height: 52 }}
      navbar={{ width: 255, breakpoint: 'sm' }}
      aside={{ width: 300, breakpoint: 'lg' }}
      padding={0}
      styles={{
        root:   { background: 'var(--bg)', minHeight: '100vh' },
        header: { background: 'var(--surface-raised)', borderBottom: '1px solid var(--border)', zIndex: 200 },
        navbar: { background: 'var(--surface)', borderRight: '1px solid var(--border)', zIndex: 100 },
        aside:  { background: 'var(--surface)', borderLeft: '1px solid var(--border)', zIndex: 100 },
        main:   { background: 'var(--bg)' },
      }}
    >
      {/* HEADER */}
      <AppShell.Header>
        <Group h="100%" px={20} justify="space-between">
          <Group gap={12}>
            <IconGavel size={20} className="text-accent" />
            <Text fw={700} size="sm" className="font-display tracking-[0.08em] text-fg uppercase">
              Patent Workbench
            </Text>
            <Text size="xs" ff="monospace" className="pl-3 border-l border-stroke text-fg-muted">
              local-first · zero telemetry
            </Text>
          </Group>
          <Group gap={8} className="items-center">
            <ThemeToggle />
            <StatusIndicator />
          </Group>
        </Group>
      </AppShell.Header>

      {/* LEFT NAV */}
      <AppShell.Navbar>
        <Box className="h-full overflow-y-auto">
          <StepProgress />
        </Box>
      </AppShell.Navbar>

      {/* MAIN */}
      <AppShell.Main>
        {workflowPhase === 'input' && (
          <ScrollArea style={{ height: 'calc(100vh - 52px)' }}>
            <IdeaInputStep />
          </ScrollArea>
        )}

        {isWorking && (
          <Box style={{ height: 'calc(100vh - 52px)', overflow: 'hidden' }}>
            <ResizableSplit left={<OptionsPanel />} right={<ArtifactPreview />} />
          </Box>
        )}

        {isFigures && (
          <Box className="flex flex-col overflow-hidden" style={{ height: 'calc(100vh - 52px)' }}>
            <FiguresStep />
          </Box>
        )}

        {isInventors && (
          <Box className="flex flex-col overflow-hidden" style={{ height: 'calc(100vh - 52px)' }}>
            <InventorsStep />
          </Box>
        )}

        {isPreview && (
          <Box className="flex flex-col overflow-hidden" style={{ height: 'calc(100vh - 52px)' }}>
            <PreviewPhase />
          </Box>
        )}
      </AppShell.Main>

      {/* RIGHT ASIDE */}
      <AppShell.Aside>
        <Box className="h-full flex flex-col p-4">
          <Group gap={8} mb={6}>
            <IconHistory size={14} className="text-accent" />
            <Text size="xs" fw={700} tt="uppercase" ff="monospace" className="text-accent tracking-[2px]">
              Sessions
            </Text>
          </Group>
          <Text size="xs" c="var(--text-muted)" mb={12}>
            In-memory only · cleared on exit
          </Text>
          <Divider mb={14} className="border-stroke" />
          <Box className="flex-1 overflow-hidden">
            <SessionsPanel />
          </Box>
        </Box>
      </AppShell.Aside>
    </AppShell>
  );
}
