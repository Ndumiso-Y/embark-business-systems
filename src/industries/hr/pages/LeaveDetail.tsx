import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useActions, useData, useIndustry, useUser } from '../../../core/context';
import { findRecord, str } from '../../../core/engine';
import { formatDate } from '../../../core/lib/dates';
import { Field, KeyValues, Notice, Panel, Tag } from '../../../core/components/ui';
import { RecordDetail } from '../../../core/components/records';
import { SICK_CERT_AFTER } from '../data';
import {
  approverProblem, awayOn, balanceFor, clashText, emp, empName, fmtDays, fullName, isHr, jobLabel, leaveDays, leaveLabel, leaveRequestProblem, medicalCertProblem,
  needsMedicalCert, siteShort, teamClash, teamKey, teamLabelOf, teamLimit, teamMembers, todayStr, workingDaysIn,
} from '../helpers';
import { Check, EmpLink, LeaveTypeLabel } from './shared';
import { useFeedback } from './feedback';

/** One leave request: every approval rule with its own control (medical certificate, cover note). */
export default function LeaveDetail() {
  const config = useIndustry();
  const data = useData();
  const act = useActions();
  const { id } = useParams();
  const { user, can } = useUser();
  const fb = useFeedback();
  const [cover, setCover] = useState('');
  const r = findRecord(data, 'leave', id);
  if (!r) return <RecordDetail />;

  const today = todayStr();
  const e = emp(data, str(r, 'employee'));
  const mgr = emp(data, str(e, 'manager'));
  const days = leaveDays(r);
  const type = str(r, 'type');
  const open = r.status === 'requested';
  const bal = e ? balanceFor(data, e, type, today, r.id) : null;
  const ask = { id: r.id, employee: str(r, 'employee'), type, start: str(r, 'start'), end: str(r, 'end') };
  const requestProblem = leaveRequestProblem(data, ask, today);
  const who = approverProblem(data, user, r);
  const cert = medicalCertProblem(r);
  const clash = open ? teamClash(data, r) : null;
  const team = e ? teamMembers(data, e) : [];
  const canDecide = can('leave.approve') && !who;
  const canTickCert = (can('leave.hr') || canDecide) && ['requested', 'approved'].includes(r.status ?? '');
  // Colleagues away on any of these days.
  const alsoAway = new Map<string, Set<string>>();
  for (const d of workingDaysIn(str(r, 'start'), str(r, 'end'))) {
    for (const l of awayOn(data, d, (x) => x.id !== r.id && team.some((t) => t.id === str(x, 'employee')) && str(x, 'employee') !== str(r, 'employee'))) {
      const set = alsoAway.get(str(l, 'employee')) ?? new Set<string>();
      set.add(d);
      alsoAway.set(str(l, 'employee'), set);
    }
  }

  const tickCert = (on: boolean) => {
    act.update('leave', r.id, { medicalCert: on }, on ? 'Medical certificate received' : 'Medical certificate unticked');
    fb.ok(on ? 'Medical certificate recorded.' : 'Medical certificate removed.');
  };
  const approveWithNote = () => {
    if (!cover.trim()) { fb.fail('Write how the team’s work is covered on these days.'); return; }
    const res = act.transition('leave', r.id, 'approved', cover.trim());
    if (!res.ok) { fb.fail(res.reason); return; }
    setCover('');
    fb.ok('Approved with a cover note.');
  };

  const message = `Hi ${str(e, 'firstName')},\n\nYour ${leaveLabel(type).toLowerCase()} from ${formatDate(str(r, 'start'))} to ${formatDate(str(r, 'end'))} (${fmtDays(days)} working day${days === 1 ? '' : 's'}) has been ${r.status === 'declined' ? 'declined' : 'approved'} by ${str(r, 'decidedBy') || 'your manager'}.\n\n${config.businessName} HR`;

  return (
    <RecordDetail backLabel="Leave requests"
      aside={
        <Panel title="Employee">
          <KeyValues items={[
            { label: 'Employee', value: <EmpLink e={e} /> },
            { label: 'Job', value: `${jobLabel(e)} · ${siteShort(str(e, 'site'))}` },
            { label: 'Manager', value: mgr ? fullName(mgr) : '—' },
            { label: 'Type', value: <LeaveTypeLabel type={type} /> },
            { label: 'Working days', value: `${fmtDays(days)} (weekends and public holidays not counted)` },
            { label: bal ? `${bal.label} available` : 'Balance', value: bal ? `${fmtDays(bal.available)} days${open ? ` · ${fmtDays(bal.available - days)} after this request` : ''}` : 'No balance for this type' },
          ]} />
        </Panel>
      }>
      {open && (
        <Panel title="Checks before approval" meta="The same checks run when “Approve” is pressed" right={<Tag tone={approverProblem(data, user, r) || requestProblem || cert || clash ? 'amber' : 'green'}>{approverProblem(data, user, r) || requestProblem || cert || clash ? 'Not ready' : 'Ready to approve'}</Tag>}>
          <ul className="list" data-testid="leave-checks">
            <Check ok={!who} label="Who decides" detail={who ?? (isHr(user) ? 'You are in HR and may decide on anyone’s leave except your own.' : `You are ${empName(data, str(e, 'manager'))}, ${fullName(e)}’s manager.`)} />
            <Check ok={!requestProblem} label={bal ? `${bal.label} balance` : 'Dates and type'}
              detail={requestProblem ?? (bal ? `${fmtDays(bal.available)} days available (${bal.basis}); this request is ${fmtDays(days)}.` : `${leaveLabel(type)} has no balance in this demo; the dates are checked for overlaps.`)} />
            <Check ok={needsMedicalCert(r) ? !cert : null} label="Medical certificate"
              detail={needsMedicalCert(r) ? (cert ?? 'Received.') : type === 'sick' ? `Not needed for ${SICK_CERT_AFTER} days or fewer.` : 'Only for sick leave.'} />
            <Check ok={!clash} label="Team cover" detail={clash ? clashText(clash) : `${teamLabelOf(teamKey(e))}: ${team.length} people, at most ${teamLimit(team.length)} away on the same day.`} />
          </ul>
          {needsMedicalCert(r) && (
            <label className="check" style={{ display: 'flex', marginTop: 12 }} data-testid="medical-cert">
              <input type="checkbox" checked={!!r.values.medicalCert} disabled={!canTickCert} onChange={(ev) => tickCert(ev.target.checked)} /> Medical certificate received
            </label>
          )}
          {clash && (
            <div style={{ marginTop: 14 }} data-testid="team-cover">
              <h3 style={{ margin: '0 0 6px', fontSize: 13 }}>Team cover</h3>
              <Notice tone="amber">{clashText(clash)} Approving would put {clash.away.length + 1} people away. Approve only with a note saying how the work is covered — otherwise decline or ask for other dates.</Notice>
              {canDecide && (
                <>
                  <Field label="Cover note (required to approve)" className="span-2"><textarea className="textarea" aria-label="Cover note" value={cover} onChange={(ev) => setCover(ev.target.value)} placeholder="e.g. Kevin moves from receiving to picking on those days; overtime approved for Saturday." /></Field>
                  <button className="btn sm primary" style={{ marginTop: 8 }} onClick={approveWithNote} data-testid="approve-with-note">Approve with cover note</button>
                </>
              )}
            </div>
          )}
          {fb.view}
        </Panel>
      )}
      {alsoAway.size > 0 && (
        <Panel title="Also away from the team" meta={`${teamLabelOf(teamKey(e))} · approved or taken leave on these days`}>
          <ul className="list">
            {[...alsoAway].map(([empId, set]) => <li key={empId}><div className="grow"><b>{empName(data, empId)}</b><small>{[...set].map((d) => formatDate(d).slice(0, 6)).join(', ')}</small></div><Tag tone="blue">{set.size} day{set.size === 1 ? '' : 's'}</Tag></li>)}
          </ul>
        </Panel>
      )}
      {['approved', 'taken', 'declined'].includes(r.status ?? '') && (
        <Panel title="Message to the employee" meta="Preview only — not sent">
          <div className="hr-preview" data-testid="leave-message">{message}</div>
          {str(r, 'coverNote') && <p className="muted-note" style={{ marginTop: 10 }}>Cover note: {str(r, 'coverNote')}</p>}
        </Panel>
      )}
    </RecordDetail>
  );
}
