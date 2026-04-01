import { useState, useRef, useCallback } from 'react';
import {
  Box,
  Textarea,
  Button,
  Group,
  Text,
  NumberInput,
  Switch,
} from '@mantine/core';
import { IconCheck, IconAlertCircle } from '@tabler/icons-react';
import { toPng } from 'html-to-image';
import { generateId } from '@/utils/sanitize';
import type { FigureItem } from '@/types';

const DEFAULT_W = 900;
const DEFAULT_H = 500;

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

const TOOLBAR_INPUT_STYLES = {
  input: {
    fontFamily: 'var(--font-mono)',
    fontSize: 12,
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    color: 'var(--text-primary)',
    height: 28,
    minHeight: 28,
  },
};

// Color schemes

const DARK_COLORS = {
  string: '#a5d6a7',
  boolean: '#ff9800',
  number: '#64b5f6',
  null: '#9e9e9e',
  key: '#90caf9',
  punct: '#bdbdbd',
  text: '#e0e0e0',
  placeholder: '#555',
};

const LIGHT_COLORS = {
  string: '#2e7d32',
  boolean: '#e65100',
  number: '#1565c0',
  null: '#616161',
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
  if (value === null) return <span style={{ color: c.null }}>null</span>;
  if (typeof value === 'boolean')
    return <span style={{ color: c.boolean }}>{String(value)}</span>;
  if (typeof value === 'number')
    return <span style={{ color: c.number }}>{value}</span>;
  if (typeof value === 'string') return <JsonString value={value} c={c} />;
  return <span style={{ color: c.text }}>{String(value)}</span>;
}

function JsonNode({
  value,
  depth = 0,
  c,
}: Readonly<{ value: unknown; depth?: number; c: ColorScheme }>) {
  if (value === null || typeof value !== 'object')
    return <JsonPrimitive value={value} c={c} />;

  if (Array.isArray(value)) {
    if (value.length === 0) return <span style={{ color: c.punct }}>[]</span>;
    return (
      <>
        <span style={{ color: c.punct }}>[</span>
        {value.map((item, i) => (
          // stable index key — display-only, no reordering
          // biome-ignore lint/suspicious/noArrayIndexKey: display list
          <div key={i} style={{ paddingLeft: 20 }}>
            <JsonNode value={item} depth={depth + 1} c={c} />
            {i < value.length - 1 && (
              <span style={{ color: c.punct }}>,</span>
            )}
          </div>
        ))}
        <span style={{ color: c.punct }}>]</span>
      </>
    );
  }

  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length === 0)
    return <span style={{ color: c.punct }}>{'{}'}</span>;

  return (
    <>
      <span style={{ color: c.punct }}>{'{'}</span>
      {entries.map(([key, val], i) => (
        <div key={key} style={{ paddingLeft: 20 }}>
          <span style={{ color: c.key }}>"{key}"</span>
          <span style={{ color: c.punct }}>: </span>
          <JsonNode value={val} depth={depth + 1} c={c} />
          {i < entries.length - 1 && (
            <span style={{ color: c.punct }}>,</span>
          )}
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
  const [jsonText, setJsonText] = useState('');
  const [exportW, setExportW] = useState<number>(DEFAULT_W);
  const [exportH, setExportH] = useState<number>(DEFAULT_H);
  const [transparentBg, setTransparentBg] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parsed, setParsed] = useState<unknown>(null);
  const previewRef = useRef<HTMLDivElement>(null);

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

  const colors = transparentBg ? LIGHT_COLORS : DARK_COLORS;

  const handleExport = useCallback(async () => {
    if (!previewRef.current || parsed === null) return;
    try {
      const dataUrl = await toPng(previewRef.current, {
        backgroundColor: transparentBg ? undefined : '#1e1e1e',
        width: exportW,
        height: exportH,
        style: {
          width: `${exportW}px`,
          minHeight: `${exportH}px`,
          overflow: 'hidden',
        },
      });
      onAddFigure({
        id: generateId(),
        dataUrl,
        name: `Figure ${figureNumber}`,
        caption: '',
        width: exportW,
        height: exportH,
        type: 'json',
      });
    } catch (err) {
      console.error('JSON export failed:', err);
    }
  }, [parsed, exportW, exportH, transparentBg, onAddFigure, figureNumber]);

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
        <Text size="xs" ff="monospace" style={{ color: 'var(--text-muted)' }}>
          Export size:
        </Text>
        <NumberInput
          size="xs"
          value={exportW}
          onChange={(v) => setExportW(Number(v) || DEFAULT_W)}
          min={200}
          max={2400}
          allowDecimal={false}
          placeholder="W"
          style={{ width: 80 }}
          styles={TOOLBAR_INPUT_STYLES}
          aria-label="Export width"
        />
        <Text size="xs" ff="monospace" style={{ color: 'var(--text-muted)' }}>
          ×
        </Text>
        <NumberInput
          size="xs"
          value={exportH}
          onChange={(v) => setExportH(Number(v) || DEFAULT_H)}
          min={100}
          max={2400}
          allowDecimal={false}
          placeholder="H"
          style={{ width: 80 }}
          styles={TOOLBAR_INPUT_STYLES}
          aria-label="Export height"
        />
        <Box style={{ flex: 1 }} />
        <Switch
          size="xs"
          checked={transparentBg}
          onChange={(e) => setTransparentBg(e.currentTarget.checked)}
          label={
            <Text size="xs" ff="monospace" style={{ color: 'var(--text-muted)' }}>
              TRANSPARENT BG
            </Text>
          }
        />
        <Button
          size="xs"
          leftSection={<IconCheck size={12} />}
          onClick={() => void handleExport()}
          disabled={parsed === null}
          style={{
            background: parsed === null ? 'var(--surface-raised)' : 'var(--accent)',
            color: parsed === null ? 'var(--text-muted)' : 'var(--accent-text)',
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            border: 'none',
          }}
        >
          ADD TO FIGURES
        </Button>
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
          >
            JSON INPUT
          </Text>
          <Textarea
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
                size={12}
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
          >
            PREVIEW · {exportW} × {exportH} px
          </Text>
          {/* Checkerboard wrapper — visual only, not exported */}
          <Box
            style={{
              borderRadius: 6,
              overflow: 'hidden',
              background: transparentBg
                ? 'repeating-conic-gradient(#ccc 0% 25%, #fff 0% 50%) 0 0 / 16px 16px'
                : undefined,
            }}
          >
            <Box
              ref={previewRef}
              style={{
                background: transparentBg ? 'transparent' : '#1e1e1e',
                padding: '20px 24px',
                fontFamily: "'Cascadia Code', 'Fira Code', 'Consolas', monospace",
                fontSize: 13,
                lineHeight: 1.7,
                color: colors.text,
                minHeight: 200,
                width: '100%',
                overflow: 'auto',
              }}
            >
              {parsed === null ? (
                <Text
                  size="xs"
                  ff="monospace"
                  style={{ color: colors.placeholder }}
                >
                  {jsonText.trim() ? 'Invalid JSON…' : 'Enter valid JSON on the left to preview…'}
                </Text>
              ) : (
                <JsonNode value={parsed} c={colors} />
              )}
            </Box>
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
        <Text size="xs" c="var(--text-muted)" ff="monospace">
          Paste or type any valid JSON · adjust export dimensions · click ADD TO FIGURES to render as image
        </Text>
      </Box>
    </Box>
  );
}
