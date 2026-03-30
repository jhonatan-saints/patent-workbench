/**
 * Central theme preset.
 *
 * - Mantine theme config (fonts, colors, component overrides)
 * - Color tokens for dark and light schemes
 * - localStorageColorSchemeManager so the preference survives page reloads
 *
 * CSS custom properties (--bg, --accent, etc.) are defined in styles.css and
 * switch automatically via [data-mantine-color-scheme] selectors that Mantine
 * sets on the root element.
 */

import { createTheme, localStorageColorSchemeManager } from '@mantine/core';

const customBlue = [
  '#edf5ff', // 50
  '#d9ebff', // 100
  '#aad5ff', // 200
  '#60b5ff', // 300
  '#0a91ff', // 400 
  '#0073d0', // 500
  '#005fb8', // 600
  '#004890', // 700
  '#003d77', // 800
  '#043262', // 900
] as const;

export const mantineTheme = createTheme({
  fontFamily: "'IBM Plex Sans', 'Helvetica Neue', sans-serif",
  fontFamilyMonospace: "'IBM Plex Mono', 'Fira Code', monospace",
  headings: {
    fontFamily: "'IBM Plex Sans Condensed', sans-serif",
  },
  colors: { 'custom-blue': customBlue },
  primaryColor: 'custom-blue',
  primaryShade: { light: 6, dark: 4 },
  defaultRadius: 'sm',
});

// Persists dark/light preference in localStorage across sessions.
export const colorSchemeManager = localStorageColorSchemeManager({
  key: 'patent-workbench-color-scheme',
});
