import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { INDUSTRIES } from '../../industries/registry';
import type { IndustryConfig } from '../types';
import { IcoArrow, IcoChevron } from '../components/Icons';
import CoverFlow from '../portal/CoverFlow';
import IndustryCard from '../portal/IndustryCard';
import { positionLabel } from '../portal/coverflow';
import { EMBARK_MARK, HERO_DESKTOP, HERO_INDUSTRY, HERO_PHONE } from '../portal/media';

/**
 * Owner hub homepage (`#/`). Approved concept ED-HOME-2026-11-20; design record:
 * docs/design/05_homepage_addendum_2026-11-20.md. Mainly for Embark Digitals — clients
 * receive a link straight to their own industry, which never shows this page.
 */
export default function Gallery() {
  useEffect(() => { document.title = 'Business Systems · Embark Digitals'; }, []);
  // Order follows each config's `priority`; no commercial ranking is implied.
  const list = [...INDUSTRIES].sort((a, b) => (a.priority ?? 99) - (b.priority ?? 99));
  const [active, setActive] = useState(0);
  const [modulesOpen, setModulesOpen] = useState(false);
  const current: IndustryConfig | undefined = list[active];
  const hero = list.find((c) => c.id === HERO_INDUSTRY);

  const demos = useRef<HTMLElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const how = useRef<HTMLElement>(null);
  const jump = (el: HTMLElement | null, focus?: HTMLElement | null) => {
    const calm = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    el?.scrollIntoView({ behavior: calm ? 'auto' : 'smooth', block: 'start' });
    (focus ?? el)?.focus({ preventScroll: true });
  };
  const toDemos = () => jump(demos.current, stage.current);
  const toHow = () => jump(how.current);

  return (
    <div className="hp">
      <header className="hp-top">
        <div className="hp-brand">
          <img src={EMBARK_MARK} alt="" width={174} height={192} />
          <span className="hp-wordmark"><b>Embark</b><small>Digitals</small></span>
          <span className="sr-only">Embark Digitals</span>
        </div>
        <nav className="hp-nav" aria-label="On this page">
          <button type="button" className="hp-nav-link is-home" aria-current="page" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>Home</button>
          <button type="button" className="hp-nav-link" onClick={toDemos}>Demos</button>
          <button type="button" className="hp-nav-link" onClick={toHow}>How it works</button>
        </nav>
        <span className="hp-pill"><i />Demonstrations · fictional data</span>
      </header>

      <main>
        <section className="hp-hero">
          <div className="hp-hero-copy">
            <p className="hp-eyebrow">Business integration systems</p>
            <h1>
              Run your business in one connected{' '}
              <span className="hp-underline">system.
                <svg viewBox="0 0 200 14" preserveAspectRatio="none" aria-hidden="true"><path d="M3 9.5C46 2.5 132 1.5 197 7" /></svg>
              </span>
            </h1>
            <p className="hp-lead">
              Explore interactive, industry-specific business system demos that show how appointments, jobs, people and records can work together.
            </p>
            <div className="hp-actions">
              <button type="button" className="hp-btn is-primary" onClick={toDemos} data-testid="hero-explore">Explore Demos <IcoArrow /></button>
              <button type="button" className="hp-btn" onClick={toHow} data-testid="hero-how">See How It Works <IcoChevron /></button>
            </div>
            <p className="hp-fineprint">Fictional businesses and sample data, running in your browser.</p>
          </div>

          {hero && (
            <figure className="hp-devices">
              <span className="hp-arc" aria-hidden="true" />
              <div className="hp-devices-stage">
              <div className="hp-laptop">
                <div className="hp-laptop-lid">
                  <img src={HERO_DESKTOP} width={1280} height={800} alt={`Dashboard of the ${hero.businessName} demonstration, captured from this site at laptop size`} />
                </div>
                <div className="hp-laptop-base" aria-hidden="true" />
              </div>
              <div className="hp-phone">
                <div className="hp-phone-screen">
                <img src={HERO_PHONE} width={390} height={844} alt={`The same ${hero.businessName} dashboard captured at phone size`} />
                </div>
              </div>
              </div>
              <figcaption className="hp-devices-note">
                <b>Demonstration</b>
                <span>
                  Real screens from the {hero.businessName} demo (fictional business).{' '}
                  <Link to={`/${hero.id}`} aria-label={`Try the ${hero.businessName} demonstration shown here`}>Try it <IcoArrow /></Link>
                </span>
              </figcaption>
            </figure>
          )}
        </section>

        <section className="hp-demos" ref={demos} id="industry-demonstrations" aria-labelledby="hp-demos-title">
          <div className="hp-section-head">
            <div>
              <p className="hp-eyebrow">Industry demonstrations</p>
              <h2 id="hp-demos-title">Explore by Industry</h2>
            </div>
            <p>Interactive business system demonstrations, each tailored to the workflows, records and operations of a specific industry.</p>
          </div>

          {/* Go straight to any industry without swiping: name buttons on wider screens, a dropdown on phones. */}
          <div className="hp-jump" role="group" aria-label="Jump to an industry" data-testid="jump-chips">
            {list.map((c, i) => (
              <button key={c.id} type="button" aria-pressed={i === active} onClick={() => setActive(i)} data-testid={`jump-${c.id}`}>{c.industry}</button>
            ))}
          </div>
          <label className="hp-jump-select">
            <span>Jump to an industry</span>
            <select value={current?.id ?? ''} data-testid="jump-select"
              onChange={(e) => { const i = list.findIndex((c) => c.id === e.target.value); if (i >= 0) { setActive(i); stage.current?.scrollIntoView({ behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' }); } }}>
              {list.map((c) => <option key={c.id} value={c.id}>{c.industry}</option>)}
            </select>
          </label>

          <CoverFlow
            items={list.map((c) => ({ id: c.id, label: c.industry, c }))}
            active={active}
            onActive={setActive}
            label="Industry demonstrations"
            noun="industry"
            stageRef={stage}
            render={(item, state) => <IndustryCard c={item.c} interactive={state.active} />}
          />

          {current && (
            <div className="hp-current">
              <p className="hp-current-line">
                <span className="hp-count" aria-hidden="true">{positionLabel(active, list.length)}</span>
                <b>{current.industry}</b>
                <span>{current.businessName} · fictional business</span>
                <button type="button" className="hp-modules-btn" aria-expanded={modulesOpen} aria-controls="hp-modules" onClick={() => setModulesOpen((v) => !v)} data-testid={`modules-open-${current.id}`}>
                  {current.modules.length} modules <IcoChevron />
                </button>
              </p>
              {modulesOpen && (
                <nav className="hp-modules" id="hp-modules" aria-label={`${current.industry} modules`}>
                  {current.modules.map((m) => (
                    <Link key={m.key} to={`/${current.id}/${m.key}`} title={m.description} data-testid={`module-${current.id}-${m.key}`}><m.icon /><span>{m.label}</span></Link>
                  ))}
                </nav>
              )}
            </div>
          )}
        </section>

        <section className="hp-how" ref={how} id="how-it-works" tabIndex={-1} aria-labelledby="hp-how-title">
          <div className="hp-how-head">
            <p className="hp-eyebrow">How it works</p>
            <h2 id="hp-how-title">What these demonstrations are — and are not</h2>
          </div>
          <div className="hp-how-body">
            <ol className="hp-steps">
              <li><b>Pick an industry.</b> Each demonstration is a fictional business with its own modules, rules and daily routine.</li>
              <li><b>Try it as different staff.</b> Switch between the fictional team members to see what each role can open and do, or follow the guided walkthrough on the dashboard.</li>
              <li><b>Change anything.</b> What you do is saved only on this device, and Settings puts the sample data back.</li>
            </ol>
            <p className="hp-caution">
              They run in the browser with invented people, records and figures, saved only on this device. There is no real sign-in, no server, and no
              medical, legal, safety or financial compliance. They show how a system could work so the real one can be scoped properly.
            </p>
          </div>
        </section>
      </main>

      <footer className="hp-foot">Built by Embark Digitals · All businesses, people and records shown are fictional</footer>
    </div>
  );
}
