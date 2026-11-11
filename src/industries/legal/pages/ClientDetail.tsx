import { Link, useParams } from 'react-router-dom';
import { useBase, useData, useIndustry, useUser } from '../../../core/context';
import { findRecord, records, str } from '../../../core/engine';
import { formatDate } from '../../../core/lib/dates';
import { Empty, KeyValues, Notice, Panel, StatusTag } from '../../../core/components/ui';
import { RecordDetail } from '../../../core/components/records';
import { FICA_STATUS, MATTER_TYPES, label } from '../data';
import { OPEN_MATTER_STATES, ficaState, formatCents, matterMoney, todayStr, trustBalance } from '../helpers';
import { FicaTag } from './shared';

export default function ClientDetail() {
  const { id } = useParams();
  const data = useData();
  const c = findRecord(data, 'clients', id);
  return (
    <RecordDetail aside={c ? <Aside id={c.id} /> : undefined}>
      {c && <Matters id={c.id} />}
    </RecordDetail>
  );
}

function Matters({ id }: { id: string }) {
  const config = useIndustry();
  const data = useData();
  const base = useBase();
  const { hasModule } = useUser();
  const wf = config.collections.find((c) => c.key === 'matters')!.workflow;
  const mine = records(data, 'matters').filter((m) => str(m, 'client') === id);
  const opposite = records(data, 'matters').filter((m) => {
    const name = str(findRecord(data, 'clients', id), 'name').toLowerCase();
    return name && (str(m, 'opposingParty').toLowerCase().includes(name) || str(m, 'otherParties').toLowerCase().includes(name));
  });
  return (
    <>
      <Panel title="Matters" meta={`${mine.length} matter(s) for this client`}>
        {mine.length ? (
          <ul className="list">
            {mine.map((m) => {
              const mm = matterMoney(data, m.id);
              return (
                <li key={m.id}>
                  <div className="grow">
                    {hasModule('matters') ? <Link to={`${base}/matters/${m.id}`}><b>{str(m, 'name')}</b></Link> : <b>{str(m, 'name')}</b>}
                    <small>{m.ref} · {label(MATTER_TYPES, str(m, 'type'))} · WIP {formatCents(mm.wip)} · trust {formatCents(trustBalance(data, m.id))}</small>
                  </div>
                  <StatusTag workflow={wf} status={m.status} />
                </li>
              );
            })}
          </ul>
        ) : <Empty title="No matters yet" />}
      </Panel>
      {opposite.length > 0 && (
        <Notice tone="amber"><b>Also appears as a party on other matters:</b> {opposite.map((m) => `${m.ref} (${str(m, 'name')})`).join('; ')}. Check conflicts before acting.</Notice>
      )}
    </>
  );
}

function Aside({ id }: { id: string }) {
  const data = useData();
  const today = todayStr();
  const c = findRecord(data, 'clients', id)!;
  const state = ficaState(c, today);
  const open = records(data, 'matters').filter((m) => str(m, 'client') === id && OPEN_MATTER_STATES.includes(m.status ?? ''));
  return (
    <Panel title="FICA (simulated)" right={<FicaTag client={c} today={today} />}>
      <KeyValues items={[
        { label: 'Documents', value: label(FICA_STATUS, str(c, 'ficaStatus')) },
        { label: 'Review due', value: formatDate(str(c, 'ficaExpiry')) },
        { label: 'Open matters', value: open.length },
      ]} />
      {state !== 'ok' && open.length > 0 && <div style={{ marginTop: 12 }}><Notice tone="amber">Update FICA documents before taking further instructions on the open matters.</Notice></div>}
      <p className="muted-note" style={{ marginTop: 12 }}>The demo stores a status only. No identity or document verification is performed.</p>
    </Panel>
  );
}
