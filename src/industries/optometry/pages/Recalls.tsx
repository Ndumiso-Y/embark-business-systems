import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { DemoRecord } from '../../../core/types';
import { useActions, useBase, useData, useIndustry, useUser } from '../../../core/context';
import { records, str } from '../../../core/engine';
import { addDays, daysBetween, formatDate } from '../../../core/lib/dates';
import { DueTag, Empty, Modal, Notice, PageHeader, Panel, Segmented, Stat, Tag } from '../../../core/components/ui';
import { RecordFormModal } from '../../../core/components/fields';
import { IcoSend } from '../../../core/components/Icons';
import { RECALL_TYPES, label } from '../data';
import { dueRecalls, todayStr } from '../helpers';

const TEMPLATES: Record<string, string> = {
  annual: 'Hi {first}, it’s time for your routine eye examination at Northgate Optometry. Reply or call to book a time that suits you.',
  cl: 'Hi {first}, your contact lens aftercare check is due. Regular checks keep your eyes healthy — reply or call to book.',
  diabetic: 'Hi {first}, your diabetic eye review is due. Please reply or call us to book.',
  child: 'Hi, {first}’s children’s vision review is due. Reply or call us to book a time after school.',
  iop: 'Hi {first}, your follow-up eye pressure check is due. Please call us to book.',
};

export default function Recalls() {
  const config = useIndustry();
  const data = useData();
  const base = useBase();
  const act = useActions();
  const { can, hasModule } = useUser();
  const today = todayStr();
  const [scope, setScope] = useState<'due' | 'all'>('due');
  const [contacting, setContacting] = useState<DemoRecord | null>(null);
  const [booking, setBooking] = useState<DemoRecord | null>(null);
  const due = dueRecalls(data, today);
  const all = records(data, 'patients').filter((p) => str(p, 'recallDue')).sort((a, b) => str(a, 'recallDue').localeCompare(str(b, 'recallDue')));
  const rows = scope === 'due' ? due : all;
  const booked = (p: DemoRecord) => records(data, 'appointments').some((a) => str(a, 'patient') === p.id && a.status === 'booked' && str(a, 'date') >= today);
  const contactedRecently = (p: DemoRecord) => str(p, 'lastContacted') && daysBetween(str(p, 'lastContacted'), today) <= 14;

  return (
    <>
      <PageHeader kicker={`${config.businessName} / Front desk`} title="Recalls" subtitle="Patients due for their next exam, aftercare or review. Reminders are logged, never sent, in this demo." />
      <div className="stat-grid">
        <Stat label="Overdue" value={due.filter((p) => str(p, 'recallDue') < today).length} tone="red" />
        <Stat label="Due in 45 days" value={due.filter((p) => str(p, 'recallDue') >= today).length} />
        <Stat label="Already booked" value={due.filter(booked).length} tone="accent" />
        <Stat label="No reminder consent" value={due.filter((p) => !p.values.consentRecall).length} sub="Contact only when they visit" />
      </div>
      <div className="section-gap" />
      <Panel title="Recall list" right={<Segmented label="Recall scope" value={scope} onChange={setScope} options={[{ value: 'due', label: 'Due & overdue' }, { value: 'all', label: 'All patients' }]} />} pad>
        {rows.length ? (
          <div className="table-wrap">
            <table className="table" data-testid="recall-table">
              <thead><tr><th>Patient</th><th>Reason</th><th>Due</th><th>Last contact</th><th>Status</th><th /></tr></thead>
              <tbody>
                {rows.map((p) => {
                  const overdue = str(p, 'recallDue') < today;
                  return (
                    <tr key={p.id}>
                      <td>{hasModule('patients') ? <Link to={`${base}/patients/${p.id}`}><strong>{str(p, 'firstName')} {str(p, 'lastName')}</strong></Link> : <strong>{str(p, 'firstName')} {str(p, 'lastName')}</strong>}<small>{str(p, 'phone')} · prefers {str(p, 'preferredContact') || 'SMS'}</small></td>
                      <td>{label(RECALL_TYPES, str(p, 'recallType'))}</td>
                      <td>{formatDate(str(p, 'recallDue'))}<br /><DueTag state={overdue ? 'overdue' : daysBetween(today, str(p, 'recallDue')) <= 45 ? 'due-soon' : 'ok'} label={overdue ? `${daysBetween(str(p, 'recallDue'), today)} days overdue` : undefined} /></td>
                      <td>{str(p, 'lastContacted') ? formatDate(str(p, 'lastContacted')) : '—'}</td>
                      <td>{booked(p) ? <Tag tone="green">Booked</Tag> : !p.values.consentRecall ? <Tag tone="dark">No consent</Tag> : contactedRecently(p) ? <Tag tone="blue">Contacted</Tag> : <Tag tone="amber">To contact</Tag>}</td>
                      <td>
                        <div className="btns" style={{ flexWrap: 'nowrap' }}>
                          {!booked(p) && p.values.consentRecall && can('bookings') && <button className="btn xs" onClick={() => setContacting(p)}><IcoSend /> Remind</button>}
                          {!booked(p) && can('bookings') && <button className="btn xs primary" onClick={() => setBooking(p)}>Book</button>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : <Empty title="No recalls due" />}
      </Panel>
      <Modal open={!!contacting} title="Recall reminder" sub={contacting ? `To ${str(contacting, 'firstName')} ${str(contacting, 'lastName')} via ${str(contacting, 'preferredContact') || 'SMS'}` : ''} onClose={() => setContacting(null)}
        footer={<><button className="btn" onClick={() => setContacting(null)}>Cancel</button><button className="btn primary" data-testid="log-reminder" onClick={() => {
          act.update('patients', contacting!.id, { lastContacted: today }, 'Recall reminder logged (not sent)');
          act.toast('Reminder logged — no message was sent'); setContacting(null);
        }}>Log reminder (demo)</button></>}>
        {contacting && <div className="sms-preview">{(TEMPLATES[str(contacting, 'recallType')] ?? TEMPLATES.annual).replace('{first}', str(contacting, 'firstName'))}</div>}
        <Notice tone="grey">Nothing is sent. Production use needs a messaging provider, opt-out handling and recorded consent.</Notice>
      </Modal>
      {booking && (
        <RecordFormModal def={act.def('appointments')} open title={`Book ${str(booking, 'firstName')} ${str(booking, 'lastName')}`}
          initial={{ patient: booking.id, type: str(booking, 'recallType') === 'cl' ? 'claftercare' : str(booking, 'recallType') === 'diabetic' ? 'diabetic' : str(booking, 'recallType') === 'child' ? 'child' : 'exam', date: addDays(today, 2), time: '10:00', practitioner: 'sd' }}
          onClose={() => setBooking(null)}
          onSave={(v) => { act.create('appointments', v, 'booked', 'Booked from recall list'); act.toast('Appointment booked from recall'); setBooking(null); }} />
      )}
    </>
  );
}
