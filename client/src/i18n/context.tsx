import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { LOCALE_LABELS, type Locale } from './locales';
import { I18nContext } from './i18nCtx';
import enUS from './locales/en-US.json';

type Translations = Record<string, string>;

// en-US is imported directly (synchronous, in main bundle).
// All other locales are lazy — loaded only when the user switches to them.
const localeModules = import.meta.glob<{ default: Translations }>([
  './locales/*.json',
  '!./locales/en-US.json',
]);

async function load(locale: Locale): Promise<Translations> {
  if (locale === 'en-US') return enUS as Translations;
  const mod = await localeModules[`./locales/${locale}.json`]?.();
  return mod?.default ?? (enUS as Translations);
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
  const [activeLocale, setActiveLocale] = useState<Locale>(detectLocale);
  const [translations, setTranslations] = useState<Translations>(enUS as Translations);
  const [ready, setReady] = useState(() => detectLocale() === 'en-US');

  useEffect(() => {
    const initial = detectLocale();
    if (initial !== 'en-US') {
      void load(initial).then((t) => {
        setTranslations(t);
        setReady(true);
      });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const setLocale = useCallback((l: Locale) => {
    setActiveLocale(l);
    void load(l).then(setTranslations);
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
    () => ({ locale: activeLocale, setLocale, t, localeOptions, ready }),
    [activeLocale, setLocale, t, localeOptions, ready]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}
