import { Link } from 'react-router-dom';
import { useBase, useData } from '../../../core/context';
import { findRecord, records, str } from '../../../core/engine';
import { formatDate } from '../../../core/lib/dates';
import { Panel, Stat, Tag } from '../../../core/components/ui';
import { RegisterPage } from '../../../core/components/records';
import { DISCIPLINE_CATEGORIES, label } from '../data';
import { className, detentionList, enrolledLearners, fullName, isMerit, learnerPoints, todayStr } from '../helpers';

/** Discipline and merit register with the detention list and the points table. */
export default function Discipline() {
  const data = useData();
  const base = useBase();
  const today = todayStr();
  const all = records(data, 'discipline');
  const open = all.filter((r) => !isMerit(r) && r.status !== 'resolved');
  const serious = open.filter((r) => str(r, 'severity') === 'serious');
  const detentions = detentionList(data, today);
  const merits = all.filter(isMerit);
  const table = enrolledLearners(data).map((l) => ({ l, p: learnerPoints(data, l.id) })).filter((x) => x.p.records.length);
  const top = [...table].sort((a, b) => b.p.merits - a.p.merits).filter((x) => x.p.merits > 0).slice(0, 5);
  const concern = [...table].sort((a, b) => b.p.demerits - a.p.demerits).filter((x) => x.p.demerits > 0).slice(0, 5);

  return (
    <RegisterPage>
      <div className="stat-grid">
        <Stat label="Open incidents" value={open.length} tone={open.length ? 'red' : undefined} sub={`${open.filter((r) => r.status === 'logged').length} with the parent still to contact`} />
        <Stat label="Serious, awaiting the deputy" value={serious.length} tone={serious.length ? 'red' : undefined} sub="only the deputy or principal can resolve these" />
        <Stat label="Detentions to serve" value={detentions.length} sub={detentions[0] ? `next on ${formatDate(str(detentions[0], 'detentionDate'))}` : 'none booked'} />
        <Stat label="Merits logged" value={merits.length} tone="accent" sub={`${merits.reduce((n, r) => n + Math.abs(Number(r.values.points) || 0), 0)} merit points awarded`} />
      </div>
      <div className="grid-2-even">
        <Panel title="Detention list" meta="Incidents with a detention still to be served">
          {detentions.length ? (
            <ul className="list" data-testid="detention-list">
              {detentions.map((r) => {
                const l = findRecord(data, 'learners', str(r, 'learner'));
                return (
                  <li key={r.id} style={{ padding: '9px 0' }}>
                    <span className="time-chip">{str(r, 'detentionDate') ? formatDate(str(r, 'detentionDate')) : 'Date to set'}</span>
                    <div className="grow"><Link to={`${base}/discipline/${r.id}`}><b>{fullName(l)}</b></Link><small>{className(data, str(l, 'class'))} · {label(DISCIPLINE_CATEGORIES, str(r, 'category'))}</small></div>
                  </li>
                );
              })}
            </ul>
          ) : <p className="muted-note">No detentions are booked.</p>}
        </Panel>
        <Panel title="Points" meta="Merits add points; incidents take them away">
          <div className="field-label">Most merit points</div>
          <ul className="list" data-testid="points-table">
            {top.map(({ l, p }) => <li key={l.id} style={{ padding: '7px 0' }}><div className="grow"><b>{fullName(l)}</b><small>{className(data, str(l, 'class'))}</small></div><Tag tone="green">+{p.merits}</Tag></li>)}
          </ul>
          <div className="field-label" style={{ marginTop: 12 }}>Most demerit points</div>
          <ul className="list">
            {concern.map(({ l, p }) => <li key={l.id} style={{ padding: '7px 0' }}><div className="grow"><b>{fullName(l)}</b><small>{className(data, str(l, 'class'))}</small></div><Tag tone={p.demerits >= 5 ? 'red' : 'amber'}>−{p.demerits}</Tag></li>)}
          </ul>
        </Panel>
      </div>
    </RegisterPage>
  );
}
