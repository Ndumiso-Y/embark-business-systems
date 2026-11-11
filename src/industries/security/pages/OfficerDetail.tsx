import { Link, useParams } from 'react-router-dom';
import type { DemoRecord } from '../../../core/types';
import { useActions, useBase, useData, useUser } from '../../../core/context';
import { records, str } from '../../../core/engine';
import { daysBetween, formatDate } from '../../../core/lib/dates';
import { Empty, Notice, Panel, StatusTag, Tag } from '../../../core/components/ui';
import { RecordDetail } from '../../../core/components/records';
import { SHIFT_SHORT } from '../data';
import { currentSlot, deployability, equipmentLabel, inductions, issuedTo, kindOf, notReturned, officerExpiries, rec, shiftTitle, slotKey } from '../helpers';
import { Check } from './shared';
import { useClock } from './format';

export default function OfficerDetail() {
  const { id } = useParams();
  const data = useData();
  const o = rec(data, 'officers', id);
  return (
    <RecordDetail aside={o ? <Aside officer={o} /> : undefined}>
      {o && <Compliance officer={o} />}
    </RecordDetail>
  );
}

/** Training and medical dates are "due" dates; registration and competency "expire". */
const dated = (key: string) => key === 'refresherDue' || key === 'medicalDue';

function Compliance({ officer: o }: { officer: DemoRecord }) {
  const data = useData();
  const base = useBase();
  const act = useActions();
  const { hasModule } = useUser();
  const { today } = useClock();
  const dep = deployability(o, today);
  const rosterDef = act.def('roster');
  const mine = records(data, 'roster')
    .filter((r) => str(r, 'officer') === o.id || str(r, 'reliefOfficer') === o.id)
    .map((r) => ({ r, key: slotKey(str(r, 'date'), kindOf(data, r)) }))
    .sort((a, b) => a.key.localeCompare(b.key));
  const cur = currentSlot(today);
  const now = slotKey(cur.date, cur.kind);
  const upcoming = mine.filter((x) => x.key >= now || x.r.status === 'onduty').slice(0, 5);
  const past = mine.filter((x) => x.key < now && x.r.status !== 'onduty').slice(-5).reverse();
  const row = ({ r }: { r: DemoRecord }) => (
    <li key={r.id}>
      <span className="time-chip">{formatDate(str(r, 'date')).slice(0, 6)}</span>
      <div className="grow">
        {hasModule('roster') ? <Link to={`${base}/roster/${r.id}`}><b>{shiftTitle(data, r)}</b></Link> : <b>{shiftTitle(data, r)}</b>}
        <small>{SHIFT_SHORT[kindOf(data, r)]} shift{str(r, 'reliefOfficer') === o.id ? ' · as relief' : str(r, 'reliefOfficer') ? ' · absent, relieved' : ''}</small>
      </div>
      <StatusTag workflow={rosterDef.workflow} status={r.status} />
    </li>
  );
  return (
    <>
      <Panel title="Compliance" meta="Demo rule: deployable = actively employed with a valid PSIRA registration" right={<Tag tone={dep.deployable ? 'green' : 'red'}>{dep.deployable ? 'Deployable' : 'Not deployable'}</Tag>}>
        {!dep.deployable && <Notice tone="red">Cannot be posted: {dep.reasons.join('; ')}.</Notice>}
        <ul className="list" data-testid="officer-compliance">
          {officerExpiries(o, today).map((e) => (
            <Check key={e.key} ok={e.state === 'none' ? null : e.state !== 'overdue'} label={e.label}
              detail={!e.date ? 'Not on record' : e.state === 'overdue' ? `${dated(e.key) ? 'Overdue since' : 'Expired'} ${formatDate(e.date)} (${daysBetween(e.date, today)} days ago)` : `${dated(e.key) ? 'Due' : 'Valid to'} ${formatDate(e.date)}${e.state === 'due-soon' ? ` — ${daysBetween(today, e.date)} days left` : ''}`} />
          ))}
          <Check ok={str(o, 'competencyExpiry') ? str(o, 'competencyExpiry') >= today : null} label="Armed posts" detail={str(o, 'competencyExpiry') ? (str(o, 'competencyExpiry') >= today ? 'May be posted on armed posts and issued a firearm (demo rule)' : 'Competency lapsed — unarmed posts only') : 'No firearm competency — unarmed posts only'} />
        </ul>
        <p className="muted-note" style={{ marginTop: 10 }}>Site inductions: {inductions(o).length ? inductions(o).join(', ') : 'none recorded'}. PSIRA numbers and dates are fictional.</p>
      </Panel>
      <Panel title="Shifts" meta="From the duty roster">
        {upcoming.length ? <ul className="list">{upcoming.map(row)}</ul> : <Empty title="Not on the roster for the coming days" />}
        {past.length > 0 && (
          <>
            <h3 className="panel-title" style={{ marginTop: 16, fontSize: 13 }}>Recent</h3>
            <ul className="list">{past.map(row)}</ul>
          </>
        )}
      </Panel>
    </>
  );
}

function Aside({ officer: o }: { officer: DemoRecord }) {
  const data = useData();
  const base = useBase();
  const { hasModule } = useUser();
  const { today } = useClock();
  const items = issuedTo(data, o.id);
  return (
    <Panel title="Equipment on issue" meta="Issued at book-on, returned at book-off">
      {items.length ? (
        <ul className="list">
          {items.map((e) => (
            <li key={e.id}>
              <div className="grow">{hasModule('equipment') ? <Link to={`${base}/equipment/${e.id}`}><b>{equipmentLabel(e)}</b></Link> : <b>{equipmentLabel(e)}</b>}<small>Issued {formatDate(str(e, 'issuedOn'))}</small></div>
              {notReturned(data, e, today) && <Tag tone="red">Not returned</Tag>}
            </li>
          ))}
        </ul>
      ) : <Empty title="Nothing on issue" />}
    </Panel>
  );
}
