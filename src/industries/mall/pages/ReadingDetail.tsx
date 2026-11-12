import { useParams } from 'react-router-dom';
import { useActions, useData, useUser } from '../../../core/context';
import { findRecord, num, str } from '../../../core/engine';
import { KeyValues, Notice, Panel, Tag } from '../../../core/components/ui';
import { RecordDetail } from '../../../core/components/records';
import { ELEC_TARIFF, USAGE_REVIEW_PCT, WATER_TARIFF } from '../data';
import { consumption, needsReview, periodLabel, randOf, shopLabel, thousands, tradingLease, unitOf, usageChange } from '../helpers';
import { ReadingCapture } from './Meters';
import { MallStyles, RecLink, TenantCard } from './shared';

export default function ReadingDetail() {
  const { id } = useParams();
  const data = useData();
  const act = useActions();
  const { can, user } = useUser();
  const r = findRecord(data, 'readings', id);
  const unit = r ? unitOf(data, str(r, 'unit')) : undefined;
  const c = consumption(data, r);
  const change = usageChange(data, r);
  return (
    // “Capture reading” is done with the figures in the panel below.
    <RecordDetail hideTransitions={['captured']} backLabel="Utilities metering" aside={r && unit ? (
      <>
        <Panel title="Shop"><KeyValues items={[{ label: 'Unit', value: <RecLink module="units" id={unit.id}>{shopLabel(unit)}</RecLink> }, { label: 'Water sub-meter', value: unit.values.waterMeter === true ? 'Yes' : 'No' }]} /></Panel>
        <Panel title="Tenant"><TenantCard data={data} lease={tradingLease(data, unit.id)} /></Panel>
      </>
    ) : undefined}>
      {r && unit && <MallStyles />}
      {r && unit && r.status === 'due' && (
        <Panel title="Type the reading" meta="A reading below the previous one is refused">
          <ul className="list"><ReadingCapture key={r.id} unitId={unit.id} period={str(r, 'period')} /></ul>
        </Panel>
      )}
      {r && unit && r.status === 'captured' && (
        <Panel title={`Usage — ${periodLabel(str(r, 'period'))}`} meta="This reading less the one before it" right={change === null ? undefined : <Tag tone={Math.abs(change) > USAGE_REVIEW_PCT ? 'amber' : 'green'}>{change > 0 ? '+' : ''}{change}% vs last month</Tag>}>
          {c ? (
            <KeyValues items={[
              { label: 'Electricity used', value: `${thousands(c.elec)} kWh (${thousands(num(r, 'elec'))} − ${thousands(num(c.prev, 'elec'))})` },
              { label: 'Electricity to recover', value: `${randOf(c.elec * ELEC_TARIFF)} at ${randOf(ELEC_TARIFF)}/kWh` },
              ...(unit.values.waterMeter === true ? [{ label: 'Water used', value: `${thousands(c.water)} kL` }, { label: 'Water to recover', value: `${randOf(c.water * WATER_TARIFF)} at ${randOf(WATER_TARIFF)}/kL` }] : []),
            ]} />
          ) : <p className="muted-note">This is the opening reading for the meter, so there is no usage to bill yet.</p>}
          {needsReview(data, r) && (
            <div style={{ marginTop: 12 }}>
              <Notice tone="amber">
                Usage is more than {USAGE_REVIEW_PCT}% different from last month. Check the meter was read correctly before it is billed.
                {can('meters') && <div style={{ marginTop: 8 }}><button className="btn sm" data-testid="mark-reviewed" onClick={() => { act.update('readings', r.id, { reviewedBy: user.name }, 'Unusual usage reviewed and accepted'); act.toast(`${r.ref}: usage reviewed`); }}>Mark reviewed</button></div>}
              </Notice>
            </div>
          )}
        </Panel>
      )}
    </RecordDetail>
  );
}
