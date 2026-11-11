import { useRef, useState } from 'react';
import { useIndustry } from '../context';
import { useStore } from '../store';
import { brandedLink, dominantColor, isBranded, normaliseHex, themeFromHex, type Brand } from '../brand';
import { getIndustry } from '../../industries/registry';
import { Field, Notice, Panel, Tag } from './ui';

const MAX_LOGO_BYTES = 180_000;

/** Read an image file, shrink it for storage and sample its pixels for the brand colour. */
async function readLogo(file: File): Promise<{ logo: string; colour: string | null }> {
  const url: string = await new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error('Could not read the file.'));
    r.readAsDataURL(file);
  });
  const img: HTMLImageElement = await new Promise((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = () => reject(new Error('That file is not an image the browser can open. Use PNG, JPG, SVG or WebP.'));
    i.src = url;
  });
  const draw = (max: number) => {
    const scale = Math.min(1, max / Math.max(img.naturalWidth || 300, img.naturalHeight || 150));
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round((img.naturalWidth || 300) * scale));
    c.height = Math.max(1, Math.round((img.naturalHeight || 150) * scale));
    c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
    return c;
  };
  let logo = '';
  for (const max of [360, 260, 180, 120]) {
    logo = draw(max).toDataURL('image/png');
    if (logo.length <= MAX_LOGO_BYTES) break;
  }
  const small = draw(64);
  const colour = dominantColor(small.getContext('2d')!.getImageData(0, 0, small.width, small.height).data);
  return { logo, colour };
}

/** Settings panel: make the demo look like the client's own system. */
export default function BrandStudio() {
  const config = useIndustry();
  const base = getIndustry(config.id) ?? config;
  const brand = useStore((s) => s.brands[config.id]) ?? {};
  const setBrand = useStore((s) => s.setBrand);
  const toast = useStore((s) => s.toast);
  const file = useRef<HTMLInputElement>(null);
  const [error, setError] = useState('');
  const [logoColour, setLogoColour] = useState<string | null>(null);
  const update = (patch: Partial<Brand>) => setBrand(config.id, { ...brand, ...patch });
  const accent = normaliseHex(brand.accent) ?? base.theme.accent;
  const theme = themeFromHex(accent) ?? base.theme;
  const link = isBranded(brand) ? brandedLink(window.location.href, brand, config.id) : '';

  const onFile = async (f: File | undefined) => {
    setError('');
    if (!f) return;
    if (f.size > 4_000_000) { setError('That file is over 4 MB. Use a smaller logo.'); return; }
    try {
      const { logo, colour } = await readLogo(f);
      setLogoColour(colour);
      update({ logo, ...(colour ? { accent: colour } : {}) });
      toast(colour ? 'Logo added — colours taken from the logo' : 'Logo added — no clear colour found, choose one below');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not use that file.');
    }
  };
  const copy = async (text: string, what: string) => {
    try { await navigator.clipboard.writeText(text); toast(`${what} copied`); } catch { toast(`Select the text and copy it manually`, 'info'); }
  };

  return (
    <Panel title="Brand this demo for a client" meta="Add their logo and name — the whole workspace takes on their colours" right={isBranded(brand) ? <Tag tone="accent">Branded</Tag> : undefined}>
      <div className="brand-studio" data-testid="brand-studio">
        <div className="stack">
          <Field label="Company name" hint={`Replaces “${base.businessName}” everywhere in this demo.`}>
            <input id="brand-name" className="input" aria-label="Company name" placeholder={base.businessName} value={brand.name ?? ''} onChange={(e) => update({ name: e.target.value })} />
          </Field>
          <Field label="Logo" error={error || undefined} hint="PNG, JPG, SVG or WebP. It is resized and kept in this browser.">
            <div className="btns">
              <input id="brand-logo" ref={file} type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" aria-label="Logo file" data-testid="brand-logo-input" hidden onChange={(e) => { void onFile(e.target.files?.[0]); e.target.value = ''; }} />
              <button type="button" className="btn primary" onClick={() => file.current?.click()}>{brand.logo ? 'Replace logo' : 'Upload logo'}</button>
              {brand.logo && <button type="button" className="btn" onClick={() => { setLogoColour(null); update({ logo: undefined }); }}>Remove logo</button>}
            </div>
          </Field>
          <Field label="Brand colour" hint="Taken from the logo automatically. Adjust it if the wrong colour was picked. Very light colours are deepened so text stays readable.">
            <div className="brand-colour">
              <input id="brand-colour-picker" type="color" aria-label="Brand colour picker" value={accent} onChange={(e) => update({ accent: e.target.value })} />
              <input id="brand-colour-hex" className="input" style={{ maxWidth: 140 }} aria-label="Brand colour hex" placeholder="#1a73e8" defaultValue={brand.accent ?? ''} key={brand.accent ?? 'none'}
                onBlur={(e) => { const hex = normaliseHex(e.target.value); if (hex) update({ accent: hex }); else if (!e.target.value.trim()) update({ accent: undefined }); }} />
              {logoColour && logoColour !== normaliseHex(brand.accent) && <button type="button" className="btn sm" onClick={() => update({ accent: logoColour })}>Use logo colour</button>}
            </div>
          </Field>
          {isBranded(brand) && (
            <div className="btns">
              <button type="button" className="btn danger" data-testid="brand-remove" onClick={() => { setLogoColour(null); setBrand(config.id, null); toast('Branding removed'); }}>Remove branding</button>
            </div>
          )}
        </div>
        <div className="brand-preview" style={{ ['--accent' as string]: theme.accent }}>
          <div className="brand-preview-logo">
            {brand.logo ? <img src={brand.logo} alt="Logo preview" /> : <span className="muted-note">No logo yet — the initials “{config.monogram}” are shown instead</span>}
          </div>
          <div className="brand-swatches" aria-label="Derived colours">
            {[theme.accent, theme.accent2, theme.accentSoft, theme.accentLine, theme.accentTint, theme.accentText].map((c, i) => <span key={i} style={{ background: c }} title={c} />)}
          </div>
          <p className="muted-note">Colours apply instantly to the menu, buttons, charts and highlights. Status colours (green, amber, red) stay the same so warnings keep their meaning.</p>
          {link && (
            <>
              <Field label="Branded link (name and colour)">
                <textarea id="brand-link" className="textarea brand-link" readOnly aria-label="Branded link" value={link} onFocus={(e) => e.target.select()} />
              </Field>
              <div className="btns">
                <button type="button" className="btn sm" onClick={() => copy(link, 'Link')}>Copy link</button>
                <button type="button" className="btn sm" onClick={() => copy(JSON.stringify(brand, null, 2), 'Brand file')}>Copy brand file (with logo)</button>
              </div>
            </>
          )}
        </div>
      </div>
      <div style={{ height: 14 }} />
      <Notice tone="grey">
        Branding set here is saved in this browser, which is ideal for presenting on your own laptop. To send a client a link that already looks like theirs, use the branded link
        (name and colour only) or publish a brand file so the logo travels too — see docs/BRANDING.md. Only use a client’s logo with their permission.
      </Notice>
    </Panel>
  );
}
