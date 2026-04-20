import { useState, useEffect, useMemo } from 'react';
import {
  ActionIcon,
  Tooltip,
  Modal,
  Stack,
  SimpleGrid,
  Select,
  NumberInput,
  TextInput,
  PasswordInput,
  Group,
  Button,
  Text,
  Box,
  Tabs,
  useComputedColorScheme,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconAdjustmentsCog, IconTrash } from '@tabler/icons-react';
import { useWorkbenchStore } from '@/store/workbench';
import { useI18n } from '@/i18n';
import { TemplateEditor } from '@/components/TemplateEditor';
import { listBackups, restoreBackup, deleteBackup, type BackupEntry } from '@/api/client';
import type { AppSettings, LogLevel, RegTemplate } from '@/types';

const LOG_LEVEL_OPTIONS: { value: LogLevel; label: string }[] = [
  { value: 'fatal', label: 'fatal' },
  { value: 'error', label: 'error' },
  { value: 'warn', label: 'warn' },
  { value: 'info', label: 'info' },
  { value: 'debug', label: 'debug' },
  { value: 'trace', label: 'trace' },
];

const FIELD = { label: { fontFamily: 'monospace', fontSize: 11 } } as const;
const TAB_STYLES = { tab: { fontFamily: 'monospace', fontSize: 11 } } as const;

const MODAL_STYLES = {
  content: { background: 'var(--surface-raised)', border: '1px solid var(--border)' },
  header: {
    background: 'var(--surface-raised)',
    borderBottom: '1px solid var(--border)',
    paddingBottom: 8,
  },
  body: { paddingTop: 12 },
} as const;

function formatDate(ms: number) {
  return new Date(ms).toLocaleString();
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function BackupTab() {
  const { initSessions, loadSettings, loadTemplate } = useWorkbenchStore();
  const { t } = useI18n();
  const [backups, setBackups] = useState<BackupEntry[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [status, setStatus] = useState<{ ok: boolean; msg: string } | null>(null);

  useEffect(() => {
    listBackups().then((list) => {
      setBackups(list);
      setLoaded(true);
    });
  }, []);

  const restore = async (filename: string) => {
    setRestoringId(filename);
    setStatus(null);
    const result = await restoreBackup(filename);
    setRestoringId(null);
    if (result.success) {
      await Promise.all([initSessions(), loadSettings(), loadTemplate()]);
      setStatus({ ok: true, msg: t('res_BackupRestored') });
    } else {
      setStatus({ ok: false, msg: result.error ?? t('res_BackupRestoreError') });
    }
  };

  const remove = async (filename: string) => {
    const ok = await deleteBackup(filename);
    if (ok) setBackups((prev) => prev.filter((b) => b.filename !== filename));
  };

  if (!loaded) {
    return (
      <Text size="xs" ff="monospace" c="var(--text-muted)">
        Loading...
      </Text>
    );
  }

  return (
    <Stack gap="sm">
      {status && (
        <Text size="xs" ff="monospace" c={status.ok ? 'teal' : 'red'}>
          {status.msg}
        </Text>
      )}
      {backups.length === 0 ? (
        <Text size="xs" ff="monospace" c="var(--text-muted)">
          {t('res_BackupNoBackups')}
        </Text>
      ) : (
        <Stack gap="xs">
          {backups.map((b) => (
            <Group
              key={b.filename}
              justify="space-between"
              align="center"
              className="border border-stroke rounded px-3 py-2"
            >
              <Box>
                <Text size="xs" ff="monospace">
                  {formatDate(b.mtimeMs)}
                </Text>
                <Text size="xs" ff="monospace" c="var(--text-muted)">
                  {formatSize(b.size)}
                </Text>
              </Box>
              <Group gap={4} wrap="nowrap">
                <Button
                  size="xs"
                  ff="monospace"
                  variant="subtle"
                  loading={restoringId === b.filename}
                  disabled={restoringId !== null && restoringId !== b.filename}
                  onClick={() => void restore(b.filename)}
                >
                  {restoringId === b.filename ? t('res_BackupRestoring') : t('res_BackupRestore')}
                </Button>
                <ActionIcon
                  size="sm"
                  variant="subtle"
                  disabled={restoringId !== null}
                  onClick={() => void remove(b.filename)}
                  aria-label="Delete backup"
                >
                  <IconTrash size={13} />
                </ActionIcon>
              </Group>
            </Group>
          ))}
        </Stack>
      )}
    </Stack>
  );
}

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
  useComputedColorScheme('dark');
  const [opened, { open, close }] = useDisclosure(false);
  const [activeTab, setActiveTab] = useState<string | null>('general');
  const {
    appSettings,
    saveSettings,
    resetSettings,
    availableModels,
    template,
    saveTemplate,
    resetTemplate,
  } = useWorkbenchStore();

  const { t } = useI18n();
  const [form, setForm] = useState<AppSettings>({ ...appSettings });
  const [templateDraft, setTemplateDraft] = useState<RegTemplate>(() => structuredClone(template));
  const [saving, setSaving] = useState(false);
  const [templateSaving, setTemplateSaving] = useState(false);

  useEffect(() => {
    if (opened) {
      setForm({ ...appSettings });
      setTemplateDraft(structuredClone(template));
      setActiveTab('general');
    }
  }, [opened, appSettings, template]);

  const isTemplateDirty = useMemo(
    () => JSON.stringify(templateDraft) !== JSON.stringify(template),
    [templateDraft, template]
  );

  const patch = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const patchStep = (id: string, key: string, value: string) =>
    setTemplateDraft((d) => ({
      ...d,
      steps: { ...d.steps, [id]: { ...d.steps[id], [key]: value } },
    }));

  const patchRag = (key: string, value: number) =>
    setTemplateDraft((d) => ({ ...d, rag: { ...d.rag!, [key]: value } }));

  const handleSave = async () => {
    setSaving(true);
    await saveSettings(form);
    setSaving(false);
    close();
  };

  const handleResetSettings = async () => {
    setSaving(true);
    await resetSettings();
    setSaving(false);
  };

  const handleSaveTemplate = async () => {
    setTemplateSaving(true);
    await saveTemplate(templateDraft);
    setTemplateSaving(false);
  };

  const handleResetTemplate = async () => {
    setTemplateSaving(true);
    await resetTemplate();
    setTemplateSaving(false);
  };

  let modelOptions: string[];
  if (availableModels.length > 0) modelOptions = availableModels;
  else if (form.defaultModel) modelOptions = [form.defaultModel];
  else modelOptions = [];

  const isTemplateTab = activeTab === 'template' || activeTab === 'rag';
  const isBackupTab = activeTab === 'backup';

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
          <IconAdjustmentsCog size={18} />
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
        size="lg"
        styles={MODAL_STYLES}
      >
        <Stack gap="sm">
          <Tabs value={activeTab} onChange={setActiveTab} styles={TAB_STYLES}>
            <Tabs.List mb="sm">
              <Tabs.Tab value="general">{t('res_SettingsTabGeneral')}</Tabs.Tab>
              <Tabs.Tab value="template">{t('res_SettingsTabTemplate')}</Tabs.Tab>
              {templateDraft.rag && <Tabs.Tab value="rag">{t('res_TemplateRagLimits')}</Tabs.Tab>}
              <Tabs.Tab value="backup">{t('res_SettingsTabBackup')}</Tabs.Tab>
            </Tabs.List>

            <Tabs.Panel value="general">
              <Stack gap="sm">
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

                <Box>
                  <SectionLabel>{t('res_SettingsSectionConnection')}</SectionLabel>
                  <Stack gap="xs" mt="xs">
                    <TextInput
                      label={t('res_SettingsOllamaUrl')}
                      value={form.ollamaUrl}
                      onChange={(e) => patch('ollamaUrl', e.target.value)}
                      styles={FIELD}
                    />
                    <PasswordInput
                      label={t('res_SettingsApiKey')}
                      description={t('res_SettingsApiKeyDescription')}
                      value={form.apiKey ?? ''}
                      onChange={(e) => patch('apiKey', e.target.value || undefined)}
                      maxLength={256}
                      styles={FIELD}
                    />
                  </Stack>
                </Box>

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
              </Stack>
            </Tabs.Panel>

            <Tabs.Panel value="template">
              <TemplateEditor steps={templateDraft.steps} patchStep={patchStep} />
            </Tabs.Panel>

            {templateDraft.rag && (
              <Tabs.Panel value="rag">
                <Box mt="xs">
                  <SimpleGrid cols={2} spacing="xs">
                    <NumberInput
                      label={t('res_TemplatePriorSections')}
                      value={templateDraft.rag.maxPriorSections}
                      onChange={(v) => patchRag('maxPriorSections', Number(v))}
                      min={0}
                      max={10}
                      styles={FIELD}
                    />
                    <NumberInput
                      label={t('res_TemplateSectionChars')}
                      value={templateDraft.rag.maxSectionChars}
                      onChange={(v) => patchRag('maxSectionChars', Number(v))}
                      min={0}
                      max={10_000}
                      step={500}
                      thousandSeparator=","
                      styles={FIELD}
                    />
                    <NumberInput
                      label={t('res_TemplateIdeaChars')}
                      value={templateDraft.rag.maxIdeaChars}
                      onChange={(v) => patchRag('maxIdeaChars', Number(v))}
                      min={0}
                      max={10_000}
                      step={500}
                      thousandSeparator=","
                      styles={FIELD}
                    />
                    <NumberInput
                      label={t('res_TemplateConstraintsChars')}
                      value={templateDraft.rag.maxConstraintsChars}
                      onChange={(v) => patchRag('maxConstraintsChars', Number(v))}
                      min={0}
                      max={10_000}
                      step={500}
                      thousandSeparator=","
                      styles={FIELD}
                    />
                    <NumberInput
                      label={t('res_TemplateContextFileChars')}
                      value={templateDraft.rag.maxContextFileChars}
                      onChange={(v) => patchRag('maxContextFileChars', Number(v))}
                      min={0}
                      max={200_000}
                      step={10_000}
                      thousandSeparator=","
                      styles={FIELD}
                    />
                  </SimpleGrid>
                </Box>
              </Tabs.Panel>
            )}
            <Tabs.Panel value="backup">
              <BackupTab />
            </Tabs.Panel>
          </Tabs>

          {/* Footer — varies by active tab */}
          {!isBackupTab && (
            <Group justify="flex-end" gap="xs" pt={4}>
              {isTemplateTab ? (
                <>
                  <Button
                    variant="subtle"
                    size="xs"
                    color="red"
                    ff="monospace"
                    loading={templateSaving}
                    onClick={() => void handleResetTemplate()}
                  >
                    {t('res_ResetToDefaults')}
                  </Button>
                  <Button
                    size="xs"
                    ff="monospace"
                    loading={templateSaving}
                    disabled={!isTemplateDirty}
                    onClick={() => void handleSaveTemplate()}
                    className="bg-accent text-bg"
                  >
                    {t('res_Save')}
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    variant="subtle"
                    size="xs"
                    color="red"
                    ff="monospace"
                    loading={saving}
                    onClick={() => void handleResetSettings()}
                  >
                    {t('res_ResetToDefaults')}
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
                </>
              )}
            </Group>
          )}
        </Stack>
      </Modal>
    </>
  );
}
