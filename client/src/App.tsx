import {
  AppShell,
  Group,
  Text,
  Box,
  ActionIcon,
  Tooltip,
  Divider,
  ScrollArea,
  Modal,
  Button,
  useMantineColorScheme,
  useComputedColorScheme,
} from '@mantine/core';
import {
  IconSunFilled,
  IconMoon,
  IconChevronLeft,
  IconChevronRight,
  IconBrandGithub,
  IconLogout,
  IconTrash,
} from '@tabler/icons-react';
import React, {
  lazy,
  Suspense,
  useRef,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import { useHotkeys } from '@mantine/hooks';
import { StatusIndicator } from '@/components/StatusIndicator';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { SettingsMenu } from '@/components/SettingsMenu';
import { StepProgress } from '@/components/workflow/StepProgress';
import { DraftsPanel } from '@/components/workflow/DraftsPanel';
import { useWorkbenchStore } from '@/store/workbench';
import { useShallow } from 'zustand/react/shallow';
import { AppLoader } from '@/components/AppLoader';
import { BrandSplash } from '@/components/BrandSplash';
import { OAuthLoginDemo } from '@/components/OAuthLoginDemo';
import { WindowControls } from '@/components/WindowControls';
import { useI18n } from '@/i18n';

const IdeaInputStep = lazy(() =>
  import('@/components/workflow/IdeaInputStep').then((m) => ({ default: m.IdeaInputStep }))
);
const OptionsPanel = lazy(() =>
  import('@/components/workflow/OptionsPanel').then((m) => ({ default: m.OptionsPanel }))
);
const ArtifactPreview = lazy(() =>
  import('@/components/workflow/ArtifactPreview').then((m) => ({ default: m.ArtifactPreview }))
);
const FiguresStep = lazy(() =>
  import('@/components/workflow/FiguresStep').then((m) => ({ default: m.FiguresStep }))
);
const InventorsStep = lazy(() =>
  import('@/components/workflow/InventorsStep').then((m) => ({ default: m.InventorsStep }))
);
const PreviewPhase = lazy(() =>
  import('@/components/workflow/PreviewPhase').then((m) => ({ default: m.PreviewPhase }))
);
const ReviewPhase = lazy(() =>
  import('@/components/workflow/ReviewPhase').then((m) => ({ default: m.ReviewPhase }))
);

// Set VITE_DEMO_OAUTH=true to preview the OAuth2 login -> loader -> app flow
const DEMO_OAUTH = import.meta.env.VITE_DEMO_OAUTH === 'true';

const IS_ELECTRON = globalThis.electronAPI?.isElectron === true;

type AppPhase = 'splash' | 'login' | 'loading' | 'ready';

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
        do {
          next = Math.floor(Math.random() * 9);
        } while (next === last);
        last = next;
        setActive(next);
        schedule();
      }, delay);
    };
    schedule();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <span className="grid grid-cols-[repeat(3,4px)] gap-0.75 shrink-0 self-center">
      {Array.from({ length: 9 }, (_, i) => (
        <span
          key={i}
          className="block w-1 h-1 bg-accent [transition:opacity_600ms_ease,box-shadow_600ms_ease]"
          style={{
            opacity: active === i ? 1 : 0.2,
            boxShadow: active === i ? '0 0 5px var(--accent), 0 0 12px var(--accent)' : 'none',
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
        {scheme === 'dark' ? <IconSunFilled size={18} /> : <IconMoon size={18} />}
      </ActionIcon>
    </Tooltip>
  );
}

export function App() {
  const {
    workflowPhase,
    artifact,
    initSessions,
    loadSettings,
    loadTemplate,
    clearSessions,
    sessions,
    persistDraft,
  } = useWorkbenchStore(
    useShallow((s) => ({
      workflowPhase: s.workflowPhase,
      artifact: s.artifact,
      initSessions: s.initSessions,
      loadSettings: s.loadSettings,
      loadTemplate: s.loadTemplate,
      clearSessions: s.clearSessions,
      sessions: s.sessions,
      persistDraft: s.persistDraft,
    }))
  );
  const [clearDraftsOpen, setClearDraftsOpen] = useState(false);
  const logoutBtnRef = useRef<HTMLButtonElement>(null);
  const navRef = useRef<HTMLDivElement>(null);
  const draftsRef = useRef<HTMLDivElement>(null);
  const { t, ready: i18nReady } = useI18n();
  const isWorking = workflowPhase === 'working';
  const isFigures = workflowPhase === 'figures';
  const isInventors = workflowPhase === 'inventors';
  const isPreview = workflowPhase === 'preview';
  const isReview = workflowPhase === 'review';

  function getInitialPhase(): AppPhase {
    if (IS_ELECTRON) return 'splash';
    if (DEMO_OAUTH) return 'login';
    return 'loading';
  }

  const [phase, setPhase] = useState<AppPhase>(getInitialPhase);
  const [animDone, setAnimDone] = useState(false);

  useEffect(() => {
    if (animDone && i18nReady) setPhase('ready');
  }, [animDone, i18nReady]);

  useEffect(() => {
    void initSessions();
    void loadSettings();
    void loadTemplate();
  }, [initSessions, loadSettings, loadTemplate]);

  // Auto-save: debounce persists the draft 2 s after any artifact change.
  // Covers figures upload, manual content, inline edits, inventors, etc.
  useEffect(() => {
    if (!artifact || workflowPhase === 'input') return;
    const timer = setTimeout(() => { void persistDraft(); }, 2000);
    return () => clearTimeout(timer);
  }, [artifact, workflowPhase, persistDraft]);

  const [navCollapsed, setNavCollapsed] = useState(
    () => localStorage.getItem('nav-collapsed') === 'true'
  );
  const toggleNav = useCallback(() => {
    setNavCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem('nav-collapsed', String(next));
      return next;
    });
  }, []);

  useHotkeys([
    [
      'alt+W',
      () => {
        const first = navRef.current?.querySelector<HTMLElement>(
          '[tabindex="0"], button, a, [role="button"]'
        );
        first?.focus();
      },
    ],
    [
      'alt+D',
      () => {
        const first = draftsRef.current?.querySelector<HTMLButtonElement>('button');
        first?.focus();
      },
    ],
    [
      'alt+S',
      () => {
        void persistDraft();
      },
    ],
    [
      'alt+L',
      () => {
        if (DEMO_OAUTH) logoutBtnRef.current?.click();
      },
    ],
  ]);

  if (phase === 'login') return <OAuthLoginDemo onAuthenticated={() => setPhase('loading')} />;

  if (phase === 'loading') return <AppLoader onDone={() => setAnimDone(true)} />;

  return (
    <>
      {phase === 'splash' && <BrandSplash onDone={() => setAnimDone(true)} />}
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
            WebkitAppRegion: 'drag',
          },
          navbar: {
            background: 'var(--surface)',
            borderRight: '1px solid var(--border)',
            zIndex: 100,
            transition: 'width 220ms cubic-bezier(0.4, 0, 0.2, 1)',
            overflow: 'hidden',
          },
          aside: {
            background: 'var(--surface)',
            borderLeft: '1px solid var(--border)',
            zIndex: 100,
          },
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
            <Group gap={8} align="center" wrap="nowrap">
              <LogoDots />
              <Text
                fw={600}
                size="md"
                ff="monospace"
                className="text-fg tracking-widest uppercase"
                style={{ margin: 0 }}
              >
                {t('res_PatentWorkbench')}
              </Text>
              <span className="inline-flex items-center px-2 py-0.5 rounded border border-stroke bg-surface-raised text-[11px] font-mono text-fg-muted tracking-[0.06em] leading-[1.6] uppercase select-none">
                {t(DEMO_OAUTH ? 'res_OnPremZeroTelemetry' : 'res_LocalFirstZeroTelemetry')}
              </span>
            </Group>

            {/* Right actions */}
            <Group
              gap={8}
              align="center"
              wrap="nowrap"
              style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
            >
              <LanguageSwitcher />
              <ThemeToggle />
              {!DEMO_OAUTH && <SettingsMenu />}
              <StatusIndicator />
              {IS_ELECTRON && (
                <>
                  <Divider
                    orientation="vertical"
                    style={{ height: 16, alignSelf: 'center', marginLeft: 4 }}
                  />
                  <WindowControls />
                </>
              )}
              {DEMO_OAUTH && (
                <>
                  <Divider
                    orientation="vertical"
                    style={{ height: 16, alignSelf: 'center', marginLeft: 6 }}
                  />
                  <Tooltip label={`Logout (Alt+L)`} position="bottom">
                    <ActionIcon
                      ref={logoutBtnRef}
                      variant="subtle"
                      size="md"
                      onClick={() => setPhase('login')}
                      aria-label="Logout"
                      className="text-fg-muted hover:text-accent"
                    >
                      <IconLogout size={18} />
                    </ActionIcon>
                  </Tooltip>
                </>
              )}
            </Group>
          </Group>
        </AppShell.Header>

        {/* LEFT NAV */}
        <AppShell.Navbar>
          <Box ref={navRef} className="h-full flex flex-col overflow-hidden">
            <Box className="flex-1 overflow-y-auto min-h-0">
              <StepProgress collapsed={navCollapsed} />
            </Box>
            <Box
              className={`border-t border-stroke flex items-center ${navCollapsed ? 'px-0 py-2 justify-center' : 'px-2.5 py-2 justify-between'}`}
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
                  className={`text-fg-muted hover:text-accent ${navCollapsed ? 'hidden' : ''}`}
                >
                  <IconBrandGithub size={14} />
                </ActionIcon>
              </Tooltip>
              <Tooltip label={navCollapsed ? 'Expand' : 'Collapse'} position="right" withArrow>
                <ActionIcon
                  variant="subtle"
                  size="sm"
                  onClick={toggleNav}
                  aria-label={navCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                  className="text-fg-muted hover:text-accent"
                >
                  {navCollapsed ? <IconChevronRight size={14} /> : <IconChevronLeft size={14} />}
                </ActionIcon>
              </Tooltip>
            </Box>
          </Box>
        </AppShell.Navbar>

        {/* MAIN */}
        <AppShell.Main>
          <Suspense fallback={null}>
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
              <Box
                className="flex flex-col overflow-hidden"
                style={{ height: 'calc(100vh - 44px)' }}
              >
                <FiguresStep />
              </Box>
            )}

            {isInventors && (
              <Box
                className="flex flex-col overflow-hidden"
                style={{ height: 'calc(100vh - 44px)' }}
              >
                <InventorsStep />
              </Box>
            )}

            {isPreview && (
              <Box
                className="flex flex-col overflow-hidden"
                style={{ height: 'calc(100vh - 44px)' }}
              >
                <PreviewPhase />
              </Box>
            )}

            {isReview && (
              <Box
                className="flex flex-col overflow-hidden"
                style={{ height: 'calc(100vh - 44px)' }}
              >
                <ReviewPhase />
              </Box>
            )}
          </Suspense>
        </AppShell.Main>

        {/* RIGHT ASIDE */}
        <AppShell.Aside>
          <Box className="h-full flex flex-col overflow-hidden">
            {/* Aside chrome header — mirrors ArtifactPreview header structure (px-4 py-3.5) */}
            <Box className="px-4 py-3.5 shrink-0 border-b border-stroke bg-surface-raised">
              <Group justify="space-between" align="center" wrap="nowrap">
                {/* Left: label block */}
                <Box>
                  <Group gap={8} align="center" wrap="nowrap" mb={3}>
                    <Box className="animate-pulse-glow w-1.5 h-1.5 rounded-full bg-accent shrink-0" />
                    <Text
                      ff="monospace"
                      fw={700}
                      tt="uppercase"
                      className="text-accent tracking-widest"
                      size="xs"
                    >
                      {t('res_Drafts')}
                    </Text>
                  </Group>
                  <Text size="xs" ff="monospace" c="var(--text-muted)">
                    {t('res_InMemoryOnly')}
                  </Text>
                </Box>

                {/* Right: clear button */}
                {sessions.length > 0 && (
                  <Tooltip label={t('res_Clear')} position="left" withArrow>
                    <ActionIcon
                      variant="subtle"
                      size="sm"
                      onClick={() => setClearDraftsOpen(true)}
                      aria-label={t('res_Clear')}
                      className="text-fg-muted hover:text-accent"
                    >
                      <IconTrash size={13} />
                    </ActionIcon>
                  </Tooltip>
                )}
              </Group>
            </Box>

            {/* Sessions list */}
            <Box ref={draftsRef} className="flex-1 overflow-y-auto min-h-0 px-4 py-2.5">
              <DraftsPanel />
            </Box>

            {/* Powered by */}
            <Box className="py-2 text-center shrink-0">
              <Text
                ff="monospace"
                className="text-muted text-[11px] tracking-[0.07em] select-none opacity-75"
              >
                {t('res_PoweredByOllama')}
              </Text>
            </Box>
          </Box>
        </AppShell.Aside>

        <Modal
          opened={clearDraftsOpen}
          onClose={() => setClearDraftsOpen(false)}
          title={t('res_ClearAllDraftsConfirmTitle')}
          centered
          size="sm"
        >
          <Text size="sm" mb="lg">
            {t('res_ClearAllDraftsConfirmMessage')}
          </Text>
          <Group justify="flex-end" gap={8}>
            <Button variant="default" size="xs" onClick={() => setClearDraftsOpen(false)}>
              {t('res_Cancel')}
            </Button>
            <Button
              color="red"
              size="xs"
              onClick={() => {
                setClearDraftsOpen(false);
                clearSessions();
              }}
            >
              {t('res_Delete')}
            </Button>
          </Group>
        </Modal>
      </AppShell>
    </>
  );
}
