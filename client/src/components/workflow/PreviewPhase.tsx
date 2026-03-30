import { useState } from 'react';
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
import {
  IconArrowLeft,
  IconCircleCheck,
  IconPencil,
  IconCheck,
  IconX,
} from '@tabler/icons-react';
import { useWorkbenchStore } from '@/store/workbench';
import { WORKFLOW_ORDER, SECTION_LABELS } from '@/utils/workflowTemplates';
import { ExportPanel } from '@/components/ExportPanel';
import type { WorkflowModuleId } from '@/types';

interface EditableSectionProps {
  readonly moduleId: WorkflowModuleId;
  readonly content: string;
}

function EditableSection({ moduleId, content }: EditableSectionProps) {
  const { updateSectionContent } = useWorkbenchStore();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(content);

  const handleSave = () => {
    updateSectionContent(moduleId, draft);
    setEditing(false);
  };

  const handleCancel = () => {
    setDraft(content);
    setEditing(false);
  };

  const isTitle = false;

  return (
    <Box>
      <Group justify="space-between" align="flex-start" mb={8} wrap="nowrap">
        <Badge
          size="sm"
          variant="outline"
          style={{
            borderColor: '#888',
            color: '#555',
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            letterSpacing: '0.08em',
          }}
        >
          {SECTION_LABELS[moduleId]}
        </Badge>

        {editing ? (
          <Group gap={6} style={{ flexShrink: 0 }}>
            <Button
              size="xs"
              variant="subtle"
              leftSection={<IconX size={11} />}
              onClick={handleCancel}
              style={{ color: '#888', fontFamily: 'var(--font-mono)', fontSize: 10 }}
            >
              CANCEL
            </Button>
            <Button
              size="xs"
              leftSection={<IconCheck size={11} />}
              onClick={handleSave}
              style={{
                background: 'var(--accent)',
                color: 'var(--accent-text)',
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                fontWeight: 700,
                border: 'none',
              }}
            >
              SAVE
            </Button>
          </Group>
        ) : (
          <Button
            size="xs"
            variant="subtle"
            leftSection={<IconPencil size={11} />}
            onClick={() => {
              setDraft(content);
              setEditing(true);
            }}
            style={{ color: '#888', fontFamily: 'var(--font-mono)', fontSize: 10 }}
          >
            EDIT
          </Button>
        )}
      </Group>

      {editing ? (
        <Textarea
          aria-label={`Edit content for ${SECTION_LABELS[moduleId]}`}
          value={draft}
          onChange={(e) => setDraft(e.currentTarget.value)}
          minRows={4}
          autosize
          styles={{
            input: {
              background: '#fafafa',
              border: '1px solid var(--accent)',
              color: '#111',
              fontFamily: isTitle ? 'var(--font-display)' : 'var(--font-serif)',
              fontSize: isTitle ? 16 : 13,
              lineHeight: 1.8,
            },
          }}
        />
      ) : (
        <Text
          style={{
            color: '#111',
            fontFamily: isTitle ? 'var(--font-display)' : 'var(--font-serif)',
            fontSize: isTitle ? 20 : 14,
            fontWeight: isTitle ? 700 : 400,
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
  if (!artifact) return null;

  const completedSections = WORKFLOW_ORDER.filter((m) => artifact.sections[m]);
  const totalTokens = steps.reduce((acc, s) => acc + s.promptTokens + s.completionTokens, 0);
  const allDone = completedSections.length === WORKFLOW_ORDER.length;

  const handleBackToWork = () => {
    // Go to last incomplete step, or last step if all done
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
      <Box
        style={{
          padding: '14px 20px',
          borderBottom: '1px solid var(--border)',
          background: 'var(--surface-raised)',
          flexShrink: 0,
        }}
      >
        <Group justify="space-between" wrap="nowrap">
          <Stack gap={2}>
            <Group gap={8}>
              <IconCircleCheck size={14} style={{ color: 'var(--accent)' }} />
              <Text
                fw={700}
                size="sm"
                ff="monospace"
                style={{ color: 'var(--text-primary)', letterSpacing: '0.06em' }}
              >
                {allDone ? 'PATENT DRAFT COMPLETE' : 'DRAFT IN PROGRESS'}
              </Text>
            </Group>
            <Text size="xs" c="var(--text-muted)" ff="monospace">
              {completedSections.length}/{WORKFLOW_ORDER.length} sections
              {totalTokens > 0 && ` · ${totalTokens}t`}
              {' · '}{artifact.model.split(':')[0]}
              {artifact.inventors.length > 0 &&
                ` · ${artifact.inventors.map((i) => i.name).join(', ')}`}
            </Text>
          </Stack>
          <Group gap={8}>
            {workflowPhase === 'preview' && (
              <Button
                variant="subtle"
                size="xs"
                leftSection={<IconArrowLeft size={12} />}
                onClick={handleBackToWork}
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                  color: 'var(--text-muted)',
                }}
              >
                BACK TO STEPS
              </Button>
            )}
            <Button
              variant="subtle"
              size="xs"
              leftSection={<IconArrowLeft size={12} />}
              onClick={resetWorkflow}
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                color: 'var(--text-muted)',
              }}
            >
              NEW INVENTION
            </Button>
          </Group>
        </Group>
      </Box>

      {/* Document */}
      <ScrollArea style={{ flex: 1, background: 'var(--bg)' }}>
        <Box py={40} px={24}>
          <Box
            style={{
              maxWidth: 800,
              margin: '0 auto',
              background: '#f4f0e8',
              zoom: zoom,
              transformOrigin: 'top center',
              color: '#111',
              padding: '72px 80px',
              boxShadow: '0 4px 32px rgba(0,0,0,0.18), 0 1px 4px rgba(0,0,0,0.10)',
              borderRadius: 2,
              minHeight: 1000,
            }}
          >
            <Stack gap={28}>
              {/* Inventors block — IDF format: blue labels, field-per-line */}
              {artifact.inventors.length > 0 && (
                <Box>
                  <Text
                    style={{
                      color: '#4472C4',
                      fontFamily: 'Calibri, Arial, sans-serif',
                      fontSize: 18,
                      fontWeight: 400,
                      marginBottom: 6,
                    }}
                  >
                    Inventors
                  </Text>
                  {artifact.inventors.map((inv) => (
                    <Box key={inv.id} mb={8}>
                      <Text style={{ color: '#4472C4', fontFamily: 'Calibri, Arial, sans-serif', fontSize: 13, marginTop: 10, marginBottom: 2 }}>Name:</Text>
                      <Text style={{ fontFamily: 'Calibri, Arial, sans-serif', fontSize: 13, fontWeight: 700, color: '#111' }}>{inv.name}</Text>
                      {inv.address && (<>
                        <Text style={{ color: '#4472C4', fontFamily: 'Calibri, Arial, sans-serif', fontSize: 13, marginTop: 10, marginBottom: 2 }}>Home Address:</Text>
                        <Text style={{ fontFamily: 'Calibri, Arial, sans-serif', fontSize: 13, color: '#111' }}>{inv.address}</Text>
                      </>)}
                      {inv.telephone && (<>
                        <Text style={{ color: '#4472C4', fontFamily: 'Calibri, Arial, sans-serif', fontSize: 13, marginTop: 10, marginBottom: 2 }}>Home Telephone:</Text>
                        <Text style={{ fontFamily: 'Calibri, Arial, sans-serif', fontSize: 13, color: '#111' }}>{inv.telephone}</Text>
                      </>)}
                      <Text style={{ color: '#4472C4', fontFamily: 'Calibri, Arial, sans-serif', fontSize: 13, marginTop: 10, marginBottom: 2 }}>Home Email:</Text>
                      <Text style={{ fontFamily: 'Calibri, Arial, sans-serif', fontSize: 13, color: '#111' }}>{inv.email ?? ''}</Text>
                      {inv.citizenship && (<>
                        <Text style={{ color: '#4472C4', fontFamily: 'Calibri, Arial, sans-serif', fontSize: 13, marginTop: 10, marginBottom: 2 }}>Citizenship:</Text>
                        <Text style={{ fontFamily: 'Calibri, Arial, sans-serif', fontSize: 13, color: '#111' }}>{inv.citizenship}</Text>
                      </>)}
                      {inv.employeeId && (<>
                        <Text style={{ color: '#4472C4', fontFamily: 'Calibri, Arial, sans-serif', fontSize: 13, marginTop: 10, marginBottom: 2 }}>Employee ID:</Text>
                        <Text style={{ fontFamily: 'Calibri, Arial, sans-serif', fontSize: 13, fontWeight: 700, color: '#111' }}>{inv.employeeId}</Text>
                      </>)}
                    </Box>
                  ))}
                  <Divider mt={20} mb={0} style={{ borderColor: '#ddd' }} />
                </Box>
              )}

              {/* Invention Title + IDF metadata — bold black labels */}
              {(artifact.inventionTitle || artifact.idfNumber || artifact.businessGroup) && (
                <Box>
                  <Text style={{ fontFamily: 'Calibri, Arial, sans-serif', fontSize: 13, fontWeight: 700, color: '#111', marginBottom: 2 }}>Invention Title</Text>
                  <Text style={{ fontFamily: 'Calibri, Arial, sans-serif', fontSize: 13, color: '#111', marginBottom: 10 }}>
                    {artifact.inventionTitle ?? artifact.baseIdea}
                  </Text>
                  <Text style={{ fontFamily: 'Calibri, Arial, sans-serif', fontSize: 13, fontWeight: 700, color: '#111', marginBottom: 2 }}>IDF Number</Text>
                  {artifact.idfNumber && (
                    <Text style={{ fontFamily: 'Calibri, Arial, sans-serif', fontSize: 13, color: '#111', marginBottom: 10 }}>{artifact.idfNumber}</Text>
                  )}
                  {artifact.businessGroup && (<>
                    <Text style={{ fontFamily: 'Calibri, Arial, sans-serif', fontSize: 13, fontWeight: 700, color: '#111', marginBottom: 2 }}>Business Group</Text>
                    <Text style={{ fontFamily: 'Calibri, Arial, sans-serif', fontSize: 13, color: '#111' }}>{artifact.businessGroup}</Text>
                  </>)}
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

              {/* Figures section */}
              {artifact.figures?.length > 0 && (
                <Box>
                  <Divider mb={24} style={{ borderColor: '#ddd' }} />
                  <Text
                    style={{
                      color: '#4472C4',
                      fontFamily: 'Calibri, Arial, sans-serif',
                      fontSize: 18,
                      fontWeight: 400,
                      marginBottom: 16,
                    }}
                  >
                    Figures
                  </Text>
                  <Stack gap={20}>
                    {artifact.figures.map((fig) => (
                      <Box key={fig.id} style={{ textAlign: 'center' }}>
                        <img
                          src={fig.dataUrl}
                          alt={fig.name}
                          style={{ maxWidth: '100%', border: '1px solid #ddd', borderRadius: 4 }}
                        />
                        <Text style={{ fontFamily: 'Calibri, Arial, sans-serif', fontSize: 12, color: '#555', marginTop: 6, fontStyle: 'italic' }}>
                          {fig.name}{fig.caption ? ` — ${fig.caption}` : ''}
                        </Text>
                      </Box>
                    ))}
                  </Stack>
                </Box>
              )}

              {completedSections.length === 0 && (
                <Text size="sm" c="var(--text-muted)" ta="center" py={40}>
                  No sections completed yet. Complete steps to see the draft here.
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
