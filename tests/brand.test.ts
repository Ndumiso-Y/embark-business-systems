import { describe, expect, it } from 'vitest';
import { brandedConfig, brandedLink, contrast, dominantColor, hexToHsl, initials, normaliseHex, parseUrlBrand, safeLogo, sanitiseBrand, themeFromHex } from '../src/core/brand';
import optometry from '../src/industries/optometry';

/** Build RGBA pixels from [r,g,b,a,count] runs. */
const px = (...runs: Array<[number, number, number, number, number]>) => runs.flatMap(([r, g, b, a, n]) => Array.from({ length: n }, () => [r, g, b, a]).flat());

describe('brand colours', () => {
  it('normalises hex input', () => {
    expect(normaliseHex('1A73E8')).toBe('#1a73e8');
    expect(normaliseHex('#abc')).toBe('#aabbcc');
    expect(normaliseHex('blue')).toBeNull();
    expect(normaliseHex('')).toBeNull();
  });

  it('derives a readable palette from any brand colour, keeping the hue', () => {
    for (const hex of ['#1a73e8', '#e11d48', '#ffd400', '#00e5ff', '#16a34a', '#7c3aed', '#f97316', '#111827', '#f8fafc', '#8b5e34']) {
      const t = themeFromHex(hex)!;
      expect(contrast(t.accentText, t.accentTint), `${hex} text on tint`).toBeGreaterThanOrEqual(4.5);
      expect(contrast('#ffffff', t.accent), `${hex} white on accent`).toBeGreaterThanOrEqual(4.5);
      expect(contrast(t.accentSoft, '#242924'), `${hex} soft on dark`).toBeGreaterThanOrEqual(4.5);
      const src = hexToHsl(hex);
      if (src.s > 0.2) expect(Math.abs(hexToHsl(t.accent).h - src.h)).toBeLessThan(8);
    }
    expect(themeFromHex('not-a-colour')).toBeNull();
  });

  it('picks the main brand colour from logo pixels', () => {
    // White background, mostly blue mark, a little red, black text.
    const hex = dominantColor(px([255, 255, 255, 255, 600], [26, 115, 232, 255, 300], [220, 38, 38, 255, 40], [10, 10, 10, 255, 120]))!;
    const { h } = hexToHsl(hex);
    expect(h).toBeGreaterThan(200);
    expect(h).toBeLessThan(230);
  });

  it('ignores transparent pixels and falls back to grey for monochrome logos', () => {
    expect(dominantColor(px([255, 0, 0, 0, 500], [255, 255, 255, 255, 100]))).toBeNull();
    const grey = dominantColor(px([255, 255, 255, 255, 300], [40, 40, 40, 255, 200]))!;
    expect(hexToHsl(grey).s).toBeLessThan(0.05);
  });
});

describe('applying a brand', () => {
  it('replaces the name, monogram, colours and logo but nothing else', () => {
    const logo = 'data:image/png;base64,iVBORw0KGgo=';
    const c = brandedConfig(optometry, { name: 'Acme Eye Care', accent: '#1a73e8', logo });
    expect(c.businessName).toBe('Acme Eye Care');
    expect(c.monogram).toBe('AE');
    expect(c.brandedFor).toBe('Acme Eye Care');
    expect(c.logo).toBe(logo);
    expect(c.theme.accent).not.toBe(optometry.theme.accent);
    expect(c.modules).toBe(optometry.modules);
    expect(brandedConfig(optometry, {})).toBe(optometry);
    expect(brandedConfig(optometry, { accent: 'nope' })).toBe(optometry);
  });

  it('makes sensible initials', () => {
    expect(initials('Acme Eye Care')).toBe('AE');
    expect(initials('Mokoena & Sons')).toBe('MS');
    expect(initials('Zenith')).toBe('ZE');
    expect(initials('  ')).toBe('');
  });

  it('accepts only safe logos and clean values', () => {
    expect(safeLogo('data:image/png;base64,AAAA')).not.toBeNull();
    expect(safeLogo('brands/acme.png')).toBe('brands/acme.png');
    expect(safeLogo('javascript:alert(1)')).toBeNull();
    expect(safeLogo('https://example.com/logo.png')).toBeNull();
    expect(safeLogo('../secret.png')).toBeNull();
    expect(safeLogo('data:text/html;base64,AAAA')).toBeNull();
    expect(sanitiseBrand({ name: '  Acme  ', accent: 'zzz', logo: 'javascript:x' })).toEqual({ name: 'Acme' });
    expect(sanitiseBrand({ accent: 'zzz' })).toBeNull();
    expect(sanitiseBrand('x')).toBeNull();
  });

  it('reads branding from a link and writes it back', () => {
    expect(parseUrlBrand('?name=Acme%20Eye%20Care&accent=1a73e8')).toEqual({ brand: { name: 'Acme Eye Care', accent: '#1a73e8' } });
    expect(parseUrlBrand('?brand=Acme-Optics')).toEqual({ key: 'acme-optics' });
    expect(parseUrlBrand('?brand=../../etc')).toEqual({});
    expect(parseUrlBrand('')).toEqual({});
    const link = brandedLink('https://example.com/demo/optometry/?old=1#/optometry/settings', { name: 'Acme Eye Care', accent: '#1A73E8', logo: 'data:image/png;base64,AAAA' }, 'optometry');
    expect(link).toBe('https://example.com/demo/optometry/?name=Acme+Eye+Care&accent=1a73e8#/optometry');
    expect(parseUrlBrand(new URL(link).search).brand).toEqual({ name: 'Acme Eye Care', accent: '#1a73e8' });
  });
});
