// Builds the GitHub Pages site:
//   /<slug>/        one locked client build per industry (contains only that industry)
//   /<HUB_PATH>/    the full hub with every industry — unlisted, for Embark Digitals
//   /               a neutral page that lists nothing, so clients cannot browse other demos
// Usage: npm run build:pages   (output in dist-pages/)
import { execSync } from 'node:child_process';
import { copyFileSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';

export const CLIENT_SLUGS = {
  optometry: 'optometry',
  medical: 'medical-practice',
  automotive: 'automotive',
  tyres: 'tyre-fitment',
  mining: 'mining',
  construction: 'construction',
  realestate: 'real-estate',
  legal: 'law-firm',
  security: 'security',
  cleaning: 'cleaning',
};
// Unlisted, not secret: the repository is public. See docs/SHARING_LINKS.md.
export const HUB_PATH = 'hub-k7q3m9';

const OUT = 'dist-pages';
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

const build = (outDir, env = {}) =>
  execSync(`npx vite build --outDir ${outDir} --emptyOutDir --logLevel warn`, { stdio: 'inherit', env: { ...process.env, ...env } });

for (const [id, slug] of Object.entries(CLIENT_SLUGS)) {
  console.log(`→ ${slug}/ (${id} only)`);
  build(`${OUT}/${slug}`, { DEMO_INDUSTRY: id });
}
console.log(`→ ${HUB_PATH}/ (all industries)`);
build(`${OUT}/${HUB_PATH}`, { DEMO_INDUSTRY: '' });

copyFileSync('public/landing.html', `${OUT}/index.html`);
copyFileSync('public/landing.html', `${OUT}/404.html`);
writeFileSync(`${OUT}/.nojekyll`, '');
writeFileSync(`${OUT}/robots.txt`, 'User-agent: *\nDisallow: /\n');
console.log(`Done: ${OUT}/`);
