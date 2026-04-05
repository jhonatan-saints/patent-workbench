import { useState, useEffect } from 'react';
import {
  Stack,
  Textarea,
  TextInput,
  Button,
  Text,
  Group,
  Box,
  Select,
} from '@mantine/core';
import { IconWand } from '@tabler/icons-react';
import { useWorkbenchStore } from '@/store/workbench';
import { INPUT_STYLES, btnPrimary } from '@/theme/styles';
import { useI18n } from '@/i18n/useI18n';

/** Document with a spark — idea becoming a patent */
function PatentIdeaIcon({ size = 28, className = '' }: Readonly<{ size?: number; className?: string }>) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {/* Patent document */}
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      {/* Claim text lines */}
      <line x1="8" y1="13" x2="16" y2="13" strokeWidth="1.2" />
      <line x1="8" y1="17" x2="13" y2="17" strokeWidth="1.2" />
      {/* Spark — the invention idea floating above the document */}
      <line x1="2.5" y1="4.5" x2="2.5" y2="2" strokeWidth="1.3" />
      <line x1="1.2" y1="3.2" x2="3.8" y2="3.2" strokeWidth="1.3" />
      <line x1="1.7" y1="2.2" x2="3.3" y2="4.2" strokeWidth="1.1" />
      <line x1="3.3" y1="2.2" x2="1.7" y2="4.2" strokeWidth="1.1" />
    </svg>
  );
}

function formatModelLabel(name: string): string {
  return name.split(':')[0];
}

function useTypewriter(text: string, speed = 32) {
  const [displayed, setDisplayed] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    setDisplayed('');
    setDone(false);
    let i = 0;
    const timer = setInterval(() => {
      i++;
      setDisplayed(text.slice(0, i));
      if (i >= text.length) {
        clearInterval(timer);
        setDone(true);
      }
    }, speed);
    return () => clearInterval(timer);
  }, [text, speed]);

  return { displayed, done };
}

export function IdeaInputStep() {
  const { startWorkflow, llmStatus, selectedModel, availableModels, setModel } =
    useWorkbenchStore();

  const { t } = useI18n();

  const [idea, setIdea] = useState('');
  const [domain, setDomain] = useState('');
  const [constraints, setConstraints] = useState('');

  const canStart = idea.trim().length > 0 && llmStatus === 'ok';

  const { displayed: headline, done: headlineDone } = useTypewriter(t('res_DescribeYourInvention'));

  const handleStart = () => {
    startWorkflow(idea, domain, constraints || undefined);
  };

  return (
    <div className="relative flex min-h-[calc(100vh-52px)] items-start justify-center overflow-hidden px-6 py-14">
      {/* Animated background blobs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="animate-blob-1 absolute top-[15%] left-[25%] h-125 w-125 rounded-full"
          style={{
            background: 'radial-gradient(circle, var(--accent) 0%, transparent 65%)',
            filter: 'blur(90px)',
            opacity: 0.1,
          }}
        />
        <div
          className="animate-blob-2 absolute top-[45%] right-[15%] h-90 w-90 rounded-full"
          style={{
            background: 'radial-gradient(circle, var(--accent-dim) 0%, transparent 65%)',
            filter: 'blur(100px)',
            opacity: 0.07,
          }}
        />
        <div
          className="animate-blob-1 absolute bottom-[10%] left-[55%] h-70 w-70 rounded-full"
          style={{
            background: 'radial-gradient(circle, var(--accent) 0%, transparent 65%)',
            filter: 'blur(70px)',
            opacity: 0.05,
            animationDelay: '6s',
          }}
        />
      </div>

      {/* Glassmorphism card */}
      <div
        className="relative z-10 w-full max-w-165 rounded-2xl p-10 shadow-xl"
        style={{
          background: 'var(--glass-bg)',
          backdropFilter: 'blur(18px)',
          WebkitBackdropFilter: 'blur(18px)',
          border: '1px solid var(--glass-border)',
          boxShadow: '0 8px 40px rgb(0 0 0 / 30%), inset 0 1px 0 rgb(255 255 255 / 4%)',
        }}
      >
        {/* Header */}
        <div className="animate-fade-up mb-8" style={{ animationDelay: '0ms' }}>
          <Group gap={10} mb={8}>
            <PatentIdeaIcon size={28} className="text-accent" />
            <Text
              component="h2"
              fw={700}
              size="xl"
              className="font-display tracking-wide text-fg"
              style={{ margin: 0 }}
            >
              {headline}
              <span className={headlineDone ? 'opacity-0' : 'animate-cursor-blink'}>|</span>
            </Text>
          </Group>
          <Text size="sm" c="var(--text-muted)" style={{ lineHeight: 1.65 }}>
            {t('res_GuidedWorkflowIntro')}
          </Text>
        </div>

        {/* Divider with glow */}
        <div
          className="animate-fade-up relative mb-8 flex h-px items-center justify-center"
          style={{ animationDelay: '80ms' }}
        >
          <div
            className="absolute inset-0 rounded-full"
            style={{
              background:
                'linear-gradient(to right, transparent 0%, var(--accent) 50%, transparent 100%)',
              opacity: 0.25,
            }}
          />
          <div
            className="absolute top-1/2 left-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent"
            style={{ boxShadow: '0 0 8px var(--accent)' }}
          />
        </div>

        <Stack gap={18}>
          <Box className="animate-fade-up" style={{ animationDelay: '120ms' }}>
            <Textarea
              label={t('res_InventionConcept')}
              description={t('res_InventionConcept_Description')}
              placeholder={t('res_InventionConcept_Placeholder')}
              value={idea}
              onChange={(e) => setIdea(e.currentTarget.value)}
              rows={5}
              required
              styles={INPUT_STYLES}
            />
          </Box>

          <Box className="animate-fade-up" style={{ animationDelay: '180ms' }}>
            <TextInput
              label={t('res_TechnologyDomain')}
              description={t('res_TechnologyDomain_Description')}
              placeholder={t('res_TechnologyDomain_Placeholder')}
              value={domain}
              onChange={(e) => setDomain(e.currentTarget.value)}
              styles={INPUT_STYLES}
            />
          </Box>

          <Box className="animate-fade-up" style={{ animationDelay: '240ms' }}>
            <Textarea
              label={t('res_ConstraintsNotes')}
              description={t('res_ConstraintsNotes_Description')}
              placeholder={t('res_ConstraintsNotes_Placeholder')}
              value={constraints}
              onChange={(e) => setConstraints(e.currentTarget.value)}
              rows={3}
              styles={INPUT_STYLES}
            />
          </Box>

          {/* Model + Start */}
          <Box className="animate-fade-up" style={{ animationDelay: '300ms' }}>
            <Group justify="space-between" align="flex-end" mt={4}>
              <Select
                label={t('res_Model')}
                value={selectedModel}
                onChange={(v) => v && setModel(v)}
                data={availableModels.map((m) => ({ value: m, label: formatModelLabel(m) }))}
                size="sm"
                style={{ width: 200 }}
                styles={{
                  label: INPUT_STYLES.label,
                  input: {
                    ...INPUT_STYLES.input,
                    fontFamily: 'var(--font-mono)',
                    fontSize: 13,
                  },
                  dropdown: {
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                  },
                }}
              />

              <Button
                leftSection={<IconWand size={14} />}
                onClick={handleStart}
                disabled={!canStart}
                size="md"
                style={btnPrimary(canStart)}
                className="uppercase btn-shimmer"
              >
                {t('res_StartWorkflow')}
              </Button>
            </Group>

            {llmStatus !== 'ok' && (
              <Text
                size="xs"
                c={llmStatus === 'checking' ? 'var(--text-muted)' : 'red'}
                ff="monospace"
                mt={8}
              >
                {llmStatus === 'checking' ? t('res_CheckingLLM') : t('res_LLMOffline')}
              </Text>
            )}
          </Box>
        </Stack>
      </div>
    </div>
  );
}
