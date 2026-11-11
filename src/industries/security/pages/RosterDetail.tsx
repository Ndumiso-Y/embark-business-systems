import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { DemoRecord } from '../../../core/types';
import { useActions, useBase, useData, useUser } from '../../../core/context';
import { records, str } from '../../../core/engine';
import { addDays, formatDate } from '../../../core/lib/dates';
import { Empty, Field, KeyValues, Notice, Panel, Tag } from '../../../core/components/ui';
import { RecordDetail } from '../../../core/components/records';
import { SHIFT_END, SHIFT_KINDS, SHIFT_START, label } from '../data';
import {
  deployability, equipmentLabel, fullName, handoverEntry, hasCompetency, kindOf, officerExpiries, officerName, postOf, postingProblems, rec, siteOfShift,
  slotPhase, workingOfficerId,
} from '../helpers';
import { Check } from './shared';
import { useClock } from './format';

export default function RosterDetail() {
  const { id } = useParams();
  const data = useData();
  const r = rec(data, 'roster', id);
  return (
    <RecordDetail backLabel="Duty roster" aside={r ? <Aside shift={r} /> : undefined}>
      {r && <Body shift={r} />}
    </RecordDetail>
  );
}

function Body({ shift }: { shift: DemoRecord }) {
  const data = useData();
  const base = useBase();
  const { can } = useUser();
  const post = postOf(data, shift);
  const site = siteOfShift(data, shift);
  const kind = kindOf(data, shift);
  return (
    <>
      <Panel title="Post requirements" meta="What the client contract asks for on this post">
        <KeyValues items={[
          { label: 'Site', value: site ? <Link to={`${base}/sites/${site.id}`}>{str(site, 'name')}</Link> : '—' },
          { label: 'Post', value: str(post, 'name') },
          { label: 'Shift', value: `${formatDate(str(shift, 'date'))} · ${label(SHIFT_KINDS, kind)}` },
          { label: 'Minimum grade', value: `Grade ${str(post, 'grade')} (A is the highest)` },
          { label: 'Armed post', value: post?.values.armed === true ? 'Yes — valid firearm competency required (demo rule)' : 'No' },
          { label: 'Site induction', value: site?.values.requiresInduction === true ? `Required (${str(site, 'code')})` : 'Not required' },
        ]} />
      </Panel>
      {(shift.status === 'open' || shift.status === 'absent') && (can('roster.manage')
        ? <Picker shift={shift} />
        : <Notice tone="grey">Your simulated role cannot post officers. Switch to a control room operator to fill this post.</Notice>)}
      {shift.status === 'onduty' && <Handover shift={shift} />}
    </>
  );
}

type Candidate = { o: DemoRecord; problems: string[] };
const REASONS = [/PSIRA/, /Grade too low/, /Armed post/, /already posted/, /rest rule/, /site induction/, /cannot be posted/];
/** Interleave refused candidates by the rule that stops them, so the short list shows one of each kind first. */
function varied(list: Candidate[]): Candidate[] {
  const groups = REASONS.map((re) => list.filter((x) => re.test(x.problems[0])));
  groups.push(list.filter((x) => !REASONS.some((re) => re.test(x.problems[0]))));
  const out: Candidate[] = [];
  for (let round = 0; out.length < list.length; round++) for (const g of groups) if (g[round]) out.push(g[round]);
  return out;
}

/** Pick an officer for an unfilled post, or a relief for an absent officer. Every candidate is run through the posting rules. */
function Picker({ shift }: { shift: DemoRecord }) {
  const data = useData();
  const base = useBase();
  const act = useActions();
  const { today } = useClock();
  const [q, setQ] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [refused, setRefused] = useState<{ name: string; problems: string[] } | null>(null);
  const relief = shift.status === 'absent';
  const needle = q.trim().toLowerCase();
  const rows = records(data, 'officers')
    .filter((o) => o.id !== (relief ? str(shift, 'officer') : ''))
    .map((o) => ({ o, problems: postingProblems(data, shift, o.id) }))
    .filter((x) => !needle || `${fullName(x.o)} ${str(x.o, 'grade')} ${str(x.o, 'psiraNo')}`.toLowerCase().includes(needle))
    .sort((a, b) => a.problems.length - b.problems.length || fullName(a.o).localeCompare(fullName(b.o)));
  const eligible = rows.filter((x) => !x.problems.length);
  const refusedRows = rows.filter((x) => x.problems.length);
  const blocked = needle ? refusedRows : varied(refusedRows);

  const assign = (o: DemoRecord) => {
    const problems = postingProblems(data, shift, o.id);
    if (problems.length) {
      setRefused({ name: fullName(o), problems });
      act.toast(problems[0], 'err');
      return;
    }
    act.update('roster', shift.id, relief ? { reliefOfficer: o.id } : { officer: o.id });
    const res = act.transition('roster', shift.id, relief ? 'relief' : 'posted');
    if (!res.ok) { act.toast(res.reason, 'err'); return; }
    setRefused(null);
    act.toast(`${fullName(o)} ${relief ? 'assigned as relief' : 'posted'} — ${shift.ref}`);
  };
  const row = ({ o, problems }: Candidate) => (
    <li key={o.id} data-testid={problems.length ? 'candidate-blocked' : 'candidate-eligible'}>
      <span className={`dot ${problems.length ? 'red' : 'green'}`} />
      <div className="grow">
        <Link to={`${base}/officers/${o.id}`}><b>{fullName(o)}</b></Link>
        <small>Grade {str(o, 'grade')} · PSIRA {str(o, 'psiraExpiry') < str(shift, 'date') ? 'expired' : 'valid to'} {formatDate(str(o, 'psiraExpiry'))}{hasCompetency(o, today) ? ' · firearm competent' : ''}{str(o, 'inductions') ? ` · inducted ${str(o, 'inductions')}` : ''}</small>
        {problems.map((p) => <small key={p} style={{ color: 'var(--danger)' }}>{p}</small>)}
      </div>
      <button className={`btn sm ${problems.length ? '' : 'primary'}`} onClick={() => assign(o)}>{problems.length ? 'Try to post' : relief ? 'Assign as relief' : 'Post'}</button>
    </li>
  );
  return (
    <Panel title={relief ? 'Assign a relief officer' : 'Post an officer'} meta={`${eligible.length} eligible · ${blocked.length} not eligible for this post and shift`}
      right={<input className="input sm" aria-label="Search officers" placeholder="Search name, grade, PSIRA no." value={q} onChange={(e) => setQ(e.target.value)} style={{ width: 220 }} />}>
      {relief && <Notice tone="amber">{officerName(data, shift.values.officer)} is absent. The relief officer is checked against the same rules as a normal posting.</Notice>}
      {refused && (
        <Notice tone="red">
          <b>{refused.name} was refused.</b>
          <ul className="problem-list">{refused.problems.map((p) => <li key={p}>{p}</li>)}</ul>
        </Notice>
      )}
      {eligible.length ? <ul className="list" data-testid="eligible-list">{(showAll ? eligible : eligible.slice(0, 6)).map(row)}</ul> : <Empty title="No eligible officer matches" body="Clear the search, or check the officer register for lapsed registrations." />}
      {eligible.length > 6 && <button className="link-btn" style={{ marginTop: 8 }} onClick={() => setShowAll(!showAll)}>{showAll ? 'Show fewer' : `Show all ${eligible.length} eligible officers`}</button>}
      {blocked.length > 0 && (
        <>
          <h3 className="panel-title" style={{ marginTop: 18, fontSize: 13 }}>Not eligible — and why</h3>
          <ul className="list" data-testid="blocked-list">{(needle || showAll ? blocked : blocked.slice(0, 8)).map(row)}</ul>
          {!needle && !showAll && blocked.length > 8 && <p className="muted-note" style={{ marginTop: 8 }}>+ {blocked.length - 8} more — search by name to check a specific officer.</p>}
        </>
      )}
      <p className="muted-note" style={{ marginTop: 12 }}>Demo rules only: grades, registration and competency dates are invented and prove nothing about a real officer.</p>
    </Panel>
  );
}

/** The site's handover entry gates book-off; this is a shortcut to write and sign it. */
function Handover({ shift }: { shift: DemoRecord }) {
  const data = useData();
  const base = useBase();
  const act = useActions();
  const { can, hasModule } = useUser();
  const { today, time } = useClock();
  const site = siteOfShift(data, shift);
  const kind = kindOf(data, shift);
  const date = str(shift, 'date');
  const entry = site ? handoverEntry(data, site.id, date, kind) : undefined;
  const [text, setText] = useState(`Shift handed over to the ${kind === 'day' ? 'night' : 'day'} shift. Keys, radio and occurrence book handed over, site in order.`);
  if (!site) return null;
  const write = () => {
    if (!text.trim()) { act.toast('Write the handover entry first.', 'err'); return; }
    // A late handover for a shift that has already ended is recorded at the shift's end time.
    const ended = slotPhase(date, kind, today, time) === 'past';
    const when = ended ? { date: kind === 'night' ? addDays(date, 1) : date, time: SHIFT_END[kind] } : { date: today, time };
    const r = act.create('ob', { site: site.id, date: when.date, time: when.time, shift: kind, type: 'handover', entry: text.trim(), by: officerName(data, workingOfficerId(shift)) }, 'draft', 'Handover entry written');
    const res = act.transition('ob', r.id, 'signed');
    act.toast(res.ok ? `${r.ref} signed — the officers on this shift can now book off.` : res.reason, res.ok ? 'ok' : 'err');
  };
  return (
    <Panel title="Shift handover" meta={`Book-off needs a signed handover entry in the ${str(site, 'name')} occurrence book`} right={<Tag tone={entry ? 'green' : 'amber'}>{entry ? 'Handover signed' : 'Handover outstanding'}</Tag>}>
      {entry ? (
        <ul className="list">
          <Check ok label={`${entry.ref} · ${formatDate(str(entry, 'date'))} ${str(entry, 'time')}`} detail={<>{str(entry, 'entry')} — {str(entry, 'by')}{hasModule('ob') && <> · <Link to={`${base}/ob/${entry.id}`}>open entry</Link></>}</>} />
        </ul>
      ) : can('ob.record') ? (
        <>
          <Field label="Handover entry" hint={`Shift ${SHIFT_START[kind]}–${SHIFT_END[kind]}. The entry is numbered, signed and locked.`}>
            <textarea className="textarea" aria-label="Handover entry" value={text} onChange={(e) => setText(e.target.value)} />
          </Field>
          <div className="btns" style={{ marginTop: 10 }}><button className="btn sm primary" onClick={write} data-testid="write-handover">Write &amp; sign handover entry</button></div>
        </>
      ) : <Notice tone="grey">Your simulated role cannot write occurrence book entries.</Notice>}
    </Panel>
  );
}

function Aside({ shift }: { shift: DemoRecord }) {
  const data = useData();
  const base = useBase();
  const { hasModule } = useUser();
  const { today } = useClock();
  const o = rec(data, 'officers', workingOfficerId(shift) || shift.values.officer);
  const items = records(data, 'equipment').filter((e) => e.status === 'issued' && str(e, 'issuedShift') === shift.id);
  return (
    <>
      <Panel title={shift.status === 'absent' ? 'Absent officer' : 'Officer on this shift'} meta={o ? `Grade ${str(o, 'grade')} · ${str(o, 'psiraNo')}` : 'Nobody posted'}
        right={o ? <Tag tone={deployability(o, str(shift, 'date')).deployable ? 'green' : 'red'}>{deployability(o, str(shift, 'date')).deployable ? 'Deployable' : 'Not deployable'}</Tag> : undefined}>
        {o ? (
          <>
            {hasModule('officers') ? <Link to={`${base}/officers/${o.id}`}><b>{fullName(o)}</b></Link> : <b>{fullName(o)}</b>}
            <ul className="list">
              {officerExpiries(o, today).map((e) => <Check key={e.key} ok={e.state === 'none' ? null : e.state !== 'overdue'} label={e.label} detail={e.date ? `${e.state === 'overdue' ? 'Expired' : 'Valid to'} ${formatDate(e.date)}` : 'Not on record'} />)}
            </ul>
          </>
        ) : <Empty title="No officer posted" body="Use the picker to fill this post." />}
      </Panel>
      <Panel title="Equipment issued for this shift" meta="Issued at book-on, returned at book-off">
        {items.length ? (
          <ul className="list">
            {items.map((e) => <li key={e.id}><div className="grow">{hasModule('equipment') ? <Link to={`${base}/equipment/${e.id}`}><b>{equipmentLabel(e)}</b></Link> : <b>{equipmentLabel(e)}</b>}<small>{str(e, 'serial')}</small></div></li>)}
          </ul>
        ) : <Empty title="Nothing issued" />}
      </Panel>
    </>
  );
}
