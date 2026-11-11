// Occurrence book entry. This page deliberately does not use the generic record
// detail: a signed entry must not offer "Edit" or "Delete", only a follow-up entry.
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useActions, useBase, useData, useIndustry, useUser } from '../../../core/context';
import { records, str } from '../../../core/engine';
import { formatDate } from '../../../core/lib/dates';
import { Empty, KeyValues, Notice, PageHeader, Panel, StatusTag } from '../../../core/components/ui';
import { History, WorkflowActions } from '../../../core/components/records';
import { RecordFormModal } from '../../../core/components/fields';
import RoleBar from '../../../core/components/RoleBar';
import { IcoBack, IcoEdit, IcoPlus } from '../../../core/components/Icons';
import { OB_TYPES, SHIFT_KINDS, label } from '../data';
import { currentSlot, rec, siteName } from '../helpers';
import { useClock } from './format';

export default function ObDetail() {
  const { id } = useParams();
  const config = useIndustry();
  const data = useData();
  const base = useBase();
  const act = useActions();
  const navigate = useNavigate();
  const { user, can, hasModule } = useUser();
  const { today, time } = useClock();
  const def = act.def('ob');
  const r = rec(data, 'ob', id);
  const [editing, setEditing] = useState(false);
  const [following, setFollowing] = useState(false);
  if (!r) {
    return (
      <>
        <PageHeader kicker={config.businessName} title="OB entry not found" subtitle="The demo data may have been reset." />
        <Link className="btn" to={`${base}/ob`}><IcoBack /> Back to the occurrence book</Link>
      </>
    );
  }
  const signed = r.status === 'signed';
  const parent = rec(data, 'ob', r.values.followsUp);
  const followUps = records(data, 'ob').filter((e) => str(e, 'followsUp') === r.id);
  return (
    <>
      <Link className="back-link" to={`${base}/ob`}><IcoBack /> Occurrence book</Link>
      <PageHeader kicker={`OB entry · ${r.ref}`} title={`${label(OB_TYPES, str(r, 'type'))} — ${siteName(data, r.values.site)}`} subtitle={`${formatDate(str(r, 'date'))} ${str(r, 'time')} · entered by ${str(r, 'by')}`}
        actions={can('ob.record') ? (
          <>
            {!signed && <button className="btn" onClick={() => setEditing(true)} data-testid="edit-record"><IcoEdit /> Correct draft</button>}
            {signed && <button className="btn primary" onClick={() => setFollowing(true)} data-testid="ob-followup"><IcoPlus /> Add follow-up entry</button>}
          </>
        ) : undefined} />
      <div className="doc-grid">
        <div className="stack">
          <Panel title="Entry status" meta="Draft entries can be corrected; signing locks the entry" right={<StatusTag workflow={def.workflow} status={r.status} />}>
            {signed
              ? <Notice tone="grey">This entry is signed and locked. It cannot be edited or deleted — record any correction or update as a follow-up entry, which gets its own OB number.</Notice>
              : <WorkflowActions def={def} record={r} />}
          </Panel>
          <Panel title="Entry">
            <KeyValues items={[
              { label: 'OB number', value: r.ref },
              { label: 'Site', value: hasModule('sites') ? <Link to={`${base}/sites/${str(r, 'site')}`}>{siteName(data, r.values.site)}</Link> : siteName(data, r.values.site) },
              { label: 'Date and time', value: `${formatDate(str(r, 'date'))} ${str(r, 'time')}` },
              { label: 'Shift', value: label(SHIFT_KINDS, str(r, 'shift')) },
              { label: 'Type', value: label(OB_TYPES, str(r, 'type')) },
              { label: 'Entered by', value: str(r, 'by') },
              { label: 'Entry', value: str(r, 'entry'), wide: true },
              ...(parent ? [{ label: 'Follows up', value: <Link to={`${base}/ob/${parent.id}`}>{parent.ref} — {str(parent, 'entry').slice(0, 80)}</Link>, wide: true }] : []),
            ]} />
          </Panel>
          <Panel title="Follow-up entries" meta="Later entries that refer back to this one">
            {followUps.length ? (
              <ul className="list">
                {followUps.map((e) => (
                  <li key={e.id}>
                    <span className="time-chip">{str(e, 'time')}</span>
                    <div className="grow"><Link to={`${base}/ob/${e.id}`}><b>{e.ref} · {formatDate(str(e, 'date'))}</b></Link><small>{str(e, 'entry')}</small></div>
                    <StatusTag workflow={def.workflow} status={e.status} />
                  </li>
                ))}
              </ul>
            ) : <Empty title="No follow-up entries" />}
          </Panel>
        </div>
        <div className="stack">
          <Panel title="History" meta="Who did what, when (simulated users)"><History record={r} /></Panel>
          <RoleBar compact />
        </div>
      </div>
      {editing && (
        <RecordFormModal def={def} record={r} open title={`Correct draft entry ${r.ref}`} onClose={() => setEditing(false)} onSave={(v) => {
          if (rec(data, 'ob', r.id)?.status !== 'draft') { act.toast('This entry has been signed and can no longer be edited.', 'err'); setEditing(false); return; }
          act.update('ob', r.id, v, 'Draft corrected');
          act.toast(`${r.ref} saved`);
          setEditing(false);
        }} />
      )}
      {following && (
        <RecordFormModal def={def} open title={`Follow-up to ${r.ref}`} onClose={() => setFollowing(false)}
          initial={{ site: str(r, 'site'), date: today, time, shift: currentSlot(today).kind, type: 'followup', by: user.name, followsUp: r.id }}
          onSave={(v) => {
            const n = act.create('ob', { ...v, followsUp: r.id }, 'draft', `Follow-up to ${r.ref}`);
            act.toast(`${n.ref} written as a follow-up to ${r.ref}`);
            setFollowing(false);
            navigate(`${base}/ob/${n.id}`);
          }} />
      )}
    </>
  );
}
