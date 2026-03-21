import React from 'react';
import { createRoot } from 'react-dom/client';
import { MantineProviderWrapper } from '@/app/providers';
import App from '@/app/App';
import './styles.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element not found: missing element with id="root"');
}

createRoot(rootElement).render(
  <MantineProviderWrapper>
    <App />
  </MantineProviderWrapper>
);
