import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useActions, useBase, useData, useIndustry, useUser } from '../../../core/context';
import { findRecord, str } from '../../../core/engine';
import { daysBetween, formatDate, todayIso } from '../../../core/lib/dates';
import { Flags, KeyValues, Notice, PageHeader, Panel, StatusTag } from '../../../core/components/ui';
import { History } from '../../../core/components/records';
import { RecordFormModal } from '../../../core/components/fields';
import { IcoBack, IcoEdit } from '../../../core/components/Icons';
import RoleBar from '../../../core/components/RoleBar';
import { DIARY_TYPES, earnerName, label } from '../data';
import { todayStr } from '../helpers';
import { MatterLink } from './shared';
import { PRESCRIPTION_RULE, PostponeModal } from './Postpone';

/**
 * Diary entry. Not the generic record screen: postponing needs a new date and a reason
 * together, and a prescription date must never offer a postpone button at all.
 */
export default function DiaryDetail() {
  const config = useIndustry();
  const { id } = useParams();
  const data = useData();
  const base = useBase();
  const act = useActions();
  const { user, can } = useUser();
  const def = act.def('diary');
  const today = todayStr();
  const d = findRecord(data, 'diary', id);
  const [postponing, setPostponing] = useState(false);
  const [editing, setEditing] = useState(false);
  const back = <Link className="back-link" to={`${base}/diary`}><IcoBack /> Court diary & deadlines</Link>;
  if (!d) {
    return <>{back}<PageHeader kicker={config.businessName} title="Diary entry not found" subtitle="It may have been deleted, or the demo data was reset." /></>;
  }
  const presc = str(d, 'type') === 'prescription';
  const upcoming = d.status === 'upcoming';
  const diff = daysBetween(today, str(d, 'date'));
  const done = () => { const res = act.transition('diary', d.id, 'done'); act.toast(res.ok ? `${d.ref} marked done` : res.reason, res.ok ? 'ok' : 'err'); };
  return (
    <>
      {back}
      <PageHeader kicker={`Diary entry · ${d.ref}`} title={str(d, 'title')} subtitle={def.subtitle?.(d, data)}
        actions={can('diary') ? <button className="btn" onClick={() => setEditing(true)} data-testid="edit-record"><IcoEdit /> Edit</button> : undefined} />
      <div className="doc-grid">
        <div className="stack">
          {presc && upcoming && <Notice tone="red"><b>Prescription date.</b> {PRESCRIPTION_RULE} The demo only highlights the date; it does not calculate prescription periods.</Notice>}
          <Panel title="Status" meta={upcoming ? (presc ? 'A prescription date can only be marked done' : 'Postponing asks for the new date and a reason, and creates a new entry on that date') : 'This entry is closed'}
            right={<StatusTag workflow={def.workflow} status={d.status} />}>
            {upcoming && can('diary') && (
              <div className="btns wf-actions">
                <button className="btn primary sm" onClick={done}>Mark done</button>
                {presc
                  ? <span className="tag dark outline" data-testid="no-postpone">Cannot be postponed</span>
                  : <button className="btn sm" onClick={() => setPostponing(true)} data-testid="postpone">Postpone to a new date…</button>}
              </div>
            )}
            {upcoming && !can('diary') && <p className="muted-note">Your simulated role cannot change the court diary.</p>}
            {!upcoming && <span className="muted-note">No further steps — {d.status === 'postponed' ? `postponed to ${formatDate(str(d, 'newDate'))}; see the new entry in the diary.` : 'this entry is done.'}</span>}
          </Panel>
          <Panel title="Details" right={<Flags flags={def.flags?.(d, data, todayIso(), user) ?? []} />}>
            <KeyValues items={[
              { label: 'Matter', value: <MatterLink data={data} id={d.values.matter} />, wide: true },
              { label: 'Type', value: label(DIARY_TYPES, str(d, 'type')) },
              { label: 'When', value: `${formatDate(str(d, 'date'))}${str(d, 'time') ? ` · ${str(d, 'time')}` : ''}` },
              { label: 'Countdown', value: !upcoming ? '—' : diff < 0 ? `${-diff} day${diff === -1 ? '' : 's'} overdue` : diff === 0 ? 'Today' : `${diff} day${diff === 1 ? '' : 's'} to go` },
              { label: 'Responsible', value: earnerName(str(d, 'feeEarner')) },
              { label: 'Court / venue / action', value: str(d, 'venue') || '—', wide: true },
              { label: 'Notes', value: str(d, 'notes') || '—', wide: true },
            ]} />
          </Panel>
        </div>
        <div className="stack">
          <Panel title="History" meta="Who did what, when (simulated users)"><History record={d} /></Panel>
          <RoleBar compact />
        </div>
      </div>
      {postponing && <PostponeModal entry={d} onClose={() => setPostponing(false)} />}
      {editing && (
        <RecordFormModal def={{ ...def, fields: def.fields.filter((f) => f.key !== 'newDate') }} record={d} open onClose={() => setEditing(false)}
          onSave={(v) => { act.update('diary', d.id, v, 'Details edited'); act.toast(`${d.ref} saved`); setEditing(false); }} />
      )}
    </>
  );
}
