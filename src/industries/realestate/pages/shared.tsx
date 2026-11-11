import type { ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { DemoRecord, IndustryData, Values } from '../../../core/types';
import { findRecord, num, str } from '../../../core/engine';
import { useActions, useBase, useData, useIndustry, useUser } from '../../../core/context';
import { daysBetween, formatDate } from '../../../core/lib/dates';
import { Tag } from '../../../core/components/ui';
import { RecordFormModal } from '../../../core/components/fields';
import { DESIGNATIONS, PROPERTY_TYPES, label, suburbLabel } from '../data';
import { ffcState, randOf, todayStr } from '../helpers';

/** Link to a record when the simulated user has the module; plain text otherwise. */
export function RecLink({ module, id, children }: { module: string; id: string | undefined; children: ReactNode }) {
  const base = useBase();
  const { hasModule } = useUser();
  return hasModule(module) && id ? <Link to={`${base}/${module}/${id}`}>{children}</Link> : <>{children}</>;
}

export function FfcTag({ agent, today }: { agent: DemoRecord | undefined; today: string }) {
  const s = ffcState(agent, today);
  if (s === 'missing') return <Tag tone="red">No FFC on record</Tag>;
  if (s === 'expired') return <Tag tone="red">FFC expired {formatDate(str(agent, 'ffcExpiry'))}</Tag>;
  if (s === 'expiring') return <Tag tone="amber">FFC expires in {daysBetween(today, str(agent, 'ffcExpiry'))} days</Tag>;
  return <Tag tone="green">FFC valid to {formatDate(str(agent, 'ffcExpiry'))}</Tag>;
}

const initials = (name: string) => name.split(/\s+/).filter((w) => /^[A-Z]/.test(w)).slice(0, 2).map((w) => w[0]).join('');

export function AgentCard({ data, id, today }: { data: IndustryData; id: unknown; today: string }) {
  const a = findRecord(data, 'agents', String(id ?? ''));
  if (!a) return <p className="muted-note">No agent assigned.</p>;
  return (
    <div className="patient-card">
      <span className="avatar">{initials(str(a, 'name'))}</span>
      <div className="grow">
        <RecLink module="agents" id={a.id}><b>{str(a, 'name')}</b></RecLink>
        <small>{label(DESIGNATIONS, str(a, 'designation'))} · {str(a, 'ffcNumber')}</small>
        <small>{str(a, 'phone')} · {str(a, 'email')}</small>
        <div style={{ marginTop: 6 }}><FfcTag agent={a} today={today} /></div>
      </div>
    </div>
  );
}

export function PersonCard({ name, lines, tag }: { name: string; lines: string[]; tag?: ReactNode }) {
  return (
    <div className="patient-card">
      <span className="avatar">{initials(name) || '?'}</span>
      <div className="grow">
        <b>{name}</b>
        {lines.filter(Boolean).map((l) => <small key={l}>{l}</small>)}
        {tag && <div style={{ marginTop: 6 }}>{tag}</div>}
      </div>
    </div>
  );
}

/** One-line property summary card, linked to the listing. */
export function ListingCard({ data, id }: { data: IndustryData; id: unknown }) {
  const l = findRecord(data, 'listings', String(id ?? ''));
  if (!l) return <p className="muted-note">Listing not found.</p>;
  return (
    <div className="patient-card">
      <span className="avatar">{num(l, 'beds')}b</span>
      <div className="grow">
        <RecLink module="listings" id={l.id}><b>{str(l, 'address')}</b></RecLink>
        <small>{l.ref} · {suburbLabel(str(l, 'suburb'))} · {label(PROPERTY_TYPES, str(l, 'type'))}</small>
        <small>{num(l, 'beds')} bed · {num(l, 'baths')} bath · {num(l, 'floor')} m² · asking {randOf(num(l, 'askingPrice'))}</small>
      </div>
    </div>
  );
}

/**
 * Pass / fail checklist used for go-live, lease signing and offer conditions.
 * An item may carry an `action`: the control that fixes it, right where it is reported.
 */
export function Checklist({ items }: { items: Array<{ label: string; ok: boolean; detail?: ReactNode; action?: ReactNode }> }) {
  return (
    <ul className="list">
      {items.map((i) => (
        <li key={i.label} style={{ flexWrap: 'wrap' }}>
          <span className={`dot ${i.ok ? 'green' : 'red'}`} />
          <div className="grow" style={{ minWidth: 160 }}><b>{i.label}</b>{i.detail && <small>{i.detail}</small>}</div>
          {i.action}
          <Tag tone={i.ok ? 'green' : 'red'}>{i.ok ? 'OK' : 'Blocked'}</Tag>
        </li>
      ))}
    </ul>
  );
}

/**
 * Capture an offer to purchase from a listing, a buyer or a completed viewing.
 * The buyer moves to “Offer made” and the new offer opens so the seller’s response can be recorded.
 */
export function OfferCapture({ initial, title, onClose }: { initial: Values; title: string; onClose: () => void }) {
  const config = useIndustry();
  const data = useData();
  const base = useBase();
  const act = useActions();
  const navigate = useNavigate();
  const { hasModule } = useUser();
  const today = todayStr();
  const offerDef = config.collections.find((c) => c.key === 'offers')!;
  return (
    <RecordFormModal def={offerDef} open title={title}
      initial={{ ...offerDef.createDefaults?.(today, data), ...initial }}
      onClose={onClose}
      onSave={(v) => {
        const o = act.create('offers', v, 'submitted', 'Offer captured');
        const lead = findRecord(data, 'leads', String(v.lead ?? ''));
        if (lead && ['new', 'contacted', 'viewing'].includes(lead.status ?? '')) act.transition('leads', lead.id, 'offer');
        act.toast(`Offer ${o.ref} captured — now record the seller’s response`);
        onClose();
        if (hasModule('offers')) navigate(`${base}/offers/${o.id}`);
      }} />
  );
}
