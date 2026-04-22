import { useState, useRef, useCallback, useEffect } from 'react';
import { Box, Textarea, Button, Group, Text, Tooltip, useMantineColorScheme } from '@mantine/core';
import { IconCheck, IconAlertCircle, IconLayersIntersect, IconTrash } from '@tabler/icons-react';
import { toPng } from 'html-to-image';
import { generateId } from '@/utils';
import type { FigureItem } from '@/types';
import { useI18n } from '@/i18n/useI18n';
import { useWorkbenchStore } from '@/store/workbench';
import { useShallow } from 'zustand/react/shallow';

const DEFAULT_W = 900;

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

// Color schemes

const DARK_COLORS = {
  bg: '#1e1e1e',
  string: '#a5d6a7',
  boolean: '#ff9800',
  number: '#64b5f6',
  null: '#9e9e9e',
  key: '#90caf9',
  punct: '#bdbdbd',
  text: '#e0e0e0',
  placeholder: '#a8a8a8',
};

const LIGHT_COLORS = {
  bg: '#ffffff',
  string: '#2e7d32',
  boolean: '#e65100',
  number: '#1565c0',
  null: '#757575',
  key: '#0d47a1',
  punct: '#424242',
  text: '#212121',
  placeholder: '#9e9e9e',
};

type ColorScheme = typeof DARK_COLORS;

// Syntax-highlighted JSON renderer
function JsonString({ value, c }: Readonly<{ value: string; c: ColorScheme }>) {
  return <span style={{ color: c.string }}>"{value}"</span>;
}

function JsonPrimitive({ value, c }: Readonly<{ value: unknown; c: ColorScheme }>) {
  if (value === null || value === undefined)
    return <span style={{ color: c.null }}>{value === null ? 'null' : 'undefined'}</span>;

  switch (typeof value) {
    case 'boolean':
      return <span style={{ color: c.boolean }}>{value ? 'true' : 'false'}</span>;
    case 'number':
      return <span style={{ color: c.number }}>{value}</span>;
    case 'string':
      return <JsonString value={value} c={c} />;
    case 'bigint':
      return <span style={{ color: c.number }}>{value.toString()}</span>;
    case 'symbol':
      return <span style={{ color: c.string }}>{value.toString()}</span>;
    default:
      return <span style={{ color: c.text }}>[complex]</span>;
  }
}

function JsonNode({
  value,
  depth = 0,
  c,
}: Readonly<{ value: unknown; depth?: number; c: ColorScheme }>) {
  if (value === null || typeof value !== 'object') return <JsonPrimitive value={value} c={c} />;

  if (Array.isArray(value)) {
    if (value.length === 0) return <span style={{ color: c.punct }}>[]</span>;
    return (
      <>
        <span style={{ color: c.punct }}>[</span>
        {value.map((item, i) => {
          let itemTag: string;
          if (item === null) itemTag = 'null';
          else if (typeof item === 'object') itemTag = 'obj';
          else itemTag = String(item);
          const k = `${i}:${itemTag}`;
          return (
            <div key={k} style={{ paddingLeft: 20 }}>
              <JsonNode value={item} depth={depth + 1} c={c} />
              {i < value.length - 1 && <span style={{ color: c.punct }}>,</span>}
            </div>
          );
        })}
        <span style={{ color: c.punct }}>]</span>
      </>
    );
  }

  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length === 0) return <span style={{ color: c.punct }}>{'{}'}</span>;

  return (
    <>
      <span style={{ color: c.punct }}>{'{'}</span>
      {entries.map(([key, val], i) => (
        <div key={key} style={{ paddingLeft: 20 }}>
          <span style={{ color: c.key }}>"{key}"</span>
          <span style={{ color: c.punct }}>: </span>
          <JsonNode value={val} depth={depth + 1} c={c} />
          {i < entries.length - 1 && <span style={{ color: c.punct }}>,</span>}
        </div>
      ))}
      <span style={{ color: c.punct }}>{'}'}</span>
    </>
  );
}

// Main component

interface Props {
  onAddFigure: (figure: FigureItem) => void;
  figureNumber: number;
}

export function JsonViewer({ onAddFigure, figureNumber }: Readonly<Props>) {
  const { figuresDraft, setJsonDraftText } = useWorkbenchStore(
    useShallow((s) => ({ figuresDraft: s.figuresDraft, setJsonDraftText: s.setJsonDraftText }))
  );
  const [jsonText, setJsonText] = useState(figuresDraft.jsonText);
  const [transparentBg, setTransparentBg] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parsed, setParsed] = useState<unknown>(() => {
    if (!figuresDraft.jsonText.trim()) return null;
    try {
      return JSON.parse(figuresDraft.jsonText);
    } catch {
      return null;
    }
  });
  const previewRef = useRef<HTMLDivElement>(null);
  const { t } = useI18n();

  useEffect(() => {
    const timer = setTimeout(() => {
      setJsonDraftText(jsonText);
    }, 300);
    return () => clearTimeout(timer);
  }, [jsonText, setJsonDraftText]);

  const handleJsonChange = (text: string) => {
    setJsonText(text);
    if (!text.trim()) {
      setError(null);
      setParsed(null);
      return;
    }
    try {
      setParsed(JSON.parse(text));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
      setParsed(null);
    }
  };

  const { colorScheme } = useMantineColorScheme();
  const colors = colorScheme === 'dark' ? DARK_COLORS : LIGHT_COLORS;

  const handleExport = useCallback(async () => {
    if (!previewRef.current || parsed === null) return;
    try {
      // Use actual rendered content height so the image fits tightly around the content
      const contentH = previewRef.current.scrollHeight;
      const dataUrl = await toPng(previewRef.current, {
        backgroundColor: transparentBg ? undefined : colors.bg,
        width: DEFAULT_W,
        height: contentH,
        style: {
          width: `${DEFAULT_W}px`,
          height: `${contentH}px`,
          overflow: 'hidden',
        },
      });
      onAddFigure({
        id: generateId(),
        dataUrl,
        name: `Figure ${figureNumber}`,
        caption: '',
        width: DEFAULT_W,
        height: contentH,
        type: 'json',
      });
    } catch (err) {
      console.error('JSON export failed:', err);
    }
  }, [parsed, transparentBg, onAddFigure, figureNumber, colors.bg]);

  return (
    <Box style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Toolbar */}
      <Group
        gap={8}
        p="8px 14px"
        wrap="nowrap"
        style={{
          background: 'var(--surface-raised)',
          borderBottom: '1px solid var(--border)',
          flexShrink: 0,
        }}
      >
        <Box style={{ flex: 1 }} />
        <Tooltip label={t('res_TransparentBg')} withArrow position="bottom">
          <Button
            size="xs"
            variant={transparentBg ? 'filled' : 'light'}
            color={transparentBg ? 'indigo' : 'gray'}
            onClick={() => setTransparentBg((v) => !v)}
            style={{ fontFamily: 'var(--font-mono)', fontSize: 11, padding: '0 8px' }}
          >
            <IconLayersIntersect size={13} />
          </Button>
        </Tooltip>
        <Tooltip label={t('res_DiagramClearAll')} withArrow position="bottom">
          <Button
            size="xs"
            variant="light"
            color="red"
            onClick={() => handleJsonChange('')}
            disabled={!jsonText.trim()}
            style={{ fontFamily: 'var(--font-mono)', fontSize: 11, padding: '0 8px' }}
          >
            <IconTrash size={13} />
          </Button>
        </Tooltip>
        <Tooltip label={t('res_DiagramAddToFigures')} withArrow position="bottom">
          <Button
            size="xs"
            variant="filled"
            onClick={() => void handleExport()}
            disabled={parsed === null}
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              padding: '0 8px',
              border: 'none',
              ...(parsed !== null && {
                background: 'var(--accent)',
                color: 'var(--accent-text)',
              }),
            }}
          >
            <IconCheck size={13} />
          </Button>
        </Tooltip>
      </Group>

      {/* Body: editor (left) + preview (right) */}
      <Box style={{ flex: 1, overflow: 'hidden', display: 'flex' }}>
        {/* JSON input */}
        <Box
          style={{
            width: '40%',
            borderRight: '1px solid var(--border)',
            display: 'flex',
            flexDirection: 'column',
            padding: 16,
            gap: 8,
            overflow: 'auto',
          }}
        >
          <Text
            size="xs"
            ff="monospace"
            fw={700}
            style={{ color: 'var(--text-muted)', letterSpacing: '0.08em' }}
            className="uppercase"
          >
            {t('res_JSONInput')}
          </Text>
          <Textarea
            aria-label={t('res_JSONInput')}
            value={jsonText}
            onChange={(e) => handleJsonChange(e.currentTarget.value)}
            placeholder={'{\n  "key": "value",\n  "items": [1, 2, 3]\n}'}
            minRows={16}
            autosize
            styles={{
              ...INPUT_STYLES,
              input: {
                ...INPUT_STYLES.input,
                fontFamily: 'var(--font-mono)',
                fontSize: 12,
                lineHeight: 1.6,
              },
            }}
          />
          {error && (
            <Group gap={6} wrap="nowrap">
              <IconAlertCircle
                size={14}
                style={{ color: 'var(--mantine-color-red-6)', flexShrink: 0 }}
              />
              <Text size="xs" c="red" ff="monospace">
                {error}
              </Text>
            </Group>
          )}
        </Box>

        {/* Preview */}
        <Box
          style={{
            flex: 1,
            overflow: 'auto',
            background: 'var(--surface)',
            display: 'flex',
            flexDirection: 'column',
            padding: 16,
            gap: 8,
          }}
        >
          <Text
            size="xs"
            ff="monospace"
            fw={700}
            style={{ color: 'var(--text-muted)', letterSpacing: '0.08em' }}
            className="uppercase"
          >
            {t('res_Preview')}
          </Text>
          <Box
            ref={previewRef}
            style={{
              background: colors.bg,
              borderRadius: 6,
              overflow: 'hidden',
              padding: '20px 24px',
              fontFamily: "'Cascadia Code', 'Fira Code', 'Consolas', monospace",
              fontSize: 13,
              lineHeight: 1.7,
              color: colors.text,
              minHeight: 200,
              width: '100%',
            }}
          >
            {parsed === null ? (
              <Text size="xs" ff="monospace" style={{ color: colors.placeholder }}>
                {jsonText.trim() ? t('res_InvalidJSON') : t('res_EnterValidJSON')}
              </Text>
            ) : (
              <JsonNode value={parsed} c={colors} />
            )}
          </Box>
        </Box>
      </Box>

      {/* Hint bar */}
      <Box
        p="5px 14px"
        style={{
          background: 'var(--surface-raised)',
          borderTop: '1px solid var(--border)',
          flexShrink: 0,
        }}
      >
        <Text size="xs" c="var(text-accent)" ff="monospace">
          {t('res_JsonViewer_Hint')}
        </Text>
      </Box>
    </Box>
  );
}
