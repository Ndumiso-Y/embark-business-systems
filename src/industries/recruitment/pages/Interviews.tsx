import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { records, searchText, str } from '../../../core/engine';
import { useBase, useData, useIndustry, useUser } from '../../../core/context';
import { addDays, formatDate, parseIso } from '../../../core/lib/dates';
import { IcoPlus, IcoSearch } from '../../../core/components/Icons';
import { Empty, Flags, Modal, PageHeader, Panel, Stat, Tag } from '../../../core/components/ui';
import { RecordTable } from '../../../core/components/records';
import { FORMATS, ROUNDS, label } from '../data';
import { candidateName, jobTitle, mondayOf, submissionOf, todayStr } from '../helpers';
import { BookInterview } from './interview';

const DOW = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** Interview diary: the next two weeks by day, feedback still to capture, and every interview. */
export default function Interviews() {
  const config = useIndustry();
  const data = useData();
  const base = useBase();
  const navigate = useNavigate();
  const { user, can } = useUser();
  const today = todayStr();
  const [booking, setBooking] = useState(false);
  const [q, setQ] = useState('');
  const def = config.collections.find((c) => c.key === 'interviews')!;
  const all = records(data, 'interviews');
  const upcoming = all.filter((i) => i.status === 'scheduled' && str(i, 'date') >= today && str(i, 'date') <= addDays(today, 14))
    .sort((a, b) => (str(a, 'date') + str(a, 'time')).localeCompare(str(b, 'date') + str(b, 'time')));
  const outstanding = all.filter((i) => i.status === 'scheduled' && str(i, 'date') < today);
  const weekFrom = mondayOf(today);
  const weekTo = addDays(today, 6) > addDays(weekFrom, 6) ? addDays(today, 6) : addDays(weekFrom, 6);
  const thisWeek = all.filter((i) => i.status !== 'cancelled' && str(i, 'date') >= weekFrom && str(i, 'date') <= weekTo);
  const days = [...new Set(upcoming.map((i) => str(i, 'date')))];
  const who = (iv: typeof all[number]) => { const s = submissionOf(data, str(iv, 'submission')); return { name: candidateName(data, str(s, 'candidate')), job: jobTitle(data, str(s, 'job')) }; };
  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return [...all].sort(def.sort).filter((r) => !needle || searchText(def, r, data).includes(needle));
  }, [all, def, data, q]);
  return (
    <>
      <PageHeader kicker={`${config.businessName} / Desk`} title="Interviews" subtitle={config.modules.find((m) => m.key === 'interviews')!.description}
        actions={can('interviews') ? <button className="btn primary" onClick={() => setBooking(true)} data-testid="new-interview"><IcoPlus /> Book interview</button> : undefined} />
      <div className="stat-grid">
        <Stat label="This week" value={thisWeek.length} tone="accent" sub={`${formatDate(weekFrom)} – ${formatDate(weekTo)}`} />
        <Stat label="Today" value={upcoming.filter((i) => str(i, 'date') === today).length} sub="scheduled for today" />
        <Stat label="Feedback outstanding" value={outstanding.length} tone={outstanding.length ? 'red' : undefined} sub="interviews held, feedback not captured" />
        <Stat label="Next 14 days" value={upcoming.length} sub={`${new Set(upcoming.map((i) => str(submissionOf(data, str(i, 'submission')), 'candidate'))).size} candidates`} />
      </div>
      <div className="grid-2">
        <Panel title="Next two weeks" meta="By day and time · the clash check stops a candidate being double-booked">
          {days.length ? days.map((d) => (
            <div key={d} style={{ marginBottom: 10 }}>
              <h3 className="panel-title" style={{ fontSize: 13 }}>{d === today ? 'Today' : DOW[parseIso(d).getDay()]} · {formatDate(d)}</h3>
              <ul className="list" data-testid={`day-${d}`}>
                {upcoming.filter((i) => str(i, 'date') === d).map((i) => (
                  <li key={i.id}>
                    <span className="time-chip">{str(i, 'time')}</span>
                    <div className="grow">
                      <Link to={`${base}/interviews/${i.id}`}><b>{who(i).name}</b></Link>
                      <small>{who(i).job}</small>
                      <small>{label(ROUNDS, str(i, 'round'))} · {label(FORMATS, str(i, 'format'))} · {str(i, 'interviewer')}</small>
                    </div>
                    <Flags flags={def.flags?.(i, data, today, user) ?? []} />
                  </li>
                ))}
              </ul>
            </div>
          )) : <Empty title="No interviews booked in the next two weeks" />}
        </Panel>
        <Panel title="Feedback outstanding" meta="Interviews that have happened — capture the client’s feedback">
          {outstanding.length ? (
            <ul className="list" data-testid="feedback-outstanding">
              {outstanding.map((i) => (
                <li key={i.id}>
                  <span className="time-chip">{formatDate(str(i, 'date')).slice(0, 6)}</span>
                  <div className="grow"><Link to={`${base}/interviews/${i.id}`}><b>{who(i).name}</b></Link><small>{who(i).job}</small></div>
                  <Tag tone="red">Feedback due</Tag>
                </li>
              ))}
            </ul>
          ) : <Empty title="All feedback captured" body="Feedback from every interview that has taken place is on record." />}
        </Panel>
      </div>
      <Panel title="All interviews" meta="Newest first">
        <div className="toolbar">
          <label className="search-box"><IcoSearch /><input aria-label="Search interviews" placeholder="Search interviews" value={q} onChange={(e) => setQ(e.target.value)} /></label>
          <span className="toolbar-count">{rows.length} shown</span>
        </div>
        <RecordTable def={def} rows={rows} moduleKey="interviews" />
      </Panel>
      <Modal open={booking} wide title="Book an interview" sub="The candidate must have been submitted to the client. Reminders are previewed on the interview, never sent." onClose={() => setBooking(false)}>
        <BookInterview onDone={(id) => { setBooking(false); navigate(`${base}/interviews/${id}`); }} />
      </Modal>
    </>
  );
}
