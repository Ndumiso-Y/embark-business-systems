import { Link } from 'react-router-dom';
import { useBase, useData, useUser } from '../../../core/context';
import { records, str } from '../../../core/engine';
import { addDays, formatDate } from '../../../core/lib/dates';
import { Empty, Notice, Panel, Tag } from '../../../core/components/ui';
import { RegisterPage } from '../../../core/components/records';
import { EVENT_KINDS, label } from '../data';
import { todayStr } from '../helpers';

/** Notice register with the next weeks of the school calendar alongside. */
export default function Notices() {
  const data = useData();
  const base = useBase();
  const { hasModule } = useUser();
  const today = todayStr();
  const horizon = addDays(today, 35);
  const upcoming = records(data, 'events').filter((e) => (str(e, 'endDate') || str(e, 'date')) >= today && str(e, 'date') <= horizon).sort((a, b) => str(a, 'date').localeCompare(str(b, 'date')));
  const notices = records(data, 'notices');

  return (
    <RegisterPage>
      <div className="grid-2">
        <Panel title="How notices work here">
          <Notice tone="accent">A notice is drafted, approved by the deputy or principal, then “logged as sent” — with a preview of the message and a count of the families it would reach. Nothing is actually sent from this demo.</Notice>
          <div className="mini-stat-row" style={{ marginTop: 14 }}>
            <span><b>{notices.filter((n) => n.status === 'draft').length}</b>drafts</span>
            <span><b>{notices.filter((n) => n.status === 'approved').length}</b>approved, to log as sent</span>
            <span><b>{notices.filter((n) => n.status === 'sent').length}</b>logged as sent</span>
          </div>
        </Panel>
        <Panel title="Coming up" meta="The next five weeks on the term calendar" right={hasModule('calendar') ? <Link className="btn sm" to={`${base}/calendar`}>Term calendar</Link> : undefined}>
          {upcoming.length ? (
            <ul className="list" data-testid="upcoming-events">
              {upcoming.slice(0, 6).map((e) => (
                <li key={e.id} style={{ padding: '8px 0' }}>
                  <span className="time-chip">{formatDate(str(e, 'date')).slice(0, 6)}</span>
                  <div className="grow"><b>{str(e, 'title')}</b>{str(e, 'endDate') && <small>until {formatDate(str(e, 'endDate'))}</small>}</div>
                  <Tag tone={str(e, 'date') <= today ? 'accent' : 'dark'}>{label(EVENT_KINDS, str(e, 'kind'))}</Tag>
                </li>
              ))}
            </ul>
          ) : <Empty title="Nothing on the calendar" />}
        </Panel>
      </div>
    </RegisterPage>
  );
}
