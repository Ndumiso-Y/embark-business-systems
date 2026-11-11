import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { DemoRecord } from '../../../core/types';
import { useActions, useBase, useData, useIndustry, useUser } from '../../../core/context';
import { str } from '../../../core/engine';
import { addDays, formatDate, parseIso } from '../../../core/lib/dates';
import { Empty, Field, Flags, Modal, Notice, PageHeader, Panel, Segmented, Stat, StatusTag, Tag } from '../../../core/components/ui';
import { RecordTable } from '../../../core/components/records';
import { RecordFormModal } from '../../../core/components/fields';
import { IcoPlus } from '../../../core/components/Icons';
import { dayStaffing, fullName, shiftCleaners, siteName, staffByRef, staffing, todayStr } from '../helpers';
import { cleanerState, isRelief, useShiftActions } from './attendance';
import { StaffingTag } from './shared';

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const OFFSETS = ['-1', '0', '1', '2', '3'] as const;

/** Today's board: one card per site shift with its cleaners, staffing level and attendance actions. */
export default function Schedule() {
  const config = useIndustry();
  const data = useData();
  const base = useBase();
  const act = useActions();
  const navigate = useNavigate();
  const { can } = useUser();
  const shiftActions = useShiftActions();
  const today = todayStr();
  const def = act.def('shifts');
  const [offset, setOffset] = useState<(typeof OFFSETS)[number]>('0');
  const [creating, setCreating] = useState(false);
  const [absence, setAbsence] = useState<{ shift: DemoRecord; staff: DemoRecord } | null>(null);
  const [note, setNote] = useState('');
  const [err, setErr] = useState('');

  const date = addDays(today, Number(offset));
  const isToday = date === today;
  const s = dayStaffing(data, date);
  const dayLabel = (o: string) => (o === '0' ? 'Today' : o === '-1' ? 'Yesterday' : o === '1' ? 'Tomorrow' : `${DOW[parseIso(addDays(today, Number(o))).getDay()]} ${addDays(today, Number(o)).slice(8)}`);
  const toConfirm = s.shifts.filter((x) => x.status === 'draft').length;
  const toStart = s.shifts.filter((x) => ['draft', 'scheduled'].includes(x.status ?? '')).length;

  const confirmAbsence = () => {
    if (!absence) return;
    const problem = shiftActions.markAbsent(absence.shift, absence.staff, note);
    if (problem) { setErr(problem); return; }
    setAbsence(null); setNote(''); setErr('');
  };

  return (
    <>
      <PageHeader kicker={`${config.businessName} / Operations`} title="Daily schedule & attendance" subtitle="One shift per site per day. Clock cleaners in, log absences and arrange relief cover; the staffing level compares cleaners present with the number the contract promises."
        actions={can('schedule.manage') ? <button className="btn primary" onClick={() => setCreating(true)} data-testid="new-record"><IcoPlus /> New shift</button> : undefined} />
      <div className="toolbar">
        <Segmented label="Day" value={offset} onChange={setOffset} options={OFFSETS.map((o) => ({ value: o, label: dayLabel(o) }))} />
        <span className="toolbar-count">{formatDate(date)} · {s.shifts.length} shifts</span>
      </div>
      <div className="stat-grid">
        <Stat label={isToday ? 'Cleaners clocked in' : 'Cleaners present'} value={`${s.present}/${s.contracted}`} sub={isToday && toStart ? `${s.pct}% of the day’s contracted cleaners · ${toStart} shift${toStart === 1 ? '' : 's'} still to start` : `${s.pct}% of contracted cleaners`} tone={s.pct >= 95 ? 'accent' : undefined} />
        <Stat label="Sites short-staffed" value={s.short.length} tone={s.short.length ? 'red' : undefined} sub={s.short.slice(0, 2).map((x) => siteName(data, x.values.site)).join(' · ') || 'every site fully rostered'} />
        <Stat label="Late clock-ins" value={s.late} sub="more than 10 minutes after the start" />
        <Stat label="Unfilled places" value={s.unfilled} tone={s.unfilled ? 'red' : undefined} sub={toConfirm ? `${toConfirm} roster${toConfirm === 1 ? '' : 's'} still to confirm` : 'all rosters confirmed'} />
      </div>
      {!isToday && Number(offset) > 0 && <div style={{ marginBottom: 18 }}><Notice tone="grey">Cleaners can only be clocked in on the day. Open a shift to change its roster or confirm it.</Notice></div>}
      {s.shifts.length ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: 14, marginBottom: 18 }} data-testid="attendance-board">
          {s.shifts.map((shift) => {
            const st = staffing(shift, data);
            const started = !['draft', 'scheduled'].includes(shift.status ?? '');
            const live = isToday && shift.status !== 'completed' && shift.status !== 'draft';
            return (
              <article key={shift.id} className="board-card" data-testid={`shift-card-${shift.id}`}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
                  <div style={{ minWidth: 0 }}>
                    <Link to={`${base}/schedule/${shift.id}`}><strong>{siteName(data, shift.values.site)}</strong></Link>
                    <small style={{ display: 'block' }}>{shift.ref} · {str(shift, 'start')}–{str(shift, 'end')}</small>
                  </div>
                  <StaffingTag st={st} started={started} />
                </div>
                <div className="flags" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '4px 0' }}>
                  <StatusTag workflow={def.workflow} status={shift.status} />
                  <Flags flags={def.flags?.(shift, data, today) ?? []} />
                </div>
                <ul className="list" style={{ margin: 0 }}>
                  {shiftCleaners(shift).map((ref) => {
                    const p = staffByRef(data, ref);
                    const cs = cleanerState(shift, ref);
                    return (
                      <li key={ref} style={{ padding: '7px 0', gap: 8 }}>
                        <div className="grow">
                          <b style={{ fontSize: 12 }}>{fullName(p)}</b>
                          {isRelief(shift, ref) && <small>Relief cover</small>}
                        </div>
                        {cs.key === 'waiting' && live && p && can('attendance') ? (
                          <span className="btns" style={{ gap: 4, flexWrap: 'nowrap' }}>
                            <button className="btn xs primary" onClick={() => { const e = shiftActions.clockIn(shift, p); if (e) act.toast(e, 'err'); }} aria-label={`Clock in ${fullName(p)}`}>Clock in</button>
                            <button className="btn xs" onClick={() => { setAbsence({ shift, staff: p }); setNote(''); setErr(''); }} aria-label={`Mark ${fullName(p)} absent`}>Absent</button>
                          </span>
                        ) : <Tag tone={cs.tone}>{cs.label}</Tag>}
                      </li>
                    );
                  })}
                  {Array.from({ length: st.unfilled }, (_, i) => (
                    <li key={`u${i}`} style={{ padding: '7px 0' }}><div className="grow"><b style={{ fontSize: 12, color: 'var(--muted-2)' }}>Unfilled place</b></div><Tag tone="red">No cleaner</Tag></li>
                  ))}
                </ul>
                {shift.status === 'short' && <Link className="link-btn" to={`${base}/schedule/${shift.id}`} style={{ marginTop: 4 }}>Assign a relief cleaner →</Link>}
              </article>
            );
          })}
        </div>
      ) : <Panel><Empty title="No shifts on this day" body="Sites are serviced on their contracted days only." /></Panel>}
      <Panel title="Shifts" meta={`${formatDate(date)} · open a shift for its roster, checklist and history`}>
        <RecordTable def={def} rows={s.shifts} moduleKey="schedule" extra={{ head: 'Staffing', cell: (r) => <StaffingTag st={staffing(r, data)} started={!['draft', 'scheduled'].includes(r.status ?? '')} /> }} />
      </Panel>
      <Modal open={!!absence} title="Log absence" sub={absence ? `${fullName(absence.staff)} · ${siteName(data, absence.shift.values.site)} · a note is required` : ''} onClose={() => setAbsence(null)}
        footer={<><button className="btn" onClick={() => setAbsence(null)}>Cancel</button><button className="btn danger" onClick={confirmAbsence} data-testid="confirm-absence">Log absence</button></>}>
        <Field label="Reason / who was told" error={err || undefined}><textarea className="textarea" aria-label="Absence note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Phoned in sick at 05:40; client informed" /></Field>
      </Modal>
      {creating && (
        <RecordFormModal def={def} open title="New shift" initial={{ date: addDays(today, 1), start: '06:00', end: '14:00' }} onClose={() => setCreating(false)}
          onSave={(v) => {
            const r = act.create('shifts', { cleaners: '', clockIns: '', absentees: '', reliefs: '', checklist: '', ...v }, 'draft', 'Shift created — roster to confirm');
            act.toast(`Shift ${r.ref} created — add cleaners and confirm the roster`);
            setCreating(false);
            navigate(`${base}/schedule/${r.id}`);
          }} />
      )}
    </>
  );
}
