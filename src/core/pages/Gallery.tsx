import { useEffect, useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { INDUSTRIES } from '../../industries/registry';
import { FAMILIES } from '../../industries/ids';
import type { IndustryConfig } from '../types';
import { IcoArrow, IcoBriefcase, IcoCar, IcoCheck, IcoEye, IcoHelmet, IcoHome, IcoPickaxe, IcoScale, IcoShield, IcoStethoscope, IcoWrench, IcoX } from '../components/Icons';

/** Stand-in artwork per industry, used only until a licensed cover photo is supplied. */
const COVER_ICON: Record<string, typeof IcoEye> = {
  optometry: IcoEye, medical: IcoStethoscope, automotive: IcoWrench, tyres: IcoCar, mining: IcoPickaxe,
  construction: IcoHelmet, realestate: IcoHome, legal: IcoScale, security: IcoShield, cleaning: IcoCheck,
};

/**
 * Portal: one photo card per industry (design lock: docs/design/02_design_lock.md).
 * Mainly for Embark Digitals — clients receive a link straight to their own industry.
 */
export default function Gallery() {
  useEffect(() => { document.title = 'Business Systems · Embark Digitals'; }, []);
  const list = [...INDUSTRIES].sort((a, b) => (a.priority ?? 99) - (b.priority ?? 99));
  const families = FAMILIES.filter((f) => f.ids.some((id) => list.some((c) => c.id === id)));
  const familyOf = (id: string) => families.find((f) => f.ids.includes(id));
  const [family, setFamily] = useState('all');
  const shown = family === 'all' ? list : list.filter((c) => familyOf(c.id)?.name === family);

  return (
    <div className="portal">
      <header className="portal-top">
        <div className="portal-brand"><span className="portal-mark" aria-hidden="true">ED</span><div><b>Embark Digitals</b><small>Business systems</small></div></div>
        <span className="portal-pill"><i />Demonstrations · fictional data</span>
      </header>

      <section className="portal-hero">
        <p className="portal-kicker">{list.length} industries · one foundation</p>
        <h1>Choose an industry to explore</h1>
        <p className="portal-sub">Each one is a working demonstration built around how that kind of business actually runs — its own modules, rules and daily routine.</p>
        <div className="portal-filter" role="group" aria-label="Filter by type of business">
          <button type="button" aria-pressed={family === 'all'} onClick={() => setFamily('all')}>All <span>{list.length}</span></button>
          {families.map((f) => (
            <button key={f.name} type="button" aria-pressed={family === f.name} onClick={() => setFamily(f.name)}>{f.name} <span>{f.ids.filter((id) => list.some((c) => c.id === id)).length}</span></button>
          ))}
        </div>
      </section>

      <div className="portal-grid">
        {shown.map((c) => <IndustryCard key={c.id} c={c} family={familyOf(c.id)?.name} />)}
      </div>

      <section className="portal-note">
        <b>What these demonstrations are — and are not</b>
        <p>
          They run in the browser with invented people, records and figures, saved only on this device. There is no real sign-in, no server, and no
          medical, legal, safety or financial compliance. They show how a system could work so the real one can be scoped properly.
        </p>
      </section>
      <footer className="portal-foot">Built by Embark Digitals · All businesses, people and records shown are fictional</footer>
    </div>
  );
}

function IndustryCard({ c, family }: { c: IndustryConfig; family?: string }) {
  const [open, setOpen] = useState(false);
  const Icon = COVER_ICON[c.id] ?? c.modules[0]?.icon ?? IcoBriefcase;
  const style = { '--accent': c.theme.accent, '--accent-soft': c.theme.accentSoft, '--accent-text': c.theme.accentText } as CSSProperties;
  return (
    <article className={`pcard ${open ? 'is-open' : ''}`} style={style} data-testid={`industry-${c.id}`} id={`card-${c.id}`}>
      <div className="pcard-media" aria-hidden="true">
        {c.image
          ? <img src={c.image} alt="" loading="lazy" style={{ objectPosition: c.imageFocus ?? '50% 50%' }} />
          : <div className="pcard-art"><Icon /></div>}
      </div>
      <div className="pcard-shade" aria-hidden="true" />
      <div className="pcard-body">
        <div className="pcard-top">
          <span className="pcard-mono">{c.monogram}</span>
          {c.priority === 1 && <span className="pcard-badge">Most complete</span>}
        </div>
        <h2>{c.industry}</h2>
        <p className="pcard-name">{c.businessName}</p>
        <p className="pcard-desc">{c.summary}</p>
        <div className="pcard-tags">
          {family && <span>{family}</span>}
          <button type="button" className="pcard-tag-btn" aria-expanded={open} aria-controls={`modules-${c.id}`} onClick={() => setOpen(true)} data-testid={`modules-open-${c.id}`}>{c.modules.length} modules</button>
        </div>
        <Link className="pcard-btn" to={`/${c.id}`} aria-label={`Open ${c.industry.toLowerCase()} demo`}>Open demo <IcoArrow /></Link>
      </div>
      {open && (
        <div className="pcard-modules" id={`modules-${c.id}`}>
          <div className="pcard-modules-head">
            <div><small>{c.industry}</small><b>Go straight to a module</b></div>
            <button type="button" className="pcard-close" aria-label={`Close ${c.industry} modules`} onClick={() => setOpen(false)}><IcoX /></button>
          </div>
          <nav aria-label={`${c.industry} modules`}>
            {c.modules.map((m) => (
              <Link key={m.key} to={`/${c.id}/${m.key}`} title={m.description} data-testid={`module-${c.id}-${m.key}`}><m.icon /><span>{m.label}</span></Link>
            ))}
          </nav>
          <Link className="pcard-btn" to={`/${c.id}`}>Open dashboard <IcoArrow /></Link>
        </div>
      )}
    </article>
  );
}
