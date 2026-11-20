// Homepage imagery. Everything here is either the supplied Embark mark or a browser
// capture of this repository's own demos (scripts/capture-portal-media.mjs).
// Rights and capture dates: docs/design/04_asset_manifest.md.
import mark from './media/embark-mark.png';
import heroDesktop from './media/hero-optometry-desktop.png';
import heroPhone from './media/hero-optometry-phone.png';

const cards = import.meta.glob<string>('./media/cards/*.jpg', { eager: true, query: '?url', import: 'default' });

export const EMBARK_MARK = mark;
export const HERO_DESKTOP = heroDesktop;
export const HERO_PHONE = heroPhone;
/** The industry shown in the hero devices. */
export const HERO_INDUSTRY = 'optometry';

/** Capture of an industry's own dashboard, used on its card until a licensed photo is cleared. */
export function cardCapture(id: string): string | undefined {
  return cards[`./media/cards/${id}.jpg`];
}
