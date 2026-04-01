import { useState, useRef } from 'react';
import {
  Stack,
  Button,
  Text,
  Group,
  Box,
  ScrollArea,
  TextInput,
  Textarea,
  NumberInput,
  ActionIcon,
  SegmentedControl,
} from '@mantine/core';
import {
  IconPhoto,
  IconUpload,
  IconTrash,
  IconArrowLeft,
  IconArrowRight,
  IconVectorTriangle,
  IconBraces,
} from '@tabler/icons-react';
import { useWorkbenchStore } from '@/store/workbench';
import type { FigureItem } from '@/types';
import { generateId } from '@/utils/sanitize';
import { DiagramEditor } from './DiagramEditor';
import { JsonViewer } from './JsonViewer';

const INPUT_STYLES = {
  label: {
    fontFamily: 'var(--font-mono)',
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.06em',
    textTransform: 'uppercase' as const,
    color: 'var(--text-secondary)',
  },
  input: {
    background: 'var(--surface-raised)',
    border: '1px solid var(--border)',
    color: 'var(--text-primary)',
  },
};

const FIGURE_TYPE_LABELS: Record<string, string> = { diagram: 'DIAGRAM', json: 'JSON' };
function figureTypeLabel(type: FigureItem['type']): string {
  return FIGURE_TYPE_LABELS[type ?? ''] ?? 'IMAGE';
}

function makeImageFigure(dataUrl: string, img: HTMLImageElement, figureNumber: number): FigureItem {
  return {
    id: generateId(),
    dataUrl,
    name: `Figure ${figureNumber}`,
    caption: '',
    width: img.naturalWidth,
    height: img.naturalHeight,
    type: 'image',
  };
}

export function FiguresStep() {
  const { artifact, updateFigures, goToInventors, goToStep, steps } = useWorkbenchStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [figures, setFigures] = useState<FigureItem[]>(() => artifact?.figures ?? []);
  const [mode, setMode] = useState<'upload' | 'diagram' | 'json'>('upload');

  const addImageFromDataUrl = (dataUrl: string) => {
    const img = new Image();
    img.onload = () => {
      setFigures((prev) => [...prev, makeImageFigure(dataUrl, img, prev.length + 1)]);
    };
    img.src = dataUrl;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;

    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const dataUrl = ev.target?.result as string;
        addImageFromDataUrl(dataUrl);
      };
      reader.readAsDataURL(file);
    });

    e.target.value = '';
  };

  const updateFigure = (id: string, field: 'name' | 'caption', value: string) => {
    setFigures((prev) => prev.map((f) => (f.id === id ? { ...f, [field]: value } : f)));
  };

  const updateFigureDimension = (id: string, field: 'width' | 'height', value: number | string) => {
    const num = typeof value === 'string' ? Number.parseInt(value, 10) : value;
    const safeNum = Number.isNaN(num) ? undefined : num;
    setFigures((prev) => prev.map((f) => (f.id === id ? { ...f, [field]: safeNum } : f)));
  };

  const removeFigure = (id: string) => {
    setFigures((prev) => prev.filter((f) => f.id !== id));
  };

  const handleAddFigureFromEditor = (fig: FigureItem) => {
    setFigures((prev) => [...prev, fig]);
    setMode('upload');
  };

  const handleConfirm = () => {
    updateFigures(figures);
    goToInventors();
  };

  const handleBack = () => {
    updateFigures(figures);
    goToStep(steps.length - 1);
  };

  const footerText =
    figures.length > 0
      ? (() => {
          const plural = figures.length > 1 ? 's' : '';
          return `${figures.length} figure${plural} added`;
        })()
      : 'No figures added yet';

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
              <IconPhoto size={14} style={{ color: 'var(--accent)' }} />
              <Text
                fw={700}
                size="sm"
                ff="monospace"
                style={{ color: 'var(--text-primary)', letterSpacing: '0.06em' }}
              >
                FIGURES & DIAGRAMS
              </Text>
            </Group>
            <Text size="xs" c="var(--text-muted)" ff="monospace">
              Upload images or create flowcharts · optional
            </Text>
          </Stack>
          <Button
            variant="subtle"
            size="xs"
            leftSection={<IconArrowLeft size={12} />}
            onClick={handleBack}
            style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)' }}
          >
            BACK TO STEPS
          </Button>
        </Group>
      </Box>

      {/* Mode selector */}
      <Box
        p="10px 20px"
        style={{
          borderBottom: '1px solid var(--border)',
          background: 'var(--surface)',
          flexShrink: 0,
        }}
      >
        <SegmentedControl
          value={mode}
          onChange={(v) => setMode(v as 'upload' | 'diagram' | 'json')}
          size="xs"
          data={[
            {
              value: 'upload',
              label: (
                <Group gap={6} wrap="nowrap">
                  <IconUpload size={12} />
                  <Text ff="monospace" size="xs" fw={600} style={{ letterSpacing: '0.05em' }}>
                    UPLOAD IMAGE
                  </Text>
                </Group>
              ),
            },
            {
              value: 'diagram',
              label: (
                <Group gap={6} wrap="nowrap">
                  <IconVectorTriangle size={12} />
                  <Text ff="monospace" size="xs" fw={600} style={{ letterSpacing: '0.05em' }}>
                    CREATE DIAGRAM
                  </Text>
                </Group>
              ),
            },
            {
              value: 'json',
              label: (
                <Group gap={6} wrap="nowrap">
                  <IconBraces size={12} />
                  <Text ff="monospace" size="xs" fw={600} style={{ letterSpacing: '0.05em' }}>
                    JSON OBJECT
                  </Text>
                </Group>
              ),
            },
          ]}
          styles={{
            root: { background: 'var(--surface-raised)', border: '1px solid var(--border)' },
          }}
        />
      </Box>

      {/* Body — upload */}
      {mode === 'upload' && (
        <ScrollArea style={{ flex: 1 }}>
          <Box p={28} style={{ maxWidth: 800, margin: '0 auto' }}>
            <Stack gap={20}>
              <Box
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border: '2px dashed var(--border)',
                  borderRadius: 8,
                  padding: '32px 24px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  transition: 'border-color 0.15s, background 0.15s',
                  background: 'var(--surface)',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent)';
                  (e.currentTarget as HTMLElement).style.background = 'var(--surface-raised)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)';
                  (e.currentTarget as HTMLElement).style.background = 'var(--surface)';
                }}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  style={{ display: 'none' }}
                  onChange={handleFileChange}
                />
                <IconUpload size={24} style={{ color: 'var(--text-muted)', marginBottom: 8 }} />
                <Text size="sm" fw={600} style={{ color: 'var(--text-primary)' }}>
                  Click to upload images
                </Text>
                <Text size="xs" c="var(--text-muted)" mt={4}>
                  PNG, JPG, GIF, SVG · multiple files supported
                </Text>
              </Box>

              {figures.map((fig, idx) => (
                <Box
                  key={fig.id}
                  style={{
                    border: '1px solid var(--border)',
                    borderRadius: 6,
                    overflow: 'hidden',
                    background: 'var(--surface)',
                  }}
                >
                  <Group
                    justify="space-between"
                    p="10px 14px"
                    style={{
                      background: 'var(--surface-raised)',
                      borderBottom: '1px solid var(--border)',
                    }}
                  >
                    <Group gap={8}>
                      <Text
                        size="xs"
                        ff="monospace"
                        fw={700}
                        style={{ color: 'var(--text-muted)', letterSpacing: '0.06em' }}
                      >
                        {figureTypeLabel(fig.type)} {idx + 1}
                      </Text>
                      {fig.type !== 'image' && fig.type != null && (
                        <Text
                          size="xs"
                          ff="monospace"
                          style={{
                            color: 'var(--accent)',
                            fontSize: 10,
                            background: 'var(--surface-active)',
                            padding: '1px 6px',
                            borderRadius: 3,
                            border: '1px solid var(--accent)',
                          }}
                        >
                          {figureTypeLabel(fig.type)}
                        </Text>
                      )}
                    </Group>
                    <ActionIcon
                      variant="subtle"
                      size="sm"
                      color="red"
                      onClick={() => removeFigure(fig.id)}
                      aria-label="Remove figure"
                    >
                      <IconTrash size={13} />
                    </ActionIcon>
                  </Group>
                  <Box p={14}>
                    <Group align="flex-start" gap={16} wrap="nowrap">
                      <Box
                        style={{
                          width: 180,
                          height: 130,
                          flexShrink: 0,
                          border: '1px solid var(--border)',
                          borderRadius: 4,
                          overflow: 'hidden',
                          background: '#fff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <img
                          src={fig.dataUrl}
                          alt={fig.name}
                          style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                        />
                      </Box>
                      <Stack gap={10} style={{ flex: 1 }}>
                        <TextInput
                          label="Figure Label"
                          value={fig.name}
                          onChange={(e) => updateFigure(fig.id, 'name', e.currentTarget.value)}
                          styles={INPUT_STYLES}
                        />
                        <Group gap={10} grow>
                          <NumberInput
                            label="Width (px)"
                            value={fig.width ?? ''}
                            onChange={(val) => updateFigureDimension(fig.id, 'width', val)}
                            min={1}
                            allowDecimal={false}
                            styles={INPUT_STYLES}
                          />
                          <NumberInput
                            label="Height (px)"
                            value={fig.height ?? ''}
                            onChange={(val) => updateFigureDimension(fig.id, 'height', val)}
                            min={1}
                            allowDecimal={false}
                            styles={INPUT_STYLES}
                          />
                        </Group>
                        <Textarea
                          label="Caption"
                          placeholder="Brief description of what this figure shows..."
                          value={fig.caption}
                          onChange={(e) => updateFigure(fig.id, 'caption', e.currentTarget.value)}
                          minRows={2}
                          autosize
                          styles={INPUT_STYLES}
                        />
                      </Stack>
                    </Group>
                  </Box>
                </Box>
              ))}
            </Stack>
          </Box>
        </ScrollArea>
      )}

      {/* Body — diagram editor */}
      {mode === 'diagram' && (
        <Box style={{ flex: 1, overflow: 'hidden' }}>
          <DiagramEditor
            onAddFigure={handleAddFigureFromEditor}
            figureNumber={figures.length + 1}
          />
        </Box>
      )}

      {/* Body — JSON viewer */}
      {mode === 'json' && (
        <Box style={{ flex: 1, overflow: 'hidden' }}>
          <JsonViewer
            onAddFigure={handleAddFigureFromEditor}
            figureNumber={figures.length + 1}
          />
        </Box>
      )}

      {/* Footer */}
      <Box
        style={{
          padding: '12px 28px',
          borderTop: '1px solid var(--border)',
          background: 'var(--surface-raised)',
          flexShrink: 0,
        }}
      >
        <Group justify="space-between">
          <Text size="xs" c="var(--text-muted)" ff="monospace">
              {footerText}
          </Text>
          <Button
            leftSection={<IconArrowRight size={13} />}
            onClick={handleConfirm}
            size="sm"
            style={{
              background: 'var(--accent)',
              color: 'var(--accent-text)',
              fontFamily: 'var(--font-mono)',
              fontWeight: 700,
              fontSize: 11,
              letterSpacing: '0.08em',
              border: 'none',
            }}
          >
            CONTINUE TO INVENTORS
          </Button>
        </Group>
      </Box>
    </Stack>
  );
}
