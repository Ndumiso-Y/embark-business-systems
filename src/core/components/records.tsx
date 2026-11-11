// Generic register (table / board), record detail, workflow actions and history.
// Any collection declared in an IndustryConfig gets these screens for free.
import { useMemo, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { CollectionDef, DemoRecord, ModuleDef, Transition } from '../types';
import { availableTransitions, can, PERMISSION_REFUSED, permissionHint, searchText } from '../engine';
import { useActions, useBase, useData, useIndustry, useUser } from '../context';
import { formatDate, formatDateTime, todayIso } from '../lib/dates';
import { Confirm, Empty, Flags, KeyValues, Modal, PageHeader, Panel, Segmented, StatusTag, Field } from './ui';
import { formatValue, RecordFormModal, useVisibleFields } from './fields';
import { IcoBack, IcoEdit, IcoPlus, IcoSearch, IcoTrash } from './Icons';
import RoleBar from './RoleBar';

export function useModule(): ModuleDef {
  const config = useIndustry();
  const { module } = useParams();
  const m = config.modules.find((x) => x.key === module);
  if (!m) throw new Error(`Unknown module ${module}`);
  return m;
}

/* ---------------- Workflow action buttons ---------------- */
export function WorkflowActions({ def, record, compact, onDone, hide }: { def: CollectionDef; record: DemoRecord; compact?: boolean; onDone?: (to: string) => void; /** Target states whose buttons a custom page renders itself. */ hide?: string[] }) {
  const config = useIndustry();
  const data = useData();
  const { user } = useUser();
  const act = useActions();
  const [pending, setPending] = useState<Transition | null>(null);
  const [note, setNote] = useState('');
  const [err, setErr] = useState('');
  if (!def.workflow) return null;
  const every = availableTransitions(def.workflow, record, user, data);
  // If the page handles every available step itself, show nothing rather than "final state".
  if (every.length && hide && every.every((o) => hide.includes(o.transition.to))) return null;
  const options = every
    .filter((o) => !hide?.includes(o.transition.to))
    .map((o) => (o.blocked === PERMISSION_REFUSED ? { ...o, blocked: permissionHint(config, data, o.transition.permission), byPermission: true } : { ...o, byPermission: false }));
  if (!options.length) return compact ? null : <span className="muted-note">No further steps — this is a final state.</span>;

  const run = (t: Transition, n?: string) => {
    const res = act.transition(def.key, record.id, t.to, n);
    if (!res.ok) { setErr(res.reason); act.toast(res.reason, 'err'); return; }
    act.toast(`${record.ref}: ${t.label}`);
    setPending(null); setNote(''); setErr('');
    onDone?.(t.to);
  };
  return (
    <>
      <div className="btns wf-actions">
        {options.map(({ transition: t, blocked, byPermission }) => (
          <button key={t.label + t.to} type="button" title={blocked ?? undefined}
            className={`btn ${compact ? 'xs' : 'sm'} ${t.intent === 'primary' ? 'primary' : t.intent === 'danger' ? 'danger' : ''}`}
            disabled={byPermission}
            onClick={() => {
              if (!t.requiresNote) return blocked ? act.toast(blocked, 'err') : run(t);
              // Don't ask for a note when the step is blocked for a reason no note can fix.
              const withNote = t.guard?.({ record, data, user, note: '(note)' }) ?? null;
              if (blocked && blocked === withNote) return act.toast(blocked, 'err');
              setPending(t);
            }}>
            {t.label}
          </button>
        ))}
      </div>
      {!compact && options.some((o) => o.blocked) && (
        <ul className="blocked-list">
          {options.filter((o) => o.blocked).map((o) => <li key={o.transition.label}><b>{o.transition.label}:</b> {o.blocked}</li>)}
        </ul>
      )}
      {compact && options.length > 0 && options.every((o) => o.byPermission) && <small className="wf-who">{options[0].blocked}</small>}
      <Modal open={!!pending} title={pending?.label ?? ''} sub={`${record.ref} · ${pending?.noteHint ?? 'a note is required for this step'}`} onClose={() => setPending(null)}
        footer={<><button className="btn" onClick={() => setPending(null)}>Cancel</button><button className="btn primary" data-testid="confirm-transition" onClick={() => pending && run(pending, note)}>{pending?.label}</button></>}>
        <Field label="Note" error={err || undefined}><textarea className="textarea" aria-label="Transition note" value={note} onChange={(e) => setNote(e.target.value)} /></Field>
      </Modal>
    </>
  );
}

export function History({ record }: { record: DemoRecord }) {
  return (
    <ul className="timeline">
      {[...record.history].reverse().map((h, i) => (
        <li key={i}>
          <div>
            <b>{h.action}</b>
            <small>{h.by} · {h.role} · {new Date(h.at).getTime() > Date.now() ? formatDate(h.at.slice(0, 10)) : formatDateTime(h.at)}</small>
            {h.note && <div className="note">{h.note}</div>}
          </div>
        </li>
      ))}
    </ul>
  );
}

/* ---------------- Register table ---------------- */
export function RecordTable({ def, rows, moduleKey, extra }: { def: CollectionDef; rows: DemoRecord[]; moduleKey: string; extra?: { head: string; cell: (r: DemoRecord) => ReactNode } }) {
  const config = useIndustry();
  const data = useData();
  const base = useBase();
  const navigate = useNavigate();
  const fields = useVisibleFields(def).filter((f) => f.table);
  const { user } = useUser();
  const today = todayIso();
  if (!rows.length) return <Empty title={`No ${def.plural.toLowerCase()} match`} body="Adjust the search or filters, or create a new record." />;
  return (
    <div className="table-wrap">
      <table className="table" data-testid={`table-${def.key}`}>
        <thead>
          <tr>
            <th>{def.singular}</th>
            {fields.map((f) => <th key={f.key} className={f.type === 'money' || f.type === 'number' ? 'num' : ''}>{f.label}</th>)}
            {extra && <th>{extra.head}</th>}
            {def.workflow && <th>Status</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="clickable" tabIndex={0} onClick={() => navigate(`${base}/${moduleKey}/${r.id}`)} onKeyDown={(e) => { if (e.key === 'Enter') navigate(`${base}/${moduleKey}/${r.id}`); }}>
              <td>
                <strong>{def.title(r, data)}</strong>
                <small>{r.ref}{def.subtitle ? ` · ${def.subtitle(r, data)}` : ''}</small>
                <Flags flags={def.flags?.(r, data, today, user) ?? []} />
              </td>
              {fields.map((f) => <td key={f.key} className={f.type === 'money' || f.type === 'number' ? 'num' : ''}>{formatValue(f, r.values[f.key], data, config.collections)}</td>)}
              {extra && <td>{extra.cell(r)}</td>}
              {def.workflow && <td><StatusTag workflow={def.workflow} status={r.status} /></td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ---------------- Board (kanban by workflow state) ---------------- */
export function RecordBoard({ def, rows, moduleKey, hideTerminal = true }: { def: CollectionDef; rows: DemoRecord[]; moduleKey: string; hideTerminal?: boolean }) {
  const data = useData();
  const { user } = useUser();
  const base = useBase();
  const today = todayIso();
  const states = def.workflow!.states.filter((s) => !hideTerminal || !s.terminal);
  return (
    <div className="board" data-testid={`board-${def.key}`}>
      {states.map((s) => {
        const items = rows.filter((r) => r.status === s.key);
        return (
          <section key={s.key} className="board-col" aria-label={`${s.label} column`}>
            <header><span className={`dot ${s.tone}`} />{s.label}<b>{items.length}</b></header>
            {items.map((r) => (
              <article key={r.id} className="board-card">
                <Link to={`${base}/${moduleKey}/${r.id}`}><strong>{def.title(r, data)}</strong></Link>
                <small>{r.ref}{def.subtitle ? ` · ${def.subtitle(r, data)}` : ''}</small>
                <Flags flags={def.flags?.(r, data, today, user) ?? []} />
                <WorkflowActions def={def} record={r} compact />
              </article>
            ))}
            {!items.length && <div className="board-empty">Nothing here</div>}
          </section>
        );
      })}
    </div>
  );
}

/* ---------------- Generic register page ---------------- */
export function RegisterPage({ collection, intro, children }: { collection?: string; intro?: ReactNode; children?: ReactNode }) {
  const config = useIndustry();
  const data = useData();
  const m = useModule();
  const act = useActions();
  const navigate = useNavigate();
  const base = useBase();
  const { can: userCan } = useUser();
  const def = act.def(collection ?? m.collection!);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [view, setView] = useState<'table' | 'board'>(m.view ?? 'table');
  const [creating, setCreating] = useState(false);
  const all = useMemo(() => data.collections[def.key] ?? [], [data, def.key]);
  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const sorted = [...all].sort(def.sort ?? ((a, b) => b.createdAt.localeCompare(a.createdAt)));
    return sorted.filter((r) => (!status || r.status === status) && (!needle || searchText(def, r, data).includes(needle)));
  }, [all, q, status, def, data]);
  const counts = def.workflow?.states.map((s) => ({ ...s, count: all.filter((r) => r.status === s.key).length })) ?? [];

  return (
    <>
      <PageHeader kicker={`${config.businessName} / ${m.group ?? 'Workspace'}`} title={m.label} subtitle={m.description}
        actions={userCan(def.editPermission) ? <button className="btn primary" onClick={() => setCreating(true)} data-testid="new-record"><IcoPlus /> New {def.singular.toLowerCase()}</button> : undefined} />
      {intro}
      {children}
      <Panel>
        <div className="toolbar">
          <label className="search-box">
            <IcoSearch />
            <input aria-label={`Search ${def.plural}`} placeholder={`Search ${def.plural.toLowerCase()}`} value={q} onChange={(e) => setQ(e.target.value)} />
          </label>
          {def.workflow && (
            <select className="select" aria-label="Filter by status" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">All statuses ({all.length})</option>
              {counts.map((s) => <option key={s.key} value={s.key}>{s.label} ({s.count})</option>)}
            </select>
          )}
          <span className="toolbar-count">{rows.length} shown</span>
          {def.workflow && (
            <div style={{ marginLeft: 'auto' }}>
              <Segmented label="View" value={view} onChange={setView} options={[{ value: 'table', label: 'Table' }, { value: 'board', label: 'Board' }]} />
            </div>
          )}
        </div>
        {view === 'board' && def.workflow ? <RecordBoard def={def} rows={rows} moduleKey={m.key} /> : <RecordTable def={def} rows={rows} moduleKey={m.key} />}
      </Panel>
      {creating && (
        <RecordFormModal def={def} open initial={def.createDefaults?.(todayIso(), data)} onClose={() => setCreating(false)} onSave={(v) => {
          const r = act.create(def.key, v);
          act.toast(`${def.singular} ${r.ref} created`);
          setCreating(false);
          navigate(`${base}/${m.key}/${r.id}`);
        }} />
      )}
    </>
  );
}

/* ---------------- Generic record detail ---------------- */
export function RecordDetail({ collection, aside, children, backLabel, hideTransitions }: { collection?: string; aside?: ReactNode; children?: ReactNode; backLabel?: string; /** Target states handled by controls on the custom page. */ hideTransitions?: string[] }) {
  const config = useIndustry();
  const data = useData();
  const m = useModule();
  const act = useActions();
  const base = useBase();
  const navigate = useNavigate();
  const { id } = useParams();
  const { user } = useUser();
  const def = act.def(collection ?? m.collection!);
  const fields = useVisibleFields(def);
  const record = (data.collections[def.key] ?? []).find((r) => r.id === id);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  if (!record) {
    return (
      <>
        <PageHeader kicker={config.businessName} title={`${def.singular} not found`} subtitle="It may have been deleted, or the demo data was reset." />
        <Link className="btn" to={`${base}/${m.key}`}><IcoBack /> Back to {m.label}</Link>
      </>
    );
  }
  const hidden = def.fields.filter((f) => !f.hidden).length - fields.length;
  // Finished records (paid, closed, verified …) are locked: a real system would not let them be edited or deleted.
  const locked = !!def.workflow?.states.find((st) => st.key === record.status)?.terminal;
  const editable = can(user, def.editPermission) && !locked;
  return (
    <>
      <Link className="back-link" to={`${base}/${m.key}`}><IcoBack /> {backLabel ?? m.label}</Link>
      <PageHeader kicker={`${def.singular} · ${record.ref}`} title={def.title(record, data)} subtitle={def.subtitle?.(record, data)}
        actions={editable ? (
          <>
            <button className="btn" onClick={() => setEditing(true)} data-testid="edit-record"><IcoEdit /> Edit</button>
            <button className="btn danger" onClick={() => setDeleting(true)}><IcoTrash /> Delete</button>
          </>
        ) : locked && can(user, def.editPermission) ? <span className="tag dark" title="Records in a final state cannot be edited or deleted">Final · locked</span> : undefined} />
      <div className="doc-grid">
        <div className="stack">
          {def.workflow && (
            <Panel title="Workflow" meta="Steps enforce the demo's business rules and simulated permissions" right={<StatusTag workflow={def.workflow} status={record.status} />}>
              <ol className="stepper">
                {def.workflow.states.filter((s) => !s.terminal || s.key === record.status).map((s) => {
                  const idx = def.workflow!.states.findIndex((x) => x.key === s.key);
                  const cur = def.workflow!.states.findIndex((x) => x.key === record.status);
                  return <li key={s.key} className={s.key === record.status ? 'current' : idx < cur ? 'done' : ''}><span>{s.label}</span></li>;
                })}
              </ol>
              <WorkflowActions def={def} record={record} hide={hideTransitions} />
            </Panel>
          )}
          {children}
          <Panel title="Details" right={<Flags flags={def.flags?.(record, data, todayIso(), user) ?? []} />}>
            <KeyValues items={fields.filter((f) => f.type !== 'lines').map((f) => ({ label: f.label, value: formatValue(f, record.values[f.key], data, config.collections), wide: f.type === 'textarea' }))} />
            {hidden > 0 && <p className="muted-note" style={{ marginTop: 12 }}>{hidden} field(s) hidden for your simulated role.</p>}
          </Panel>
        </div>
        <div className="stack">
          {aside}
          <Panel title="History" meta="Who did what, when (simulated users)"><History record={record} /></Panel>
          <RoleBar compact />
        </div>
      </div>
      {editing && (
        <RecordFormModal def={def} record={record} open onClose={() => setEditing(false)} onSave={(v) => {
          act.update(def.key, record.id, v, 'Details edited');
          act.toast(`${record.ref} saved`);
          setEditing(false);
        }} />
      )}
      <Confirm open={deleting} danger title={`Delete ${record.ref}?`} confirmLabel="Delete" body="This removes the fictional record from this browser. Reset the demo in Settings to restore the starting data."
        onCancel={() => setDeleting(false)} onConfirm={() => { act.remove(def.key, record.id); act.toast(`${record.ref} deleted`); navigate(`${base}/${m.key}`); }} />
    </>
  );
}

export function ModuleView() {
  const m = useModule();
  if (m.page) return <m.page />;
  return <RegisterPage />;
}

export function ModuleDetailView() {
  const m = useModule();
  if (m.detail) return <m.detail />;
  return <RecordDetail />;
}

