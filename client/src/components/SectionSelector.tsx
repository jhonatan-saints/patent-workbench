import { Stack, UnstyledButton, Text, Badge, Group } from '@mantine/core';
import { PATENT_TEMPLATES, SECTION_ORDER } from '../utils/templates';
import { useWorkbenchStore } from '../store/workbench';
import type { PatentSection } from '../types';

export function SectionSelector() {
  const { currentSection, setSection, setPrompt } = useWorkbenchStore();

  const handleSelect = (section: PatentSection | 'custom') => {
    setSection(section);
    if (section === 'custom') {
      setPrompt('');
    } else {
      setPrompt(PATENT_TEMPLATES[section].userTemplate);
    }
  };

  return (
    <Stack gap={2}>
      <Text
        size="xs"
        fw={700}
        tt="uppercase"
        c="dimmed"
        mb={6}
        className="tracking-[2px]"
        style={{ fontFamily: 'var(--font-mono)' }}
      >
        Section
      </Text>

      {SECTION_ORDER.map((section, i) => {
        const tpl = PATENT_TEMPLATES[section];
        const isActive = currentSection === section;

        return (
          <UnstyledButton
            key={section}
            onClick={() => handleSelect(section)}
            style={{
              padding: '8px 12px',
              borderRadius: 4,
              border: isActive ? '1px solid var(--accent)' : '1px solid transparent',
              background: isActive ? 'var(--surface-active)' : 'transparent',
              transition: 'all 0.15s ease',
              cursor: 'pointer',
            }}
          >
            <Group justify="space-between" wrap="nowrap">
              <Group gap={8} wrap="nowrap">
                <Text size="xs" c="dimmed" ff="monospace" style={{ minWidth: 16 }}>
                  {String(i + 1).padStart(2, '0')}
                </Text>
                <Text
                  size="sm"
                  fw={isActive ? 600 : 400}
                  c={isActive ? 'var(--accent)' : 'var(--text-primary)'}
                >
                  {tpl.label}
                </Text>
              </Group>
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
                ~{tpl.tokenEstimate}t
              </Badge>
            </Group>
          </UnstyledButton>
        );
      })}

      {/* Custom mode */}
      <UnstyledButton
        onClick={() => handleSelect('custom')}
        style={{
          padding: '8px 12px',
          borderRadius: 4,
          border:
            currentSection === 'custom' ? '1px solid var(--accent)' : '1px dashed var(--border)',
          background: currentSection === 'custom' ? 'var(--surface-active)' : 'transparent',
          transition: 'all 0.15s ease',
          marginTop: 8,
        }}
      >
        <Group gap={8}>
          <Text size="xs" c="dimmed" ff="monospace">
            —
          </Text>
          <Text size="sm" c={currentSection === 'custom' ? 'var(--accent)' : 'dimmed'} fs="italic">
            Custom prompt
          </Text>
        </Group>
      </UnstyledButton>
    </Stack>
  );
}
