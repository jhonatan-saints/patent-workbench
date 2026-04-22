import { createContext } from 'react';
import type { Locale } from './locales';

export interface I18nCtx {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
  localeOptions: { value: Locale; label: string }[];
  ready: boolean;
}

export const I18nContext = createContext<I18nCtx | null>(null);
