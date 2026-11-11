// Per-cleaner attendance state and the attendance actions shared by the board and the shift page.
import type { DemoRecord } from '../../../core/types';
import { useActions } from '../../../core/context';
import { str } from '../../../core/engine';
import { LATE_GRACE_MIN } from '../data';
import { clockInTime, clockIns, fullName, minutes, shiftAbsent, shiftReliefs, toCsv, withClockIn } from '../helpers';

/** How one cleaner stands on one shift. */
export function cleanerState(shift: DemoRecord, ref: string): { key: 'absent' | 'late' | 'in' | 'waiting'; label: string; tone: 'red' | 'amber' | 'green' | 'dark' } {
  if (shiftAbsent(shift).includes(ref)) return { key: 'absent', label: 'Absent', tone: 'red' };
  const t = clockIns(shift)[ref];
  if (!t) return { key: 'waiting', label: shift.status === 'completed' ? 'No clock-in' : 'Not clocked in', tone: 'dark' };
  const late = minutes(t) > minutes(str(shift, 'start')) + LATE_GRACE_MIN;
  return late ? { key: 'late', label: `Late · ${t}`, tone: 'amber' } : { key: 'in', label: `In · ${t}`, tone: 'green' };
}
export const isRelief = (shift: DemoRecord, ref: string) => shiftReliefs(shift).includes(ref);

/**
 * Attendance actions used by the board and the shift page. Values are stored on the shift
 * first and the workflow step then reads them, so the same rules apply from either screen.
 * Each returns an error message when the step is refused.
 */
export function useShiftActions() {
  const act = useActions();
  return {
    clockIn(shift: DemoRecord, staff: DemoRecord): string | null {
      const { time, adjusted } = clockInTime(shift);
      act.update('shifts', shift.id, { clockIns: withClockIn(shift, staff.ref, time) }, `Clocked in: ${fullName(staff)} at ${time}`);
      if (shift.status === 'scheduled') {
        const res = act.transition('shifts', shift.id, 'clockedin');
        if (!res.ok) return res.reason;
      }
      act.toast(adjusted
        ? `${fullName(staff)} clocked in at ${time} — the shift start is stamped because it is outside this shift’s hours right now (demo)`
        : `${fullName(staff)} clocked in at ${time}`);
      return null;
    },
    markAbsent(shift: DemoRecord, staff: DemoRecord, note: string): string | null {
      if (!note.trim()) return 'A note is required: say why the cleaner is absent.';
      const before = str(shift, 'absentees');
      const text = `${fullName(staff)} absent — ${note.trim()}`;
      if (shift.status === 'short') {
        act.update('shifts', shift.id, { absentees: toCsv([...shiftAbsent(shift), staff.ref]) }, 'Absence logged', text);
      } else {
        act.update('shifts', shift.id, { absentees: toCsv([...shiftAbsent(shift), staff.ref]) });
        const res = act.transition('shifts', shift.id, 'short', text);
        if (!res.ok) { act.update('shifts', shift.id, { absentees: before }); return res.reason; }
      }
      act.toast(`${fullName(staff)} marked absent — relief needed`, 'info');
      return null;
    },
    assignRelief(shift: DemoRecord, staff: DemoRecord): string | null {
      act.update('shifts', shift.id, { reliefPick: staff.id });
      const res = act.transition('shifts', shift.id, 'relief');
      if (!res.ok) { act.update('shifts', shift.id, { reliefPick: '' }); return res.reason; }
      return null;
    },
  };
}
