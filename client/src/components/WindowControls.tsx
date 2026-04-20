import React, { useEffect, useState } from 'react';
import { ActionIcon, Modal, Text, Group, Button, Tooltip } from '@mantine/core';
import { IconMinus, IconSquare, IconCopy, IconX } from '@tabler/icons-react';
import { useWorkbenchStore } from '@/store/workbench';
import { useI18n } from '@/i18n';

const api = window.electronAPI;

export function WindowControls() {
  const { sessions } = useWorkbenchStore();
  const { t } = useI18n();
  const [isMaximized, setIsMaximized] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    api?.windowIsMaximized().then(setIsMaximized);
    const off = api?.onMaximizeChange(setIsMaximized);
    return () => off?.();
  }, []);

  const handleClose = () => {
    if (sessions.some((s) => !s.persisted)) {
      setConfirmOpen(true);
    } else {
      api?.windowClose();
    }
  };

  const confirmClose = () => {
    setConfirmOpen(false);
    api?.windowClose();
  };

  return (
    <>
      <Group gap={2} wrap="nowrap" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        <Tooltip label={t('res_WindowMinimize')} position="bottom">
          <ActionIcon
            variant="subtle"
            size="md"
            aria-label={t('res_WindowMinimize')}
            onClick={() => api?.windowMinimize()}
            className="text-fg-muted hover:text-accent"
          >
            <span
              style={{ display: 'flex', alignItems: 'flex-end', height: '100%', paddingBottom: 1 }}
            >
              <IconMinus size={14} />
            </span>
          </ActionIcon>
        </Tooltip>

        <Tooltip
          label={isMaximized ? t('res_WindowRestore') : t('res_WindowMaximize')}
          position="bottom"
        >
          <ActionIcon
            variant="subtle"
            size="md"
            aria-label={isMaximized ? t('res_WindowRestore') : t('res_WindowMaximize')}
            onClick={() => api?.windowMaximize()}
            className="text-fg-muted hover:text-accent"
          >
            {isMaximized ? <IconCopy size={14} /> : <IconSquare size={14} />}
          </ActionIcon>
        </Tooltip>

        <Tooltip label={t('res_WindowClose')} position="bottom">
          <ActionIcon
            variant="subtle"
            size="md"
            aria-label={t('res_WindowClose')}
            onClick={handleClose}
            className="text-fg-muted hover:text-accent"
          >
            <IconX size={16} />
          </ActionIcon>
        </Tooltip>
      </Group>

      <Modal
        opened={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title={t('res_CloseWindowDraftsTitle')}
        centered
        size="sm"
      >
        <Text size="sm" mb="lg">
          {t('res_CloseWindowDraftsMessage')}
        </Text>
        <Group justify="flex-end" gap={8}>
          <Button variant="default" size="xs" onClick={() => setConfirmOpen(false)}>
            {t('res_Cancel')}
          </Button>
          <Button color="red" size="xs" onClick={confirmClose}>
            {t('res_WindowClose')}
          </Button>
        </Group>
      </Modal>
    </>
  );
}
