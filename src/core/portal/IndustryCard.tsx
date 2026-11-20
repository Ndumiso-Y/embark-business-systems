import type { CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import type { IndustryConfig } from '../types';
import { IcoArrow, IcoBriefcase, IcoCap, IcoCar, IcoCheck, IcoEye, IcoHelmet, IcoHome, IcoPickaxe, IcoScale, IcoShield, IcoStethoscope, IcoStore, IcoWrench } from '../components/Icons';
import { cardLine } from './cardLines';
import { cardCapture } from './media';

const COVER_ICON: Record<string, typeof IcoEye> = {
  optometry: IcoEye, medical: IcoStethoscope, automotive: IcoWrench, tyres: IcoCar, mining: IcoPickaxe,
  construction: IcoHelmet, realestate: IcoHome, legal: IcoScale, security: IcoShield, cleaning: IcoCheck, education: IcoCap, mall: IcoStore,
};

/**
 * Industry card: picture on top, white information band below (title, one factual line,
 * arrow). Layout-neutral, so the homepage carousel and a future full-grid page can share it.
 *
 * Picture, in order of preference:
 *   1. `c.image` — a licensed cover photo (only GREEN rows of the asset manifest);
 *   2. a browser capture of the industry's own dashboard on its colour;
 *   3. the industry's icon on its colour.
 *
 * `interactive={false}` takes the link out of the tab order (carousel neighbours).
 */
export default function IndustryCard({ c, interactive = true }: { c: IndustryConfig; interactive?: boolean }) {
  const Icon = COVER_ICON[c.id] ?? c.modules[0]?.icon ?? IcoBriefcase;
  const capture = cardCapture(c.id);
  const style = { '--accent': c.theme.accent, '--accent-soft': c.theme.accentSoft, '--accent-text': c.theme.accentText } as CSSProperties;
  return (
    <article className="icard" style={style} data-testid={`industry-${c.id}`} id={`card-${c.id}`}>
      <div className="icard-media" aria-hidden="true">
        {c.image ? (
          <img className="icard-photo" src={c.image} alt="" loading="lazy" draggable={false} style={{ objectPosition: c.imageFocus ?? '50% 50%' }} />
        ) : capture ? (
          <>
            <span className="icard-glyph"><Icon /></span>
            <img className="icard-shot" src={capture} alt="" loading="lazy" draggable={false} />
          </>
        ) : (
          <span className="icard-glyph is-solo"><Icon /></span>
        )}
      </div>
      <div className="icard-info">
        <span className="icard-marker" aria-hidden="true" />
        <div className="icard-text">
          <h3>{c.industry}</h3>
          <p>{cardLine(c)}</p>
        </div>
        <Link className="icard-go" to={`/${c.id}`} aria-label={`Open ${c.industry.toLowerCase()} demo`} tabIndex={interactive ? undefined : -1} draggable={false}><IcoArrow /></Link>
      </div>
    </article>
  );
}
