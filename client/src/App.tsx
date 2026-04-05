import {
  AppShell,
  Group,
  Text,
  Box,
  ActionIcon,
  Tooltip,
  ScrollArea,
  useMantineColorScheme,
  useComputedColorScheme,
} from '@mantine/core';
import { IconSun, IconMoon, IconChevronLeft, IconChevronRight, IconBrandGithub } from '@tabler/icons-react';
import { useRef, useState, useEffect, useCallback, type ReactNode } from 'react';
import { StatusIndicator } from '@/components/StatusIndicator';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
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
import { useI18n } from '@/i18n';

function ResizableSplit({ left, right }: { readonly left: ReactNode; readonly right: ReactNode }) {
  const [leftPct, setLeftPct] = useState(40);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragging.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const pct = ((e.clientX - rect.left) / rect.width) * 100;
      setLeftPct(Math.min(70, Math.max(30, pct)));
    };
    const onUp = () => {
      dragging.current = false;
    };
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
        onMouseDown={() => {
          dragging.current = true;
        }}
        className="w-[2.5px] cursor-col-resize bg-stroke shrink-0 transition-colors duration-150 border-0 p-0 hover:bg-accent"
      />
      <div className="flex-1 overflow-hidden flex flex-col">{right}</div>
    </div>
  );
}

function LogoDots() {
  const [active, setActive] = useState<number>(0);

  useEffect(() => {
    let cancelled = false;
    let last = -1;
    const schedule = () => {
      const delay = 900 + Math.random() * 1200;
      setTimeout(() => {
        if (cancelled) return;
        let next: number;
        do { next = Math.floor(Math.random() * 9); } while (next === last);
        last = next;
        setActive(next);
        schedule();
      }, delay);
    };
    schedule();
    return () => { cancelled = true; };
  }, []);

  return (
    <span
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 4px)',
        gap: 3,
        flexShrink: 0,
        alignSelf: 'center',
      }}
    >
      {Array.from({ length: 9 }, (_, i) => (
        <span
          key={i}
          style={{
            display: 'block',
            width: 4,
            height: 4,
            background: 'var(--accent)',
            opacity: active === i ? 1 : 0.2,
            boxShadow: active === i ? '0 0 5px var(--accent), 0 0 12px var(--accent)' : 'none',
            transition: 'opacity 600ms ease, box-shadow 600ms ease',
          }}
        />
      ))}
    </span>
  );
}

function ThemeToggle() {
  const { setColorScheme } = useMantineColorScheme();
  const scheme = useComputedColorScheme('dark');
  const { t } = useI18n();
  return (
    <Tooltip
      label={scheme === 'dark' ? t('res_SwitchToLight') : t('res_SwitchToDark')}
      position="bottom"
    >
      <ActionIcon
        aria-label="theme toggle"
        variant="subtle"
        size="md"
        onClick={() => setColorScheme(scheme === 'dark' ? 'light' : 'dark')}
        className="text-fg-muted hover:text-accent"
      >
        {scheme === 'dark' ? <IconSun size={16} /> : <IconMoon size={16} />}
      </ActionIcon>
    </Tooltip>
  );
}

export function App() {
  const { workflowPhase } = useWorkbenchStore();
  const { t } = useI18n();
  const isWorking = workflowPhase === 'working';
  const isFigures = workflowPhase === 'figures';
  const isInventors = workflowPhase === 'inventors';
  const isPreview = workflowPhase === 'preview';

  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const handle = setTimeout(() => setLoading(false), 2500);
    return () => clearTimeout(handle);
  }, []);

  const [navCollapsed, setNavCollapsed] = useState(
    () => localStorage.getItem('nav-collapsed') === 'true',
  );
  const toggleNav = useCallback(() => {
    setNavCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem('nav-collapsed', String(next));
      return next;
    });
  }, []);

  if (loading) return <AppLoader />;

  return (
    <AppShell
      header={{ height: 44 }}
      navbar={{ width: navCollapsed ? 52 : 240, breakpoint: 'sm' }}
      aside={{ width: 300, breakpoint: 'lg' }}
      padding={0}
      styles={{
        root: { background: 'var(--bg)', minHeight: '100vh' },
        header: {
          background: 'color-mix(in srgb, var(--surface-raised) 80%, transparent)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderBottom: 'none',
          boxShadow: '0 1px 0 var(--border)',
          zIndex: 200,
        },
        navbar: {
          background: 'var(--surface)',
          borderRight: '1px solid var(--border)',
          zIndex: 100,
          transition: 'width 220ms cubic-bezier(0.4, 0, 0.2, 1)',
          overflow: 'hidden',
        },
        aside: { background: 'var(--surface)', borderLeft: '1px solid var(--border)', zIndex: 100 },
        main: {
          background: 'var(--bg)',
          transition: 'margin-left 220ms cubic-bezier(0.4, 0, 0.2, 1)',
        },
      }}
    >
      {/* HEADER */}
      <AppShell.Header>
        <Group h="100%" px={20} justify="space-between" align="center" wrap="nowrap">
          {/* Logo */}
          <Group gap={10} align="center" wrap="nowrap">
            <LogoDots />
            <Text
              fw={600}
              size="sm"
              ff="monospace"
              className="text-fg tracking-widest uppercase"
              style={{ letterSpacing: '0.1em' }}
            >
              {t('res_PatentWorkbench')}
            </Text>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '2px 8px',
                borderRadius: 4,
                border: '1px solid var(--border)',
                fontSize: 10,
                fontFamily: 'monospace',
                color: 'var(--text-muted)',
                letterSpacing: '0.06em',
                lineHeight: 1.6,
                textTransform: 'uppercase',
                userSelect: 'none',
              }}
            >
              {t('res_LocalFirstZeroTelemetry')}
            </span>
          </Group>

          {/* Right actions */}
          <Group gap={8} align="center" wrap="nowrap">
            <LanguageSwitcher />
            <ThemeToggle />
            <StatusIndicator />
          </Group>
        </Group>
      </AppShell.Header>

      {/* LEFT NAV */}
      <AppShell.Navbar>
        <Box className="h-full flex flex-col overflow-hidden">
          <Box className="flex-1 overflow-y-auto min-h-0">
            <StepProgress collapsed={navCollapsed} />
          </Box>
          <Box
            style={{
              borderTop: '1px solid var(--border)',
              padding: navCollapsed ? '8px 0' : '8px 10px',
              display: 'flex',
              justifyContent: navCollapsed ? 'center' : 'space-between',
              alignItems: 'center',
            }}
          >
            <Tooltip label="GitHub" position="right" withArrow>
              <ActionIcon
                component="a"
                href="https://github.com/jhonatan-saints/patent-workbench"
                target="_blank"
                rel="noopener noreferrer"
                variant="subtle"
                size="sm"
                aria-label="GitHub repository"
                className="text-fg-muted hover:text-accent"
                style={{ display: navCollapsed ? 'none' : undefined }}
              >
                <IconBrandGithub size={13} />
              </ActionIcon>
            </Tooltip>
            <Tooltip
              label={navCollapsed ? 'Expand' : 'Collapse'}
              position="right"
              withArrow
            >
              <ActionIcon
                variant="subtle"
                size="sm"
                onClick={toggleNav}
                aria-label={navCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                className="text-fg-muted hover:text-accent"
              >
                {navCollapsed ? <IconChevronRight size={13} /> : <IconChevronLeft size={13} />}
              </ActionIcon>
            </Tooltip>
          </Box>
        </Box>
      </AppShell.Navbar>

      {/* MAIN */}
      <AppShell.Main>
        {workflowPhase === 'input' && (
          <ScrollArea style={{ height: 'calc(100vh - 44px)' }}>
            <IdeaInputStep />
          </ScrollArea>
        )}

        {isWorking && (
          <Box style={{ height: 'calc(100vh - 44px)', overflow: 'hidden' }}>
            <ResizableSplit left={<OptionsPanel />} right={<ArtifactPreview />} />
          </Box>
        )}

        {isFigures && (
          <Box className="flex flex-col overflow-hidden" style={{ height: 'calc(100vh - 44px)' }}>
            <FiguresStep />
          </Box>
        )}

        {isInventors && (
          <Box className="flex flex-col overflow-hidden" style={{ height: 'calc(100vh - 44px)' }}>
            <InventorsStep />
          </Box>
        )}

        {isPreview && (
          <Box className="flex flex-col overflow-hidden" style={{ height: 'calc(100vh - 44px)' }}>
            <PreviewPhase />
          </Box>
        )}
      </AppShell.Main>

      {/* RIGHT ASIDE */}
      <AppShell.Aside>
        <Box className="h-full flex flex-col overflow-hidden">
          {/* Aside chrome header — mirrors ArtifactPreview header structure (px-4 py-3.5) */}
          <Box
            className="px-4 py-3.5 shrink-0"
            style={{
              borderBottom: '1px solid var(--border)',
              background: 'var(--surface-raised)',
            }}
          >
            {/* Row 1: icon + label */}
            <Group gap={8} mb={3} align="center" wrap="nowrap">
              <Box
                className="animate-pulse-glow"
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: 'var(--accent)',
                  flexShrink: 0,
                }}
              />
              <Text
                ff="monospace"
                fw={700}
                tt="uppercase"
                className="text-accent tracking-widest"
                size="xs"
              >
                {t('res_Sessions')}
              </Text>
            </Group>
            {/* Row 2: subtitle */}
            <Text size="xs" ff="monospace" c="var(--text-muted)">
              {t('res_InMemoryOnly')}
            </Text>
          </Box>

          {/* Sessions list */}
          <Box className="flex-1 overflow-y-auto min-h-0 p-4">
            <SessionsPanel />
          </Box>

          {/* Powered by */}
          <Box
            style={{
              padding: '8px 0',
              textAlign: 'center',
              flexShrink: 0,
            }}
          >
            <Text
              ff="monospace"
              className="text-fg-muted"
              style={{ fontSize: 9, letterSpacing: '0.07em', userSelect: 'none', opacity: 0.5 }}
            >
              {t('res_PoweredByOllama')}
            </Text>
          </Box>
        </Box>
      </AppShell.Aside>
    </AppShell>
  );
}
