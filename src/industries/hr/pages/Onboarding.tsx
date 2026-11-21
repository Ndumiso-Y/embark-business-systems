import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useActions, useBase, useData, useIndustry, useUser } from '../../../core/context';
import { records, str } from '../../../core/engine';
import { addDays, daysBetween, formatDate } from '../../../core/lib/dates';
import { Empty, PageHeader, Panel, Stat, Tag } from '../../../core/components/ui';
import { RecordTable } from '../../../core/components/records';
import { RecordFormModal } from '../../../core/components/fields';
import { IcoPlus } from '../../../core/components/Icons';
import { jobLabel, onboardingDone, onboardingMissing, requiredOnboarding, siteShort, todayStr } from '../helpers';
import { Progress } from './shared';

/** New hires and their checklists, plus the people who started recently. */
export default function Onboarding() {
  const config = useIndustry();
  const data = useData();
  const act = useActions();
  const base = useBase();
  const navigate = useNavigate();
  const { can } = useUser();
  const [creating, setCreating] = useState(false);
  const today = todayStr();
  const def = act.def('employees');
  const hires = records(data, 'employees').filter((e) => e.status === 'onboarding').sort((a, b) => str(a, 'startDate').localeCompare(str(b, 'startDate')));
  const recent = records(data, 'employees').filter((e) => e.status !== 'onboarding' && str(e, 'startDate') >= addDays(today, -120) && str(e, 'startDate') <= today)
    .sort((a, b) => str(b, 'startDate').localeCompare(str(a, 'startDate')));
  const open = hires.reduce((n, e) => n + onboardingMissing(e).length, 0);
  const dueSoon = hires.filter((e) => daysBetween(today, str(e, 'startDate')) <= 3);

  return (
    <>
      <PageHeader kicker={`${config.businessName} / People`} title="Onboarding" subtitle="Every new hire gets the checklist their job needs: warehouse and fleet staff need PPE, drivers need their licence and PrDP checked. Nobody can start until the required items are done."
        actions={can('employees.manage') ? <button className="btn primary" onClick={() => setCreating(true)} data-testid="new-record"><IcoPlus /> New hire</button> : undefined} />
      <div className="stat-grid">
        <Stat label="New hires in onboarding" value={hires.length} sub={`${dueSoon.length} start within three days`} />
        <Stat label="Checklist items open" value={open} tone={open ? 'red' : undefined} sub="required items not yet ticked" />
        <Stat label="Started in the last 120 days" value={recent.length} sub={`${recent.filter((e) => e.status === 'probation').length} still on probation`} />
        <Stat label="Ready to start" value={hires.filter((e) => !onboardingMissing(e).length).length} tone="accent" sub="all required items done" />
      </div>
      {hires.length ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(270px, 1fr))', gap: 14, marginBottom: 18 }} data-testid="onboarding-cards">
          {hires.map((e) => {
            const req = requiredOnboarding(e);
            const done = onboardingDone(e);
            const missing = onboardingMissing(e);
            const n = daysBetween(today, str(e, 'startDate'));
            return (
              <article key={e.id} className="board-card" data-testid={`hire-${e.id}`}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
                  <div style={{ minWidth: 0 }}>
                    <Link to={`${base}/onboarding/${e.id}`}><strong>{def.title(e, data)}</strong></Link>
                    <small style={{ display: 'block' }}>{jobLabel(e)} · {siteShort(str(e, 'site'))}</small>
                  </div>
                  <Tag tone={n < 0 ? 'red' : n <= 3 ? 'amber' : 'dark'}>{n < 0 ? `Start date passed` : n === 0 ? 'Starts today' : `Starts in ${n} days`}</Tag>
                </div>
                <small style={{ display: 'block', marginTop: 8 }}>{req.filter((i) => done.has(i.key)).length} of {req.length} required items done · start {formatDate(str(e, 'startDate'))}</small>
                <Progress done={req.filter((i) => done.has(i.key)).length} total={req.length} />
                {missing.length ? <ul className="problem-list muted-note" style={{ margin: '8px 0 0', paddingLeft: 18 }}>{missing.map((i) => <li key={i.key}>{i.label}</li>)}</ul>
                  : <p className="muted-note" style={{ marginTop: 8 }}>Ready to start.</p>}
                <Link className="link-btn" style={{ marginTop: 6, display: 'inline-block' }} to={`${base}/onboarding/${e.id}`}>Open checklist →</Link>
              </article>
            );
          })}
        </div>
      ) : <Panel><Empty title="No one is in onboarding" body="Hiring an applicant, or “New hire”, adds them here with their checklist." /></Panel>}
      <Panel title="Started recently" meta="Probation runs for three months (company policy in this demo)">
        <RecordTable def={def} rows={recent} moduleKey="onboarding" />
      </Panel>
      {creating && (
        <RecordFormModal def={def} open title="New hire" initial={def.createDefaults?.(today, data)} onClose={() => setCreating(false)}
          onSave={(v) => {
            const r = act.create('employees', v, 'onboarding', 'New hire added — onboarding checklist opened');
            act.toast(`${r.ref} added to onboarding`);
            setCreating(false);
            navigate(`${base}/onboarding/${r.id}`);
          }} />
      )}
    </>
  );
}
