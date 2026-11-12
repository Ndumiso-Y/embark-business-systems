import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useActions, useData, useUser } from '../../../core/context';
import { findRecord, str } from '../../../core/engine';
import { addDays, formatDate } from '../../../core/lib/dates';
import { Field, KeyValues, Notice, Panel, Tag } from '../../../core/components/ui';
import { RecordDetail } from '../../../core/components/records';
import { className, familyOf, fullName, isMerit, learnerPoints, todayStr } from '../helpers';
import { useFeedback } from './feedback';
import { ModuleLink, WhoCan } from './shared';

/** An incident or merit: parent contact, detention and outcome each have their own control. */
export default function DisciplineDetail() {
  const data = useData();
  const act = useActions();
  const { id } = useParams();
  const { can } = useUser();
  const fb = useFeedback();
  const r = findRecord(data, 'discipline', id);
  const [contact, setContact] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<{ text: string; detention: boolean; date: string } | null>(null);
  if (!r) return <RecordDetail />;

  const today = todayStr();
  const merit = isMerit(r);
  const learner = findRecord(data, 'learners', str(r, 'learner'));
  const family = familyOf(data, learner);
  const points = learner ? learnerPoints(data, learner.id) : null;
  const open = r.status !== 'resolved';
  const editable = open && can('discipline');
  const serious = str(r, 'severity') === 'serious';
  const contactText = contact ?? str(r, 'parentNote');
  const of = outcome ?? { text: str(r, 'resolution'), detention: r.values.detention === true, date: str(r, 'detentionDate') };

  const saveContact = () => {
    if (!contactText.trim()) { fb.fail('Say how and when the parent was contacted, and what was agreed.'); return; }
    act.update('discipline', r.id, { parentNote: contactText.trim() }, 'Parent contact recorded', contactText.trim());
    setContact(null);
    if (r.status !== 'logged') { fb.ok('Parent contact updated.'); return; }
    const res = act.transition('discipline', r.id, 'contacted');
    if (!res.ok) { fb.fail(res.reason); return; }
    fb.ok(`Parent contact recorded. Next: record the outcome below, then “Resolve”${serious ? ' — a serious incident is resolved by the deputy or the principal' : ''}.`);
  };
  const saveOutcome = () => {
    if (!of.text.trim()) { fb.fail('Describe the outcome: what was decided or done.'); return; }
    if (of.detention && !of.date) { fb.fail('Choose the detention date.'); return; }
    act.update('discipline', r.id, { resolution: of.text.trim(), detention: of.detention, detentionDate: of.detention ? of.date : '' }, of.detention ? `Outcome recorded — detention on ${formatDate(of.date)}` : 'Outcome recorded', of.text.trim());
    setOutcome(null);
    fb.ok('Outcome saved. Press “Resolve” above to close the record.');
  };

  return (
    <RecordDetail hideTransitions={['contacted']}
      aside={
        <Panel title="Learner" right={points ? <Tag tone={points.net < 0 ? 'amber' : 'green'}>Net {points.net > 0 ? '+' : ''}{points.net} points</Tag> : undefined}>
          <KeyValues items={[
            { label: 'Learner', value: learner ? <ModuleLink module="learners" id={learner.id}>{fullName(learner)}</ModuleLink> : '—' },
            { label: 'Class', value: className(data, str(learner, 'class')) },
            { label: 'Parent / guardian', value: str(family, 'guardian1') },
            { label: 'Phone (fictional)', value: str(family, 'phone1') },
            { label: 'Merit points', value: points ? `+${points.merits}` : '—' },
            { label: 'Demerit points', value: points ? `−${points.demerits}` : '—' },
          ]} />
          {points && points.records.length > 1 && <p className="muted-note" style={{ marginTop: 10 }}>{points.records.length - 1} other record{points.records.length === 2 ? '' : 's'} for this learner — see the learner’s profile.</p>}
        </Panel>
      }>
      {merit ? (
        <Notice tone="accent">A merit needs no parent contact or outcome. {open ? '“Resolve” above confirms the award; the points already count on the learner’s profile.' : 'The points count on the learner’s profile.'}</Notice>
      ) : (
        <>
          <Panel title="Parent contact" meta="How and when the parent was told, and what was agreed" right={<Tag tone={str(r, 'parentNote') ? 'green' : 'amber'}>{str(r, 'parentNote') ? 'Contacted' : 'Not contacted yet'}</Tag>}>
            {editable ? (
              <>
                <Field label="Contact note"><textarea className="textarea" aria-label="Parent contact note" value={contactText} onChange={(e) => setContact(e.target.value)} placeholder="e.g. Phoned the mother at 14:10; she will speak to him tonight" /></Field>
                <div className="btns" style={{ marginTop: 10 }}>
                  <button className="btn primary sm" onClick={saveContact} disabled={r.status !== 'logged' && contact === null} data-testid="save-contact">{r.status === 'logged' ? 'Record parent contact' : 'Update contact note'}</button>
                </div>
              </>
            ) : <p style={{ fontSize: 13, color: 'var(--ink-2)' }}>{str(r, 'parentNote') || 'No contact recorded.'}</p>}
            <p className="muted-note" style={{ marginTop: 8 }}>A note only — no call, SMS or email is made from this demo.</p>
          </Panel>
          <Panel title="Outcome" meta={serious ? 'Serious incident: the outcome is decided and resolved by the deputy or the principal' : 'What was decided: warning, detention, restitution …'}
            right={r.values.detention === true ? <Tag tone="dark">{str(r, 'detentionDate') ? `Detention ${formatDate(str(r, 'detentionDate'))}` : 'Detention'}</Tag> : undefined}>
            {editable ? (
              <>
                <Field label="Outcome"><textarea className="textarea" aria-label="Outcome" value={of.text} onChange={(e) => setOutcome({ ...of, text: e.target.value })} placeholder="e.g. Verbal warning; apology to the class" /></Field>
                <div className="toolbar" style={{ marginTop: 10, marginBottom: 0 }}>
                  <label className="check"><input type="checkbox" checked={of.detention} onChange={(e) => setOutcome({ ...of, detention: e.target.checked, date: e.target.checked ? of.date || addDays(today, 2) : '' })} /> Detention</label>
                  {of.detention && <input className="input" style={{ width: 'auto', height: 38 }} type="date" aria-label="Detention date" min={today} value={of.date} onChange={(e) => setOutcome({ ...of, date: e.target.value })} />}
                  <button className="btn sm" onClick={saveOutcome} disabled={outcome === null} data-testid="save-outcome">Save outcome</button>
                </div>
              </>
            ) : <p style={{ fontSize: 13, color: 'var(--ink-2)' }}>{str(r, 'resolution') || 'No outcome recorded.'}</p>}
            {fb.view}
            {open && <WhoCan permission="discipline" what="Updating this record:" />}
            {open && serious && <WhoCan permission="discipline.serious" what="Resolving a serious incident:" />}
          </Panel>
        </>
      )}
    </RecordDetail>
  );
}
