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
import { INPUT_STYLES, BTN_PRIMARY } from '@/theme/styles';
import type { FigureItem } from '@/types';
import { generateId } from '@/utils/sanitize';
import { DiagramEditor } from './DiagramEditor';
import { JsonViewer } from './JsonViewer';

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
      ? `${figures.length} figure${figures.length > 1 ? 's' : ''} added`
      : 'No figures added yet';

  return (
    <Stack gap={0} style={{ height: '100%' }}>
      {/* Header */}
      <Box className="px-5 py-3.5 border-b border-stroke bg-surface-raised shrink-0">
        <Group justify="space-between" wrap="nowrap">
          <Stack gap={2}>
            <Group gap={8}>
              <IconPhoto size={14} className="text-accent" />
              <Text fw={700} size="sm" ff="monospace" className="text-fg tracking-[0.06em]">
                FIGURES
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
            className="font-mono text-[11px] text-fg-muted"
          >
            BACK TO STEPS
          </Button>
        </Group>
      </Box>

      {/* Mode selector */}
      <Box className="px-5 py-2.5 border-b border-stroke bg-surface shrink-0">
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
                  <Text ff="monospace" size="xs" fw={600} className="tracking-[0.05em]">
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
                  <Text ff="monospace" size="xs" fw={600} className="tracking-[0.05em]">
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
                  <Text ff="monospace" size="xs" fw={600} className="tracking-[0.05em]">
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
                className="border-2 border-dashed border-stroke rounded-lg px-6 py-8 text-center cursor-pointer transition-colors duration-150 bg-surface hover:border-accent hover:bg-surface-raised"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={handleFileChange}
                />
                <IconUpload size={24} className="text-fg-muted mb-2" />
                <Text size="sm" fw={600} className="text-fg">
                  Click to upload images
                </Text>
                <Text size="xs" c="var(--text-muted)" mt={4}>
                  PNG, JPG, GIF, SVG · multiple files supported
                </Text>
              </Box>

              {figures.map((fig, idx) => (
                <Box key={fig.id} className="border border-stroke rounded-md overflow-hidden bg-surface">
                  <Group
                    justify="space-between"
                    className="px-3.5 py-2.5 bg-surface-raised border-b border-stroke"
                  >
                    <Group gap={8}>
                      <Text size="xs" ff="monospace" fw={700} className="text-fg-muted tracking-[0.06em]">
                        {figureTypeLabel(fig.type)} {idx + 1}
                      </Text>
                      {fig.type !== 'image' && fig.type != null && (
                        <Text
                          size="xs"
                          ff="monospace"
                          className="text-accent text-[10px] bg-surface-active px-1.5 py-px rounded border border-accent"
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
                      <Box className="w-45 h-32.5 shrink-0 border border-stroke rounded flex items-center justify-center overflow-hidden bg-white">
                        <img
                          src={fig.dataUrl}
                          alt={fig.name}
                          className="max-w-full max-h-full object-contain"
                        />
                      </Box>
                      <Stack gap={10} className="flex-1">
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
      <Box className="px-7 py-3 border-t border-stroke bg-surface-raised shrink-0">
        <Group justify="space-between">
          <Text size="xs" c="var(--text-muted)" ff="monospace">
            {footerText}
          </Text>
          <Button
            leftSection={<IconArrowRight size={13} />}
            onClick={handleConfirm}
            size="sm"
            style={BTN_PRIMARY}
          >
            CONTINUE TO INVENTORS
          </Button>
        </Group>
      </Box>
    </Stack>
  );
}
