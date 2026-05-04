import { Box, Stack, Text, Group, Badge, Button, Loader, ScrollArea, Divider } from '@mantine/core';
import {
  IconArrowBackUp,
  IconClipboardCheck,
  IconAlertCircle,
  IconAlertTriangle,
  IconBulb,
  IconRefresh,
  IconMoodSearch,
  IconCircleCheck,
  IconX,
} from '@tabler/icons-react';
import { useWorkbenchStore } from '@/store/workbench';
import { useShallow } from 'zustand/react/shallow';
import { useI18n } from '@/i18n/useI18n';
import type { IdfReviewFinding } from '@/types';
import { resolveLabel } from '@/utils';

const SEVERITY_CONFIG = {
  critical: {
    color: '#e53e3e',
    bgVar: 'rgba(229,62,62,0.08)',
    icon: IconAlertCircle,
    key: 'res_ReviewFinding_Critical',
  },
  warning: {
    color: '#d97706',
    bgVar: 'rgba(217,119,6,0.08)',
    icon: IconAlertTriangle,
    key: 'res_ReviewFinding_Warning',
  },
  suggestion: {
    color: 'var(--accent)',
    bgVar: 'var(--accent-glow)',
    icon: IconBulb,
    key: 'res_ReviewFinding_Suggestion',
  },
  strength: {
    color: '#38a169',
    bgVar: 'rgba(56,161,105,0.08)',
    icon: IconCircleCheck,
    key: 'res_ReviewFinding_Strength'
  },
} as const;

function scoreColor(score: number): string {
  if (score <= 3) return '#e53e3e';
  if (score <= 6) return '#d97706';
  return '#38a169';
}

function FindingCard({ finding }: Readonly<{ finding: IdfReviewFinding }>) {
  const { t } = useI18n();
  const cfg = SEVERITY_CONFIG[finding.severity] ?? SEVERITY_CONFIG.suggestion;
  const Icon = cfg.icon;
  const isGlobal = !finding.section || finding.section === 'global';

  return (
    <Box
      className="rounded border"
      style={{ borderColor: cfg.color, background: cfg.bgVar }}
    >
      <Box className="px-4 py-3">
        <Group gap={8} wrap="nowrap" align="flex-start" mb={6}>
          <Icon size={14} style={{ color: cfg.color, flexShrink: 0, marginTop: 2 }} />
          <Box className="flex-1 min-w-0">
            <Group gap={6} wrap="wrap" mb={4}>
              <Badge
                size="xs"
                variant="outline"
                style={{ borderColor: cfg.color, color: cfg.color }}
                className="font-mono"
              >
                {t(cfg.key)}
              </Badge>
              <Badge
                size="xs"
                variant="outline"
                className="font-mono border-stroke text-fg-muted"
              >
                {isGlobal ? t('res_ReviewSectionGlobal') : resolveLabel(finding.section, t)}
              </Badge>
            </Group>
            <Text size="sm" fw={600} className="text-fg leading-snug mb-1">
              {finding.title}
            </Text>
            <Text size="xs" className="text-fg-secondary leading-relaxed">
              {finding.detail}
            </Text>
            {finding.quote && (
              <Text
                size="xs"
                ff="monospace"
                className="mt-1.5 pl-2 border-l-2 italic opacity-60"
                style={{ borderColor: cfg.color }}
              >
                "{finding.quote}"
              </Text>
            )}
          </Box>
        </Group>
      </Box>
    </Box>
  );
}

const SEVERITY_ORDER: IdfReviewFinding['severity'][] = ['critical', 'warning', 'suggestion', 'strength'];

export function ReviewPhase() {
  const { artifact, reviewResult, reviewStatus, reviewPass, lastError, startReview, cancelReview, goToPreview } = useWorkbenchStore(
    useShallow((s) => ({
      artifact: s.artifact,
      reviewResult: s.reviewResult,
      reviewStatus: s.reviewStatus,
      reviewPass: s.reviewPass,
      lastError: s.lastError,
      startReview: s.startReview,
      cancelReview: s.cancelReview,
      goToPreview: s.goToPreview,
    }))
  );
  const { t } = useI18n();

  if (!artifact) return null;

  const isLoading = reviewStatus === 'loading';
  const isError = reviewStatus === 'error';
  const hasResult = reviewStatus === 'success' && reviewResult !== null;
  const hasRun = hasResult || isError;

  const sortedFindings = reviewResult
    ? [...reviewResult.findings].sort(
        (a, b) =>
          SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity)
      )
    : [];

  const criticalCount = sortedFindings.filter((f) => f.severity === 'critical').length;
  const warningCount = sortedFindings.filter((f) => f.severity === 'warning').length;
  const strengthCount = sortedFindings.filter((f) => f.severity === 'strength').length;

  let analyzeButtonLabel: string;
  if (isLoading) {
    analyzeButtonLabel = t('res_ReviewAnalyzing');
  } else if (hasRun) {
    analyzeButtonLabel = t('res_ReviewRerun');
  } else {
    analyzeButtonLabel = t('res_ReviewAnalyze');
  }

  function renderActionButton() {
    if (isLoading) {
      return (
        <Button
          size="xs"
          variant="subtle"
          leftSection={<IconX size={14} />}
          onClick={cancelReview}
          className="font-mono text-[11px] font-bold text-fg-muted"
        >
          <span className="uppercase">{t('res_Cancel')}</span>
        </Button>
      );
    }
    if (hasRun) {
      return (
        <Button
          size="xs"
          variant="subtle"
          leftSection={<IconRefresh size={14} />}
          onClick={() => startReview()}
          className="font-mono text-[11px] font-bold text-accent"
        >
          <span className="uppercase">{analyzeButtonLabel}</span>
        </Button>
      );
    }
    return (
      <Button
        size="xs"
        leftSection={<IconClipboardCheck size={14} />}
        onClick={() => startReview()}
        className="font-mono text-[11px] font-bold border-none bg-accent text-accent-text"
      >
        <span className="uppercase">{analyzeButtonLabel}</span>
      </Button>
    );
  }

  return (
    <Stack gap={0} className="h-full">
      {/* Header */}
      <Box className="px-5 py-3.5 border-b border-stroke bg-surface-raised shrink-0">
        <Group justify="space-between" wrap="nowrap">
          <Stack gap={2}>
            <Group gap={8}>
              <IconMoodSearch size={14} className="text-accent" />
              <Text fw={700} size="sm" ff="monospace" className="text-fg tracking-[0.06em] uppercase">
                {t('res_IdfReview')}
              </Text>
            </Group>
            <Text size="xs" c="var(--text-muted)" ff="monospace">
              {t('res_IdfReview_Description')}
            </Text>
          </Stack>
          <Group gap={8}>
            <Button
              variant="subtle"
              size="xs"
              leftSection={<IconArrowBackUp size={16} />}
              onClick={goToPreview}
              className="font-mono text-[11px] text-fg-muted"
            >
              <span className="uppercase">{t('res_ReviewBackToPreview')}</span>
            </Button>
            {renderActionButton()}
          </Group>
        </Group>
      </Box>

      {/* Non-result states — centered, no scroll needed */}
      {!hasResult && (
        <Box className="flex-1 flex flex-col items-center justify-center gap-4 bg-bg">
          {!isLoading && !isError && (
            <>
              <IconMoodSearch size={40} className="text-fg-muted opacity-40" />
              <Text size="sm" ff="monospace" className="text-fg-muted text-center max-w-sm">
                {t('res_ReviewEmptyHint')}
              </Text>
            </>
          )}
          {isLoading && (
            <>
              <Loader size={32} color="var(--accent)" />
              <Text size="sm" ff="monospace" className="text-fg-muted">
                {reviewPass ? t('res_ReviewAnalyzing_Step', { step: t(reviewPass) }) : t('res_ReviewAnalyzing')}
              </Text>
            </>
          )}
          {isError && (
            <>
              <IconAlertCircle size={36} style={{ color: '#e53e3e' }} />
              <Text size="sm" ff="monospace" className="text-center" style={{ color: '#e53e3e' }}>
                {t('res_ReviewError')}
              </Text>
              {lastError && (
                <Text size="xs" ff="monospace" className="text-center max-w-sm opacity-60" style={{ color: '#e53e3e' }}>
                  {lastError}
                </Text>
              )}
              <Button
                size="xs"
                variant="subtle"
                leftSection={<IconRefresh size={13} />}
                onClick={() => startReview()}
                className="font-mono text-[11px] text-fg-muted"
              >
                <span className="uppercase">{t('res_ReviewRerun')}</span>
              </Button>
            </>
          )}
        </Box>
      )}

      {/* Result state — score card pinned, findings scroll independently */}
      {hasResult && reviewResult && (
        <>
          {/* Score + Summary — fixed, never scrolls */}
          <Box className="shrink-0 border-b border-stroke bg-surface-raised px-6 py-4">
            <Stack gap={8}>
              {/* Score + badges on a single left-aligned row */}
              <Group gap={10} align="baseline" wrap="nowrap">
                <Text
                  ff="monospace"
                  fw={700}
                  style={{ fontSize: 48, lineHeight: 1, color: scoreColor(reviewResult.overallScore) }}
                >
                  {reviewResult.overallScore}
                </Text>
                <Text size="sm" ff="monospace" className="text-fg-muted">
                  / 10
                </Text>
                <Text
                  size="xs"
                  fw={700}
                  ff="monospace"
                  className="uppercase tracking-widest"
                  style={{ color: scoreColor(reviewResult.overallScore) }}
                >
                  {t('res_ReviewOverallScore')}
                </Text>
                {(criticalCount > 0 || warningCount > 0 || strengthCount > 0) && (
                  <Group gap={6} ml={4}>
                    {criticalCount > 0 && (
                      <Badge size="xs" variant="outline" style={{ borderColor: '#e53e3e', color: '#e53e3e' }} className="font-mono">
                        {criticalCount} {t('res_ReviewFinding_Critical')}
                      </Badge>
                    )}
                    {warningCount > 0 && (
                      <Badge size="xs" variant="outline" style={{ borderColor: '#d97706', color: '#d97706' }} className="font-mono">
                        {warningCount} {t('res_ReviewFinding_Warning')}
                      </Badge>
                    )}
                    {strengthCount > 0 && (
                      <Badge size="xs" variant="outline" style={{ borderColor: '#38a169', color: '#38a169' }} className="font-mono">
                        {strengthCount} {t('res_ReviewFinding_Strength')}
                      </Badge>
                    )}
                  </Group>
                )}
              </Group>

              <Divider className="border-stroke" />

              {/* Summary below the score */}
              <Box>
                <Text
                  size="xs"
                  fw={700}
                  ff="monospace"
                  className="text-fg-muted uppercase tracking-widest mb-1"
                >
                  {t('res_ReviewSummary')}
                </Text>
                <Text size="sm" className="text-fg leading-relaxed">
                  {reviewResult.summary}
                </Text>
              </Box>
            </Stack>
          </Box>

          {/* Findings — scrollable */}
          <ScrollArea className="flex-1 bg-bg">
            <Box className="max-w-3xl mx-auto py-5 px-6">
              <Text
                size="xs"
                fw={700}
                ff="monospace"
                className="text-fg-muted uppercase tracking-widest border-l-2 border-accent pl-2 mb-3"
              >
                {t('res_ReviewFindings')}
              </Text>

              {sortedFindings.length === 0 ? (
                <Text size="sm" ff="monospace" className="text-fg-muted">
                  {t('res_ReviewNoFindings')}
                </Text>
              ) : (
                <Stack gap={10}>
                  {sortedFindings.map((finding) => (
                    <FindingCard
                      key={`${finding.severity}-${finding.section}-${finding.title}`}
                      finding={finding}
                    />
                  ))}
                </Stack>
              )}
            </Box>
          </ScrollArea>
        </>
      )}
    </Stack>
  );
}
