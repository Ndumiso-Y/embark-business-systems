import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useActions, useBase, useData, useIndustry, useUser } from '../../../core/context';
import { records, str } from '../../../core/engine';
import { Empty, Field, Notice, PageHeader, Panel, Stat, StatusTag, Tag } from '../../../core/components/ui';
import { RecordTable, WorkflowActions } from '../../../core/components/records';
import { IcoSearch } from '../../../core/components/Icons';
import { CONFLICT_OUTCOMES } from '../data';
import { clientName, conflictStatus, matterName, searchConflicts, todayStr } from '../helpers';
import { MatterLink } from './shared';

export default function ConflictChecks() {
  const config = useIndustry();
  const data = useData();
  const base = useBase();
  const act = useActions();
  const { can, hasModule } = useUser();
  const def = act.def('conflicts');
  const matterDef = config.collections.find((c) => c.key === 'matters')!;
  const [q, setQ] = useState('');
  const [matter, setMatter] = useState('');
  const [outcome, setOutcome] = useState('');
  const [note, setNote] = useState('');
  const [err, setErr] = useState('');
  const hits = useMemo(() => searchConflicts(data, q), [data, q]);
  const checks = [...records(data, 'conflicts')].sort((a, b) => b.ref.localeCompare(a.ref));
  const pending = checks.filter((c) => c.status === 'pending');
  const candidates = records(data, 'matters').filter((m) => ['intake', 'conflict'].includes(m.status ?? ''));
  const awaiting = records(data, 'matters').filter((m) => m.status === 'conflict' && conflictStatus(data, m.id) !== 'cleared');

  const pickMatter = (id: string) => {
    setMatter(id);
    const m = records(data, 'matters').find((x) => x.id === id);
    if (m && !q.trim()) setQ(str(m, 'opposingParty') || clientName(data, m.values.client));
  };
  const save = () => {
    if (!matter) return setErr('Select the matter this search is for.');
    if (q.trim().length < 2) return setErr('Enter the name you searched.');
    if (!outcome) return setErr('Choose an outcome.');
    if (outcome === 'potential' && !note.trim()) return setErr('A potential conflict needs a note explaining how it is resolved.');
    const summary = hits.length ? hits.map((h) => `${h.name} — ${h.role} (${h.ref})`).join('; ') : 'No hits.';
    const r = act.create('conflicts', { matter, searchTerms: q.trim(), hits: hits.length, hitSummary: summary, outcome, note: note.trim(), checkedOn: todayStr() }, 'pending', 'Conflict search recorded');
    const m = records(data, 'matters').find((x) => x.id === matter);
    if (m?.status === 'intake') act.transition('matters', matter, 'conflict');
    act.toast(`Conflict check ${r.ref} recorded — awaiting clearance`);
    setErr(''); setNote(''); setOutcome(''); setMatter('');
  };

  return (
    <>
      <PageHeader kicker={`${config.businessName} / Matters`} title="Conflict checks" subtitle="Search a name across every client and every matter’s opposing and other parties, record the outcome, and have a partner clear it before engagement." />
      <div className="stat-grid">
        <Stat label="Awaiting clearance" value={pending.length} tone={pending.length ? 'red' : undefined} sub="Recorded checks not yet cleared" />
        <Stat label="Matters held at conflict stage" value={awaiting.length} sub="Engagement is blocked until cleared" />
        <Stat label="Checks recorded" value={checks.length} />
        <Stat label="Conflicts confirmed" value={checks.filter((c) => c.status === 'conflict').length} sub="Matters declined" />
      </div>
      <div className="section-gap" />
      <div className="grid-2">
        <Panel title="Search parties" meta="Clients, opposing parties and other parties of all matters (fictional records in this browser only)">
          <div className="toolbar">
            <label className="search-box" style={{ width: '100%', maxWidth: 420 }}>
              <IcoSearch />
              <input aria-label="Search name for conflicts" placeholder="Type a person or company name, e.g. Sable" value={q} onChange={(e) => setQ(e.target.value)} data-testid="conflict-search" />
            </label>
            <span className="toolbar-count">{q.trim().length >= 2 ? `${hits.length} hit${hits.length === 1 ? '' : 's'}` : 'Enter at least 2 characters'}</span>
          </div>
          {q.trim().length >= 2 && (hits.length ? (
            <div className="table-wrap">
              <table className="table" data-testid="conflict-hits">
                <thead><tr><th>Name matched</th><th>Appears as</th><th>Where</th><th>Status</th></tr></thead>
                <tbody>
                  {hits.map((h, i) => (
                    <tr key={i}>
                      <td><strong>{h.name}</strong></td>
                      <td><Tag tone={h.role === 'Client' ? 'accent' : h.role === 'Opposing party' ? 'red' : 'dark'}>{h.role}</Tag></td>
                      <td>{h.matterId ? <MatterLink data={data} id={h.matterId} /> : hasModule('clients') && h.clientId ? <Link to={`${base}/clients/${h.clientId}`}>{h.ref}</Link> : h.ref}</td>
                      <td>{h.status ? <StatusTag workflow={matterDef.workflow} status={h.status} /> : <Tag tone="green">Client record</Tag>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <Empty title="No hits" body="No client or party name matches. Record the search as clear if that is the outcome." />)}
        </Panel>
        <Panel title="Record this search" meta="Creates a conflict check awaiting partner clearance">
          {can('intake') ? (
            <form className="stack" onSubmit={(e) => { e.preventDefault(); save(); }} noValidate>
              <Field label="Matter">
                <select className="select" aria-label="Matter for conflict check" value={matter} onChange={(e) => pickMatter(e.target.value)}>
                  <option value="">Select matter at intake / conflict stage…</option>
                  {candidates.map((m) => <option key={m.id} value={m.id}>{m.ref} · {str(m, 'name')}</option>)}
                </select>
              </Field>
              <Field label="Outcome">
                <select className="select" aria-label="Conflict outcome" value={outcome} onChange={(e) => setOutcome(e.target.value)}>
                  <option value="">Select…</option>
                  {CONFLICT_OUTCOMES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </Field>
              <Field label="Note / resolution" hint={outcome === 'potential' ? 'Required for a potential conflict, e.g. informed consent obtained from both clients.' : undefined} error={err || undefined}>
                <textarea className="textarea" aria-label="Conflict note" value={note} onChange={(e) => setNote(e.target.value)} />
              </Field>
              <div className="btns"><button className="btn primary" type="submit" data-testid="record-conflict">Record conflict check</button></div>
            </form>
          ) : <Notice tone="grey">Your simulated role cannot record conflict searches (needs the intake permission).</Notice>}
        </Panel>
      </div>
      <Panel title="Awaiting clearance" meta={can('conflicts.clear') ? 'Clear or confirm each check. A potential conflict needs a note.' : 'Only a role with conflicts.clear can clear these.'}>
        {pending.length || awaiting.length ? (
          <ul className="list" data-testid="pending-conflicts">
            {pending.map((c) => (
              <li key={c.id}>
                <div className="grow">
                  <Link to={`${base}/conflicts/${c.id}`}><b>{c.ref} · {matterName(data, str(c, 'matter'))}</b></Link>
                  <small>Searched “{str(c, 'searchTerms')}” · {str(c, 'hitSummary')}</small>
                  {str(c, 'note') && <small>Note: {str(c, 'note')}</small>}
                </div>
                <Tag tone={str(c, 'outcome') === 'clear' ? 'green' : str(c, 'outcome') === 'potential' ? 'amber' : 'red'}>{CONFLICT_OUTCOMES.find((o) => o.value === str(c, 'outcome'))?.label.split(' —')[0]}</Tag>
                <WorkflowActions def={def} record={c} compact />
              </li>
            ))}
            {awaiting.filter((m) => conflictStatus(data, m.id) === 'none').map((m) => (
              <li key={m.id}>
                <span className="dot amber" />
                <div className="grow"><MatterLink data={data} id={m.id} /><small>{m.ref} · no conflict search recorded yet — search the client and parties above.</small></div>
                {can('intake') && <button className="btn xs" onClick={() => pickMatter(m.id)}>Search for this matter</button>}
              </li>
            ))}
          </ul>
        ) : <Empty title="Nothing awaiting clearance" />}
      </Panel>
      <div className="section-gap" />
      <Panel title="All conflict checks"><RecordTable def={def} rows={checks} moduleKey="conflicts" /></Panel>
    </>
  );
}

