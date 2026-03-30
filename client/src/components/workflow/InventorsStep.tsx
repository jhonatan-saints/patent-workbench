import { useState } from 'react';
import {
  Stack,
  TextInput,
  Button,
  Text,
  Group,
  Box,
  Divider,
  ScrollArea,
} from '@mantine/core';
import {
  IconFileDescription,
  IconUser,
  IconPlus,
  IconTrash,
  IconCheck,
  IconArrowLeft,
} from '@tabler/icons-react';
import { useWorkbenchStore } from '@/store/workbench';
import type { InventorInfo } from '@/types';
import { generateId } from '@/utils/sanitize';

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

function emptyInventor(): InventorInfo {
  return {
    id: generateId(),
    name: '',
    address: '',
    telephone: '',
    email: '',
    citizenship: '',
    employeeId: '',
  };
}

export function InventorsStep() {
  const { artifact, updateInventors, updatePatentMeta, goToPreview, goToStep, steps } =
    useWorkbenchStore();

  const [idfNumber, setIdfNumber] = useState(artifact?.idfNumber ?? '');
  const [businessGroup, setBusinessGroup] = useState(artifact?.businessGroup ?? '');

  const [inventors, setInventors] = useState<InventorInfo[]>(() =>
    artifact?.inventors.length ? artifact.inventors : [emptyInventor()]
  );

  const hasAtLeastOne = inventors.some((inv) => inv.name.trim().length > 0);

  const updateInventor = (id: string, field: keyof InventorInfo, value: string) => {
    setInventors((prev) =>
      prev.map((inv) => (inv.id === id ? { ...inv, [field]: value } : inv))
    );
  };

  const addInventor = () => setInventors((prev) => [...prev, emptyInventor()]);

  const removeInventor = (id: string) =>
    setInventors((prev) => (prev.length > 1 ? prev.filter((inv) => inv.id !== id) : prev));

  const handleConfirm = () => {
    const cleaned = inventors
      .filter((inv) => inv.name.trim().length > 0)
      .map((inv) => ({
        ...inv,
        name: inv.name.trim(),
        address: inv.address?.trim() || undefined,
        telephone: inv.telephone?.trim() || undefined,
        email: inv.email?.trim() || undefined,
        citizenship: inv.citizenship?.trim() || undefined,
        employeeId: inv.employeeId?.trim() || undefined,
      }));
    updateInventors(cleaned);
    updatePatentMeta(idfNumber || undefined, businessGroup || undefined);
    goToPreview();
  };

  const handleBack = () => {
    goToStep(steps.length - 1);
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
              <IconFileDescription size={14} style={{ color: 'var(--accent)' }} />
              <Text
                fw={700}
                size="sm"
                ff="monospace"
                style={{ color: 'var(--text-primary)', letterSpacing: '0.06em' }}
              >
                PATENT FILING DETAILS
              </Text>
            </Group>
            <Text size="xs" c="var(--text-muted)" ff="monospace">
              Filing metadata and inventor information for the IDF
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

      {/* Body */}
      <ScrollArea style={{ flex: 1 }}>
        <Box p={28} style={{ maxWidth: 700, margin: '0 auto' }}>
          <Stack gap={20}>

            {/* Filing metadata block (optional) */}
            <Box
              style={{
                border: '1px solid var(--border)',
                borderRadius: 6,
                padding: '16px 18px',
                background: 'var(--surface)',
              }}
            >
              <Group gap={6} mb={12}>
                <IconFileDescription size={12} style={{ color: 'var(--text-muted)' }} />
                <Text
                  size="xs"
                  ff="monospace"
                  fw={700}
                  style={{ color: 'var(--text-muted)', letterSpacing: '0.06em' }}
                >
                  FILING INFO
                  <Text span size="xs" fw={400} style={{ marginLeft: 6, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                    — optional
                  </Text>
                </Text>
              </Group>
              <Group grow gap={10}>
                <TextInput
                  label="IDF Number"
                  placeholder="e.g., IDF-2024-0042"
                  value={idfNumber}
                  onChange={(e) => setIdfNumber(e.currentTarget.value)}
                  styles={INPUT_STYLES}
                />
                <TextInput
                  label="Business Group"
                  placeholder="e.g., AI Platform, Cloud Infrastructure"
                  value={businessGroup}
                  onChange={(e) => setBusinessGroup(e.currentTarget.value)}
                  styles={INPUT_STYLES}
                />
              </Group>
            </Box>

            {/* Inventor blocks */}
            {inventors.map((inv, idx) => (
              <Box
                key={inv.id}
                style={{
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                  padding: '16px 18px',
                  background: 'var(--surface)',
                }}
              >
                <Group justify="space-between" mb={12}>
                  <Group gap={6}>
                    <IconUser size={12} style={{ color: 'var(--text-muted)' }} />
                    <Text
                      size="xs"
                      ff="monospace"
                      fw={700}
                      style={{ color: 'var(--text-muted)', letterSpacing: '0.06em' }}
                    >
                      INVENTOR {idx + 1}
                    </Text>
                  </Group>
                  {inventors.length > 1 && (
                    <Button
                      variant="subtle"
                      size="xs"
                      color="red"
                      leftSection={<IconTrash size={11} />}
                      onClick={() => removeInventor(inv.id)}
                      style={{ fontFamily: 'var(--font-mono)', fontSize: 10 }}
                    >
                      REMOVE
                    </Button>
                  )}
                </Group>

                <Stack gap={10}>
                  <TextInput
                    label="Full Name"
                    placeholder="e.g., Jane Smith"
                    value={inv.name}
                    onChange={(e) => updateInventor(inv.id, 'name', e.currentTarget.value)}
                    required
                    styles={INPUT_STYLES}
                  />
                  <TextInput
                    label="Address"
                    placeholder="e.g., 123 Main St, City, State, ZIP"
                    value={inv.address ?? ''}
                    onChange={(e) => updateInventor(inv.id, 'address', e.currentTarget.value)}
                    styles={INPUT_STYLES}
                  />
                  <Group grow gap={10}>
                    <TextInput
                      label="Telephone"
                      placeholder="e.g., +1 (555) 000-0000"
                      value={inv.telephone ?? ''}
                      onChange={(e) => updateInventor(inv.id, 'telephone', e.currentTarget.value)}
                      styles={INPUT_STYLES}
                    />
                    <TextInput
                      label="Email"
                      placeholder="jane@example.com"
                      value={inv.email ?? ''}
                      onChange={(e) => updateInventor(inv.id, 'email', e.currentTarget.value)}
                      styles={INPUT_STYLES}
                    />
                  </Group>
                  <Group grow gap={10}>
                    <TextInput
                      label="Citizenship"
                      placeholder="e.g., American, Canadian"
                      value={inv.citizenship ?? ''}
                      onChange={(e) => updateInventor(inv.id, 'citizenship', e.currentTarget.value)}
                      styles={INPUT_STYLES}
                    />
                    <TextInput
                      label="Employee ID"
                      placeholder="Optional"
                      value={inv.employeeId ?? ''}
                      onChange={(e) => updateInventor(inv.id, 'employeeId', e.currentTarget.value)}
                      styles={INPUT_STYLES}
                    />
                  </Group>
                </Stack>
              </Box>
            ))}

            <Divider style={{ borderColor: 'var(--border)' }} />

            <Group justify="space-between">
              <Button
                variant="outline"
                size="xs"
                leftSection={<IconPlus size={12} />}
                onClick={addInventor}
                style={{
                  borderColor: 'var(--border)',
                  color: 'var(--text-secondary)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                  letterSpacing: '0.06em',
                }}
              >
                ADD INVENTOR
              </Button>

              <Button
                leftSection={<IconCheck size={13} />}
                onClick={handleConfirm}
                disabled={!hasAtLeastOne}
                size="sm"
                style={{
                  background: hasAtLeastOne ? 'var(--accent)' : 'var(--surface-raised)',
                  color: hasAtLeastOne ? 'var(--accent-text)' : 'var(--text-muted)',
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 700,
                  fontSize: 11,
                  letterSpacing: '0.08em',
                  border: 'none',
                }}
              >
                CONFIRM & GO TO PREVIEW
              </Button>
            </Group>

          </Stack>
        </Box>
      </ScrollArea>
    </Stack>
  );
}
