import { Link, useParams } from 'react-router-dom';
import type { DemoRecord } from '../../../core/types';
import { useBase, useData, useIndustry, useUser } from '../../../core/context';
import { str } from '../../../core/engine';
import { formatDate } from '../../../core/lib/dates';
import { KeyValues, Notice, Panel, Tag } from '../../../core/components/ui';
import { RecordDetail } from '../../../core/components/records';
import { INCIDENT_TYPES, label } from '../data';
import { contractOfSite, incidentCloseProblems, isSerious, rec, sapsProblem, siteName } from '../helpers';
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
  const { can } = useUser();
  const problems = incidentCloseProblems(r);
  const saps = str(r, 'sapsCase');
  return (
    <Panel title="Close-out checklist" meta="An incident can only be closed when every item is on file" right={<Tag tone={r.status === 'closed' ? 'green' : problems.length ? 'amber' : 'green'}>{r.status === 'closed' ? 'Closed' : problems.length ? `${problems.length} outstanding` : 'Ready to close'}</Tag>}>
      <ul className="list" data-testid="closeout-checklist">
        <Check ok={!!str(r, 'clientNotifiedAt')} label="Client notified" detail={str(r, 'clientNotifiedAt') ? `Phoned at ${str(r, 'clientNotifiedAt')}` : 'Record the time the client contact was phoned'} />
        <Check ok={!!str(r, 'rootCause').trim()} label="Root cause" detail={str(r, 'rootCause') || 'Needed before the report goes to the client'} />
        <Check ok={isSerious(r) ? !sapsProblem(r) : null} label="SAPS case number (fictional)" detail={isSerious(r) ? (saps || (str(r, 'noSapsReason') ? `No case: ${str(r, 'noSapsReason')}` : 'Serious incident — record DEMO-CAS … or the reason no case was opened')) : 'Only required for serious (high severity) incidents'} />
        <Check ok={r.values.clientReportSent === true} label="Client report logged" detail={r.values.clientReportSent === true ? `Logged ${formatDate(str(r, 'clientReportOn'))} — nothing was actually sent` : 'Use “Log client report” once the investigation is complete'} />
        <Check ok={!!str(r, 'outcome').trim()} label="Outcome" detail={str(r, 'outcome') || 'What was the result — loss, arrest, repairs, retraining?'} />
      </ul>
      {r.status !== 'closed' && <p className="muted-note" style={{ marginTop: 10 }}>Use “Edit” to capture the missing details{can('incidents.close') ? '' : '. Closing needs the “Close incidents” permission (Operations director)'}.</p>}
    </Panel>
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
