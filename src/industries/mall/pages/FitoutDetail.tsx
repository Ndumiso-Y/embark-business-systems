import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useActions, useData, useIndustry, useUser } from '../../../core/context';
import { findRecord, permissionHint, str } from '../../../core/engine';
import { formatDate } from '../../../core/lib/dates';
import { Field, KeyValues, Notice, Panel, StatusTag, Tag } from '../../../core/components/ui';
import { RecordDetail } from '../../../core/components/records';
import { inductionProblems, leaseOf, todayStr } from '../helpers';
import { MallStyles, ModButton, TenantCard } from './shared';

export default function FitoutDetail() {
  const { id } = useParams();
  const data = useData();
  const f = findRecord(data, 'fitouts', id);
  return (
    <RecordDetail aside={f ? <Aside id={f.id} /> : undefined}>
      {f && <Main key={f.id} id={f.id} />}
    </RecordDetail>
  );
}

function Main({ id }: { id: string }) {
  const config = useIndustry();
  const data = useData();
  const act = useActions();
  const { can } = useUser();
  const today = todayStr();
  const f = findRecord(data, 'fitouts', id)!;
  const status = f.status ?? '';
  const edit = can('fitout.manage') && status !== 'signedoff';
  const [contractor, setContractor] = useState(str(f, 'contractor'));
  const [insurance, setInsurance] = useState(str(f, 'insuranceExpiry'));
  const [inducted, setInducted] = useState(f.values.inducted === true);
  const [snags, setSnags] = useState(str(f, 'snags'));
  const [cleared, setCleared] = useState(f.values.snagsCleared === true);
  const problems = inductionProblems(f, today);
  const snagList = str(f, 'snags').split('\n').map((s) => s.trim()).filter(Boolean);
  return (
    <>
      <MallStyles />
      <Panel title="Contractor on site" meta="“Contractor inducted” is refused until the contractor is named, insured and inducted" right={<Tag tone={problems.length ? 'red' : 'green'}>{problems.length ? `${problems.length} outstanding` : 'Cleared for site'}</Tag>}>
        <div className="form-grid">
          <Field label="Fit-out contractor (fictional)"><input className="input" aria-label="Fit-out contractor" disabled={!edit} value={contractor} onChange={(e) => setContractor(e.target.value)} data-testid="fitout-contractor" /></Field>
          <Field label="Public-liability insurance valid until"><input className="input" type="date" aria-label="Public-liability insurance valid until" disabled={!edit} value={insurance} onChange={(e) => setInsurance(e.target.value)} data-testid="fitout-insurance" /></Field>
          <label className="check" style={{ minHeight: 44 }}><input type="checkbox" disabled={!edit} checked={inducted} onChange={(e) => setInducted(e.target.checked)} data-testid="fitout-inducted" /> Site induction done (rules, hours, hoarding, waste)</label>
          {edit && <div style={{ alignSelf: 'end' }}><button className="btn" data-testid="save-fitout-contractor" onClick={() => { act.update('fitouts', id, { contractor: contractor.trim(), insuranceExpiry: insurance, inducted }, 'Contractor, insurance and induction recorded'); act.toast(`${f.ref}: contractor details saved`); }}>Save</button></div>}
        </div>
        {problems.length > 0 && <ul className="problem-list muted-note">{problems.map((p) => <li key={p}>{p.replace(/ \(“Contractor on site” panel\)/, '')}</li>)}</ul>}
        {!can('fitout.manage') && <p className="muted-note" style={{ marginTop: 10 }}>{permissionHint(config, data, 'fitout.manage')}</p>}
      </Panel>
      {['works', 'snag', 'signedoff'].includes(status) && (
        <Panel title="Snag list" meta="“Sign off fit-out” is refused while snags are open" right={<Tag tone={f.values.snagsCleared === true ? 'green' : status === 'snag' ? 'red' : 'dark'}>{f.values.snagsCleared === true ? 'All cleared' : `${snagList.length} listed`}</Tag>}>
          <Field label="Snags (one per line)"><textarea className="textarea" aria-label="Snag list" disabled={!edit} value={snags} onChange={(e) => setSnags(e.target.value)} placeholder="e.g. Shopfront signage not level" data-testid="snags" /></Field>
          {status !== 'works' && <label className="check" style={{ margin: '10px 0' }}><input type="checkbox" disabled={!edit} checked={cleared} onChange={(e) => setCleared(e.target.checked)} data-testid="snags-cleared" /> All snags cleared and checked on site</label>}
          {edit && <div><button className="btn" data-testid="save-snags" onClick={() => { act.update('fitouts', id, { snags, snagsCleared: status === 'works' ? false : cleared }, cleared && status !== 'works' ? 'Snag list cleared' : 'Snag list updated'); act.toast(`${f.ref}: snag list saved`); }}>Save snag list</button></div>}
          {status === 'snag' && !can('fitout.signoff') && <div style={{ marginTop: 12 }}><Notice tone="grey">Sign-off is kept separate from running the fit-out. {permissionHint(config, data, 'fitout.signoff')}</Notice></div>}
        </Panel>
      )}
    </>
  );
}

function Aside({ id }: { id: string }) {
  const config = useIndustry();
  const data = useData();
  const f = findRecord(data, 'fitouts', id)!;
  const lease = leaseOf(data, f.values.lease);
  const leaseDef = config.collections.find((c) => c.key === 'leases')!;
  return (
    <>
      <Panel title="Tenant & lease" right={lease ? <StatusTag workflow={leaseDef.workflow} status={lease.status} /> : undefined}>
        <TenantCard data={data} lease={lease} />
        {lease?.status === 'fitout' && (
          <div style={{ marginTop: 12 }}>
            <Notice tone={f.status === 'signedoff' ? 'accent' : 'grey'}>
              {f.status === 'signedoff' ? 'Signed off. The shop can start trading once the certificate of occupancy and tenant insurance are on the lease.' : 'The shop cannot start trading until this fit-out is signed off.'}
              <div style={{ marginTop: 8 }}><ModButton module="leases" id={lease.id} testid="open-lease">Open the lease</ModButton></div>
            </Notice>
          </div>
        )}
      </Panel>
      <Panel title="Programme">
        <KeyValues items={[
          { label: 'Works start', value: formatDate(str(f, 'startDate')) },
          { label: 'Target trading date', value: formatDate(str(f, 'targetDate')) },
          { label: 'Signed off', value: str(f, 'signedOffOn') ? formatDate(str(f, 'signedOffOn')) : '' },
        ]} />
      </Panel>
    </>
  );
}
