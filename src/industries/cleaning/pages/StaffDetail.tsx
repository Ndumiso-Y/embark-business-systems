import { Link, useParams } from 'react-router-dom';
import { useActions, useBase, useData, useIndustry, useUser } from '../../../core/context';
import { findRecord, records, str } from '../../../core/engine';
import { daysBetween, formatDate } from '../../../core/lib/dates';
import { DueTag, Empty, KeyValues, Panel, StatusTag, Tag } from '../../../core/components/ui';
import { RecordDetail } from '../../../core/components/records';
import { csv, shiftAbsent, shiftCleaners, siteName, toCsv, todayStr, trainingStates } from '../helpers';
import { cleanerState } from './attendance';

export default function StaffDetail() {
  const { id } = useParams();
  const data = useData();
  const p = findRecord(data, 'staff', id);
  return <RecordDetail aside={p ? <Aside id={p.id} /> : undefined} />;
}

function Aside({ id }: { id: string }) {
  const config = useIndustry();
  const data = useData();
  const base = useBase();
  const act = useActions();
  const { can, hasModule } = useUser();
  const today = todayStr();
  const p = findRecord(data, 'staff', id)!;
  const shiftDef = config.collections.find((c) => c.key === 'shifts')!;
  const inducted = csv(str(p, 'inductions'));
  const sites = records(data, 'sites').filter((s) => s.status !== 'ended');
  const shifts = records(data, 'shifts').filter((s) => shiftCleaners(s).includes(p.ref)).sort((a, b) => str(b, 'date').localeCompare(str(a, 'date')));
  const recent = shifts.filter((s) => str(s, 'date') <= today).slice(0, 6);
  const next = shifts.filter((s) => str(s, 'date') > today).length;
  const past = shifts.filter((s) => s.status === 'completed');
  const absences = past.filter((s) => shiftAbsent(s).includes(p.ref)).length;
  const toggle = (ref: string, on: boolean) => act.update('staff', id, { inductions: toCsv(on ? [...inducted, ref] : inducted.filter((r) => r !== ref)).replace(/,/g, ', ') }, `Site induction ${on ? 'recorded' : 'removed'}: ${ref}`);
  return (
    <>
      <Panel title="Training" meta="Expiry dates are illustrative records, not proof of competence">
        <ul className="list" data-testid="training-list">
          {trainingStates(p, today).map((t) => (
            <li key={t.key}>
              <div className="grow"><b>{t.label}</b><small>{t.date ? `Valid until ${formatDate(t.date)}` : 'Not on record'}</small></div>
              <DueTag state={t.state} label={t.state === 'overdue' ? `Expired ${daysBetween(t.date, today)} d ago` : t.state === 'due-soon' ? `Expires in ${daysBetween(today, t.date)} d` : t.state === 'ok' ? 'In date' : undefined} />
            </li>
          ))}
        </ul>
        <KeyValues items={[
          { label: 'Uniform issued', value: formatDate(str(p, 'uniformIssued')) },
          { label: 'PPE issued', value: formatDate(str(p, 'ppeIssued')) },
        ]} />
      </Panel>
      <Panel title="Site inductions" meta="A cleaner can only be rostered at sites where the induction is done" right={<Tag tone="accent">{inducted.length} sites</Tag>}>
        <div style={{ display: 'grid', gap: 6 }}>
          {sites.map((s) => (
            <label className="check" key={s.id}>
              <input type="checkbox" checked={inducted.includes(s.ref)} disabled={!can('staff.manage')} onChange={(e) => toggle(s.ref, e.target.checked)} /> {str(s, 'name')}
            </label>
          ))}
        </div>
      </Panel>
      <Panel title="Recent shifts" meta={`${past.length} completed in the record · ${absences} absence${absences === 1 ? '' : 's'} · ${next} coming up`}>
        {recent.length ? (
          <ul className="list">
            {recent.map((s) => {
              const cs = cleanerState(s, p.ref);
              return (
                <li key={s.id}>
                  <div className="grow">{hasModule('schedule') ? <Link to={`${base}/schedule/${s.id}`}><b>{siteName(data, s.values.site)}</b></Link> : <b>{siteName(data, s.values.site)}</b>}<small>{formatDate(str(s, 'date'))} · {str(s, 'start')}–{str(s, 'end')}</small></div>
                  <Tag tone={cs.tone}>{cs.label}</Tag>
                  <StatusTag workflow={shiftDef.workflow} status={s.status} />
                </li>
              );
            })}
          </ul>
        ) : <Empty title="No shifts on record" />}
      </Panel>
    </>
  );
}
