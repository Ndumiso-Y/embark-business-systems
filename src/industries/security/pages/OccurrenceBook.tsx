import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useActions, useBase, useData, useIndustry, useUser } from '../../../core/context';
import { records, str } from '../../../core/engine';
import { addDays, formatDate } from '../../../core/lib/dates';
import { Empty, Field, Notice, PageHeader, Panel, Stat, StatusTag, Tag } from '../../../core/components/ui';
import { WorkflowActions } from '../../../core/components/records';
import { IcoArrow, IcoBack, IcoLock } from '../../../core/components/Icons';
import { OB_TYPES, SHIFT_SHORT, label } from '../data';
import { currentSlot, handoverEntry, prevSlot, siteName } from '../helpers';
import { useClock } from './format';

export default function OccurrenceBook() {
  const config = useIndustry();
  const data = useData();
  const base = useBase();
  const act = useActions();
  const { user, can } = useUser();
  const { today, time } = useClock();
  const def = act.def('ob');
  const sites = records(data, 'sites');
  const [site, setSite] = useState('');
  const [date, setDate] = useState(today);
  const [form, setForm] = useState({ site: '', type: 'routine', time: '', entry: '', by: '' });
  const [err, setErr] = useState('');
  const all = records(data, 'ob');
  const rows = all.filter((e) => str(e, 'date') === date && (!site || str(e, 'site') === site)).sort((a, b) => str(a, 'time').localeCompare(str(b, 'time')) || a.ref.localeCompare(b.ref));
  const drafts = all.filter((e) => e.status === 'draft');
  const cur = currentSlot(today, time);
  const prev = prevSlot(cur);
  const handedOver = sites.filter((s) => handoverEntry(data, s.id, prev.date, prev.kind)).length;
  const handedNow = sites.filter((s) => handoverEntry(data, s.id, cur.date, cur.kind)).length;

  const add = (sign: boolean) => {
    const target = form.site || site;
    if (!target) { setErr('Choose the site whose occurrence book you are writing in.'); return; }
    if (!form.entry.trim()) { setErr('Write the entry.'); return; }
    const t = form.time || time;
    const r = act.create('ob', { site: target, date: today, time: t, shift: currentSlot(today, t).kind, type: form.type, entry: form.entry.trim(), by: form.by.trim() || user.name }, 'draft', 'Entry written');
    if (sign) {
      const res = act.transition('ob', r.id, 'signed');
      if (!res.ok) act.toast(res.reason, 'err');
    }
    act.toast(`${r.ref} ${sign ? 'written and signed' : 'saved as a draft'} — ${siteName(data, target)}`);
    setForm({ ...form, entry: '', time: '' });
    setErr('');
    setDate(today);
  };

  return (
    <>
      <PageHeader kicker={`${config.businessName} / Control room`} title="Occurrence book" subtitle="Numbered, time-stamped entries per site. Once an entry is signed it is locked — corrections are made with a follow-up entry, never by editing." />
      <div className="stat-grid compact">
        <Stat label={`Entries on ${formatDate(date)}`} value={rows.length} sub={site ? siteName(data, site) : 'all sites'} />
        <Stat label="Unsigned drafts" value={drafts.length} tone={drafts.length ? 'red' : undefined} sub="entries still open to correction" />
        <Stat label="Last shift handed over" value={`${handedOver}/${sites.length}`} tone={handedOver < sites.length ? 'red' : 'accent'} sub={`${SHIFT_SHORT[prev.kind]} shift, ${formatDate(prev.date)}`} />
        <Stat label="Current shift handovers" value={`${handedNow}/${sites.length}`} sub="needed before officers can book off" />
      </div>
      <div className="section-gap" />
      <div className="grid-2">
        <Panel title="Book entries" meta="Oldest first, as in the paper book">
          <div className="toolbar diary-nav">
            <button className="btn sm" aria-label="Previous day" onClick={() => setDate(addDays(date, -1))}><IcoBack /></button>
            <input className="input sm" type="date" aria-label="Book date" value={date} max={today} onChange={(e) => e.target.value && setDate(e.target.value)} style={{ width: 160 }} />
            <button className="btn sm" aria-label="Next day" disabled={date >= today} onClick={() => setDate(addDays(date, 1))}><IcoArrow /></button>
            <select className="select" aria-label="Site" value={site} onChange={(e) => setSite(e.target.value)}>
              <option value="">All sites</option>
              {sites.map((s) => <option key={s.id} value={s.id}>{str(s, 'name')}</option>)}
            </select>
            <span className="toolbar-count">{rows.length} entries</span>
          </div>
          {rows.length ? (
            <ul className="list" data-testid="ob-list">
              {rows.map((e) => (
                <li key={e.id} style={{ alignItems: 'flex-start' }}>
                  <span className="time-chip">{str(e, 'time')}<br />{e.ref}</span>
                  <div className="grow">
                    <Link to={`${base}/ob/${e.id}`}><b>{label(OB_TYPES, str(e, 'type'))}{site ? '' : ` · ${siteName(data, e.values.site)}`}</b></Link>
                    <small style={{ color: 'var(--ink-3)', whiteSpace: 'pre-wrap' }}>{str(e, 'entry')}</small>
                    <small>{str(e, 'by')} · {SHIFT_SHORT[str(e, 'shift')] ?? ''} shift{str(e, 'followsUp') ? ' · follow-up entry' : ''}</small>
                  </div>
                  {e.status === 'signed' ? <Tag tone="green"><IcoLock style={{ width: 11, height: 11, marginRight: 4 }} />Signed</Tag> : <><StatusTag workflow={def.workflow} status={e.status} /><WorkflowActions def={def} record={e} compact /></>}
                </li>
              ))}
            </ul>
          ) : <Empty title="No entries for this day" body="The demo seeds the last three days. Write an entry with the form on the right." />}
        </Panel>
        <div className="stack">
          <Panel title="Write an entry" meta={`Dated ${formatDate(today)} — entries cannot be back-dated in the demo`}>
            {can('ob.record') ? (
              <div className="form-grid">
                <Field label="Site">
                  <select className="select" aria-label="Entry site" value={form.site || site} onChange={(e) => setForm({ ...form, site: e.target.value })}>
                    <option value="">Select site…</option>
                    {sites.map((s) => <option key={s.id} value={s.id}>{str(s, 'name')}</option>)}
                  </select>
                </Field>
                <Field label="Entry type">
                  <select className="select" aria-label="Entry type" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                    {OB_TYPES.filter((t) => t.value !== 'followup').map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </Field>
                <Field label="Time" hint="Defaults to now.">
                  <input className="input" type="time" aria-label="Entry time" value={form.time || time} onChange={(e) => setForm({ ...form, time: e.target.value })} />
                </Field>
                <Field label="Entered by">
                  <input className="input" aria-label="Entered by" placeholder={user.name} value={form.by} onChange={(e) => setForm({ ...form, by: e.target.value })} />
                </Field>
                <div className="span-2">
                  <Field label="Entry" error={err || undefined}>
                    <textarea className="textarea" aria-label="Entry text" value={form.entry} onChange={(e) => setForm({ ...form, entry: e.target.value })} placeholder="What happened, who was involved, what was done" />
                  </Field>
                </div>
                <div className="span-2 btns">
                  <button className="btn primary" onClick={() => add(true)} data-testid="ob-sign">Write &amp; sign</button>
                  <button className="btn" onClick={() => add(false)} data-testid="ob-draft">Save as draft</button>
                </div>
              </div>
            ) : <Notice tone="grey">Your simulated role cannot write occurrence book entries.</Notice>}
          </Panel>
          <Panel title="Unsigned drafts" meta="Sign each entry to lock it">
            {drafts.length ? (
              <ul className="list">
                {drafts.slice(0, 6).map((e) => (
                  <li key={e.id}>
                    <div className="grow"><Link to={`${base}/ob/${e.id}`}><b>{e.ref} · {siteName(data, e.values.site)}</b></Link><small>{formatDate(str(e, 'date'))} {str(e, 'time')} · {label(OB_TYPES, str(e, 'type'))}</small></div>
                    <WorkflowActions def={def} record={e} compact />
                  </li>
                ))}
              </ul>
            ) : <Empty title="Every entry is signed" />}
          </Panel>
        </div>
      </div>
    </>
  );
}
