import { Link } from 'react-router-dom';
import { useBase, useData } from '../../../core/context';
import { records, str } from '../../../core/engine';
import { addDays, daysBetween, formatDate } from '../../../core/lib/dates';
import { Panel, Stat } from '../../../core/components/ui';
import { RegisterPage } from '../../../core/components/records';
import { SPACES } from '../data';
import { bookingClash, bookingFigures, overlaps, plural, randBig, todayStr } from '../helpers';
import { MallStyles } from './shared';

const WINDOW = 42;
const TONES: Record<string, string> = { live: '#cfe6d3', confirmed: '#f0d1e5', quoted: '#cddcf3', enquiry: '#e9e9e4' };

/** Bookings register with a six-week view of each space, so clashes are visible before they are refused. */
export default function Bookings() {
  const data = useData();
  const base = useBase();
  const today = todayStr();
  const end = addDays(today, WINDOW - 1);
  const all = records(data, 'bookings');
  const open = all.filter((b) => ['enquiry', 'quoted', 'confirmed', 'live'].includes(b.status ?? ''));
  const inWindow = open.filter((b) => str(b, 'startDate') && overlaps(str(b, 'startDate'), str(b, 'endDate'), today, end));
  const live = all.filter((b) => b.status === 'live');
  const confirmed = all.filter((b) => b.status === 'confirmed');
  const clashes = all.filter((b) => ['enquiry', 'quoted'].includes(b.status ?? '') && bookingClash(data, b));
  const income = [...live, ...confirmed].reduce((n, b) => n + bookingFigures(b).net, 0);
  return (
    <RegisterPage>
      <MallStyles />
      <div className="stat-grid">
        <Stat label="Live now" value={live.length} tone="accent" sub="exhibitors on the mall today" />
        <Stat label="Confirmed ahead" value={confirmed.length} sub="deposit received, space held" />
        <Stat label="Would clash" value={clashes.length} tone={clashes.length ? 'red' : undefined} sub="enquiries or quotes for dates already confirmed" />
        <Stat label="Exhibition income" value={randBig(income)} sub="live and confirmed bookings, excl. VAT" />
      </div>
      <Panel title="Spaces — next six weeks" meta={`${formatDate(today)} to ${formatDate(end)} · held bookings on the top row, enquiries and quotes below · a space cannot be confirmed twice for the same dates`}>
        <div className="mall-cal" data-testid="space-calendar">
          {SPACES.map((s) => {
            const list = inWindow.filter((b) => str(b, 'space') === s.value).sort((a, b) => str(a, 'startDate').localeCompare(str(b, 'startDate')));
            return (
              <div className="mall-cal-row" key={s.value}>
                <b>{s.label}</b>
                <div className="mall-cal-track" title={list.length ? plural(list.length, 'booking') : 'Free'}>
                  {list.map((b) => {
                    const from = Math.max(0, daysBetween(today, str(b, 'startDate')));
                    const to = Math.min(WINDOW - 1, daysBetween(today, str(b, 'endDate')));
                    const held = ['confirmed', 'live'].includes(b.status ?? '');
                    return (
                      <Link key={b.id} to={`${base}/bookings/${b.id}`} className="mall-cal-bar" title={`${str(b, 'exhibitor')} · ${formatDate(str(b, 'startDate'))} – ${formatDate(str(b, 'endDate'))} · ${b.status}`}
                        style={{ left: `${(from / WINDOW) * 100}%`, width: `${((to - from + 1) / WINDOW) * 100}%`, background: TONES[b.status ?? 'enquiry'], top: held ? 3 : 24, border: bookingClash(data, b) && !held ? '1px solid #b4605a' : undefined }}>
                        {str(b, 'exhibitor')}
                      </Link>
                    );
                  })}
                  <span className="mall-cal-today" style={{ left: 0 }} />
                </div>
              </div>
            );
          })}
        </div>
        <div className="mall-legend" style={{ marginTop: 12, marginBottom: 0 }}>
          {Object.entries(TONES).map(([k, c]) => <span key={k}><i style={{ background: c }} />{k[0].toUpperCase() + k.slice(1)}</span>)}
          <span><i style={{ background: '#fff', borderColor: '#b4605a' }} />Clashes with a confirmed booking</span>
        </div>
      </Panel>
      <div className="section-gap" />
    </RegisterPage>
  );
}
