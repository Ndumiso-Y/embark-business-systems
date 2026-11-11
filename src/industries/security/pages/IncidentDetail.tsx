import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { DemoRecord } from '../../../core/types';
import { useActions, useBase, useData, useIndustry, useUser } from '../../../core/context';
import { str } from '../../../core/engine';
import { formatDate } from '../../../core/lib/dates';
import { Field, KeyValues, Notice, Panel, Tag } from '../../../core/components/ui';
import { RecordDetail } from '../../../core/components/records';
import { INCIDENT_TYPES, label } from '../data';
import { SAPS_RE, contractOfSite, incidentCloseProblems, isSerious, rec, sapsProblem, siteName } from '../helpers';
import { Check } from './shared';

export default function IncidentDetail() {
  const { id } = useParams();
  const data = useData();
  const r = rec(data, 'incidents', id);
  return (
    <RecordDetail aside={r ? <Aside incident={r} /> : undefined}>
      {r && <CloseOut incident={r} />}
    </RecordDetail>
  );
}

function CloseOut({ incident: r }: { incident: DemoRecord }) {
  const act = useActions();
  const { can } = useUser();
  const problems = incidentCloseProblems(r);
  const saps = str(r, 'sapsCase');
  const [form, setForm] = useState({ clientNotifiedAt: str(r, 'clientNotifiedAt'), rootCause: str(r, 'rootCause'), sapsCase: saps, noSapsReason: str(r, 'noSapsReason'), outcome: str(r, 'outcome') });
  const [err, setErr] = useState('');
  const set = (k: keyof typeof form, v: string) => setForm({ ...form, [k]: v });
  const save = () => {
    const sapsCase = form.sapsCase.trim();
    if (sapsCase && !SAPS_RE.test(sapsCase)) { setErr('Use the demo format DEMO-CAS 123/11/2026.'); return; }
    act.update('incidents', r.id, { clientNotifiedAt: form.clientNotifiedAt, rootCause: form.rootCause.trim(), sapsCase, noSapsReason: form.noSapsReason.trim(), outcome: form.outcome.trim() }, 'Close-out details updated');
    act.toast(`${r.ref} close-out details saved`);
    setErr('');
  };
  return (
    <>
    <Panel title="Close-out checklist" meta="An incident can only be closed when every item is on file" right={<Tag tone={r.status === 'closed' ? 'green' : problems.length ? 'amber' : 'green'}>{r.status === 'closed' ? 'Closed' : problems.length ? `${problems.length} outstanding` : 'Ready to close'}</Tag>}>
      <ul className="list" data-testid="closeout-checklist">
        <Check ok={!!str(r, 'clientNotifiedAt')} label="Client notified" detail={str(r, 'clientNotifiedAt') ? `Phoned at ${str(r, 'clientNotifiedAt')}` : 'Record the time the client contact was phoned'} />
        <Check ok={!!str(r, 'rootCause').trim()} label="Root cause" detail={str(r, 'rootCause') || 'Needed before the report goes to the client'} />
        <Check ok={isSerious(r) ? !sapsProblem(r) : null} label="SAPS case number (fictional)" detail={isSerious(r) ? (saps || (str(r, 'noSapsReason') ? `No case: ${str(r, 'noSapsReason')}` : 'Serious incident — record DEMO-CAS … or the reason no case was opened')) : 'Only required for serious (high severity) incidents'} />
        <Check ok={r.values.clientReportSent === true} label="Client report logged" detail={r.values.clientReportSent === true ? `Logged ${formatDate(str(r, 'clientReportOn'))} — nothing was actually sent` : 'Use “Log client report” once the investigation is complete'} />
        <Check ok={!!str(r, 'outcome').trim()} label="Outcome" detail={str(r, 'outcome') || 'What was the result — loss, arrest, repairs, retraining?'} />
      </ul>
      {r.status !== 'closed' && !can('incidents.close') && <p className="muted-note" style={{ marginTop: 10 }}>Closing needs the “Close incidents” permission (Operations director).</p>}
    </Panel>
    {r.status !== 'closed' && can('incidents.manage') && (
      <Panel title="Close-out details" meta="Capture what the checklist is waiting for, then take the next workflow step">
        <div className="form-grid">
          <Field label="Client notified at" hint="Time the client contact was phoned.">
            <input className="input" type="time" aria-label="Client notified at" value={form.clientNotifiedAt} onChange={(e) => set('clientNotifiedAt', e.target.value)} />
          </Field>
          <Field label="SAPS case number (fictional)" error={err || undefined} hint={isSerious(r) ? 'Serious incident: a case number or the reason below is required.' : 'Optional for this severity.'}>
            <input className="input" aria-label="SAPS case number" placeholder="DEMO-CAS 123/11/2026" value={form.sapsCase} onChange={(e) => set('sapsCase', e.target.value)} />
          </Field>
          <div className="span-2">
            <Field label="Reason no SAPS case was opened">
              <input className="input" aria-label="Reason no SAPS case was opened" value={form.noSapsReason} onChange={(e) => set('noSapsReason', e.target.value)} placeholder="Only if there is no case number" />
            </Field>
          </div>
          <div className="span-2">
            <Field label="Root cause"><textarea className="textarea" aria-label="Root cause" value={form.rootCause} onChange={(e) => set('rootCause', e.target.value)} /></Field>
          </div>
          <div className="span-2">
            <Field label="Outcome"><textarea className="textarea" aria-label="Outcome" value={form.outcome} onChange={(e) => set('outcome', e.target.value)} /></Field>
          </div>
        </div>
        <div className="btns" style={{ marginTop: 12 }}><button className="btn primary" onClick={save} data-testid="save-closeout">Save close-out details</button></div>
      </Panel>
    )}
    </>
  );
}

function Aside({ incident: r }: { incident: DemoRecord }) {
  const config = useIndustry();
  const data = useData();
  const base = useBase();
  const { hasModule } = useUser();
  const contract = contractOfSite(data, r.values.site);
  return (
    <>
      <Panel title="Client report preview" meta="Logged when the step is taken — never sent">
        <div className="sms-preview" data-testid="client-report">
          <b>Incident report {r.ref}</b><br />
          To: {str(contract, 'contactName') || 'Client contact'}, {str(contract, 'client')}<br /><br />
          {label(INCIDENT_TYPES, str(r, 'type'))} at {siteName(data, r.values.site)} on {formatDate(str(r, 'date'))} at {str(r, 'time')} ({str(r, 'severity') || 'unrated'} severity). {str(r, 'title')}.
          {str(r, 'rootCause') ? ` Root cause: ${str(r, 'rootCause')}` : ' Root cause: still under investigation.'}
          {str(r, 'outcome') ? ` Outcome: ${str(r, 'outcome')}` : ''}
          {str(r, 'sapsCase') ? ` SAPS reference: ${str(r, 'sapsCase')}.` : ''}<br /><br />
          {config.businessName} control room
        </div>
        <Notice tone="grey">Demonstration only: this text is a preview. No email, SMS or report leaves the browser.</Notice>
      </Panel>
      <Panel title="Site & client">
        <KeyValues items={[
          { label: 'Site', value: hasModule('sites') ? <Link to={`${base}/sites/${str(r, 'site')}`}>{siteName(data, r.values.site)}</Link> : siteName(data, r.values.site) },
          { label: 'Client', value: str(contract, 'client') },
          { label: 'Contact', value: `${str(contract, 'contactName')} · ${str(contract, 'phone')}` },
          { label: 'Keyholder', value: str(rec(data, 'sites', r.values.site), 'keyholder') },
        ]} />
      </Panel>
    </>
  );
}
