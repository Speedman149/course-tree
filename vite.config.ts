import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: { rollupOptions: { output: { manualChunks: id => id.includes('/node_modules/') ? 'vendor' : undefined } } },
  server: {
    watch: { ignored: ['**/.playwright/**', '**/.cache/**'] },
  },
});
