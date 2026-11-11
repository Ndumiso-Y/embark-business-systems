import { useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import type { DemoRecord, Values } from '../../../core/types';
import { useActions, useBase, useData, useIndustry, useUser } from '../../../core/context';
import { findRecord, records, str } from '../../../core/engine';
import { addDays, formatDate } from '../../../core/lib/dates';
import { Empty, Notice, PageHeader, Panel, Segmented, Stat } from '../../../core/components/ui';
import { RecordTable } from '../../../core/components/records';
import { RecordFormModal } from '../../../core/components/fields';
import { IcoArrow, IcoBack, IcoPlus } from '../../../core/components/Icons';
import { label, VIEWING_KINDS } from '../data';
import { agentName, bookingProblem, byDateTime, ffcState, leadName, listingName, todayStr } from '../helpers';

const SLOTS = Array.from({ length: 20 }, (_, i) => `${String(8 + Math.floor(i / 2)).padStart(2, '0')}:${i % 2 ? '30' : '00'}`);
const slotOf = (t: string) => `${t.slice(0, 2)}:${Number(t.slice(3, 5)) >= 30 ? '30' : '00'}`;

export default function Viewings() {
  const config = useIndustry();
  const data = useData();
  const act = useActions();
  const { can } = useUser();
  const def = act.def('viewings');
  const [date, setDate] = useState(todayStr());
  const [view, setView] = useState<'planner' | 'list' | 'all'>('planner');
  const [booking, setBooking] = useState<Values | null>(null);
  const today = todayStr();
  const all = records(data, 'viewings');
  const dayRows = all.filter((v) => str(v, 'date') === date).sort(byDateTime);
  const outstanding = all.filter((v) => v.status === 'booked' && str(v, 'date') < today).sort(byDateTime);
  // Sales hosts: every agent who is not the rental agent-only profile, plus anyone with a viewing that day.
  const agents = records(data, 'agents').filter((a) => str(a, 'userId') !== 'u_rental' || dayRows.some((v) => str(v, 'agent') === a.id));
  const isToday = date === today;

  const save = (v: Values) => {
    const p = bookingProblem(data, v, today);
    if (p) { act.toast(p, 'err'); return; }
    const r = act.create('viewings', v, 'booked', 'Viewing booked');
    const lead = findRecord(data, 'leads', String(v.lead ?? ''));
    if (lead && ['new', 'contacted'].includes(lead.status ?? '')) act.transition('leads', lead.id, 'viewing');
    act.toast(`Viewing ${r.ref} booked — ${listingName(data, v.listing)} at ${String(v.time)}`);
    setBooking(null);
    setDate(String(v.date));
  };

  return (
    <>
      <PageHeader kicker={`${config.businessName} / Sales`} title="Viewings & show days" subtitle="Book viewings per agent, then record the buyer’s feedback and interest level — a viewing cannot be completed without them."
        actions={can('leads') ? <button className="btn primary" data-testid="new-viewing" onClick={() => setBooking({ date: date < today ? today : date, time: '10:00', kind: 'private' })}><IcoPlus /> Book viewing</button> : undefined} />
      <div className="toolbar diary-nav">
        <button className="btn sm" aria-label="Previous day" onClick={() => setDate(addDays(date, -1))}><IcoBack /></button>
        <input className="input sm" type="date" aria-label="Viewing date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} style={{ width: 160 }} />
        <button className="btn sm" aria-label="Next day" onClick={() => setDate(addDays(date, 1))}><IcoArrow /></button>
        {!isToday && <button className="btn sm" onClick={() => setDate(today)}>Today</button>}
        <b className="diary-date">{formatDate(date)}{isToday ? ' · today' : ''}</b>
        <div style={{ marginLeft: 'auto' }}>
          <Segmented label="Viewings view" value={view} onChange={setView} options={[{ value: 'planner', label: 'Planner' }, { value: 'list', label: 'Day list' }, { value: 'all', label: 'All viewings' }]} />
        </div>
      </div>
      <div className="stat-grid compact">
        <Stat label="Viewings" value={dayRows.filter((v) => v.status !== 'cancelled').length} />
        <Stat label="Show days" value={dayRows.filter((v) => str(v, 'kind') === 'showday').length} tone="accent" />
        <Stat label="Completed" value={dayRows.filter((v) => v.status === 'completed').length} />
        <Stat label="Feedback outstanding" value={outstanding.length} tone={outstanding.length ? 'red' : undefined} sub="Booked viewings in the past" />
      </div>
      <div className="section-gap" />
      {outstanding.length > 0 && (
        <Notice tone="amber"><b>Feedback outstanding:</b> {outstanding.map((v) => `${v.ref} (${formatDate(str(v, 'date'))}, ${listingName(data, v.values.listing)})`).join('; ')}. Open the viewing, record the interest level and feedback, then complete it.</Notice>
      )}
      {view === 'planner' && (
        <Panel pad>
          <div className="planner" style={{ '--cols': agents.length } as CSSProperties} data-testid="viewing-planner">
            <div />
            {agents.map((a) => <div key={a.id} className="planner-head">{str(a, 'name')}<small>{ffcState(a, today) === 'expired' ? 'FFC expired — cannot host' : 'Agent'}</small></div>)}
            {SLOTS.map((t) => (
              <Row key={t} t={t} rows={dayRows} agents={agents} canBook={can('leads') && date >= today} onBook={(agentId) => setBooking({ date, time: t, agent: agentId, kind: 'private' })} />
            ))}
          </div>
          <p className="muted-note" style={{ marginTop: 12 }}>Click an empty slot to book. Viewings can only be booked on listed or under-offer properties, and not with an agent whose (fictional) FFC has expired.</p>
        </Panel>
      )}
      {view === 'list' && <Panel>{dayRows.length ? <RecordTable def={def} rows={dayRows} moduleKey="viewings" /> : <Empty title="No viewings on this day" />}</Panel>}
      {view === 'all' && <Panel><RecordTable def={def} rows={[...all].sort(def.sort)} moduleKey="viewings" /></Panel>}
      {booking && <RecordFormModal def={def} initial={booking} open title="Book viewing" onClose={() => setBooking(null)} onSave={save} />}
    </>
  );
}

function Row({ t, rows, agents, canBook, onBook }: { t: string; rows: DemoRecord[]; agents: DemoRecord[]; canBook: boolean; onBook: (agentId: string) => void }) {
  const data = useData();
  const base = useBase();
  const config = useIndustry();
  const wf = config.collections.find((c) => c.key === 'viewings')!.workflow!;
  const today = todayStr();
  return (
    <>
      <div className="planner-time">{t}</div>
      {agents.map((a) => {
        const here = rows.filter((v) => str(v, 'agent') === a.id && slotOf(str(v, 'time')) === t);
        if (!here.length) {
          return canBook && ffcState(a, today) !== 'expired'
            ? <button key={a.id} type="button" className="planner-slot free" aria-label={`Book ${str(a, 'name')} at ${t}`} onClick={() => onBook(a.id)}><span>+ Book</span></button>
            : <div key={a.id} className="planner-slot" />;
        }
        return (
          <div key={a.id} className="planner-slot filled">
            {here.map((v) => {
              const st = wf.states.find((s) => s.key === v.status);
              return (
                <Link key={v.id} to={`${base}/viewings/${v.id}`} className={`appt tone-${st?.tone ?? 'dark'}`} data-testid="viewing-appt">
                  <b>{listingName(data, v.values.listing)}</b>
                  <small>{str(v, 'time')} · {str(v, 'lead') ? leadName(data, v.values.lead) : label(VIEWING_KINDS, str(v, 'kind'))}</small>
                  <small>{st?.label} · {agentName(data, v.values.agent).split(' ')[0]}</small>
                </Link>
              );
            })}
          </div>
        );
      })}
    </>
  );
}
