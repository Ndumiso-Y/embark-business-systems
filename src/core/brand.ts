// Client branding for presentations: a company name, a logo and one brand colour
// turn any industry demo into "their" system. Pure functions here (unit tested in
// tests/brand.test.ts); the UI lives in pages/SettingsPage.tsx.
import type { IndustryConfig, Theme } from './types';

export type Brand = {
  /** Client company name shown in place of the fictional business name. */
  name?: string;
  /** Logo as a data: URL (PNG) or a path relative to the site. */
  logo?: string;
  /** Brand colour as #rrggbb. The whole accent palette is derived from it. */
  accent?: string;
};

/* ---------------- Colour maths ---------------- */

export function normaliseHex(input: string | undefined | null): string | null {
  if (!input) return null;
  const m = input.trim().replace(/^#/, '').toLowerCase();
  if (/^[0-9a-f]{3}$/.test(m)) return `#${m.split('').map((c) => c + c).join('')}`;
  return /^[0-9a-f]{6}$/.test(m) ? `#${m}` : null;
}

type HSL = { h: number; s: number; l: number };

export function hexToHsl(hex: string): HSL {
  const n = parseInt(hex.slice(1), 16);
  return rgbToHsl((n >> 16) & 255, (n >> 8) & 255, n & 255);
}

export function rgbToHsl(r8: number, g8: number, b8: number): HSL {
  const r = r8 / 255, g = g8 / 255, b = b8 / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: h * 60, s, l };
}

export function hslToHex({ h, s, l }: HSL): string {
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const c = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(255 * c).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const lin = (v: number) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
}

/** WCAG contrast ratio between two colours (1–21). */
export function contrast(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/**
 * Derive the six accent tokens from one brand colour. The hue is kept; lightness
 * and saturation are adjusted so text stays readable (accentText on accentTint and
 * white-on-accent are both at least 4.5:1), which means very light or neon brand
 * colours are shown in a deeper shade of the same hue.
 */
export function themeFromHex(input: string): Theme | null {
  const hex = normaliseHex(input);
  if (!hex) return null;
  const { h, s, l } = hexToHsl(hex);
  const sat = Math.min(s, 0.78);
  let accentL = clamp(l, 0.26, 0.46);
  let accent = hslToHex({ h, s: sat, l: accentL });
  while (contrast(accent, '#ffffff') < 4.5 && accentL > 0.12) { accentL -= 0.02; accent = hslToHex({ h, s: sat, l: accentL }); }
  const accentTint = hslToHex({ h, s: Math.min(sat, 0.5), l: 0.95 });
  let textL = Math.min(accentL - 0.06, 0.3);
  let accentText = hslToHex({ h, s: sat, l: textL });
  while (contrast(accentText, accentTint) < 4.5 && textL > 0.08) { textL -= 0.02; accentText = hslToHex({ h, s: sat, l: textL }); }
  return {
    accent,
    accent2: hslToHex({ h, s: sat, l: Math.min(accentL + 0.06, 0.52) }),
    accentSoft: hslToHex({ h, s: Math.min(sat, 0.6), l: 0.78 }),
    accentTint,
    accentLine: hslToHex({ h, s: Math.min(sat, 0.45), l: 0.87 }),
    accentText,
  };
}

/**
 * Pick the brand colour from logo pixels (RGBA bytes, e.g. canvas getImageData).
 * Ignores transparent, near-white and near-black pixels; prefers the most
 * widespread saturated hue. Falls back to the average dark grey for monochrome
 * logos, or null when nothing usable is found.
 */
export function dominantColor(pixels: ArrayLike<number>): string | null {
  const BUCKETS = 24;
  const sum = Array.from({ length: BUCKETS }, () => ({ w: 0, r: 0, g: 0, b: 0 }));
  const grey = { n: 0, r: 0, g: 0, b: 0 };
  for (let i = 0; i + 3 < pixels.length; i += 4) {
    const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2], a = pixels[i + 3];
    if (a < 128) continue;
    const { h, s, l } = rgbToHsl(r, g, b);
    if (l > 0.93) continue;
    if (s < 0.18 || l < 0.1) { if (l < 0.6) { grey.n++; grey.r += r; grey.g += g; grey.b += b; } continue; }
    const w = s * (1 - Math.abs(l - 0.5));
    const k = sum[Math.floor(h / (360 / BUCKETS)) % BUCKETS];
    k.w += w; k.r += r * w; k.g += g * w; k.b += b * w;
  }
  const best = sum.reduce((p, c) => (c.w > p.w ? c : p));
  const hex = (r: number, g: number, b: number) => `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;
  if (best.w > 0) return hex(best.r / best.w, best.g / best.w, best.b / best.w);
  if (grey.n > 0) return hex(grey.r / grey.n, grey.g / grey.n, grey.b / grey.n);
  return null;
}

/* ---------------- Applying a brand ---------------- */

export function initials(name: string): string {
  const words = name.replace(/[^\p{L}\p{N}\s&]/gu, ' ').split(/\s+/).filter((w) => w && w !== '&');
  if (!words.length) return '';
  return (words.length === 1 ? words[0].slice(0, 2) : words[0][0] + words[1][0]).toUpperCase();
}

export function isBranded(brand: Brand | undefined | null): brand is Brand {
  return !!brand && !!(brand.name?.trim() || brand.logo || normaliseHex(brand.accent));
}

/** The industry config as the client should see it: their name, logo and colours. */
export function brandedConfig(config: IndustryConfig, brand: Brand | undefined | null): IndustryConfig {
  if (!isBranded(brand)) return config;
  const name = brand.name?.trim();
  return {
    ...config,
    businessName: name || config.businessName,
    monogram: name ? initials(name) || config.monogram : config.monogram,
    theme: (brand.accent && themeFromHex(brand.accent)) || config.theme,
    logo: safeLogo(brand.logo) ?? undefined,
    brandedFor: name || undefined,
  };
}

/** Only image data URLs or same-site relative paths are accepted as logos. */
export function safeLogo(logo: string | undefined | null): string | null {
  if (!logo) return null;
  if (/^data:image\/(png|jpeg|webp|gif|svg\+xml);base64,[a-z0-9+/=]+$/i.test(logo)) return logo;
  if (/^[a-z0-9][a-z0-9._/-]*\.(png|jpe?g|webp|svg|gif)$/i.test(logo) && !logo.includes('..')) return logo;
  return null;
}

export function sanitiseBrand(raw: unknown): Brand | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const brand: Brand = {};
  if (typeof o.name === 'string' && o.name.trim()) brand.name = o.name.trim().slice(0, 60);
  const accent = typeof o.accent === 'string' ? normaliseHex(o.accent) : null;
  if (accent) brand.accent = accent;
  const logo = typeof o.logo === 'string' ? safeLogo(o.logo) : null;
  if (logo) brand.logo = logo;
  return isBranded(brand) ? brand : null;
}

/**
 * Branding carried by the link: `?name=Acme%20Eye%20Care&accent=1a73e8` (no logo),
 * or `?brand=acme` which loads `brands/acme.json` published with the site.
 */
export function parseUrlBrand(search: string): { key?: string; brand?: Brand } {
  const q = new URLSearchParams(search);
  const key = (q.get('brand') ?? '').toLowerCase();
  const out: { key?: string; brand?: Brand } = {};
  if (/^[a-z0-9][a-z0-9-]{0,40}$/.test(key)) out.key = key;
  const brand = sanitiseBrand({ name: q.get('name') ?? undefined, accent: q.get('accent') ?? undefined });
  if (brand) out.brand = brand;
  return out;
}

/** Link that carries the name and colour (logos are too large for a link). */
export function brandedLink(href: string, brand: Brand, industryId: string): string {
  const u = new URL(href);
  const q = new URLSearchParams();
  if (brand.name?.trim()) q.set('name', brand.name.trim());
  const accent = normaliseHex(brand.accent);
  if (accent) q.set('accent', accent.slice(1));
  u.search = q.toString();
  u.hash = `#/${industryId}`;
  return u.toString();
}
