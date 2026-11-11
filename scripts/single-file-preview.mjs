// Builds one self-contained HTML file (CSS + JS inlined) from `npm run build:preview`
// output, for hosts that only accept a single page (e.g. a shared artifact preview).
// Usage: npm run build:preview && node scripts/single-file-preview.mjs [outFile]
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = 'dist-preview/assets';
const files = readdirSync(dir);
const css = files.filter((f) => f.endsWith('.css')).map((f) => readFileSync(join(dir, f), 'utf8')).join('\n');
const js = files.filter((f) => f.endsWith('.js')).map((f) => readFileSync(join(dir, f), 'utf8')).join('\n').replace(/<\/script/gi, '<\\/script');
const out = process.argv[2] ?? 'dist-preview/embark-industry-demos.html';

const html = `<title>Embark Industry Demos</title>
<meta name="robots" content="noindex">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap">
<style>${css}</style>
<div id="root"></div>
<script type="module">${js}</script>
`;
writeFileSync(out, html);
console.log(`${out}: ${(html.length / 1024).toFixed(0)} KB`);
