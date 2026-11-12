import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useActions, useData, useIndustry, useUser } from '../../../core/context';
import { findRecord, str } from '../../../core/engine';
import { formatDate } from '../../../core/lib/dates';
import { Field, KeyValues, Notice, Panel, Tag } from '../../../core/components/ui';
import { RecordDetail } from '../../../core/components/records';
import { IcoPrint } from '../../../core/components/Icons';
import { level, subjectLabel } from '../data';
import {
  classOf, familyOf, fullName, isFrozen, pct, releaseMessage, reportAttendance, reportAverage, reportLearner, reportResults, signBlockers, subjectAverage, termLabel,
} from '../helpers';
import { useFeedback } from './feedback';
import { Check, ModuleLink, WhoCan } from './shared';

const PRINT = '@media print { .doc-grid { display: block !important; } .doc-grid .panel:not(.rc-sheet), .page-kicker, .title-row, .guide, .toasts { display: none !important; } .rc-sheet { border: 0 !important; box-shadow: none !important; } }';

/** One learner's report card for a term: readiness checks, the teacher's comment, the printable sheet and the release preview. */
export default function ReportDetail() {
  const config = useIndustry();
  const data = useData();
  const act = useActions();
  const { id } = useParams();
  const { can } = useUser();
  const fb = useFeedback();
  const report = findRecord(data, 'reports', id);
  const [draft, setDraft] = useState<string | null>(null);
  if (!report) return <RecordDetail />;

  const learner = reportLearner(data, report);
  const cls = classOf(data, learner);
  const term = str(report, 'term');
  const results = reportResults(report, data);
  const average = reportAverage(results);
  const att = reportAttendance(report, data);
  const blockers = signBlockers(report, data);
  const open = report.status === 'draft' || report.status === 'commented';
  const mayComment = open && can('reports.comment');
  const comment = draft ?? str(report, 'comment');
  const family = familyOf(data, learner);
  const teacher = fullName(findRecord(data, 'staff', str(cls, 'teacher')));

  const saveComment = () => {
    const text = comment.trim();
    act.update('reports', report.id, { comment: text }, 'Teacher comment saved');
    setDraft(null);
    if (report.status !== 'draft') { fb.ok('Comment updated.'); return; }
    const res = act.transition('reports', report.id, 'commented');
    if (!res.ok) { fb.fail(res.reason); return; }
    act.toast(`${report.ref}: comment submitted for sign-off`);
    fb.ok('Comment submitted. The report card now waits for the principal’s sign-off.');
  };

  return (
    <RecordDetail hideTransitions={['commented']}
      aside={
        <>
          <Panel title="Sign-off" right={<Tag tone={isFrozen(report) ? 'green' : 'dark'}>{isFrozen(report) ? 'Figures frozen' : 'Figures still live'}</Tag>}>
            <KeyValues items={[
              { label: 'Signed by', value: str(report, 'signedBy') || (isFrozen(report) ? 'The principal' : 'Not signed yet') },
              { label: 'Signed on', value: str(report, 'signedOn') ? formatDate(str(report, 'signedOn')) : '—' },
              { label: 'Released', value: str(report, 'releasedOn') ? formatDate(str(report, 'releasedOn')) : 'Not released' },
            ]} />
            <p className="muted-note" style={{ marginTop: 10 }}>Until sign-off the figures follow the published marks and registers. Signing freezes them on the report.</p>
          </Panel>
          {isFrozen(report) && (
            <Panel title="Message to the parent" meta="Preview only — no message is sent from this demo">
              <div className="sms-preview" data-testid="release-preview">{releaseMessage(config.businessName, report, data)}</div>
              <p className="muted-note">To: {str(family, 'guardian1') || 'first guardian'} · {str(family, 'phone1')} (fictional). {report.status === 'released' ? 'The release was logged in the history; nothing left this browser.' : 'Shown when the report is released.'}</p>
            </Panel>
          )}
        </>
      }>
      <style>{PRINT}</style>
      {open && (
        <Panel title="Before sign-off" meta="The principal can only sign when every subject has published marks and the teacher has commented"
          right={<Tag tone={blockers.length ? 'amber' : 'green'}>{blockers.length ? `${blockers.length} to do` : 'Ready for sign-off'}</Tag>}>
          <ul className="list" data-testid="sign-checklist">
            {blockers.length === 0 && <Check ok label="Marks published in every subject, and the teacher’s comment is in" />}
            {blockers.map((b) => <Check key={b.text} ok={false} label={b.task ? <ModuleLink module="assessments" id={b.task.id}>{b.text}</ModuleLink> : b.text} detail={b.task ? `${b.task.ref} — open it to capture, moderate and publish the marks` : b.text === 'No teacher comment yet' ? 'Write it under “Teacher comment” below' : undefined} />)}
          </ul>
        </Panel>
      )}
      {open && (
        <Panel title="Teacher comment" meta={`Written by the class teacher${teacher !== '—' ? ` (${teacher})` : ''}`}>
          {mayComment ? (
            <>
              <Field label="Comment for the report card"><textarea className="textarea" aria-label="Teacher comment" value={comment} onChange={(e) => setDraft(e.target.value)} placeholder="e.g. A pleasing term. Keep reading every evening." /></Field>
              <div className="btns" style={{ marginTop: 10 }}>
                <button className="btn primary sm" onClick={saveComment} disabled={report.status !== 'draft' && draft === null} data-testid="submit-comment">{report.status === 'draft' ? 'Submit comment' : 'Update comment'}</button>
              </div>
            </>
          ) : <p style={{ fontSize: 13, color: 'var(--ink-2)' }}>{str(report, 'comment') || 'No comment yet.'}</p>}
          {fb.view}
          <WhoCan permission="reports.comment" what="Writing the comment:" />
        </Panel>
      )}
      <Panel className="rc-sheet" title="Report card" meta="Print-friendly — the watermark prints too" right={<button className="btn sm" onClick={() => window.print()} data-testid="print-report"><IcoPrint /> Print</button>}>
        <div style={{ position: 'relative', overflow: 'hidden' }} data-testid="report-sheet">
          <div aria-hidden="true" data-testid="watermark" style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', fontSize: 'clamp(26px, 7vw, 60px)', fontWeight: 800, letterSpacing: 6, color: 'var(--accent)', opacity: 0.1, transform: 'rotate(-22deg)' }}>DEMONSTRATION</div>
          <div className="doc-head">
            <div>
              <div className="page-kicker" style={{ marginBottom: 2 }}>{config.businessName}</div>
              <div className="doc-title" style={{ marginTop: 4 }}>{fullName(learner)}</div>
              <div className="doc-id">{str(cls, 'name') || 'No class'} · class teacher {teacher} · {learner?.ref}</div>
            </div>
            <div className="doc-meta">Report card<b>{termLabel(term)}</b></div>
          </div>
          <div className="table-wrap" style={{ marginTop: 14 }}>
            <table className="table" data-testid="report-results">
              <thead><tr><th>Subject</th><th className="num">Term %</th><th className="num">Class average</th><th>Level (demo scale)</th></tr></thead>
              <tbody>
                {results.map((r) => (
                  <tr key={r.subject}>
                    <td><strong>{subjectLabel(r.subject)}</strong></td>
                    <td className="num">{pct(r.pct)}</td>
                    <td className="num">{pct(cls ? subjectAverage(data, cls.id, r.subject, term) : null)}</td>
                    <td>{level(r.pct).label}</td>
                  </tr>
                ))}
                <tr><td><strong>Average</strong></td><td className="num"><strong>{pct(average)}</strong></td><td /><td>{average === null ? '' : level(average).label}</td></tr>
              </tbody>
            </table>
          </div>
          <div style={{ height: 18 }} />
          <KeyValues items={[
            { label: 'Attendance', value: att.days ? `Present ${att.present} of ${att.days} school days (${att.pct}%)` : 'No registers for this term yet' },
            { label: 'Principal', value: str(report, 'signedBy') ? `${str(report, 'signedBy')} · signed ${formatDate(str(report, 'signedOn'))}` : isFrozen(report) ? 'Signed by the principal' : 'Not signed yet' },
            { label: 'Class teacher’s comment', value: str(report, 'comment') || 'No comment yet', wide: true },
          ]} />
          <p className="muted-note" style={{ marginTop: 14 }}>Demonstration document for a fictional learner — not an official school report. Percentages and levels follow demo rules, not CAPS promotion policy.</p>
        </div>
      </Panel>
      {!open && blockers.length === 0 && report.status === 'signed' && <Notice tone="accent">Signed. “Release to parents” above logs the release and shows the message a parent would get — nothing is sent.</Notice>}
    </RecordDetail>
  );
}
