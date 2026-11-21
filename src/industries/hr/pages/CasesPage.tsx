import { useData } from '../../../core/context';
import { records, str } from '../../../core/engine';
import { formatDate } from '../../../core/lib/dates';
import { Notice, Panel, Stat, Tag } from '../../../core/components/ui';
import { RegisterPage } from '../../../core/components/records';
import { SANCTIONS, label } from '../data';
import { emp, openCases, todayStr } from '../helpers';
import { EmpLink, ModuleLink } from './shared';

/** Cases register with the warnings currently on file underneath. */
export default function CasesPage() {
  const data = useData();
  const today = todayStr();
  const open = openCases(data);
  const warnings = records(data, 'warnings').sort((a, b) => str(b, 'issued').localeCompare(str(a, 'issued')));
  const valid = warnings.filter((w) => str(w, 'expires') >= today);
  return (
    <RegisterPage intro={
      <>
        <div className="stat-grid">
          <Stat label="Open disciplinary cases" value={open.filter((c) => str(c, 'kind') === 'disciplinary').length} tone={open.length ? 'red' : undefined} sub={`${open.filter((c) => c.status === 'hearing').length} with a hearing scheduled`} />
          <Stat label="Open grievances" value={open.filter((c) => str(c, 'kind') === 'grievance').length} sub="lodged by employees" />
          <Stat label="Appeals" value={open.filter((c) => c.status === 'appeal').length} sub="waiting for a result" />
          <Stat label="Warnings on file" value={valid.length} sub={`${warnings.length - valid.length} expired`} />
        </div>
        <div style={{ marginBottom: 18 }}>
          <Notice tone="grey">A demonstration of the process only — not legal advice. Notice periods and warning validity are demo rules in the style of the LRA Code of Good Practice (2 working days’ notice of a hearing; warnings valid 3, 6 or 12 months by company policy).</Notice>
        </div>
      </>
    }>
      <Panel title="Warnings on file" meta="Created automatically when an outcome carries a warning" className="" >
        {valid.length ? (
          <ul className="list" data-testid="warnings-list">
            {valid.map((w) => (
              <li key={w.id}>
                <div className="grow"><b><EmpLink e={emp(data, str(w, 'employee'))} /> · {label(SANCTIONS, str(w, 'level'))}</b>
                  <small>{w.ref} · {str(w, 'reason')} · issued {formatDate(str(w, 'issued'))}{str(w, 'case') ? <> · <ModuleLink module="cases" id={str(w, 'case')}>case</ModuleLink></> : null}</small></div>
                <Tag tone="amber">Until {formatDate(str(w, 'expires'))}</Tag>
              </li>
            ))}
          </ul>
        ) : <p className="muted-note">No valid warnings on file.</p>}
      </Panel>
      <div className="section-gap" />
    </RegisterPage>
  );
}
