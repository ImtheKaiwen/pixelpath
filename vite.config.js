import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  root: 'frontend',
  build: {
    outDir: '../web',
    emptyOutDir: true,
    sourcemap: false,
    rollupOptions: {
      output: {
        entryFileNames: 'main.js',
        assetFileNames: asset => asset.names?.some(name => name.endsWith('.css'))
          ? 'style.css'
          : 'assets/[name]-[hash][extname]',
      },
    },
  },
});
