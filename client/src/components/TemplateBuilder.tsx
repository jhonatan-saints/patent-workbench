import { useState, useEffect } from 'react';
import {
  Stack,
  TextInput,
  Textarea,
  Text,
  Button,
  Group,
  Badge,
  Box,
  Divider,
} from '@mantine/core';
import { IconVariable, IconArrowRight } from '@tabler/icons-react';
import { PATENT_TEMPLATES } from '../utils/templates';
import { useWorkbenchStore } from '../store/workbench';
import type { PatentSection } from '../types';

// Extract {variable} placeholders from a template string
function extractVariables(template: string): string[] {
  const matches = template.matchAll(/\{(\w+)\}/g);
  return [...new Set([...matches].map((m) => m[1]))];
}

const VARIABLE_LABELS: Record<string, { label: string; placeholder: string; multiline?: boolean }> =
  {
    concept: {
      label: 'Invention Concept',
      placeholder: 'Describe what the invention is and does...',
      multiline: true,
    },
    field: {
      label: 'Technical Field',
      placeholder: 'e.g. semiconductor manufacturing, biomedical devices...',
    },
    priorArt: {
      label: 'Prior Art / Existing Solutions',
      placeholder: 'Describe known approaches and their limitations...',
      multiline: true,
    },
    problem: {
      label: 'Problem Being Solved',
      placeholder: 'What gap or issue does this invention address?',
    },
    features: {
      label: 'Key Technical Features',
      placeholder: 'List the main technical components or steps...',
    },
    advantages: {
      label: 'Main Advantages',
      placeholder: 'e.g. lower latency, higher efficiency, reduced cost...',
    },
    elements: {
      label: 'Components / Elements',
      placeholder: 'Enumerate structural or functional elements...',
    },
    novelty: { label: 'Novel Aspects', placeholder: 'What is new compared to prior art?' },
    operation: {
      label: 'How It Works',
      placeholder: 'Describe the operational flow step by step...',
    },
    variants: {
      label: 'Alternative Embodiments',
      placeholder: 'Optional: describe variations or configurations...',
    },
    mechanism: {
      label: 'Key Mechanism',
      placeholder: 'The core technical mechanism or process...',
    },
    application: { label: 'Primary Application', placeholder: 'Main use case or industry...' },
  };


interface Props {
  readonly section: PatentSection;
  readonly onApply: () => void;
}

export function TemplateBuilder({ section, onApply }: Props) {
  const template = PATENT_TEMPLATES[section];
  const variables = extractVariables(template.userTemplate);
  const { setPrompt } = useWorkbenchStore();

  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(variables.map((v) => [v, '']))
  );

  // Reset when section changes
  useEffect(() => {
    setValues(Object.fromEntries(variables.map((v) => [v, ''])));
  }, [section]); // eslint-disable-line react-hooks/exhaustive-deps

  const allFilled = variables.every((v) => values[v]?.trim());

  const handleApply = () => {
    let prompt = template.userTemplate;
    for (const [key, val] of Object.entries(values)) {
      prompt = prompt.replaceAll(`{${key}}`, val.trim());
    }
    // Prepend system context as a structured prefix
    const fullPrompt = `${template.systemContext}\n\n---\n\n${prompt}`;
    setPrompt(fullPrompt);
    onApply();
  };

  if (variables.length === 0) return null;

  return (
    <Box
      style={{
        border: '1px solid var(--border)',
        borderRadius: 6,
        background: 'var(--surface)',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <Group
        px={16}
        py={10}
        gap={8}
        style={{
          borderBottom: '1px solid var(--border)',
          background: 'var(--surface-raised)',
        }}
      >
        <IconVariable size={14} style={{ color: 'var(--accent)' }} />
        <Text size="xs" fw={700} tt="uppercase" ff="monospace" c="var(--accent)" className="tracking-[2px]">
          Template Variables
        </Text>
        <Badge
          size="xs"
          variant="outline"
          style={{
            borderColor: 'var(--border)',
            color: 'var(--text-muted)',
            fontFamily: 'var(--font-mono)',
            fontSize: 9,
          }}
        >
          {section}
        </Badge>
      </Group>

      <Stack gap={14} p={16}>
        <Text size="xs" c="dimmed">
          {template.description}. Fill the fields below to build a structured REG prompt.
        </Text>

        <Divider style={{ borderColor: 'var(--border)' }} />

        {variables.map((varName) => {
          const meta = VARIABLE_LABELS[varName] ?? {
            label: varName,
            placeholder: `Enter ${varName}...`,
          };
          const value = values[varName] ?? '';

          return meta.multiline ? (
            <Textarea
              key={varName}
              label={
                <Text size="xs" fw={600} c="var(--text-secondary)" ff="monospace">
                  {meta.label}
                </Text>
              }
              placeholder={meta.placeholder}
              value={value}
              onChange={(e) => {
                const val = e.currentTarget.value;
                setValues((prev) => ({ ...prev, [varName]: val }));
              }}
              minRows={3}
              autosize
              styles={{
                input: {
                  background: 'var(--bg)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-primary)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 12,
                  lineHeight: 1.6,
                },
              }}
            />
          ) : (
            <TextInput
              key={varName}
              label={
                <Text size="xs" fw={600} c="var(--text-secondary)" ff="monospace">
                  {meta.label}
                </Text>
              }
              placeholder={meta.placeholder}
              value={value}
              onChange={(e) => {
                const val = e.currentTarget.value;
                setValues((prev) => ({ ...prev, [varName]: val }));
              }}
              styles={{
                input: {
                  background: 'var(--bg)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-primary)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 12,
                },
              }}
            />
          );
        })}

        <Button
          onClick={handleApply}
          disabled={!allFilled}
          rightSection={<IconArrowRight size={14} />}
          size="sm"
          style={{
            background: allFilled ? 'var(--accent)' : 'var(--surface-raised)',
            color: allFilled ? '#0d0d0d' : 'var(--text-muted)',
            border: `1px solid ${allFilled ? 'var(--accent)' : 'var(--border)'}`,
            fontFamily: 'var(--font-mono)',
            fontWeight: 700,
            letterSpacing: '0.05em',
            fontSize: 12,
            transition: 'all 0.2s ease',
          }}
        >
          BUILD PROMPT
        </Button>
      </Stack>
    </Box>
  );
}
