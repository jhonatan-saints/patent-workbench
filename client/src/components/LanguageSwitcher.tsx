import { ActionIcon, Menu, Tooltip } from '@mantine/core';
import { IconLanguage } from '@tabler/icons-react';
import { useI18n, LOCALE_LABELS } from '@/i18n';

export function LanguageSwitcher() {
  const { locale, setLocale, localeOptions } = useI18n();

  return (
    <div className="flex items-center">
      <Menu position="bottom-end" offset={6} withinPortal>
        <Menu.Target>
          <Tooltip label={LOCALE_LABELS[locale]} position="bottom">
            <ActionIcon
              variant="subtle"
              size="md"
              aria-label="Select language"
              className="text-fg-muted hover:text-accent"
            >
              <IconLanguage size={18} />
            </ActionIcon>
          </Tooltip>
        </Menu.Target>

        <Menu.Dropdown className="bg-surface border border-stroke min-w-40">
          {localeOptions.map(({ value, label }) => (
            <Menu.Item
              key={value}
              onClick={() => setLocale(value)}
              className={`font-mono text-[11px] ${value === locale ? 'text-accent font-bold' : 'text-fg font-normal'}`}
            >
              {label}
            </Menu.Item>
          ))}
        </Menu.Dropdown>
      </Menu>
    </div>
  );
}
