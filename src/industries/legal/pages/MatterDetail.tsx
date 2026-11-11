import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useActions, useBase, useData, useIndustry, useUser } from '../../../core/context';
import { findRecord, num, records, str } from '../../../core/engine';
import { addDays, formatDate } from '../../../core/lib/dates';
import { toCents } from '../../../core/lib/money';
import { Confirm, Empty, Flags, KeyValues, Meters, Notice, Panel, StatusTag, Tag } from '../../../core/components/ui';
import { RecordDetail } from '../../../core/components/records';
import { RecordFormModal } from '../../../core/components/fields';
import { IcoPlus, IcoReceipt, IcoTimer } from '../../../core/components/Icons';
import { DIARY_TYPES, FEE_BASIS, FICA_STATUS, earner, earnerForUser, label } from '../data';
import {
  WORKING_MATTER_STATES, activationProblems, buildFeeNote, byDeadline, closeProblems, conflictChecks, engagementProblem, formatCents, invoiceOutstanding, invoiceTotal,
  ficaState, ledgerRows, matterMoney, pendingOutflowCents, timeValue, todayStr, trustBalance,
  diaryWhen,
} from '../helpers';
import { Checklist, ClientCard } from './shared';

export default function MatterDetail() {
  const { id } = useParams();
  const data = useData();
  const m = findRecord(data, 'matters', id);
  return (
    <RecordDetail aside={m ? <Aside id={m.id} /> : undefined}>
      {m && <Main id={m.id} />}
    </RecordDetail>
  );
}

function Main({ id }: { id: string }) {
  const config = useIndustry();
  const data = useData();
  const base = useBase();
  const act = useActions();
  const navigate = useNavigate();
  const { user, can, hasModule } = useUser();
  const today = todayStr();
  const m = findRecord(data, 'matters', id)!;
  const money = matterMoney(data, id);
  const bal = trustBalance(data, id);
  const pendingOut = pendingOutflowCents(data, id);
  const est = toCents(num(m, 'estimate'));
  const working = WORKING_MATTER_STATES.includes(m.status ?? '');
  const [recording, setRecording] = useState(false);
  const [billing, setBilling] = useState(false);
  const [diaryNew, setDiaryNew] = useState(false);
  const fee = buildFeeNote(data, id, today);
  const timeDef = config.collections.find((c) => c.key === 'time')!;
  const diaryDef = config.collections.find((c) => c.key === 'diary')!;
  const entries = records(data, 'time').filter((t) => str(t, 'matter') === id).sort((a, b) => str(b, 'date').localeCompare(str(a, 'date')) || b.ref.localeCompare(a.ref));
  const diary = records(data, 'diary').filter((d) => str(d, 'matter') === id && d.status === 'upcoming').sort(byDeadline);
  const ledger = ledgerRows(data, id);
  const me = earnerForUser(user.id) ?? earner(str(m, 'feeEarner'));
  const client = findRecord(data, 'clients', str(m, 'client'));
  const clientFica = ficaState(client, today);
  /** Confirming FICA on the matter also puts the client's documents on file, so the two never contradict each other. */
  const confirmFica = () => {
    if (client && clientFica === 'missing') act.update('clients', client.id, { ficaStatus: 'verified', ficaExpiry: str(client, 'ficaExpiry') || addDays(today, 365) }, `FICA documents recorded as on file (simulated) for ${m.ref}`);
    act.update('matters', id, { ficaVerified: true }, 'FICA confirmed for this matter (simulated)');
    act.toast(`${m.ref}: FICA confirmed (simulated — nothing is verified)`);
  };

  const billNow = () => {
    if (!fee) return;
    const inv = act.create('invoices', fee.values, 'issued', `Fee note issued from ${fee.entryIds.length} unbilled time entr${fee.entryIds.length === 1 ? 'y' : 'ies'}`);
    let failed = 0;
    for (const tid of fee.entryIds) {
      act.update('time', tid, { invoice: inv.id });
      if (!act.transition('time', tid, 'billed').ok) failed += 1;
    }
    act.toast(failed ? `Fee note ${inv.ref} created; ${failed} entries could not be marked billed` : `Fee note ${inv.ref} issued — ${fee.entryIds.length} time entr${fee.entryIds.length === 1 ? 'y' : 'ies'} marked billed`);
    setBilling(false);
    if (hasModule('invoices')) navigate(`${base}/invoices/${inv.id}`);
  };

  return (
    <>
      {m.status === 'intake' && <Notice tone="accent"><b>Next step:</b> press “Send for conflict check”, then search the client and the other parties on the Conflict checks page. Work can only start once a partner has cleared the check.</Notice>}
      {m.status === 'conflict' && engagementProblem(data, id) && <Notice tone="amber"><b>Engagement blocked:</b> {engagementProblem(data, id)}{hasModule('conflicts') && <> <Link to={`${base}/conflicts?matter=${id}`} data-testid="open-conflicts">Open conflict checks for this matter →</Link></>}</Notice>}
      {m.status === 'conflict' && !engagementProblem(data, id) && <Notice tone="accent"><b>Conflict check cleared.</b> Press “Conflict cleared — prepare engagement” above to move on.</Notice>}
      {m.status === 'engagement' && (
        <Panel title="Engagement checklist" meta="Both must be ticked before “Open for work” is allowed"
          right={<Tag tone={activationProblems(m).length ? 'amber' : 'green'}>{activationProblems(m).length ? `${activationProblems(m).length} outstanding` : 'Ready to open'}</Tag>}>
          <Checklist items={[
            { label: 'Engagement letter signed by the client', ok: m.values.engagementSigned === true, detail: `${label(FEE_BASIS, str(m, 'feeBasis'))}${est > 0 ? ` · estimate ${formatCents(est)} excl. VAT` : ''}`,
              action: m.values.engagementSigned !== true && can('matters.manage')
                ? <button className="btn sm" data-testid="mark-engagement" onClick={() => { act.update('matters', id, { engagementSigned: true }, 'Engagement letter recorded as signed'); act.toast(`${m.ref}: engagement letter recorded as signed`); }}>Record letter signed</button>
                : undefined },
            { label: 'FICA confirmed for this matter (simulated)', ok: m.values.ficaVerified === true,
              detail: `Client record: ${label(FICA_STATUS, str(client, 'ficaStatus'))}${clientFica === 'expired' ? ' — review date has passed' : ''} · no verification is performed`,
              action: m.values.ficaVerified !== true && can('matters.manage')
                ? <button className="btn sm" data-testid="mark-fica" onClick={confirmFica}>Confirm FICA documents</button>
                : undefined },
          ]} />
          {!can('matters.manage') && activationProblems(m).length > 0 && <p className="muted-note" style={{ marginTop: 10 }}>Only a role that manages matters (partner or associate) can tick these off.</p>}
          {!activationProblems(m).length && <p className="muted-note" style={{ marginTop: 10 }}>Ready — press “Open for work” in the Workflow panel above. Time can then be recorded and billed.</p>}
        </Panel>
      )}

      <Panel title="Matter position" meta={`${label(FEE_BASIS, str(m, 'feeBasis'))} · amounts excl. VAT unless stated`}>
        <div className="mini-stat-row" style={{ marginBottom: 14 }}>
          <div>Recorded (billable)<b>{formatCents(money.recorded)}</b></div>
          <div>Unbilled WIP<b>{formatCents(money.wip)}</b></div>
          <div>Billed<b>{formatCents(money.billed)}</b></div>
          <div>Fees outstanding<b>{formatCents(money.outstanding)}</b></div>
          <div>Trust held (simulated)<b>{formatCents(bal)}</b></div>
          <div>Hours<b>{money.hours}</b></div>
        </div>
        {est > 0 && (
          <Meters format={(n) => formatCents(n)} items={[{ label: 'Recorded against fee estimate', value: money.recorded, max: est, tone: money.recorded > est ? 'red' : money.recorded > est * 0.8 ? 'amber' : 'accent' }]} />
        )}
        {str(m, 'feeBasis') === 'contingency' && <p className="muted-note" style={{ marginTop: 10 }}>Contingency basis is noted only. The demo does not calculate contingency fees or apply any statutory cap.</p>}
      </Panel>

      <Panel title="Time" meta={`${entries.length} entries · latest first`}
        right={<>
          {can('time.record') && working && <button className="btn sm" onClick={() => setRecording(true)} data-testid="record-time"><IcoTimer /> Record time</button>}
          {can('billing') && fee && <button className="btn sm primary" onClick={() => setBilling(true)} data-testid="bill-time"><IcoReceipt /> Bill unbilled time</button>}
        </>}>
        {entries.length ? (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Date</th><th>Fee earner</th><th>Narrative</th><th className="num">Hours</th><th className="num">Value</th><th>Status</th></tr></thead>
              <tbody>
                {entries.slice(0, 10).map((t) => (
                  <tr key={t.id}>
                    <td>{formatDate(str(t, 'date'))}</td>
                    <td>{earner(str(t, 'feeEarner'))?.short}</td>
                    <td>{hasModule('time') ? <Link to={`${base}/time/${t.id}`}>{str(t, 'narrative')}</Link> : str(t, 'narrative')}{t.values.billable !== true && <> <Tag tone="dark">Non-billable</Tag></>}</td>
                    <td className="num">{num(t, 'hours').toFixed(1)}</td>
                    <td className="num">{formatCents(timeValue(t))}</td>
                    <td><StatusTag workflow={timeDef.workflow} status={t.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <Empty title="No time recorded" body={working ? 'Record the first time entry for this matter.' : 'Time can be recorded once the matter reaches engagement.'} />}
        {entries.length > 10 && hasModule('time') && <p className="muted-note" style={{ marginTop: 10 }}>Showing 10 of {entries.length}. <Link to={`${base}/time`}>All time entries →</Link></p>}
      </Panel>

      <Panel title="Trust (simulated)" meta="Approved balance only — not a compliant trust ledger"
        right={hasModule('trust') ? <Link className="btn sm" to={`${base}/trust?matter=${id}`}>Open ledger</Link> : undefined}>
        <div className="mini-stat-row" style={{ marginBottom: 12 }}>
          <div>Approved balance<b>{formatCents(bal)}</b></div>
          <div>Pending payments<b>{formatCents(pendingOut)}</b></div>
          <div>Available<b>{formatCents(Math.max(0, bal - pendingOut))}</b></div>
        </div>
        {ledger.length ? (
          <ul className="list">
            {ledger.slice(-5).reverse().map(({ record: t, balance }) => (
              <li key={t.id}>
                <span className="time-chip">{formatDate(str(t, 'date'))}</span>
                <div className="grow">
                  <b>{str(t, 'type') === 'deposit' ? '+' : '−'}{formatCents(toCents(num(t, 'amount')))} · {str(t, 'payee')}</b>
                  <small>{t.ref} · {str(t, 'description')} · balance {formatCents(balance)}</small>
                </div>
                <Tag tone={t.status === 'approved' ? 'green' : t.status === 'captured' ? 'amber' : 'red'}>{t.status === 'approved' ? 'Approved' : t.status === 'captured' ? 'Awaiting approval' : 'Rejected'}</Tag>
              </li>
            ))}
          </ul>
        ) : <Empty title="No trust transactions" />}
      </Panel>

      <Panel title="Diary & deadlines" meta="Upcoming for this matter · prescription dates first"
        right={can('diary') && m.status !== 'closed' && m.status !== 'declined' ? <button className="btn sm" onClick={() => setDiaryNew(true)}><IcoPlus /> Add entry</button> : undefined}>
        {diary.length ? (
          <ul className="list">
            {diary.map((d) => (
              <li key={d.id}>
                <span className="time-chip">{diaryWhen(d)}</span>
                <div className="grow">
                  {hasModule('diary') ? <Link to={`${base}/diary/${d.id}`}><b>{str(d, 'title')}</b></Link> : <b>{str(d, 'title')}</b>}
                  <small>{label(DIARY_TYPES, str(d, 'type'))} · {str(d, 'venue')}</small>
                </div>
                <Flags flags={diaryDef.flags?.(d, data, today) ?? []} />
              </li>
            ))}
          </ul>
        ) : <Empty title="Nothing upcoming" />}
      </Panel>

      {recording && (
        <RecordFormModal def={timeDef} open title={`Record time · ${m.ref}`}
          initial={{ matter: id, feeEarner: me?.value ?? '', date: today, rate: me?.rate ?? 0, billable: true, hours: 0.5 }}
          onClose={() => setRecording(false)}
          onSave={(v) => { const t = act.create('time', v, 'unbilled', 'Time recorded'); act.toast(`Time entry ${t.ref} recorded`); setRecording(false); }} />
      )}
      {diaryNew && (
        <RecordFormModal def={diaryDef} open title={`Diary entry · ${m.ref}`} initial={{ matter: id, type: 'meeting', date: today, feeEarner: str(m, 'feeEarner') }}
          onClose={() => setDiaryNew(false)}
          onSave={(v) => { const d = act.create('diary', v, 'upcoming'); act.toast(`Diary entry ${d.ref} added`); setDiaryNew(false); }} />
      )}
      <Confirm open={billing} title="Bill unbilled time?" confirmLabel="Issue fee note"
        body={fee ? <>
          A fee note will be issued for <b>{fee.entryIds.length}</b> unbilled billable time entr{fee.entryIds.length === 1 ? 'y' : 'ies'}
          ({formatCents(money.wip)} excl. VAT, plus 15% VAT). Each entry is marked billed and linked to the fee note. Non-billable time is left out.
        </> : 'Nothing to bill.'}
        onCancel={() => setBilling(false)} onConfirm={billNow} />
    </>
  );
}

function Aside({ id }: { id: string }) {
  const data = useData();
  const base = useBase();
  const { hasModule, can } = useUser();
  const config = useIndustry();
  const today = todayStr();
  const m = findRecord(data, 'matters', id)!;
  const checks = conflictChecks(data, id);
  const ccDef = config.collections.find((c) => c.key === 'conflicts')!;
  const docDef = config.collections.find((c) => c.key === 'documents')!;
  const invDef = config.collections.find((c) => c.key === 'invoices')!;
  const docs = records(data, 'documents').filter((d) => str(d, 'matter') === id);
  const invs = records(data, 'invoices').filter((i) => str(i, 'matter') === id).sort((a, b) => str(b, 'date').localeCompare(str(a, 'date')));
  const closing = ['active', 'closing'].includes(m.status ?? '') ? closeProblems(m, data) : [];
  const outstanding = invs.reduce((n, i) => n + invoiceOutstanding(i), 0);
  return (
    <>
      <Panel title="Client"><ClientCard data={data} clientId={m.values.client} today={today} /></Panel>
      <Panel title="Parties & court">
        <KeyValues items={[
          { label: 'Opposing party', value: str(m, 'opposingParty') },
          { label: 'Other parties', value: str(m, 'otherParties') },
          { label: 'Case number', value: str(m, 'caseNo') },
          { label: 'Court / forum', value: str(m, 'court') },
        ]} />
      </Panel>
      <Panel title="Conflict checks" right={hasModule('conflicts') ? <Link className="btn sm" to={`${base}/conflicts${['intake', 'conflict'].includes(m.status ?? '') ? `?matter=${id}` : ''}`}>Checks</Link> : undefined}>
        {checks.length ? (
          <ul className="list">
            {checks.map((c) => (
              <li key={c.id}>
                <div className="grow">{hasModule('conflicts') ? <Link to={`${base}/conflicts/${c.id}`}><b>{c.ref}</b></Link> : <b>{c.ref}</b>}<small>{str(c, 'searchTerms')} · {formatDate(str(c, 'checkedOn'))}</small></div>
                <StatusTag workflow={ccDef.workflow} status={c.status} />
              </li>
            ))}
          </ul>
        ) : <Empty title="No conflict check yet" />}
      </Panel>
      {['active', 'closing'].includes(m.status ?? '') && (
        <Panel title="Closure checklist" meta="Rules enforced by “Close matter”">
          {closing.length ? (
            <>
              <Notice tone="amber"><ul className="problem-list">{closing.map((p) => <li key={p}>{p}</li>)}</ul></Notice>
              <div className="btns" style={{ marginTop: 10 }}>
                {hasModule('trust') && (trustBalance(data, id) !== 0 || closing.some((p) => /trust transaction/.test(p))) && <Link className="btn sm" to={`${base}/trust?matter=${id}`} data-testid="closure-trust">Open trust ledger</Link>}
                {closing.some((p) => /unbilled/.test(p)) && <span className="muted-note">Unbilled time: use “Bill unbilled time” in the Time panel{can('billing') ? '' : ' (bookkeeper or partner)'}.</span>}
              </div>
            </>
          ) : <Notice tone="accent">Trust balance is R0.00 and there is no unbilled time — the matter can be closed.</Notice>}
          {outstanding > 0 && <p className="muted-note" style={{ marginTop: 10 }}>Note: {formatCents(outstanding)} in fees is still outstanding from the client.</p>}
        </Panel>
      )}
      <Panel title="Fee notes">
        {invs.length ? (
          <ul className="list">
            {invs.map((i) => (
              <li key={i.id}>
                <div className="grow">{hasModule('invoices') ? <Link to={`${base}/invoices/${i.id}`}><b>{i.ref}</b></Link> : <b>{i.ref}</b>}<small>{formatDate(str(i, 'date'))} · {formatCents(invoiceTotal(i))} incl. VAT</small></div>
                <Flags flags={invDef.flags?.(i, data, today) ?? []} />
                <StatusTag workflow={invDef.workflow} status={i.status} />
              </li>
            ))}
          </ul>
        ) : <Empty title="No fee notes yet" />}
      </Panel>
      <Panel title="Documents">
        {docs.length ? (
          <ul className="list">
            {docs.map((d) => (
              <li key={d.id}>
                <div className="grow">{hasModule('documents') ? <Link to={`${base}/documents/${d.id}`}><b>{str(d, 'title')}</b></Link> : <b>{str(d, 'title')}</b>}<small>{d.ref} · {str(d, 'version')}</small></div>
                <StatusTag workflow={docDef.workflow} status={d.status} />
              </li>
            ))}
          </ul>
        ) : <Empty title="No documents" />}
      </Panel>
    </>
  );
}
