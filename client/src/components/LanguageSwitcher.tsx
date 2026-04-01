import { ActionIcon, Menu, Tooltip } from '@mantine/core';
import { IconLanguage } from '@tabler/icons-react';
import { useI18n, LOCALE_LABELS, type Locale } from '@/i18n';

export function LanguageSwitcher() {
  const { locale, setLocale, localeOptions } = useI18n();

  return (
    <Menu position="bottom-end" offset={6} withinPortal>
      <Menu.Target>
        <Tooltip label={LOCALE_LABELS[locale]} position="bottom">
          <ActionIcon
            variant="subtle"
            size="sm"
            aria-label="Select language"
            className="text-fg-muted hover:text-accent"
          >
            <IconLanguage size={14} />
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
            onClick={() => setLocale(value as Locale)}
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
  );
}
