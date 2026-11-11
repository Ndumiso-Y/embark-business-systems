import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { DemoRecord } from '../../../core/types';
import { useActions, useBase, useData, useUser } from '../../../core/context';
import { records, str } from '../../../core/engine';
import { daysBetween, formatDate } from '../../../core/lib/dates';
import { Field, KeyValues, Notice, Panel, Tag } from '../../../core/components/ui';
import { RecordDetail } from '../../../core/components/records';
import { PERMIT_LABEL, SHIFT_SHORT } from '../data';
import { activeShiftFor, fullName, issueProblems, kindOf, notReturned, officerName, permitExpired, postOf, rec, shiftTitle } from '../helpers';
import { useClock } from './format';

export default function EquipmentDetail() {
  const { id } = useParams();
  const data = useData();
  const e = rec(data, 'equipment', id);
  return (
    <RecordDetail aside={e ? <Aside item={e} /> : undefined}>
      {e && <Issue item={e} />}
    </RecordDetail>
  );
}

function Issue({ item: e }: { item: DemoRecord }) {
  const data = useData();
  const act = useActions();
  const { can } = useUser();
  const { today, time } = useClock();
  const [officer, setOfficer] = useState('');
  const [everyone, setEveryone] = useState(false);
  if (e.status !== 'instore') return null;
  if (!can('equipment.issue')) return <Notice tone="grey">Your simulated role cannot issue equipment. Switch to the armoury / equipment controller.</Notice>;
  const firearm = str(e, 'category') === 'firearm';
  const candidates = records(data, 'officers')
    .map((o) => ({ o, shift: activeShiftFor(data, o.id, today, time) }))
    .filter((x) => everyone || x.shift)
    .sort((a, b) => fullName(a.o).localeCompare(fullName(b.o)));
  const problems = officer ? issueProblems(data, e, officer, today, time) : [];
  const issue = () => {
    const p = issueProblems(data, e, officer, today, time);
    if (p.length) { act.toast(p[0], 'err'); return; }
    act.update('equipment', e.id, { issuedTo: officer });
    const res = act.transition('equipment', e.id, 'issued');
    act.toast(res.ok ? `${str(e, 'assetNo')} issued to ${officerName(data, officer)}` : res.reason, res.ok ? 'ok' : 'err');
    if (res.ok) setOfficer('');
  };
  return (
    <Panel title="Issue to an officer" meta={firearm ? 'Firearms: only to an officer with valid competency who is posted on an armed post this shift (demo rule)' : 'Equipment is issued at book-on to an officer on the current or next shift'}>
      {permitExpired(e, today) && <Notice tone="red">{PERMIT_LABEL[str(e, 'category')] ?? 'Permit'} expired on {formatDate(str(e, 'permitExpiry'))} — this item cannot be issued.</Notice>}
      <div className="form-grid">
        <Field label="Officer">
          <select className="select" aria-label="Issue to officer" value={officer} onChange={(ev) => setOfficer(ev.target.value)}>
            <option value="">Select officer…</option>
            {candidates.map(({ o, shift }) => (
              <option key={o.id} value={o.id}>
                {fullName(o)} — {shift ? `${shiftTitle(data, shift)} (${SHIFT_SHORT[kindOf(data, shift)]}${postOf(data, shift)?.values.armed === true ? ', armed post' : ''})` : 'not on shift'}
              </option>
            ))}
          </select>
        </Field>
        <label className="check" style={{ alignSelf: 'end', minHeight: 44 }}>
          <input type="checkbox" checked={everyone} onChange={(ev) => setEveryone(ev.target.checked)} /> Also list officers who are not on shift
        </label>
      </div>
      {officer && (problems.length
        ? <Notice tone="red"><b>Issue would be refused.</b><ul className="problem-list">{problems.map((p) => <li key={p}>{p}</li>)}</ul></Notice>
        : <Notice tone="accent">{officerName(data, officer)} meets the demo rules for this item.</Notice>)}
      <div className="btns" style={{ marginTop: 12 }}><button className="btn primary" onClick={issue} disabled={!officer} data-testid="issue-item">Issue {str(e, 'assetNo')}</button></div>
    </Panel>
  );
}

function Aside({ item: e }: { item: DemoRecord }) {
  const data = useData();
  const base = useBase();
  const { hasModule } = useUser();
  const { today, time } = useClock();
  const shift = rec(data, 'roster', e.values.issuedShift);
  const late = notReturned(data, e, today, time);
  const permit = str(e, 'permitExpiry');
  const what = PERMIT_LABEL[str(e, 'category')];
  return (
    <>
      <Panel title="Custody" meta="Who holds the item right now" right={<Tag tone={late ? 'red' : e.status === 'issued' ? 'blue' : e.status === 'instore' ? 'green' : 'amber'}>{late ? 'Not returned after shift end' : e.status === 'issued' ? 'On issue' : e.status === 'instore' ? 'In store' : e.status === 'repair' ? 'In repair' : 'Written off'}</Tag>}>
        <KeyValues items={[
          { label: 'Issued to', value: e.status === 'issued' ? (hasModule('officers') ? <Link to={`${base}/officers/${str(e, 'issuedTo')}`}>{officerName(data, e.values.issuedTo)}</Link> : officerName(data, e.values.issuedTo)) : '—' },
          { label: 'Issued on', value: e.status === 'issued' ? formatDate(str(e, 'issuedOn')) : '—' },
          { label: 'For shift', value: shift && e.status === 'issued' ? (hasModule('roster') ? <Link to={`${base}/roster/${shift.id}`}>{shiftTitle(data, shift)} · {SHIFT_SHORT[kindOf(data, shift)]} {formatDate(str(shift, 'date'))}</Link> : shiftTitle(data, shift)) : '—', wide: true },
        ]} />
        {late && <Notice tone="red">The shift this item was issued for has ended. Recover the item and use “Return to store”.</Notice>}
      </Panel>
      {what && (
        <Panel title={what} meta="Fictional licence data — demo rule only" right={<Tag tone={!permit ? 'dark' : permit < today ? 'red' : daysBetween(today, permit) <= 30 ? 'amber' : 'green'}>{!permit ? 'Not recorded' : permit < today ? 'Expired' : `${daysBetween(today, permit)} days left`}</Tag>}>
          <p className="muted-note">{permit ? `Valid to ${formatDate(permit)}.` : 'No expiry date recorded.'} An item with an expired {what.toLowerCase()} cannot be issued{str(e, 'category') === 'vehicle' ? ' or dispatched' : ''}.</p>
        </Panel>
      )}
    </>
  );
}
