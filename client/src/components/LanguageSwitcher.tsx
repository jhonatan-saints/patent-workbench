import { ActionIcon, Menu, Tooltip } from '@mantine/core';
import { IconLanguage } from '@tabler/icons-react';
import { useI18n, LOCALE_LABELS } from '@/i18n';

export function LanguageSwitcher() {
  const { locale, setLocale, localeOptions } = useI18n();

  return (
    <div style={{ display: 'flex', alignItems: 'center' }}>
    <Menu position="bottom-end" offset={6} withinPortal>
      <Menu.Target>
        <Tooltip label={LOCALE_LABELS[locale]} position="bottom">
          <ActionIcon
            variant="subtle"
            size="md"
            aria-label="Select language"
            className="text-fg-muted hover:text-accent"
          >
            <IconLanguage size={16} />
          </ActionIcon>
        </Tooltip>
      </Menu.Target>

      <Menu.Dropdown
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          minWidth: 160,
        }}
      >
        {localeOptions.map(({ value, label }) => (
          <Menu.Item
            key={value}
            onClick={() => setLocale(value)}
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              color: value === locale ? 'var(--accent)' : 'var(--text-primary)',
              fontWeight: value === locale ? 700 : 400,
            }}
          >
            {label}
          </Menu.Item>
        ))}
      </Menu.Dropdown>
    </Menu>
    </div>
  );
}
