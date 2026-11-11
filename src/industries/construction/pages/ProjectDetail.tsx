import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { Values } from '../../../core/types';
import { useActions, useBase, useData, useUser } from '../../../core/context';
import { findRecord, num, str } from '../../../core/engine';
import { formatDate } from '../../../core/lib/dates';
import { toCents } from '../../../core/lib/money';
import { Empty, KeyValues, Meters, Notice, Panel, StatusTag } from '../../../core/components/ui';
import { RecordDetail } from '../../../core/components/records';
import { RecordFormModal } from '../../../core/components/fields';
import { IcoPlus } from '../../../core/components/Icons';
import { RETENTION_CAP_PCT, SNAG_CATEGORIES, WEATHER, label } from '../data';
import {
  CERTIFIED_STATES, approvedVariations, certifiedToDate, completionDue, diarySummary, finalCompletionProblem, forProject, nextValuationNo, openValuations,
  practicalCompletionProblem, programmeProgress, projectCost, rand, randShort, revisedContractSum, snagOpen, snagsFor, tasksFor, todayStr,
  valuationFigures, valuationsFor, variationsFor,
} from '../helpers';
import { Check, Gantt } from './shared';

export default function ProjectDetail() {
  const { id } = useParams();
  const data = useData();
  const p = findRecord(data, 'projects', id);
  return (
    <RecordDetail aside={p ? <Aside id={p.id} /> : undefined}>
      {p && <Body id={p.id} />}
    </RecordDetail>
  );
}

function Body({ id }: { id: string }) {
  const data = useData();
  const base = useBase();
  const act = useActions();
  const navigate = useNavigate();
  const { can, hasModule } = useUser();
  const today = todayStr();
  const p = findRecord(data, 'projects', id)!;
  const [creating, setCreating] = useState<'variation' | 'valuation' | null>(null);

  const contract = num(p, 'contractValue');
  const approved = approvedVariations(data, id);
  const revised = revisedContractSum(data, p);
  const pending = variationsFor(data, id, 'submitted').reduce((n, v) => n + num(v, 'value'), 0);
  const certified = certifiedToDate(data, id);
  const cost = projectCost(data, p, today);
  const budget = num(p, 'budgetCost');
  const prog = programmeProgress(data, p, today);
  const vals = valuationsFor(data, id);
  const lastCert = [...vals].reverse().find((v) => CERTIFIED_STATES.includes(v.status ?? ''));
  const lastFigures = lastCert ? valuationFigures(data, lastCert) : null;
  const retentionHeld = lastFigures?.retention ?? 0;
  const open = openValuations(data, id);
  const vos = variationsFor(data, id).sort((a, b) => str(b, 'instructedOn').localeCompare(str(a, 'instructedOn')));
  const voDef = act.def('variations');
  const valDef = act.def('valuations');
  const diaryAll = diarySummary(data, id);
  const diaryMonth = diarySummary(data, id, `${today.slice(0, 7)}-01`, today);
  const recentDiary = forProject(data, 'diary', id).sort((a, b) => str(b, 'date').localeCompare(str(a, 'date'))).slice(0, 5);
  const link = (mod: string, rid: string, text: string) => (hasModule(mod) ? <Link to={`${base}/${mod}/${rid}`}><b>{text}</b></Link> : <b>{text}</b>);

  const lastVal = vals[vals.length - 1];
  const valuationInitial: Values = {
    project: id, valuationNo: nextValuationNo(data, id), periodEnd: today,
    workDone: lastVal ? num(lastVal, 'workDone') : 0, materialsOnSite: 0, variationsToDate: approved,
  };

  return (
    <>
      <Panel title="Commercial position" meta="Excl. VAT · computed from variations, valuations, requisitions and plant hire">
        <KeyValues items={[
          { label: 'Original contract value', value: rand(toCents(contract)) },
          { label: `Approved variations (${variationsFor(data, id, 'approved').length})`, value: rand(toCents(approved)) },
          { label: 'Revised contract sum', value: <b>{rand(toCents(revised))}</b> },
          { label: 'Variations pending approval', value: rand(toCents(pending)) },
          { label: 'Certified to date', value: rand(toCents(certified)) },
          { label: `Retention held (${num(p, 'retentionPct')}%${lastFigures?.capped ? `, capped at ${RETENTION_CAP_PCT}% of contract` : ''})`, value: rand(retentionHeld) },
        ]} />
        <div style={{ marginTop: 14 }}>
          <Meters format={(n) => randShort(n)} items={[
            { label: 'Certified of revised contract sum', value: certified, max: revised || 1, tone: 'accent' as const, sub: `${revised ? Math.round((certified / revised) * 100) : 0}% certified` },
            { label: 'Cost to date of cost budget', value: cost.total, max: budget || 1, tone: cost.total > budget ? 'red' as const : cost.total > certified ? 'amber' as const : 'green' as const,
              sub: `Labour & subcontract ${randShort(cost.other)} · materials delivered ${randShort(cost.materials)} · plant hire ${randShort(cost.plant)}` },
          ]} />
        </div>
        <p className="muted-note" style={{ marginTop: 10 }}>Certified less cost to date: <b>{rand(toCents(certified - cost.total))}</b> (illustrative — not a cost report).</p>
      </Panel>

      <Panel title="Programme" meta={`${prog.pct}% complete · ${prog.elapsed}% of contract time elapsed · completion ${formatDate(completionDue(p))}${num(p, 'eotDaysGranted') ? ` (incl. ${num(p, 'eotDaysGranted')} d EOT)` : ''}`}
        right={hasModule('programme') ? <Link className="btn sm" to={`${base}/programme?project=${id}`}>Open programme</Link> : undefined}>
        {prog.tasks.length ? <Gantt project={p} tasks={prog.tasks} today={today} linkBase={hasModule('programme') ? `${base}/programme` : undefined} /> : <Empty title="No programme yet" body="Add tasks on the Programme page." />}
      </Panel>

      <Panel title="Variations" meta={`${vos.length} on record · approved ${randShort(approved)} · pending ${randShort(pending)}`}
        right={can('variations.record') && p.status !== 'final' ? <button className="btn sm" onClick={() => setCreating('variation')}><IcoPlus /> Record variation</button> : undefined}>
        {vos.length ? (
          <ul className="list">
            {vos.map((v) => (
              <li key={v.id}>
                <div className="grow">{link('variations', v.id, str(v, 'description'))}<small>{v.ref} · {str(v, 'instructionRef') || 'no SI ref'} · {num(v, 'value') ? rand(toCents(num(v, 'value'))) : 'not priced'} · {num(v, 'timeImpactDays')} d</small></div>
                <StatusTag workflow={voDef.workflow} status={v.status} />
              </li>
            ))}
          </ul>
        ) : <Empty title="No variations" />}
      </Panel>

      <Panel title="Payment valuations" meta="Cumulative monthly valuations — illustrative, not payment certificates"
        right={can('valuations') && ['onsite', 'practical'].includes(p.status ?? '') ? <button className="btn sm" disabled={open.length > 0} title={open.length ? 'Only one open valuation per project' : undefined} onClick={() => setCreating('valuation')}><IcoPlus /> New valuation</button> : undefined}>
        {open.length > 0 && can('valuations') && <div style={{ marginBottom: 10 }}><Notice tone="amber">{open[0].ref} is still open — only one open valuation per project.</Notice></div>}
        {vals.length ? (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>No.</th><th>Date</th><th className="num">Gross</th><th className="num">Retention</th><th className="num">Due (excl.)</th><th className="num">Certified</th><th>Status</th></tr></thead>
              <tbody>
                {[...vals].reverse().map((v) => {
                  const f = valuationFigures(data, v);
                  return (
                    <tr key={v.id}>
                      <td>{hasModule('valuations') ? <Link to={`${base}/valuations/${v.id}`}>{num(v, 'valuationNo')}</Link> : num(v, 'valuationNo')}</td>
                      <td>{formatDate(str(v, 'periodEnd'))}</td>
                      <td className="num">{randShort(f.gross / 100)}</td>
                      <td className="num">{randShort(f.retention / 100)}{f.capped ? ' (cap)' : ''}</td>
                      <td className="num">{rand(f.amountDue)}</td>
                      <td className="num">{str(v, 'certifiedAmount') ? rand(toCents(num(v, 'certifiedAmount'))) : '—'}</td>
                      <td><StatusTag workflow={valDef.workflow} status={v.status} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : <Empty title="No valuations yet" />}
      </Panel>

      <Panel title="Site diary" meta={`${diaryAll.entries} entries · ${diaryAll.signed} signed`} right={hasModule('diary') ? <Link className="btn sm" to={`${base}/diary`}>Site diary</Link> : undefined}>
        <KeyValues items={[
          { label: 'Rain days (all / this month)', value: `${diaryAll.rainDays} / ${diaryMonth.rainDays}` },
          { label: 'Employer-risk delay days', value: diaryAll.employerDelayDays },
          { label: 'Other delay days (contractor risk)', value: diaryAll.otherDelayDays },
          { label: 'Indicative EOT from diary', value: `${diaryAll.indicativeEot} d (granted ${num(p, 'eotDaysGranted')} d)` },
        ]} />
        {recentDiary.length > 0 && (
          <ul className="list" style={{ marginTop: 10 }}>
            {recentDiary.map((d) => (
              <li key={d.id}>
                <div className="grow">{link('diary', d.id, `${formatDate(str(d, 'date'))} · ${label(WEATHER, str(d, 'weather'))}`)}<small>{str(d, 'workDone')}</small></div>
                <span className={`tag ${d.status === 'signed' ? 'green' : 'amber'}`}>{d.status === 'signed' ? 'Signed' : 'Draft'}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="muted-note" style={{ marginTop: 10 }}>Indicative only: rain days plus employer-risk delays recorded in the diary. Not an extension-of-time claim.</p>
      </Panel>

      {creating === 'variation' && (
        <RecordFormModal def={voDef} open title={`Record variation — ${str(p, 'name')}`} initial={{ project: id, instructedOn: today, timeImpactDays: 0 }}
          onClose={() => setCreating(null)}
          onSave={(v) => { const r = act.create('variations', v, 'instructed', 'Instruction recorded'); act.toast(`Variation ${r.ref} recorded`); setCreating(null); navigate(`${base}/variations/${r.id}`); }} />
      )}
      {creating === 'valuation' && (
        <RecordFormModal def={valDef} open title={`New valuation — ${str(p, 'name')}`} initial={valuationInitial}
          onClose={() => setCreating(null)}
          onSave={(v) => { const r = act.create('valuations', v, 'draft', 'Valuation prepared'); act.toast(`Valuation ${r.ref} created`); setCreating(null); navigate(`${base}/valuations/${r.id}`); }} />
      )}
    </>
  );
}

function Aside({ id }: { id: string }) {
  const data = useData();
  const base = useBase();
  const act = useActions();
  const { can, hasModule } = useUser();
  const p = findRecord(data, 'projects', id)!;
  const snags = snagsFor(data, id);
  const open = snags.filter(snagOpen);
  const uncategorised = snags.filter((s) => !str(s, 'category'));
  const critical = open.filter((s) => str(s, 'category') === 'critical');
  const pcProblem = practicalCompletionProblem(p, data);
  const fcProblem = finalCompletionProblem(p, data);
  const tasks = tasksFor(data, id);
  // Each blocking snag is one click away from the check that names it.
  const snagLinks = (list: typeof snags) => list.map((s, i) => (
    <span key={s.id}>{i > 0 && '; '}{hasModule('snags') ? <Link to={`${base}/snags/${s.id}`}>{s.ref} {str(s, 'description')}</Link> : `${s.ref} ${str(s, 'description')}`}</span>
  ));
  return (
    <>
      <Panel title="Completion checks" meta="The same rules block practical and final completion">
        <ul className="list" data-testid="completion-checks">
          <Check ok={uncategorised.length === 0} label="Every snag categorised" detail={uncategorised.length ? snagLinks(uncategorised) : `${snags.length} snags on the list`} />
          <Check ok={critical.length === 0} label="No open critical snags" detail={critical.length ? snagLinks(critical) : 'None open'} />
          <Check ok={['practical', 'final'].includes(p.status ?? '') ? open.length === 0 : null} label="Snag list closed (final completion)" detail={`${open.length} open or awaiting verification`} />
          <Check ok={['practical', 'final'].includes(p.status ?? '') ? p.values.retentionReleaseCert === true : null} label="Retention release certificate (demo)" detail={p.values.retentionReleaseCert === true ? 'Recorded' : 'Not recorded'} />
        </ul>
        <div style={{ marginTop: 10 }}>
          {p.status === 'onsite' && <Notice tone={pcProblem ? 'amber' : 'accent'}>{pcProblem ? `${pcProblem} Open the snag above to fix it.` : 'Ready for practical completion — use “Certify practical completion” in the workflow panel.'}</Notice>}
          {p.status === 'practical' && <Notice tone={fcProblem ? 'amber' : 'accent'}>{fcProblem ?? 'Ready for final completion.'}</Notice>}
        </div>
        {p.status === 'practical' && can('projects.manage') && p.values.retentionReleaseCert !== true && (
          <button className="btn sm" style={{ marginTop: 10 }} onClick={() => { act.update('projects', id, { retentionReleaseCert: true }, 'Retention release certificate recorded (demo)'); act.toast('Retention release certificate recorded (demo)'); }}>Record retention release certificate</button>
        )}
      </Panel>
      <Panel title="Snag summary" right={hasModule('snags') ? <Link className="btn sm" to={`${base}/snags`}>Snag board</Link> : undefined}>
        <KeyValues items={[
          ...SNAG_CATEGORIES.map((c) => ({ label: `${c.label} open`, value: open.filter((s) => str(s, 'category') === c.value).length })),
          { label: 'Verified closed', value: snags.length - open.length },
        ]} />
      </Panel>
      <Panel title="Programme tasks" meta={`${tasks.filter((t) => t.status === 'complete').length} of ${tasks.length} complete`}>
        <p className="muted-note">Planned completion {formatDate(str(p, 'plannedCompletion'))} · contract completion incl. EOT {formatDate(completionDue(p))}.</p>
      </Panel>
    </>
  );
}
