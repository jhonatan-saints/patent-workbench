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

const mitelBlue: [string, string, string, string, string, string, string, string, string, string] =
  [
    '#edf5ff', // 0 — 50
    '#d9ebff', // 1 — 100
    '#aad5ff', // 2 — 200
    '#60b5ff', // 3 — 300
    '#0a91ff', // 4 — 400 
    '#0073d0', // 5 — 500
    '#005fb8', // 6 — 600
    '#004890', // 7 — 700
    '#003d77', // 8 — 800
    '#043262', // 9 — 900
  ];

export const mantineTheme = createTheme({
  fontFamily: "'IBM Plex Sans', 'Helvetica Neue', sans-serif",
  fontFamilyMonospace: "'IBM Plex Mono', 'Fira Code', monospace",
  headings: {
    fontFamily: "'IBM Plex Sans Condensed', sans-serif",
  },
  colors: { 'mitel-blue': mitelBlue },
  primaryColor: 'mitel-blue',
  primaryShade: { light: 6, dark: 4 },
  defaultRadius: 'sm',
});

// Persists dark/light preference in localStorage across sessions.
export const colorSchemeManager = localStorageColorSchemeManager({
  key: 'patent-workbench-color-scheme',
});
