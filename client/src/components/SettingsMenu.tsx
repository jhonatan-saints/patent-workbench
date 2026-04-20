import { useState, useRef, useMemo, useEffect } from 'react';
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
  Tabs,
  useComputedColorScheme,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconAdjustmentsCog, IconFileTextFilled } from '@tabler/icons-react';
import { useWorkbenchStore } from '@/store/workbench';
import { useI18n } from '@/i18n';
import { TemplateEditor } from '@/components/TemplateEditor';
import { collectTemplateErrors } from '@/utils/templateValidation';
import { exportBackup, importBackup } from '@/api/client';
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

const MODAL_BASE = {
  content: { background: 'var(--surface-raised)', border: '1px solid var(--border)' },
  header: {
    background: 'var(--surface-raised)',
    borderBottom: '1px solid var(--border)',
    paddingBottom: 8,
  },
  close: {
    color: 'var(--text-muted)',
    '&:hover': { color: 'var(--text-fg)', background: 'var(--surface-hover)' },
  },
} as const;

const MODAL_STYLES = {
  ...MODAL_BASE,
  body: {
    paddingTop: 12,
    display: 'flex',
    flexDirection: 'column' as const,
    height: 'min(620px, calc(100vh - 160px))',
    overflow: 'hidden',
  },
} as const;

const CONFIRM_MODAL_STYLES = {
  ...MODAL_BASE,
  body: { paddingTop: 12 },
} as const;

interface BackupTabProps {
  readonly selectedFile: File | null;
  readonly importing: boolean;
  readonly onFileSelect: (file: File | null) => void;
  readonly status: { ok: boolean; msg: string } | null;
}

function BackupTab({ selectedFile, importing, onFileSelect, status }: BackupTabProps) {
  const { t } = useI18n();
  const [exporting, setExporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = async () => {
    setExporting(true);
    await exportBackup();
    setExporting(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onFileSelect(file);
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) onFileSelect(file);
  };

  return (
    <Stack gap="xl">
      {status && (
        <Text size="xs" ff="monospace" c={status.ok ? 'teal' : 'red'}>
          {status.msg}
        </Text>
      )}

      <Box>
        <SectionLabel>{t('res_BackupRestore')}</SectionLabel>
        <Box
          mt="xs"
          className="border border-stroke rounded px-4 text-center"
          style={{
            cursor: importing ? 'default' : 'pointer',
            opacity: importing ? 0.5 : 1,
            minHeight: 120,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          onClick={() => !importing && fileInputRef.current?.click()}
        >
          <Group gap={6} align="center" wrap="nowrap">
            {selectedFile ? (
              <>
                <IconFileTextFilled
                  size={24}
                  style={{ color: 'var(--text-muted)', flexShrink: 0 }}
                />
                <Text size="sm" ff="monospace">
                  {selectedFile.name}
                </Text>
              </>
            ) : (
              <Text size="sm" ff="monospace" c="var(--text-muted)">
                {t('res_BackupDropHint')}
              </Text>
            )}
          </Group>
          <input
            aria-label={t('res_BackupRestore')}
            ref={fileInputRef}
            type="file"
            accept=".db"
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />
        </Box>
      </Box>

      <Box className="border-t border-stroke pt-4">
        <Group justify="space-between" align="center">
          <Text size="xs" ff="monospace" c="var(--text-muted)">
            {t('res_BackupExportHint')}
          </Text>
          <Button
            size="xs"
            ff="monospace"
            loading={exporting}
            onClick={() => void handleExport()}
            className="bg-accent text-bg"
          >
            {t('res_BackupDownload')}
          </Button>
        </Group>
      </Box>
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
    initSessions,
    loadSettings,
    loadTemplate,
  } = useWorkbenchStore();

  const { t } = useI18n();
  const [form, setForm] = useState<AppSettings>({ ...appSettings });
  const [templateDraft, setTemplateDraft] = useState<RegTemplate>(() => structuredClone(template));
  const [saving, setSaving] = useState(false);
  const [templateSaving, setTemplateSaving] = useState(false);
  const templateErrors = useMemo(
    () => collectTemplateErrors(templateDraft.steps, t),
    [templateDraft, t]
  );
  const [backupFile, setBackupFile] = useState<File | null>(null);
  const [backupImporting, setBackupImporting] = useState(false);
  const [backupStatus, setBackupStatus] = useState<{ ok: boolean; msg: string } | null>(null);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<string | null>(null);

  useEffect(() => {
    if (opened) {
      setForm({ ...appSettings });
      setTemplateDraft(structuredClone(template));
      setActiveTab('general');
      setBackupFile(null);
      setBackupStatus(null);
    }
  }, [opened, appSettings, template]);

  const handleBackupApply = async () => {
    if (!backupFile) return;
    setBackupImporting(true);
    setBackupStatus(null);
    const result = await importBackup(backupFile);
    setBackupImporting(false);
    if (result.success) {
      setBackupFile(null);
      await Promise.all([initSessions(), loadSettings(), loadTemplate()]);
      setBackupStatus({ ok: true, msg: t('res_BackupRestored') });
    } else {
      setBackupStatus({ ok: false, msg: result.error ?? t('res_BackupRestoreError') });
    }
  };

  const isTemplateDirty = useMemo(
    () => JSON.stringify(templateDraft) !== JSON.stringify(template),
    [templateDraft, template]
  );

  const isGeneralDirty = useMemo(
    () => JSON.stringify(form) !== JSON.stringify(appSettings),
    [form, appSettings]
  );

  const isCurrentTabDirty = useMemo(() => {
    if (activeTab === 'general') return isGeneralDirty;
    if (activeTab === 'template' || activeTab === 'rag') return isTemplateDirty;
    if (activeTab === 'backup') return backupFile !== null;
    return false;
  }, [activeTab, isGeneralDirty, isTemplateDirty, backupFile]);

  const guardedTabChange = (tab: string | null) => {
    if (!tab || tab === activeTab) return;
    if (isCurrentTabDirty) {
      setPendingAction(tab);
      setDiscardOpen(true);
    } else {
      setActiveTab(tab);
    }
  };

  const guardedClose = () => {
    if (isCurrentTabDirty) {
      setPendingAction('__close__');
      setDiscardOpen(true);
    } else {
      close();
    }
  };

  const handleConfirmDiscard = () => {
    setDiscardOpen(false);
    if (activeTab === 'general') setForm({ ...appSettings });
    if (activeTab === 'template' || activeTab === 'rag')
      setTemplateDraft(structuredClone(template));
    if (activeTab === 'backup') {
      setBackupFile(null);
      setBackupStatus(null);
    }
    if (pendingAction === '__close__') {
      close();
    } else if (pendingAction) {
      setActiveTab(pendingAction);
    }
    setPendingAction(null);
  };

  const handleCancelDiscard = () => {
    setDiscardOpen(false);
    setPendingAction(null);
  };

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

  const renderFooter = () => {
    if (isBackupTab) {
      return (
        <>
          <Button
            variant="subtle"
            size="xs"
            ff="monospace"
            disabled={!backupFile || backupImporting}
            onClick={() => {
              setBackupFile(null);
              setBackupStatus(null);
            }}
          >
            {t('res_Cancel')}
          </Button>
          <Button
            size="xs"
            ff="monospace"
            loading={backupImporting}
            disabled={!backupFile}
            onClick={() => void handleBackupApply()}
            className="bg-accent text-bg"
          >
            {t('res_Save')}
          </Button>
        </>
      );
    }
    if (isTemplateTab) {
      return (
        <>
          <Button
            variant="subtle"
            size="xs"
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
            disabled={!isTemplateDirty || Object.keys(templateErrors).length > 0}
            onClick={() => void handleSaveTemplate()}
            className="bg-accent text-bg"
          >
            {t('res_Save')}
          </Button>
        </>
      );
    }
    return (
      <>
        <Button
          variant="subtle"
          size="xs"
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
    );
  };

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
        opened={discardOpen}
        onClose={handleCancelDiscard}
        title={
          <Text
            ff="monospace"
            fw={700}
            tt="uppercase"
            size="xs"
            className="text-accent tracking-widest"
          >
            {t('res_SettingsDiscardTitle')}
          </Text>
        }
        centered
        size="sm"
        zIndex={400}
        styles={CONFIRM_MODAL_STYLES}
      >
        <Text className="py-5" size="sm" mb="lg" ff="monospace">
          {t('res_SettingsDiscardMessage')}
        </Text>
        <Group justify="flex-end" gap="xs">
          <Button variant="subtle" size="xs" ff="monospace" onClick={handleCancelDiscard}>
            {t('res_Cancel')}
          </Button>
          <Button
            size="xs"
            ff="monospace"
            onClick={handleConfirmDiscard}
            className="bg-accent text-bg"
          >
            {t('res_Discard')}
          </Button>
        </Group>
      </Modal>

      <Modal
        opened={opened}
        onClose={guardedClose}
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
        <Stack gap={0} style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          <Tabs
            value={activeTab}
            onChange={guardedTabChange}
            styles={{
              ...TAB_STYLES,
              root: { flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' },
              panel: { flex: 1, minHeight: 0, overflowY: 'auto' },
            }}
          >
            <Tabs.List mb="sm">
              <Tabs.Tab value="general">{t('res_SettingsTabGeneral')}</Tabs.Tab>
              <Tabs.Tab value="template">{t('res_SettingsTabTemplate')}</Tabs.Tab>
              {templateDraft.rag && <Tabs.Tab value="rag">{t('res_TemplateRagLimits')}</Tabs.Tab>}
              <Tabs.Tab value="backup">{t('res_SettingsTabBackup')}</Tabs.Tab>
            </Tabs.List>

            <Tabs.Panel value="general" pb="md">
              <Stack gap="xl">
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
                  <Box mt="xs">
                    <TextInput
                      label={t('res_SettingsOllamaUrl')}
                      value={form.ollamaUrl}
                      onChange={(e) => patch('ollamaUrl', e.target.value)}
                      styles={FIELD}
                    />
                  </Box>
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

            <Tabs.Panel value="template" pb="md">
              <TemplateEditor steps={templateDraft.steps} patchStep={patchStep} />
            </Tabs.Panel>

            {templateDraft.rag && (
              <Tabs.Panel value="rag" pb="md">
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
            <Tabs.Panel value="backup" pb="md">
              <BackupTab
                selectedFile={backupFile}
                importing={backupImporting}
                status={backupStatus}
                onFileSelect={(f) => {
                  setBackupFile(f);
                  setBackupStatus(null);
                }}
              />
            </Tabs.Panel>
          </Tabs>

          {/* Footer — fixed at bottom, content varies by active tab */}
          <Group
            justify="flex-end"
            gap="xs"
            pt="sm"
            style={{ borderTop: '1px solid var(--border)', flexShrink: 0 }}
          >
            {renderFooter()}
          </Group>
        </Stack>
      </Modal>
    </>
  );
}
