import type { CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { INDUSTRIES } from '../../industries/registry';
import { IcoArrow } from '../components/Icons';

/** Landing page: one card per industry configuration. */
export default function Gallery() {
  const list = [...INDUSTRIES].sort((a, b) => (a.priority ?? 9) - (b.priority ?? 9));
  return (
    <div className="gallery">
      <header className="gallery-head">
        <div className="gallery-brand"><span className="avatar">ED</span><div><b>Embark Digitals</b><small>Industry management demos</small></div></div>
        <span className="demo-pill"><span className="status-dot" />Demonstration · fictional data</span>
      </header>
      <section className="gallery-intro">
        <div className="page-kicker">One foundation · five industries</div>
        <h1 className="page-title">Business systems shaped around how each industry works</h1>
        <p className="subtitle">
          Each demo runs on the same reusable foundation — navigation, dashboards, simulated users and permissions, registers, workflows and history —
          configured with modules that matter to that industry. Open one, switch between fictional staff in the top bar, and work through real-looking tasks.
        </p>
      </section>
      <nav className="gallery-jump" aria-label="Jump to an industry">
        {list.map((c) => (
          <a key={c.id} href={`#/`} onClick={(e) => { e.preventDefault(); document.getElementById(`card-${c.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}
            style={{ '--accent': c.theme.accent } as CSSProperties}><i />{c.industry}</a>
        ))}
      </nav>
      <div className="gallery-grid">
        {list.map((c, i) => (
          <article key={c.id} id={`card-${c.id}`} className={`gallery-card ${i === 0 ? 'featured' : ''}`} style={{ '--accent': c.theme.accent, '--accent-tint': c.theme.accentTint, '--accent-text': c.theme.accentText, '--accent-line': c.theme.accentLine } as CSSProperties} data-testid={`industry-${c.id}`}>
            <div className="gallery-card-top">
              <span className="gallery-mono">{c.monogram}</span>
              <div>
                <div className="gallery-industry">{c.industry}{i === 0 && <span className="tag accent" style={{ marginLeft: 8 }}>Most complete</span>}</div>
                <h2>{c.businessName}</h2>
              </div>
            </div>
            <p>{c.summary}</p>
            <ul className="gallery-highlights">{c.highlights.map((h) => <li key={h}>{h}</li>)}</ul>
            <div className="gallery-modules-head">{c.modules.length} modules · open any one directly</div>
            <nav className="gallery-modules" aria-label={`${c.industry} modules`}>
              {c.modules.map((m) => (
                <Link key={m.key} to={`/${c.id}/${m.key}`} title={m.description} data-testid={`module-${c.id}-${m.key}`}>
                  <m.icon /><span>{m.label}</span>
                </Link>
              ))}
            </nav>
            <Link className="btn primary" to={`/${c.id}`}>Open {c.industry.toLowerCase()} dashboard <IcoArrow /></Link>
          </article>
        ))}
      </div>
      <section className="gallery-boundary">
        <b>What these demos are — and are not</b>
        <p>
          Browser-only demonstrations with invented people, records and figures. Data is saved only in this browser. There is no real sign-in, no server-side
          access control, no backend, and no medical, legal, safety or financial compliance. They exist to show how a system could work, so the real one can be scoped properly.
        </p>
      </section>
      <div className="footer-note" style={{ textAlign: 'center' }}>Built by Embark Digitals · All businesses, people and records shown are fictional</div>
    </div>
  );
}
