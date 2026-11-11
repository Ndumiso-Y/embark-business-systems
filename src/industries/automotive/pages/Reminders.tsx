import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { DemoRecord } from '../../../core/types';
import { useActions, useBase, useData, useIndustry, useUser } from '../../../core/context';
import { findRecord, num, records, str } from '../../../core/engine';
import { addDays, daysBetween, formatDate } from '../../../core/lib/dates';
import { DueTag, Empty, Modal, Notice, PageHeader, Panel, Segmented, Stat, Tag } from '../../../core/components/ui';
import { RecordFormModal } from '../../../core/components/fields';
import { IcoSend } from '../../../core/components/Icons';
import { CONTACT_METHODS, label } from '../data';
import { activeJobFor, planClash, serviceDue, todayStr } from '../helpers';
import { km } from './format';

export default function Reminders() {
  const config = useIndustry();
  const data = useData();
  const base = useBase();
  const act = useActions();
  const { can, hasModule } = useUser();
  const today = todayStr();
  const [scope, setScope] = useState<'due' | 'all'>('due');
  const [contacting, setContacting] = useState<DemoRecord | null>(null);
  const [booking, setBooking] = useState<DemoRecord | null>(null);
  const all = records(data, 'vehicles').map((v) => ({ v, due: serviceDue(v, today) }));
  const due = all.filter((x) => x.due.state === 'overdue' || x.due.state === 'due-soon')
    .sort((a, b) => (a.due.state === b.due.state ? (a.due.daysLeft ?? 0) - (b.due.daysLeft ?? 0) : a.due.state === 'overdue' ? -1 : 1));
  const rows = scope === 'due' ? due : [...all].sort((a, b) => str(a.v, 'nextServiceDate').localeCompare(str(b.v, 'nextServiceDate')));
  const owner = (v: DemoRecord) => findRecord(data, 'customers', str(v, 'customer'));
  const booked = (v: DemoRecord) => !!activeJobFor(data, v.id);
  const consent = (v: DemoRecord) => owner(v)?.values.consentReminders === true;
  const contacted = (v: DemoRecord) => !!str(v, 'lastReminder') && daysBetween(str(v, 'lastReminder'), today) <= 21;
  const mayAct = can('jobs.manage') || can('customers');

  const message = (v: DemoRecord) => {
    const c = owner(v);
    const d = serviceDue(v, today);
    const first = (str(c, 'contactPerson') || str(c, 'name')).split(' ')[0];
    const why = d.by === 'km' ? `it is due by kilometres (about ${km(d.estKm)} on the clock vs ${km(num(v, 'nextServiceKm'))})` : `it was due on ${formatDate(str(v, 'nextServiceDate'))}`;
    return `Hi ${first}, a friendly reminder from ${config.businessName}: your ${str(v, 'make')} ${str(v, 'model')} (${str(v, 'reg')}) is ${d.state === 'overdue' ? 'overdue' : 'due'} for its service — ${why}. Reply with a day that suits you and we'll book it in.`;
  };

  return (
    <>
      <PageHeader kicker={`${config.businessName} / Front office`} title="Service reminders" subtitle="Vehicles due by date (12 months) or by estimated kilometres (15,000 km). Reminders are previewed and logged — never sent." />
      <div className="stat-grid">
        <Stat label="Overdue" value={due.filter((x) => x.due.state === 'overdue').length} tone="red" sub={`${due.filter((x) => x.due.state === 'overdue' && x.due.by === 'km').length} by kilometres`} />
        <Stat label="Due in 30 days / 1,000 km" value={due.filter((x) => x.due.state === 'due-soon').length} />
        <Stat label="Already booked" value={due.filter((x) => booked(x.v)).length} tone="accent" />
        <Stat label="No reminder consent" value={due.filter((x) => !consent(x.v)).length} sub="Mention it at their next visit" />
      </div>
      <div className="section-gap" />
      <Panel title="Reminder list" right={<Segmented label="Reminder scope" value={scope} onChange={setScope} options={[{ value: 'due', label: 'Due & overdue' }, { value: 'all', label: 'All vehicles' }]} />} pad>
        {rows.length ? (
          <div className="table-wrap">
            <table className="table" data-testid="reminder-table">
              <thead><tr><th>Vehicle</th><th>Owner</th><th>Due</th><th>Last reminder</th><th>Status</th><th /></tr></thead>
              <tbody>
                {rows.map(({ v, due: d }) => {
                  const c = owner(v);
                  return (
                    <tr key={v.id}>
                      <td>{hasModule('vehicles') ? <Link to={`${base}/vehicles/${v.id}`}><strong>{str(v, 'reg')}</strong></Link> : <strong>{str(v, 'reg')}</strong>}<small>{str(v, 'year')} {str(v, 'make')} {str(v, 'model')}</small></td>
                      <td>{str(c, 'name')}<small>{str(c, 'phone')} · prefers {label(CONTACT_METHODS, str(c, 'preferredContact'))}</small></td>
                      <td>
                        {formatDate(str(v, 'nextServiceDate'))} or {km(num(v, 'nextServiceKm'))}
                        <small>~{km(d.estKm)} now (estimated)</small>
                        <DueTag state={d.state} label={d.state === 'overdue' ? (d.by === 'km' ? `${km(-(d.kmLeft ?? 0))} over` : `${-(d.daysLeft ?? 0)} days overdue`) : d.state === 'due-soon' ? (d.by === 'km' ? `${km(d.kmLeft ?? 0)} to go` : `in ${d.daysLeft} days`) : undefined} />
                      </td>
                      <td>{str(v, 'lastReminder') ? formatDate(str(v, 'lastReminder')) : '—'}</td>
                      <td>{booked(v) ? <Tag tone="green">Booked</Tag> : !consent(v) ? <Tag tone="dark">No consent</Tag> : contacted(v) ? <Tag tone="blue">Reminded</Tag> : <Tag tone="amber">To contact</Tag>}</td>
                      <td>
                        <div className="btns" style={{ flexWrap: 'nowrap' }}>
                          {!booked(v) && consent(v) && mayAct && <button className="btn xs" onClick={() => setContacting(v)}><IcoSend /> Remind</button>}
                          {!booked(v) && can('jobs.manage') && <button className="btn xs primary" onClick={() => setBooking(v)}>Book</button>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : <Empty title="No services due" />}
      </Panel>
      <Modal open={!!contacting} title="Service reminder" sub={contacting ? `To ${str(owner(contacting), 'name')} via ${label(CONTACT_METHODS, str(owner(contacting), 'preferredContact'))}` : ''} onClose={() => setContacting(null)}
        footer={<><button className="btn" onClick={() => setContacting(null)}>Cancel</button><button className="btn primary" data-testid="log-reminder" onClick={() => {
          act.update('vehicles', contacting!.id, { lastReminder: today }, 'Service reminder logged (not sent)');
          act.toast('Reminder logged — no message was sent'); setContacting(null);
        }}>Log reminder (demo)</button></>}>
        {contacting && <div className="sms-preview">{message(contacting)}</div>}
        <Notice tone="grey">Nothing is sent. Production use needs a messaging provider, opt-out handling and recorded consent.</Notice>
      </Modal>
      {booking && (
        <RecordFormModal def={act.def('jobs')} open title={`Book ${str(booking, 'reg')}`}
          initial={{ vehicle: booking.id, jobType: serviceDue(booking, today).by === 'km' ? 'service-major' : 'service-minor', complaint: 'Scheduled service from reminder list.', workDate: addDays(today, 2), startTime: '08:00', hoursBooked: 1.5, promisedDate: addDays(today, 2), promisedTime: '16:30' }}
          onClose={() => setBooking(null)}
          onSave={(vals) => {
            const clash = planClash(data, { workDate: String(vals.workDate), startTime: String(vals.startTime ?? ''), hoursBooked: Number(vals.hoursBooked) || 0, bay: String(vals.bay ?? ''), technician: String(vals.technician ?? '') });
            if (clash) { act.toast(clash, 'err'); return; }
            const j = act.create('jobs', vals, 'booked', 'Booked from service reminders');
            act.toast(`Job card ${j.ref} booked from reminder — it is on the workshop board and the planner`); setBooking(null);
          }} />
      )}
    </>
  );
}
