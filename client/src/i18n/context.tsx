import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { LOCALE_LABELS, type Locale } from './locales';
import { I18nContext } from './i18nCtx';

type Translations = Record<string, string>;

const localeModules = import.meta.glob<{ default: Translations }>('./locales/*.json', {
  eager: true,
});

function load(locale: Locale): Translations {
  return localeModules[`./locales/${locale}.json`]?.default ?? {};
}

const STORAGE_KEY = 'pw-locale';

function detectLocale(): Locale {
  try {
    const stored = localStorage.getItem(STORAGE_KEY) as Locale | null;
    if (stored && stored in LOCALE_LABELS) return stored;

    const candidates: readonly string[] = navigator.languages?.length
      ? navigator.languages
      : [navigator.language];

    for (const lang of candidates) {
      if (lang in LOCALE_LABELS) return lang as Locale;
    }

    for (const lang of candidates) {
      const prefix = lang.split('-')[0];
      const match = (Object.keys(LOCALE_LABELS) as Locale[]).find((k) => k.startsWith(prefix));
      if (match) return match;
    }
  } catch {
    /* ignore */
  }
  return 'en-US';
}

export function I18nProvider({ children }: { readonly children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(detectLocale);
  const [translations, setTranslations] = useState<Translations>(() => load(detectLocale()));

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    setTranslations(load(l));
    try {
      localStorage.setItem(STORAGE_KEY, l);
    } catch {
      /* ignore */
    }
  }, []);

  const t = useCallback(
    (key: string, params?: Record<string, string | number>): string => {
      let str = translations[key] ?? key;
      if (params) {
        for (const [k, v] of Object.entries(params)) {
          str = str.replaceAll(`{${k}}`, String(v));
        }
      }
      return str;
    },
    [translations]
  );

  const localeOptions = useMemo(
    () =>
      (Object.entries(LOCALE_LABELS) as [Locale, string][]).map(([value, label]) => ({
        value,
        label,
      })),
    []
  );

  const value = useMemo(
    () => ({ locale, setLocale, t, localeOptions }),
    [locale, setLocale, t, localeOptions]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}
