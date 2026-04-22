import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';

export default defineConfig({
  base: '/patent-workbench',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('/node_modules/react/') || id.includes('/node_modules/react-dom/') || id.includes('/node_modules/scheduler/')) {
            return 'vendor-react';
          }
          if (id.includes('/node_modules/@mantine/')) {
            return 'vendor-mantine';
          }
          if (id.includes('/node_modules/@tabler/')) {
            return 'vendor-icons';
          }
          if (id.includes('/node_modules/@xyflow/') || id.includes('/node_modules/@reactflow/')) {
            return 'vendor-xyflow';
          }
          if (id.includes('/node_modules/docx/') || id.includes('/node_modules/html-to-image/')) {
            return 'vendor-docx';
          }
        },
      },
    },
  },
  server: {
    host: '127.0.0.1',
    port: 3003,
    open: process.env.ELECTRON_DEV !== 'true' && '/patent-workbench',
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api/, ''),
      },
    },
  },
});
