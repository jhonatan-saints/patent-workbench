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
    <div ref={containerRef} style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      <div style={{ width: `${leftPct}%`, overflow: 'hidden', flexShrink: 0, display: 'flex', flexDirection: 'column' }}>{left}</div>
      <button
        type="button"
        aria-label="Resize panels"
        onMouseDown={() => { dragging.current = true; }}
        style={{
          width: 2.5,
          cursor: 'col-resize',
          background: 'var(--border)',
          flexShrink: 0,
          transition: 'background 0.15s',
          userSelect: 'none',
          border: 'none',
          padding: 0,
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--accent)'; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--border)'; }}
      />
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>{right}</div>
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
  const isInventors = workflowPhase === 'inventors';
  const isPreview = workflowPhase === 'preview';

  // Loading state for initial mount
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    // wait 2.5 seconds before removing the loading for better UX
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
            <IconGavel size={20} className="text-accent" />
            <Text
              fw={700}
              size="sm"
              className="font-display tracking-[0.08em] text-fg uppercase"
            >
              Patent Workbench
            </Text>
            <Text
              size="xs"
              c="var(--text-muted)"
              ff="monospace"
              className="pl-3 border-l border-stroke"
            >
              local-first · zero telemetry
            </Text>
          </Group>
          <Group gap={8} className="items-center">
            <ThemeToggle />
            <StatusIndicator />
          </Group>
        </Group>
      </AppShell.Header>

      {/* LEFT NAV — step progress */}
      <AppShell.Navbar>
        <Box style={{ height: '100%', overflowY: 'auto' }}>
          <StepProgress />
        </Box>
      </AppShell.Navbar>

      {/* MAIN */}
      <AppShell.Main>
        {/* Input phase */}
        {workflowPhase === 'input' && (
          <ScrollArea style={{ height: 'calc(100vh - 52px)' }}>
            <IdeaInputStep />
          </ScrollArea>
        )}

        {/* Working phase: options (left) + live preview (right) */}
        {isWorking && (
          <Box style={{ height: 'calc(100vh - 52px)', overflow: 'hidden' }}>
            <ResizableSplit
              left={<OptionsPanel />}
              right={<ArtifactPreview />}
            />
          </Box>
        )}

        {/* Inventors phase (step 09) */}
        {isInventors && (
          <Box
            style={{
              height: 'calc(100vh - 52px)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <InventorsStep />
          </Box>
        )}

        {/* Preview phase (step 10) */}
        {isPreview && (
          <Box
            style={{
              height: 'calc(100vh - 52px)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <PreviewPhase />
          </Box>
        )}
      </AppShell.Main>

      {/* RIGHT ASIDE — sessions */}
      <AppShell.Aside>
        <Box style={{ height: '100%', display: 'flex', flexDirection: 'column', padding: 16 }}>
          <Group gap={8} mb={6}>
            <IconHistory size={14} className="text-accent" />
            <Text
              size="xs"
              fw={700}
              tt="uppercase"
              ff="monospace"
              className="text-accent tracking-[2px]"
            >
              Sessions
            </Text>
          </Group>
          <Text size="xs" c="var(--text-muted)" mb={12}>
            In-memory only · cleared on exit
          </Text>
          <Divider mb={14} style={{ borderColor: 'var(--border)' }} />
          <Box style={{ flex: 1, overflow: 'hidden' }}>
            <SessionsPanel />
          </Box>
        </Box>
      </AppShell.Aside>
    </AppShell>
  );
}
