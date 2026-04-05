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
  IconDownload,
} from '@tabler/icons-react';
import { useWorkbenchStore } from '@/store/workbench';
import { INPUT_STYLES, BTN_PRIMARY } from '@/theme/styles';
import type { FigureItem } from '@/types';
import { generateId } from '@/utils/sanitize';
import { DiagramEditor } from './DiagramEditor';
import { JsonViewer } from './JsonViewer';
import { useI18n } from '@/i18n/useI18n';

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
  const { t } = useI18n();
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
      // SVG files can contain <script> tags and event handlers — reject them entirely
      if (file.type === 'image/svg+xml' || file.name.toLowerCase().endsWith('.svg')) return;

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

  const downloadFigure = (fig: FigureItem) => {
    const mime = fig.dataUrl.split(';')[0].split(':')[1] ?? 'image/png';
    let ext = 'png';
    if (mime === 'image/jpeg') ext = 'jpg';
    else if (mime === 'image/webp') ext = 'webp';
    const a = document.createElement('a');
    a.href = fig.dataUrl;
    a.download = `${fig.name.replaceAll(' ', '_')}.${ext}`;
    a.click();
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

  const figuresCountLabel =
    figures.length > 1 ? t('res_FiguresAdded_Plural') : t('res_FiguresAdded_Singular');
  const footerText =
    figures.length === 0 ? t('res_NoFiguresAdded') : `${figures.length} ${figuresCountLabel}`;

  return (
    <Stack gap={0} style={{ height: '100%' }}>
      {/* Header */}
      <Box className="px-5 py-3.5 border-b border-stroke bg-surface-raised shrink-0">
        <Group justify="space-between" wrap="nowrap">
          <Stack gap={2}>
            <Group gap={8}>
              <IconPhoto size={14} className="text-accent" />
              <Text
                fw={700}
                size="sm"
                ff="monospace"
                className="text-fg tracking-[0.06em] uppercase"
              >
                {t('res_Figures')}
              </Text>
            </Group>
            <Text size="xs" c="var(--text-muted)" ff="monospace">
              {t('res_UploadImagesHint')}
            </Text>
          </Stack>
          <Button
            variant="subtle"
            size="xs"
            leftSection={<IconArrowLeft size={14} />}
            onClick={handleBack}
            className="font-mono text-[11px] text-fg-muted"
          >
            {t('res_BackToSteps')}
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
                <Group gap={6} px={6} wrap="nowrap">
                  <IconUpload size={14} />
                  <Text ff="monospace" size="xs" fw={600} className="tracking-[0.05em] uppercase">
                    {t('res_Image')}
                  </Text>
                </Group>
              ),
            },
            {
              value: 'diagram',
              label: (
                <Group gap={6} px={6} wrap="nowrap">
                  <IconVectorTriangle size={14} />
                  <Text ff="monospace" size="xs" fw={600} className="tracking-[0.05em] uppercase">
                    {t('res_Diagram')}
                  </Text>
                </Group>
              ),
            },
            {
              value: 'json',
              label: (
                <Group gap={6} px={6} wrap="nowrap">
                  <IconBraces size={14} />
                  <Text ff="monospace" size="xs" fw={600} className="tracking-[0.05em] uppercase">
                    {t('res_Json')}
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
      <ScrollArea style={{ flex: 1, display: mode === 'upload' ? undefined : 'none' }}>
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
                  {t('res_ClickToUploadImages')}
                </Text>
                <Text size="xs" c="var(--text-muted)" mt={4}>
                  {t('res_SupportedImageTypesHint')}
                </Text>
              </Box>

              {figures.map((fig, idx) => (
                <Box
                  key={fig.id}
                  className="border border-stroke rounded-md overflow-hidden bg-surface"
                >
                  <Group
                    justify="space-between"
                    className="px-3.5 py-2.5 bg-surface-raised border-b border-stroke"
                  >
                    <Group gap={8}>
                      <Text
                        size="xs"
                        ff="monospace"
                        fw={700}
                        className="text-fg-muted tracking-[0.06em]"
                      >
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
                    <Group gap={4}>
                      <ActionIcon
                        variant="subtle"
                        size="sm"
                        onClick={() => downloadFigure(fig)}
                        aria-label={t('res_DownloadFigure')}
                        className="text-fg-muted"
                      >
                        <IconDownload size={13} />
                      </ActionIcon>
                      <ActionIcon
                        variant="subtle"
                        size="sm"
                        color="red"
                        onClick={() => removeFigure(fig.id)}
                        aria-label={t('res_RemoveFigure')}
                      >
                        <IconTrash size={13} />
                      </ActionIcon>
                    </Group>
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
                          label={t('res_FigureLabel')}
                          value={fig.name}
                          onChange={(e) => updateFigure(fig.id, 'name', e.currentTarget.value)}
                          styles={INPUT_STYLES}
                        />
                        <Group gap={10} grow>
                          <NumberInput
                            label={t('res_WidthPx')}
                            value={fig.width ?? ''}
                            onChange={(val) => updateFigureDimension(fig.id, 'width', val)}
                            min={1}
                            allowDecimal={false}
                            styles={INPUT_STYLES}
                          />
                          <NumberInput
                            label={t('res_HeightPx')}
                            value={fig.height ?? ''}
                            onChange={(val) => updateFigureDimension(fig.id, 'height', val)}
                            min={1}
                            allowDecimal={false}
                            styles={INPUT_STYLES}
                          />
                        </Group>
                        <Textarea
                          label={t('res_Caption')}
                          placeholder={t('res_Caption_Placeholder')}
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

      {/* Body — diagram editor */}
      <Box style={{ flex: 1, overflow: 'hidden', display: mode === 'diagram' ? undefined : 'none' }}>
        <DiagramEditor
          onAddFigure={handleAddFigureFromEditor}
          figureNumber={figures.length + 1}
        />
      </Box>

      {/* Body — JSON viewer */}
      <Box style={{ flex: 1, overflow: 'hidden', display: mode === 'json' ? undefined : 'none' }}>
        <JsonViewer onAddFigure={handleAddFigureFromEditor} figureNumber={figures.length + 1} />
      </Box>

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
            {t('res_ContinueToInventors')}
          </Button>
        </Group>
      </Box>
    </Stack>
  );
}
