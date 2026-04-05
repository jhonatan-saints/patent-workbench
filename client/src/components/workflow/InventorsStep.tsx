import { useState, useRef } from 'react';
import {
  Stack,
  TextInput,
  Button,
  Text,
  Group,
  Box,
  Divider,
  ScrollArea,
  ActionIcon,
  Loader,
  Tooltip,
} from '@mantine/core';
import {
  IconFileDescription,
  IconUser,
  IconPlus,
  IconTrash,
  IconCheck,
  IconArrowLeft,
  IconWand,
  IconHome,
} from '@tabler/icons-react';
import { useWorkbenchStore } from '@/store/workbench';
import { INPUT_STYLES, btnPrimary } from '@/theme/styles';
import type { InventorInfo } from '@/types';
import { generateId } from '@/utils/sanitize';
import { useI18n } from '@/i18n/useI18n';
import { buildArtifactContext } from '@/utils/workflowTemplates';
import { generatePatentContent } from '@/api/client';

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
  const { t } = useI18n();
  const {
    artifact,
    updateInventors,
    updatePatentMeta,
    updateInventionTitle,
    goToPreview,
    goToFigures,
    resetWorkflow,
  } = useWorkbenchStore();

  const [inventionTitle, setInventionTitle] = useState(artifact?.inventionTitle ?? '');
  const [idfNumber, setIdfNumber] = useState(artifact?.idfNumber ?? '');
  const [businessGroup, setBusinessGroup] = useState(artifact?.businessGroup ?? '');
  const [generatingTitle, setGeneratingTitle] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const handleGenerateTitle = async () => {
    if (generatingTitle) {
      abortRef.current?.abort();
      setGeneratingTitle(false);
      return;
    }
    if (!artifact) return;
    abortRef.current = new AbortController();
    setGeneratingTitle(true);
    try {
      const context = buildArtifactContext(artifact);
      const prompt = `You are a patent title writer. Based on the invention below, generate a single concise and professional patent title (typically 5–15 words). Output ONLY the title text, with no quotes, no punctuation at the end, and no explanation.\n\n${context}`;
      const result = await generatePatentContent(
        { prompt, model: artifact.model },
        abortRef.current.signal
      );
      if (result.success) {
        setInventionTitle(result.data.response.trim());
      }
    } finally {
      setGeneratingTitle(false);
    }
  };

  const [inventors, setInventors] = useState<InventorInfo[]>(() =>
    artifact?.inventors.length ? artifact.inventors : [emptyInventor()]
  );

  const hasAtLeastOne = inventors.some((inv) => inv.name.trim().length > 0);
  const canConfirm = hasAtLeastOne && inventionTitle.trim().length > 0;

  const updateInventor = (id: string, field: keyof InventorInfo, value: string) => {
    setInventors((prev) => prev.map((inv) => (inv.id === id ? { ...inv, [field]: value } : inv)));
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
    updateInventionTitle(inventionTitle.trim());
    goToPreview();
  };

  const handleBack = () => {
    goToFigures();
  };

  return (
    <Stack gap={0} style={{ height: '100%' }}>
      {/* Header */}
      <Box className="px-5 py-3.5 border-b border-stroke bg-surface-raised shrink-0">
        <Group justify="space-between" wrap="nowrap">
          <Stack gap={2}>
            <Group gap={8}>
              <IconFileDescription size={14} className="text-accent" />
              <Text
                fw={700}
                size="sm"
                ff="monospace"
                className="text-fg tracking-[0.06em] uppercase"
              >
                {t('res_PatentFilingDetails')}
              </Text>
            </Group>
            <Text size="xs" c="var(--text-muted)" ff="monospace">
              {t('res_FilingMetadataHint')}
            </Text>
          </Stack>
          <Group gap={8} wrap="nowrap">
            <Button
              variant="subtle"
              size="xs"
              leftSection={<IconArrowLeft size={14} />}
              onClick={handleBack}
              className="uppercase font-mono text-[11px] text-fg-muted"
            >
              {t('res_BackToFigures')}
            </Button>
            <Button
              variant="subtle"
              size="xs"
              leftSection={<IconHome size={14} />}
              onClick={resetWorkflow}
              className="uppercase font-mono text-[11px] text-fg-muted"
            >
              {t('res_StartOver')}
            </Button>
          </Group>
        </Group>
      </Box>

      {/* Body */}
      <ScrollArea style={{ flex: 1 }}>
        <Box p={28} style={{ maxWidth: 700, margin: '0 auto' }}>
          <Stack gap={20}>
            {/* Filing metadata block (optional) */}
            <Box className="border border-stroke rounded-md px-4.5 py-4 bg-surface">
              <Group gap={6} mb={12}>
                <IconFileDescription size={14} className="text-fg-muted" />
                <Text size="xs" ff="monospace" fw={700} className="text-fg-muted tracking-[0.06em] uppercase">
                  {t('res_FilingInfo')}
                </Text>
              </Group>
              <TextInput
                label={t('res_InventionTitle')}
                placeholder={t('res_InventionTitle_Placeholder')}
                value={inventionTitle}
                onChange={(e) => setInventionTitle(e.currentTarget.value)}
                required
                styles={INPUT_STYLES}
                mb={10}
                rightSection={
                  <Tooltip label={t('res_GenerateTitle')} withArrow position="top">
                    <ActionIcon
                      aria-label={t('res_GenerateTitle')}
                      variant="subtle"
                      size="sm"
                      onClick={() => void handleGenerateTitle()}
                      className="text-fg-muted"
                    >
                      {generatingTitle ? <Loader size={14} /> : <IconWand size={14} />}
                    </ActionIcon>
                  </Tooltip>
                }
              />
              <Group grow gap={10}>
                <TextInput
                  label={t('res_IDFNumber')}
                  placeholder={t('res_IDFNumber_Placeholder')}
                  value={idfNumber}
                  onChange={(e) => setIdfNumber(e.currentTarget.value)}
                  styles={INPUT_STYLES}
                />
                <TextInput
                  label={t('res_BusinessGroup')}
                  placeholder={t('res_BusinessGroup_Placeholder')}
                  value={businessGroup}
                  onChange={(e) => setBusinessGroup(e.currentTarget.value)}
                  styles={INPUT_STYLES}
                />
              </Group>
            </Box>

            {/* Inventor blocks */}
            {inventors.map((inv, idx) => (
              <Box key={inv.id} className="border border-stroke rounded-md px-4.5 py-4 bg-surface">
                <Group justify="space-between" mb={12}>
                  <Group gap={6}>
                    <IconUser size={14} className="text-fg-muted" />
                    <Text
                      size="xs"
                      ff="monospace"
                      fw={700}
                      className="text-fg-muted tracking-[0.06em] uppercase"
                    >
                      {t('res_Inventor')} {idx + 1}
                    </Text>
                  </Group>
                  {inventors.length > 1 && (
                    <Button
                      variant="subtle"
                      size="xs"
                      color="red"
                      leftSection={<IconTrash size={11} />}
                      onClick={() => removeInventor(inv.id)}
                      className="uppercase font-mono text-[10px]"
                    >
                      {t('res_Remove')}
                    </Button>
                  )}
                </Group>

                <Stack gap={10}>
                  <TextInput
                    label={t('res_FullName')}
                    placeholder={t('res_FullName_Placeholder')}
                    value={inv.name}
                    onChange={(e) => updateInventor(inv.id, 'name', e.currentTarget.value)}
                    required
                    styles={INPUT_STYLES}
                  />
                  <TextInput
                    label={t('res_HomeAddress')}
                    placeholder={t('res_Address_Placeholder')}
                    value={inv.address ?? ''}
                    onChange={(e) => updateInventor(inv.id, 'address', e.currentTarget.value)}
                    styles={INPUT_STYLES}
                  />
                  <Group grow gap={10}>
                    <TextInput
                      label={t('res_HomeTelephone')}
                      placeholder={t('res_Telephone_Placeholder')}
                      value={inv.telephone ?? ''}
                      onChange={(e) => updateInventor(inv.id, 'telephone', e.currentTarget.value)}
                      styles={INPUT_STYLES}
                    />
                    <TextInput
                      label={t('res_HomeEmail')}
                      placeholder={t('res_Email_Placeholder')}
                      value={inv.email ?? ''}
                      onChange={(e) => updateInventor(inv.id, 'email', e.currentTarget.value)}
                      styles={INPUT_STYLES}
                    />
                  </Group>
                  <Group grow gap={10}>
                    <TextInput
                      label={t('res_Citizenship')}
                      placeholder={t('res_Citizenship_Placeholder')}
                      value={inv.citizenship ?? ''}
                      onChange={(e) => updateInventor(inv.id, 'citizenship', e.currentTarget.value)}
                      styles={INPUT_STYLES}
                    />
                    <TextInput
                      label={t('res_EmployeeId')}
                      placeholder={t('res_EmployeeId_Placeholder')}
                      value={inv.employeeId ?? ''}
                      onChange={(e) => updateInventor(inv.id, 'employeeId', e.currentTarget.value)}
                      styles={INPUT_STYLES}
                    />
                  </Group>
                </Stack>
              </Box>
            ))}

            <Divider className="border-stroke" />

            <Group justify="space-between">
              <Button
                variant="outline"
                size="xs"
                leftSection={<IconPlus size={14} />}
                onClick={addInventor}
                className="uppercase border-stroke text-fg-secondary font-mono text-[11px] tracking-[0.06em]"
              >
                {t('res_AddInventor')}
              </Button>

              <Button
                leftSection={<IconCheck size={14} />}
                onClick={handleConfirm}
                disabled={!canConfirm}
                size="sm"
                style={btnPrimary(canConfirm)}
                className="uppercase"
              >
                {t('res_ConfirmAndGoToPreview')}
              </Button>
            </Group>
          </Stack>
        </Box>
      </ScrollArea>
    </Stack>
  );
}
