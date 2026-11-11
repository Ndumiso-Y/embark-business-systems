import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { Values } from '../../../core/types';
import { useActions, useBase, useData, useIndustry, useUser } from '../../../core/context';
import { findRecord, lines, linesTotals, num, records, str } from '../../../core/engine';
import { addDays, formatDate } from '../../../core/lib/dates';
import { formatRand } from '../../../core/lib/money';
import { DueTag, Empty, KeyValues, Panel, StatusTag } from '../../../core/components/ui';
import { RecordDetail } from '../../../core/components/records';
import { RecordFormModal } from '../../../core/components/fields';
import { JOB_TYPES, TECHNICIANS, label } from '../data';
import { activeJobFor, jobInvoice, planClash, serviceDue, todayStr } from '../helpers';
import { km } from './format';

export default function VehicleProfile() {
  const { id } = useParams();
  const data = useData();
  const v = findRecord(data, 'vehicles', id);
  return (
    <RecordDetail aside={v ? <Aside id={v.id} /> : undefined}>
      {v && <History id={v.id} />}
    </RecordDetail>
  );
}

function History({ id }: { id: string }) {
  const config = useIndustry();
  const data = useData();
  const base = useBase();
  const { hasModule } = useUser();
  const wf = config.collections.find((c) => c.key === 'jobs')!.workflow;
  const jobs = records(data, 'jobs').filter((j) => str(j, 'vehicle') === id).sort((a, b) => str(b, 'workDate').localeCompare(str(a, 'workDate')) || b.ref.localeCompare(a.ref));
  return (
    <Panel title="Service history" meta="Every job card for this vehicle with odometer, technician and invoice value">
      {jobs.length ? (
        <ul className="list" data-testid="service-history">
          {jobs.map((j) => {
            const inv = jobInvoice(data, j.id);
            return (
              <li key={j.id}>
                <span className="time-chip">{formatDate(str(j, 'workDate'))}</span>
                <div className="grow">
                  {hasModule('jobs') ? <Link to={`${base}/jobs/${j.id}`}><b>{label(JOB_TYPES, str(j, 'jobType'))}</b></Link> : <b>{label(JOB_TYPES, str(j, 'jobType'))}</b>}
                  <small>{j.ref} · {str(j, 'complaint')}</small>
                  <small>{str(j, 'odometerIn') ? km(num(j, 'odometerIn')) : 'odometer not yet recorded'} · {label(TECHNICIANS, str(j, 'technician'))}{inv ? ` · ${inv.ref} ${formatRand(linesTotals(lines(inv)).total)}` : ''}</small>
                </div>
                <StatusTag workflow={wf} status={j.status} />
              </li>
            );
          })}
        </ul>
      ) : <Empty title="No job cards yet" body="Book the first job card from the panel on the right." />}
    </Panel>
  );
}

function Aside({ id }: { id: string }) {
  const data = useData();
  const act = useActions();
  const base = useBase();
  const { can } = useUser();
  const [booking, setBooking] = useState(false);
  const v = findRecord(data, 'vehicles', id)!;
  const today = todayStr();
  const due = serviceDue(v, today);
  const open = activeJobFor(data, id);
  const c = findRecord(data, 'customers', str(v, 'customer'));
  return (
    <>
      <Panel title="Next service" right={<DueTag state={due.state} label={due.state === 'ok' ? 'Not yet due' : due.state === 'overdue' ? `Overdue${due.by === 'km' ? ' (km)' : ''}` : undefined} />}>
        <KeyValues items={[
          { label: 'Due by date', value: `${formatDate(str(v, 'nextServiceDate'))}${due.daysLeft !== null ? ` (${due.daysLeft < 0 ? `${-due.daysLeft} days ago` : `in ${due.daysLeft} days`})` : ''}` },
          { label: 'Due by km', value: str(v, 'nextServiceKm') ? `${km(num(v, 'nextServiceKm'))}${due.kmLeft !== null ? ` (${due.kmLeft <= 0 ? `${km(-due.kmLeft)} over` : `${km(due.kmLeft)} to go`})` : ''}` : '—' },
          { label: 'Estimated odometer today', value: km(due.estKm) },
          { label: 'Last service', value: formatDate(str(v, 'lastServiceDate')) },
        ]} />
        <p className="muted-note" style={{ marginTop: 10 }}>Interval: 12 months or 15,000 km, whichever comes first. Kilometres are estimated from the last reading and typical monthly distance.</p>
        {open ? <p className="muted-note" style={{ marginTop: 8 }}>Open job card: <Link to={`${base}/jobs/${open.id}`}>{open.ref}</Link></p>
          : can('jobs.manage') && <button className="btn sm primary" style={{ marginTop: 12 }} data-testid="book-vehicle" onClick={() => setBooking(true)}>Book job card</button>}
      </Panel>
      {c && (
        <Panel title="Owner">
          <p className="muted-note"><Link to={`${base}/customers/${c.id}`}><b>{str(c, 'name')}</b></Link><br />{str(c, 'phone')} · {str(c, 'email')}</p>
        </Panel>
      )}
      {booking && (
        <RecordFormModal def={act.def('jobs')} open title={`Book ${str(v, 'reg')}`}
          initial={{ vehicle: id, jobType: due.state === 'none' ? 'repair' : 'service-minor', complaint: due.state === 'ok' || due.state === 'none' ? '' : 'Scheduled service due.', workDate: addDays(today, 1), startTime: '08:00', hoursBooked: 1.5, promisedDate: addDays(today, 1), promisedTime: '16:30' }}
          onClose={() => setBooking(false)}
          onSave={(vals: Values) => {
            const clash = planClash(data, { workDate: String(vals.workDate), startTime: String(vals.startTime ?? ''), hoursBooked: Number(vals.hoursBooked) || 0, bay: String(vals.bay ?? ''), technician: String(vals.technician ?? '') });
            if (clash) { act.toast(clash, 'err'); return; }
            const j = act.create('jobs', vals, 'booked', 'Job card booked');
            act.toast(`Job card ${j.ref} booked`);
            setBooking(false);
          }} />
      )}
    </>
  );
}
