import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import {readFileSync} from 'node:fs';
const appVersion=JSON.parse(readFileSync(new URL('./package.json',import.meta.url),'utf8')).version;
const buildId=/^[0-9a-f]{7,40}$/i.test(process.env.VERCEL_GIT_COMMIT_SHA??'')?process.env.VERCEL_GIT_COMMIT_SHA:'';

export default defineConfig({
  plugins: [react()],
  define: {__APP_VERSION__:JSON.stringify(appVersion),__BUILD_ID__:JSON.stringify(buildId)},
  build: { rollupOptions: { output: { manualChunks: id => id.includes('/node_modules/') ? 'vendor' : undefined } } },
  server: {
    watch: { ignored: ['**/.playwright/**', '**/.cache/**'] },
  },
});
