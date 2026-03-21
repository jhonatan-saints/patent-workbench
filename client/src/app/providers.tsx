import React from 'react';
import { MantineProvider, createTheme } from '@mantine/core';
import type { MantineThemeOverride } from '@mantine/core';

export const MantineProviderWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const themeOverride: MantineThemeOverride = {};

  const theme = createTheme(themeOverride);

  return (
    <MantineProvider theme={theme} defaultColorScheme="light">
      {children}
    </MantineProvider>
  );
};
