/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages serves a project site from /<repo>/. `npm run build:preview`
// overrides this with a relative base for portable static previews.
const REPO_NAME = 'embark-industry-demos';

export default defineConfig({
  plugins: [react()],
  base: `/${REPO_NAME}/`,
  build: { outDir: 'dist', sourcemap: false, target: 'es2020' },
  test: { environment: 'node', include: ['tests/**/*.test.ts'] },
});
