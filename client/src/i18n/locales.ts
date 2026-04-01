export type Locale =
  | 'cy-GB' | 'de-DE' | 'en-GB' | 'en-US'
  | 'es-CL' | 'es-ES' | 'fr-CA' | 'fr-FR'
  | 'it-IT' | 'nb-NO' | 'nl'
  | 'pt-BR' | 'pt-PT' | 'ru-RU' | 'sv-SE' | 'zh-CN';

export const LOCALE_LABELS: Record<Locale, string> = {
  'cy-GB': 'Cymraeg',
  'de-DE': 'Deutsch',
  'en-GB': 'English (UK)',
  'en-US': 'English (US)',
  'es-CL': 'Español (CL)',
  'es-ES': 'Español',
  'fr-CA': 'Français (CA)',
  'fr-FR': 'Français',
  'it-IT': 'Italiano',
  'nb-NO': 'Norsk',
  'nl':    'Nederlands',
  'pt-BR': 'Português (BR)',
  'pt-PT': 'Português',
  'ru-RU': 'Русский',
  'sv-SE': 'Svenska',
  'zh-CN': '中文',
};
