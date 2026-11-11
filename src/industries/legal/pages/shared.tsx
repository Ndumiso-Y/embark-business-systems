import { Link } from 'react-router-dom';
import type { DemoRecord, IndustryData } from '../../../core/types';
import { findRecord, str } from '../../../core/engine';
import { useBase, useUser } from '../../../core/context';
import { daysBetween, formatDate } from '../../../core/lib/dates';
import { Tag } from '../../../core/components/ui';
import { CLIENT_KINDS, label } from '../data';
import { ficaState, matterName } from '../helpers';

/** Matter title, linked when the simulated user has the Matters module. */
export function MatterLink({ data, id }: { data: IndustryData; id: unknown }) {
  const base = useBase();
  const { hasModule } = useUser();
  const name = matterName(data, id);
  return hasModule('matters') && id ? <Link to={`${base}/matters/${String(id)}`}>{name}</Link> : <>{name}</>;
}

export function FicaTag({ client, today }: { client: DemoRecord | undefined; today: string }) {
  const s = ficaState(client, today);
  if (s === 'missing') return <Tag tone="red">FICA outstanding</Tag>;
  if (s === 'expired') return <Tag tone="red">FICA expired {formatDate(str(client, 'ficaExpiry'))}</Tag>;
  if (s === 'expiring') return <Tag tone="amber">FICA review in {daysBetween(today, str(client, 'ficaExpiry'))} days</Tag>;
  return <Tag tone="green">FICA on file</Tag>;
}

/** Compact client summary card. */
export function ClientCard({ data, clientId, today }: { data: IndustryData; clientId: unknown; today: string }) {
  const base = useBase();
  const { hasModule } = useUser();
  const c = findRecord(data, 'clients', String(clientId ?? ''));
  if (!c) return null;
  const initials = str(c, 'name').split(/\s+/).filter((w) => /^[A-Z]/.test(w)).slice(0, 2).map((w) => w[0]).join('');
  return (
    <div className="patient-card">
      <span className="avatar">{initials}</span>
      <div className="grow">
        {hasModule('clients') ? <Link to={`${base}/clients/${c.id}`}><b>{str(c, 'name')}</b></Link> : <b>{str(c, 'name')}</b>}
        <small>{c.ref} · {label(CLIENT_KINDS, str(c, 'kind'))}{str(c, 'contact') ? ` · ${str(c, 'contact')}` : ''}</small>
        <small>{str(c, 'phone')} · {str(c, 'email')}</small>
        <div style={{ marginTop: 6 }}><FicaTag client={c} today={today} /></div>
      </div>
    </div>
  );
}
