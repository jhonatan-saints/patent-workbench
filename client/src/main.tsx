import React from 'react';
import ReactDOM from 'react-dom/client';
import { MantineProvider } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';
import { App } from './App';
import { mantineTheme, colorSchemeManager } from '@/theme/preset';
import { I18nProvider } from '@/i18n';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <I18nProvider>
      <MantineProvider
        theme={mantineTheme}
        colorSchemeManager={colorSchemeManager}
        defaultColorScheme="dark"
      >
        <Notifications position="bottom-right" />
        <App />
      </MantineProvider>
    </I18nProvider>
  </React.StrictMode>
);
