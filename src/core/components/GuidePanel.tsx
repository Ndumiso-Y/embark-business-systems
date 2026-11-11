import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBase, useData, useIndustry } from '../context';
import { safeStorage, useStore } from '../store';
import { IcoArrow, IcoCheck } from './Icons';

/**
 * "Try this" walkthrough at the top of the dashboard. Each step opens the right
 * module and, where a step needs a particular role, switches the simulated user.
 * Which steps were opened is remembered per browser as a convenience only.
 */
export default function GuidePanel() {
  const config = useIndustry();
  const data = useData();
  const base = useBase();
  const navigate = useNavigate();
  const signInAs = useStore((s) => s.signInAs);
  const key = `embark-guide-${config.id}`;
  const [state, setState] = useState<{ done: number[]; hidden: boolean }>(() => {
    try { return { done: [], hidden: false, ...JSON.parse(safeStorage.getItem(key) ?? '{}') }; } catch { return { done: [], hidden: false }; }
  });
  const steps = config.guide ?? [];
  if (!steps.length) return null;
  const save = (next: typeof state) => { setState(next); safeStorage.setItem(key, JSON.stringify(next)); };

  if (state.hidden) {
    return <button className="guide-reopen" onClick={() => save({ ...state, hidden: false })} data-testid="guide-reopen">Show the guided walkthrough ({state.done.length}/{steps.length} tried)</button>;
  }
  return (
    <section className="guide" aria-label="Guided walkthrough" data-testid="guide">
      <header>
        <div>
          <div className="guide-kicker">New here? Try these {steps.length} things</div>
          <p>Each step opens the right screen{steps.some((s) => s.as) ? ' and signs you in as the right fictional staff member' : ''}. Nothing is real, so click freely — Settings &amp; reset puts everything back.</p>
        </div>
        <button className="btn sm ghost" onClick={() => save({ ...state, hidden: true })}>Hide</button>
      </header>
      <ol>
        {steps.map((s, i) => {
          const who = s.as ? data.users.find((u) => u.id === s.as) : undefined;
          const done = state.done.includes(i);
          return (
            <li key={s.title} className={done ? 'done' : ''}>
              <span className="guide-num" aria-hidden="true">{done ? <IcoCheck /> : i + 1}</span>
              <div className="grow">
                <b>{s.title}</b>
                <small>{s.detail}</small>
                {who && <small className="guide-as">As {who.name} · {who.title}</small>}
              </div>
              <button className="btn sm" data-testid={`guide-step-${i + 1}`} onClick={() => {
                if (s.as && who) signInAs(config.id, s.as);
                save({ ...state, done: done ? state.done : [...state.done, i] });
                navigate(s.to ? `${base}/${s.to}` : base);
              }}>{done ? 'Open again' : 'Show me'} <IcoArrow /></button>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
