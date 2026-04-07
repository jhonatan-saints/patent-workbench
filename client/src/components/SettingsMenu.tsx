import { useState, useEffect } from 'react';
import {
  ActionIcon,
  Tooltip,
  Modal,
  Stack,
  SimpleGrid,
  Select,
  NumberInput,
  TextInput,
  Group,
  Button,
  Text,
  Box,
  useComputedColorScheme,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconUserFilled, IconUser } from '@tabler/icons-react';
import { useWorkbenchStore } from '@/store/workbench';
import { useI18n } from '@/i18n';
import type { AppSettings, LogLevel } from '@/types';

const LOG_LEVEL_OPTIONS: { value: LogLevel; label: string }[] = [
  { value: 'fatal', label: 'fatal' },
  { value: 'error', label: 'error' },
  { value: 'warn', label: 'warn' },
  { value: 'info', label: 'info' },
  { value: 'debug', label: 'debug' },
  { value: 'trace', label: 'trace' },
];

const FIELD = {
  label: { fontFamily: 'monospace', fontSize: 11 },
} as const;

function SectionLabel({ children }: { readonly children: string }) {
  return (
    <Text
      size="xs"
      ff="monospace"
      tt="uppercase"
      c="var(--text-muted)"
      className="tracking-[0.07em] border-b border-stroke pb-1"
    >
      {children}
    </Text>
  );
}

export function SettingsMenu() {
  const scheme = useComputedColorScheme('dark');
  const [opened, { open, close }] = useDisclosure(false);
  const { appSettings, saveSettings, availableModels } = useWorkbenchStore();

  const { t } = useI18n();
  const [form, setForm] = useState<AppSettings>({ ...appSettings });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (opened) setForm({ ...appSettings });
  }, [opened, appSettings]);

  const patch = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const handleSave = async () => {
    setSaving(true);
    await saveSettings(form);
    setSaving(false);
    close();
  };

  let modelOptions = [] as string[];
  if (availableModels.length > 0) {
    modelOptions = availableModels;
  } else if (form.defaultModel) {
    modelOptions = [form.defaultModel];
  }

  return (
    <>
      <Tooltip label={t('res_Settings')} position="bottom">
        <ActionIcon
          aria-label={t('res_SettingsOpenSettings')}
          variant="subtle"
          size="md"
          onClick={open}
          className="text-fg-muted hover:text-accent"
        >
          {scheme === 'dark' ? <IconUserFilled size={18} /> : <IconUser size={18} />}
        </ActionIcon>
      </Tooltip>

      <Modal
        opened={opened}
        onClose={close}
        title={
          <Text
            ff="monospace"
            fw={700}
            tt="uppercase"
            size="xs"
            className="text-accent tracking-widest"
          >
            {t('res_Settings')}
          </Text>
        }
        size="md"
        styles={{
          content: { background: 'var(--surface-raised)', border: '1px solid var(--border)' },
          header: {
            background: 'var(--surface-raised)',
            borderBottom: '1px solid var(--border)',
            paddingBottom: 8,
          },
          body: { paddingTop: 12 },
        }}
      >
        <Stack gap="sm">
          {/* LLM */}
          <Box>
            <SectionLabel>{t('res_SettingsSectionLLM')}</SectionLabel>
            <SimpleGrid cols={2} spacing="xs" mt="xs">
              <Select
                label={t('res_SettingsDefaultModel')}
                data={modelOptions}
                value={form.defaultModel}
                onChange={(v) => v && patch('defaultModel', v)}
                allowDeselect={false}
                styles={FIELD}
              />
              <NumberInput
                label={t('res_SettingsNumOptions')}
                value={form.numOptions}
                onChange={(v) => patch('numOptions', Number(v))}
                min={1}
                max={5}
                styles={FIELD}
              />
              <NumberInput
                label={t('res_SettingsLlmTimeout')}
                value={Math.round(form.llmTimeoutMs / 1000)}
                onChange={(v) => patch('llmTimeoutMs', Number(v) * 1000)}
                min={5}
                max={600}
                step={5}
                styles={FIELD}
              />
              <NumberInput
                label={t('res_SettingsPromptMaxLength')}
                value={form.promptMaxLength}
                onChange={(v) => patch('promptMaxLength', Number(v))}
                min={1_000}
                max={200_000}
                step={1_000}
                thousandSeparator=","
                styles={FIELD}
              />
            </SimpleGrid>
          </Box>

          {/* Connection */}
          <Box>
            <SectionLabel>{t('res_SettingsSectionConnection')}</SectionLabel>
            <Box mt="xs">
              <TextInput
                label={t('res_SettingsOllamaUrl')}
                value={form.ollamaUrl}
                onChange={(e) => patch('ollamaUrl', e.target.value)}
                styles={FIELD}
              />
            </Box>
          </Box>

          {/* Server */}
          <Box>
            <SectionLabel>{t('res_SettingsSectionServer')}</SectionLabel>
            <SimpleGrid cols={2} spacing="xs" mt="xs">
              <NumberInput
                label={t('res_SettingsShutdownTimeout')}
                value={Math.round(form.shutdownTimeoutMs / 1000)}
                onChange={(v) => patch('shutdownTimeoutMs', Number(v) * 1000)}
                min={1}
                max={86_400}
                step={60}
                styles={FIELD}
              />
              <Select
                label={t('res_SettingsLogLevel')}
                data={LOG_LEVEL_OPTIONS}
                value={form.logLevel}
                onChange={(v) => v && patch('logLevel', v as LogLevel)}
                allowDeselect={false}
                styles={FIELD}
              />
            </SimpleGrid>
          </Box>

          {/* Actions */}
          <Group justify="flex-end" gap="xs" pt={4}>
            <Button variant="subtle" size="xs" onClick={close} ff="monospace">
              {t('res_Cancel')}
            </Button>
            <Button
              size="xs"
              loading={saving}
              onClick={() => void handleSave()}
              ff="monospace"
              className="bg-accent text-bg"
            >
              {t('res_Save')}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}
