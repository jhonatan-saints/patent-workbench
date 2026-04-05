import { useState, type CSSProperties } from 'react';
import {
  Box,
  Stack,
  Text,
  Group,
  Badge,
  Button,
  ScrollArea,
  Divider,
  Textarea,
} from '@mantine/core';
import { IconArrowLeft, IconCircleCheck, IconPencil, IconCheck, IconX, IconCopy, IconClipboardCheck, IconHome } from '@tabler/icons-react';
import { useWorkbenchStore } from '@/store/workbench';
import { useI18n } from '@/i18n/useI18n';
import { WORKFLOW_ORDER, SECTION_LABELS } from '@/utils/workflowTemplates';
import { ExportPanel } from '@/components/ExportPanel';
import type { WorkflowModuleId } from '@/types';

// Document-level styles intentionally use print/IDF brand colors (not theme tokens)
// so the on-screen preview matches the PDF/DOCX output exactly.
const DOC_FONT = 'Calibri, Arial, sans-serif';
const DOC_BLUE = '#4472C4';
const DOC_BLACK = '#111';

// EditableSection UI chrome sits on the beige document background (#f4f0e8),
// which is always light regardless of the app color scheme. Use fixed neutral
// grays here instead of theme tokens so they're always legible on that surface.
const DOC_UI_MUTED = '#888';
const DOC_UI_LABEL = { borderColor: '#aaa', color: '#666' };

interface EditableSectionProps {
  readonly moduleId: WorkflowModuleId;
  readonly content: string;
}

function EditableSection({ moduleId, content }: EditableSectionProps) {
  const { updateSectionContent } = useWorkbenchStore();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(content);
  const [copied, setCopied] = useState(false);
  const { t } = useI18n();

  const handleCopy = () => {
    void navigator.clipboard.writeText(content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleSave = () => {
    updateSectionContent(moduleId, draft);
    setEditing(false);
  };

  const handleCancel = () => {
    setDraft(content);
    setEditing(false);
  };

  return (
    <Box>
      <Group justify="space-between" align="flex-start" mb={8} wrap="nowrap">
        <Badge
          size="sm"
          variant="outline"
          style={DOC_UI_LABEL}
          className="font-mono text-[10px] tracking-[0.08em]"
        >
          {t(SECTION_LABELS[moduleId])}
        </Badge>

        {editing ? (
          <Group gap={6} className="shrink-0">
            <Button
              size="xs"
              variant="subtle"
              leftSection={<IconX size={11} />}
              onClick={handleCancel}
              style={{ color: DOC_UI_MUTED }}
              className="font-mono text-[10px]"
            >
              <span className="uppercase">{t('res_Cancel')}</span>
            </Button>
            <Button
              size="xs"
              leftSection={<IconCheck size={11} />}
              onClick={handleSave}
              className="font-mono text-[10px] font-bold border-none bg-accent text-accent-text"
            >
              <span className="uppercase">{t('res_Save')}</span>
            </Button>
          </Group>
        ) : (
          <Group gap={6} className="shrink-0">
            <Button
              size="xs"
              variant="subtle"
              leftSection={copied ? <IconClipboardCheck size={11} /> : <IconCopy size={11} />}
              onClick={handleCopy}
              style={{ color: copied ? '#4caf50' : DOC_UI_MUTED }}
              className="font-mono text-[10px]"
            >
              <span className="uppercase">{copied ? t('res_Copied') : t('res_Copy')}</span>
            </Button>
            <Button
              size="xs"
              variant="subtle"
              leftSection={<IconPencil size={11} />}
              onClick={() => {
                setDraft(content);
                setEditing(true);
              }}
              style={{ color: DOC_UI_MUTED }}
              className="font-mono text-[10px]"
            >
              <span className="uppercase">{t('res_Edit')}</span>
            </Button>
          </Group>
        )}
      </Group>

      {editing ? (
        <Textarea
          aria-label={`Edit content for ${t(SECTION_LABELS[moduleId])}`}
          value={draft}
          onChange={(e) => setDraft(e.currentTarget.value)}
          minRows={4}
          autosize
          styles={{
            input: {
              background: 'var(--surface-raised)',
              border: '1px solid var(--accent)',
              color: 'var(--text-primary)',
              fontFamily: 'var(--font-serif)',
              fontSize: 13,
              lineHeight: 1.8,
            },
          }}
        />
      ) : (
        // Document body — intentional print style, not theme tokens
        <Text
          style={{
            color: DOC_BLACK,
            fontFamily: 'var(--font-serif)',
            fontSize: 14,
            lineHeight: 1.8,
            whiteSpace: 'pre-wrap',
          }}
        >
          {content}
        </Text>
      )}
    </Box>
  );
}

export function PreviewPhase() {
  const { artifact, resetWorkflow, steps, goToStep, workflowPhase } = useWorkbenchStore();
  const [zoom, setZoom] = useState(1);
  const { t } = useI18n();
  if (!artifact) return null;

  const completedSections = WORKFLOW_ORDER.filter((m) => artifact.sections[m]);
  const totalTokens = steps.reduce((acc, s) => acc + s.promptTokens + s.completionTokens, 0);
  const allDone = completedSections.length === WORKFLOW_ORDER.length;

  const handleBackToWork = () => {
    const lastIncompleteIdx = steps.findIndex((s) => s.status !== 'done');
    if (lastIncompleteIdx >= 0) {
      goToStep(lastIncompleteIdx);
    } else {
      goToStep(steps.length - 1);
    }
  };

  return (
    <Stack gap={0} style={{ height: '100%' }}>
      {/* Header */}
      <Box className="px-5 py-3.5 border-b border-stroke bg-surface-raised shrink-0">
        <Group justify="space-between" wrap="nowrap">
          <Stack gap={2}>
            <Group gap={8}>
              <IconCircleCheck size={14} className="text-accent" />
              <Text
                fw={700}
                size="sm"
                ff="monospace"
                className="text-fg tracking-[0.06em] uppercase"
              >
                {allDone ? t('res_PatentDraftComplete') : t('res_DraftInProgress')}
              </Text>
            </Group>
            <Text size="xs" c="var(--text-muted)" ff="monospace">
              {completedSections.length}/{WORKFLOW_ORDER.length} {t('res_Sections')}
              {totalTokens > 0 && ` · ${totalTokens}t`}
              {' · '}
              {artifact.model.split(':')[0]}
              {artifact.inventors.length > 0 &&
                ` · ${artifact.inventors.map((i) => i.name).join(', ')}`}
            </Text>
          </Stack>
          <Group gap={8}>
            {workflowPhase === 'preview' && (
              <Button
                variant="subtle"
                size="xs"
                leftSection={<IconArrowLeft size={14} />}
                onClick={handleBackToWork}
                className="font-mono text-[11px] text-fg-muted"
              >
                <span className="uppercase">{t('res_BackToSteps')}</span>
              </Button>
            )}
            <Button
              variant="subtle"
              size="xs"
              leftSection={<IconHome size={14} />}
              onClick={resetWorkflow}
              className="font-mono text-[11px] text-fg-muted"
            >
              <span className="uppercase">{t('res_NewInvention')}</span>
            </Button>
          </Group>
        </Group>
      </Box>

      {/* Document — intentional print/IDF brand colors, not theme tokens */}
      <ScrollArea className="flex-1 bg-bg">
        <Box py={40} px={24}>
          <Box
            style={{
              maxWidth: 800,
              margin: '0 auto',
              background: '#f4f0e8',
              zoom: zoom,
              transformOrigin: 'top center',
              color: DOC_BLACK,
              padding: '72px 80px',
              boxShadow: '0 4px 32px rgba(0,0,0,0.18), 0 1px 4px rgba(0,0,0,0.10)',
              borderRadius: 2,
              minHeight: 1000,
            }}
          >
            <Stack gap={28}>
              {/* Inventors block */}
              {artifact.inventors.length > 0 && (
                <Box>
                  <Text
                    className='uppercase'
                    style={{
                      color: DOC_BLUE,
                      fontFamily: DOC_FONT,
                      fontSize: 18,
                      fontWeight: 400,
                      marginBottom: 6,
                    }}
                  >
                    {t('res_Inventors')}
                  </Text>
                  {artifact.inventors.map((inv) => (
                    <Box key={inv.id} mb={8}>
                      <Text
                        style={{
                          color: DOC_BLUE,
                          fontFamily: DOC_FONT,
                          fontSize: 13,
                          marginTop: 10,
                          marginBottom: 2,
                        }}
                      >
                        {t('res_Name')}:
                      </Text>
                      <Text
                        style={{
                          fontFamily: DOC_FONT,
                          fontSize: 13,
                          fontWeight: 700,
                          color: DOC_BLACK,
                        }}
                      >
                        {inv.name}
                      </Text>
                      {inv.address && (
                        <>
                          <Text
                            style={{
                              color: DOC_BLUE,
                              fontFamily: DOC_FONT,
                              fontSize: 13,
                              marginTop: 10,
                              marginBottom: 2,
                            }}
                          >
                            {t('res_HomeAddress')}:
                          </Text>
                          <Text style={{ fontFamily: DOC_FONT, fontSize: 13, color: DOC_BLACK }}>
                            {inv.address}
                          </Text>
                        </>
                      )}
                      {inv.telephone && (
                        <>
                          <Text
                            style={{
                              color: DOC_BLUE,
                              fontFamily: DOC_FONT,
                              fontSize: 13,
                              marginTop: 10,
                              marginBottom: 2,
                            }}
                          >
                            {t('res_HomeTelephone')}:
                          </Text>
                          <Text style={{ fontFamily: DOC_FONT, fontSize: 13, color: DOC_BLACK }}>
                            {inv.telephone}
                          </Text>
                        </>
                      )}
                      <Text
                        style={{
                          color: DOC_BLUE,
                          fontFamily: DOC_FONT,
                          fontSize: 13,
                          marginTop: 10,
                          marginBottom: 2,
                        }}
                      >
                        {t('res_HomeEmail')}:
                      </Text>
                      <Text style={{ fontFamily: DOC_FONT, fontSize: 13, color: DOC_BLACK }}>
                        {inv.email ?? ''}
                      </Text>
                      {inv.citizenship && (
                        <>
                          <Text
                            style={{
                              color: DOC_BLUE,
                              fontFamily: DOC_FONT,
                              fontSize: 13,
                              marginTop: 10,
                              marginBottom: 2,
                            }}
                          >
                            {t('res_Citizenship')}:
                          </Text>
                          <Text style={{ fontFamily: DOC_FONT, fontSize: 13, color: DOC_BLACK }}>
                            {inv.citizenship}
                          </Text>
                        </>
                      )}
                      {inv.employeeId && (
                        <>
                          <Text
                            style={{
                              color: DOC_BLUE,
                              fontFamily: DOC_FONT,
                              fontSize: 13,
                              marginTop: 10,
                              marginBottom: 2,
                            }}
                          >
                            {t('res_EmployeeId')}:
                          </Text>
                          <Text
                            style={{
                              fontFamily: DOC_FONT,
                              fontSize: 13,
                              fontWeight: 700,
                              color: DOC_BLACK,
                            }}
                          >
                            {inv.employeeId}
                          </Text>
                        </>
                      )}
                    </Box>
                  ))}
                  <Divider mt={20} mb={0} style={{ borderColor: '#ddd' }} />
                </Box>
              )}

              {/* Invention Title + IDF metadata */}
              {(artifact.inventionTitle || artifact.idfNumber || artifact.businessGroup) && (
                <Box>
                  <Text
                    style={{
                      fontFamily: DOC_FONT,
                      fontSize: 13,
                      fontWeight: 700,
                      color: DOC_BLACK,
                      marginBottom: 2,
                    }}
                  >
                    {t('res_InventionTitle')}
                  </Text>
                  <Text
                    style={{
                      fontFamily: DOC_FONT,
                      fontSize: 13,
                      color: DOC_BLACK,
                      marginBottom: 10,
                    }}
                  >
                    {artifact.inventionTitle ?? artifact.baseIdea}
                  </Text>
                  <Text
                    style={{
                      fontFamily: DOC_FONT,
                      fontSize: 13,
                      fontWeight: 700,
                      color: DOC_BLACK,
                      marginBottom: 2,
                    }}
                  >
                    {t('res_IDFNumber')}
                  </Text>
                  {artifact.idfNumber && (
                    <Text
                      style={{
                        fontFamily: DOC_FONT,
                        fontSize: 13,
                        color: DOC_BLACK,
                        marginBottom: 10,
                      }}
                    >
                      {artifact.idfNumber}
                    </Text>
                  )}
                  {artifact.businessGroup && (
                    <>
                      <Text
                        style={{
                          fontFamily: DOC_FONT,
                          fontSize: 13,
                          fontWeight: 700,
                          color: DOC_BLACK,
                          marginBottom: 2,
                        }}
                      >
                        {t('res_BusinessGroup')}
                      </Text>
                      <Text style={{ fontFamily: DOC_FONT, fontSize: 13, color: DOC_BLACK }}>
                        {artifact.businessGroup}
                      </Text>
                    </>
                  )}
                  <Divider mt={20} mb={0} style={{ borderColor: '#ddd' }} />
                </Box>
              )}

              {/* Content sections */}
              {WORKFLOW_ORDER.map((moduleId) => {
                const section = artifact.sections[moduleId];
                if (!section) return null;
                return (
                  <Box key={moduleId}>
                    <EditableSection moduleId={moduleId} content={section.content} />
                  </Box>
                );
              })}

              {/* Figures */}
              {artifact.figures?.length > 0 && (
                <Box>
                  <Divider mb={24} style={{ borderColor: '#ddd' }} />
                  <Text
                    className='uppercase'
                    style={{
                      color: DOC_BLUE,
                      fontFamily: DOC_FONT,
                      fontSize: 18,
                      fontWeight: 400,
                      marginBottom: 16,
                    }}
                  >
                    {t('res_Figures')}
                  </Text>
                  <Stack gap={20}>
                    {artifact.figures.map((fig) => {
                      const figImgStyle: CSSProperties = {
                        maxWidth: '100%',
                        border: '1px solid #ddd',
                        borderRadius: 4,
                      };
                      if (fig.width) figImgStyle.width = fig.width;
                      if (fig.height) figImgStyle.height = fig.height;
                      if (fig.width && fig.height) figImgStyle.objectFit = 'contain';
                      return (
                        <Box key={fig.id} className="text-center">
                          <img src={fig.dataUrl} alt={fig.name} style={figImgStyle} />
                          <Text
                            style={{
                              fontFamily: DOC_FONT,
                              fontSize: 12,
                              color: '#555',
                              marginTop: 6,
                              fontStyle: 'italic',
                            }}
                          >
                            {fig.name}
                            {fig.caption ? ` — ${fig.caption}` : ''}
                          </Text>
                        </Box>
                      );
                    })}
                  </Stack>
                </Box>
              )}

              {completedSections.length === 0 && (
                <Text size="sm" c="var(--text-muted)" ta="center" py={40}>
                  {t('res_NoSectionsCompletedYet')}
                </Text>
              )}
            </Stack>
          </Box>
        </Box>
      </ScrollArea>

      <ExportPanel zoom={zoom} setZoom={setZoom} />
    </Stack>
  );
}
