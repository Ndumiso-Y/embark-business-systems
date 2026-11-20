/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { INDUSTRY_IDS } from './src/industries/ids';

// Relative base: with hash routing the same build works at any path — a GitHub
// Pages folder, a custom domain root, or a single-file preview.

/**
 * Generates `virtual:industries`. With DEMO_INDUSTRY=<id> only that industry is
 * imported, so a client build contains no code or data for the other demos.
 */
function industries(): Plugin {
  const only = process.env.DEMO_INDUSTRY || '';
  if (only && !(INDUSTRY_IDS as readonly string[]).includes(only)) throw new Error(`Unknown DEMO_INDUSTRY "${only}"`);
  const ids = only ? [only] : [...INDUSTRY_IDS];
  const ID = '\0virtual:industries';
  const HUB = '\0virtual:hub';
  return {
    name: 'embark-industries',
    resolveId: (id) => (id === 'virtual:industries' ? ID : id === 'virtual:hub' ? HUB : null),
    load: (id) => {
      if (id === ID) return `${ids.map((x, i) => `import i${i} from '/src/industries/${x}/index.ts';`).join('\n')}
export const INDUSTRIES = [${ids.map((_, i) => `i${i}`).join(', ')}];
export const LOCKED_INDUSTRY = ${only ? JSON.stringify(only) : 'null'};`;
      // The owner homepage (and its pictures of every demo) is left out of client builds entirely.
      if (id === HUB) return only ? 'export default null;' : `export { default } from '/src/core/pages/Gallery.tsx';`;
      return null;
    },
  };
}

export default defineConfig({
  plugins: [react(), industries()],
  base: './',
  // PREVIEW_INLINE=1 (npm run build:preview) inlines images so the single-file preview is self-contained.
  build: { outDir: 'dist', sourcemap: false, target: 'es2020', ...(process.env.PREVIEW_INLINE ? { assetsInlineLimit: 100_000_000 } : {}) },
  test: { environment: 'node', include: ['tests/**/*.test.ts'] },
});
