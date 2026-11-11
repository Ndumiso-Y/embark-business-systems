import { useParams } from 'react-router-dom';
import { useData } from '../../../core/context';
import { findRecord, num, str } from '../../../core/engine';
import { formatDate } from '../../../core/lib/dates';
import { formatRand } from '../../../core/lib/money';
import { KeyValues, Notice, Panel, Tag } from '../../../core/components/ui';
import { RecordDetail } from '../../../core/components/records';
import { CLAIM_OPEN_DAYS, DAMAGE_TYPES, TREAD_LEGAL_MIN, label } from '../data';
import { claimAge, claimOpen, damageWarrantable, dotAgeYears, dotText, proRataCredit, stockLabel, todayStr } from '../helpers';
import { RecordLink, VehicleCard } from './shared';

export default function ClaimDetail() {
  const { id } = useParams();
  const data = useData();
  const c = findRecord(data, 'claims', id);
  return (
    <RecordDetail aside={c ? <Aside id={c.id} /> : undefined}>
      {c && <Assessment id={c.id} />}
    </RecordDetail>
  );
}

function Assessment({ id }: { id: string }) {
  const data = useData();
  const c = findRecord(data, 'claims', id)!;
  const today = todayStr();
  const st = findRecord(data, 'stock', str(c, 'stock'));
  const credit = proRataCredit(c);
  const dmg = str(c, 'damageType');
  const sell = st ? Math.round(num(st, 'sell') * 100) : 0;
  return (
    <Panel title="Casing assessment" meta={`Demo pro-rata rule: usable tread above ${TREAD_LEGAL_MIN.toFixed(1)} mm as a share of the new tread depth`}>
      {claimOpen(c) && claimAge(c, today) > CLAIM_OPEN_DAYS && <div style={{ marginBottom: 12 }}><Notice tone="red">Open {claimAge(c, today)} days — chase the supplier (over {CLAIM_OPEN_DAYS} days).</Notice></div>}
      {dmg && !damageWarrantable(c) && claimOpen(c) && <div style={{ marginBottom: 12 }}><Notice tone="amber">{label(DAMAGE_TYPES, dmg)} is not a manufacturing defect. The claim cannot be sent to the supplier — reject it with a note explaining the finding.</Notice></div>}
      <KeyValues items={[
        { label: 'Tyre', value: st ? <RecordLink module="stock" record={st}>{stockLabel(st)}</RecordLink> : '' },
        { label: 'DOT on casing', value: `${dotText(str(c, 'dot'))}${dotAgeYears(str(c, 'dot'), today) !== null ? ` · ${dotAgeYears(str(c, 'dot'), today)} yrs old` : ''}` },
        { label: 'Fitted on', value: formatDate(str(c, 'purchasedOn')) },
        { label: 'Tread new → remaining', value: str(c, 'treadRemaining') !== '' ? `${num(c, 'originalTread') || 8} mm → ${num(c, 'treadRemaining')} mm` : 'Not measured yet' },
        { label: 'Damage', value: dmg ? <>{label(DAMAGE_TYPES, dmg)} {damageWarrantable(c) ? <Tag tone="green">Warrantable</Tag> : <Tag tone="red">Not warrantable</Tag>}</> : '' },
        { label: 'Suggested credit', value: credit === null ? '—' : `${credit}% ≈ ${formatRand(Math.round((sell * credit) / 100))} excl. VAT on today’s sell price` },
        { label: 'Supplier decision', value: c.status === 'approved' ? `${num(c, 'creditPct')}% credit · ${formatDate(str(c, 'decisionOn'))}` : c.status === 'rejected' ? `Rejected · ${formatDate(str(c, 'decisionOn'))}` : 'Pending' },
        { label: 'Complaint', value: str(c, 'complaint'), wide: true },
      ]} />
      <p className="muted-note" style={{ marginTop: 10 }}>Claims are not sent to any supplier or manufacturer — the decision is typed in for the demo.</p>
    </Panel>
  );
}

function Aside({ id }: { id: string }) {
  const data = useData();
  const c = findRecord(data, 'claims', id)!;
  return <Panel title="Vehicle & customer"><VehicleCard data={data} vehicleId={c.values.vehicle} /></Panel>;
}
