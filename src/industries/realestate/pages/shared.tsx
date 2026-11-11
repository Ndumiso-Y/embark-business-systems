import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { DemoRecord, IndustryData } from '../../../core/types';
import { findRecord, num, str } from '../../../core/engine';
import { useBase, useUser } from '../../../core/context';
import { daysBetween, formatDate } from '../../../core/lib/dates';
import { Tag } from '../../../core/components/ui';
import { DESIGNATIONS, PROPERTY_TYPES, label, suburbLabel } from '../data';
import { ffcState, randOf } from '../helpers';

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

/** Pass / fail checklist used for go-live, lease signing and offer conditions. */
export function Checklist({ items }: { items: Array<{ label: string; ok: boolean; detail?: string }> }) {
  return (
    <ul className="list">
      {items.map((i) => (
        <li key={i.label}>
          <span className={`dot ${i.ok ? 'green' : 'red'}`} />
          <div className="grow"><b>{i.label}</b>{i.detail && <small>{i.detail}</small>}</div>
          <Tag tone={i.ok ? 'green' : 'red'}>{i.ok ? 'OK' : 'Blocked'}</Tag>
        </li>
      ))}
    </ul>
  );
}
