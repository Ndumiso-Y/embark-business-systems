/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Relative base: with hash routing the same build works at any path — a GitHub
// Pages project site (/<repo>/), a custom domain root, or a single-file preview —
// so renaming the repository needs no code change.

export default defineConfig({
  plugins: [react()],
  base: './',
  build: { outDir: 'dist', sourcemap: false, target: 'es2020' },
  test: { environment: 'node', include: ['tests/**/*.test.ts'] },
});
