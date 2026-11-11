import { useState } from 'react';
import type { DemoRecord } from '../../../core/types';
import { useActions } from '../../../core/context';
import { str } from '../../../core/engine';
import { addDays, formatDate } from '../../../core/lib/dates';
import { Field, Modal, Notice } from '../../../core/components/ui';
import { todayStr } from '../helpers';

export const PRESCRIPTION_RULE = 'A prescription date cannot be postponed: the claim is lost if summons is not served in time. Serve process to interrupt prescription, then mark the entry done.';

/** Postpone a diary entry: the new date and the reason are captured together, then a new entry is created for the new date. */
export function PostponeModal({ entry, onClose, onDone }: { entry: DemoRecord; onClose: () => void; onDone?: () => void }) {
  const act = useActions();
  const today = todayStr();
  const from = str(entry, 'date') > today ? str(entry, 'date') : today;
  const [date, setDate] = useState(addDays(from, 7));
  const [note, setNote] = useState('');
  const [err, setErr] = useState('');
  const presc = str(entry, 'type') === 'prescription';
  const submit = () => {
    if (!date) return setErr('Choose the new date.');
    if (date <= str(entry, 'date')) return setErr(`The new date must be after ${formatDate(str(entry, 'date'))}.`);
    if (!note.trim()) return setErr('Say why it is postponed, e.g. “By agreement — opponent’s counsel unavailable”.');
    act.update('diary', entry.id, { newDate: date });
    const res = act.transition('diary', entry.id, 'postponed', note);
    if (!res.ok) { setErr(res.reason); return; }
    act.toast(`${entry.ref} postponed to ${formatDate(date)} — a new diary entry was created`);
    onClose();
    onDone?.();
  };
  return (
    <Modal open title={`Postpone · ${str(entry, 'title')}`} sub={`${entry.ref} · currently ${formatDate(str(entry, 'date'))}`} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>{presc ? 'Close' : 'Cancel'}</button>{!presc && <button className="btn primary" data-testid="confirm-postpone" onClick={submit}>Postpone</button>}</>}>
      {presc ? <Notice tone="red">{PRESCRIPTION_RULE}</Notice> : (
        <form className="stack" onSubmit={(e) => { e.preventDefault(); submit(); }} noValidate>
          <Field label="New date"><input className="input" type="date" aria-label="New date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
          <Field label="Reason (kept on the history)" error={err || undefined}><textarea className="textarea" aria-label="Postponement note" value={note} onChange={(e) => setNote(e.target.value)} /></Field>
          <p className="muted-note">This entry is closed as “Postponed” and a new one is created on the new date, so the old date stays on record.</p>
        </form>
      )}
    </Modal>
  );
}
