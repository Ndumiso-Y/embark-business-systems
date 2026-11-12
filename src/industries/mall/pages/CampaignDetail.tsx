import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useActions, useData, useIndustry, useUser } from '../../../core/context';
import { findRecord, num, permissionHint } from '../../../core/engine';
import { toCents } from '../../../core/lib/money';
import { Field, KeyValues, Panel, Tag } from '../../../core/components/ui';
import { RecordDetail } from '../../../core/components/records';
import { marketingFund, rand, randOf } from '../helpers';
import { MallStyles } from './shared';

export default function CampaignDetail() {
  const { id } = useParams();
  const data = useData();
  const c = findRecord(data, 'campaigns', id);
  return <RecordDetail>{c && <Budget key={c.id} id={c.id} />}</RecordDetail>;
}

/** Cost against the marketing fund — what “Approve spend” checks. */
function Budget({ id }: { id: string }) {
  const config = useIndustry();
  const data = useData();
  const act = useActions();
  const { can } = useUser();
  const c = findRecord(data, 'campaigns', id)!;
  const fund = marketingFund(data);
  const planned = c.status === 'planned';
  const [cost, setCost] = useState(String(num(c, 'cost') || ''));
  const over = planned && toCents(num(c, 'cost')) > fund.balance;
  return (
    <Panel title="Budget" meta="Paid from the marketing fund (levies billed to tenants)" right={<Tag tone={over ? 'red' : 'green'}>{over ? 'More than the fund balance' : planned ? 'Within the fund' : 'Committed'}</Tag>}>
      <MallStyles />
      <KeyValues items={[
        { label: 'Cost of this campaign', value: <b>{randOf(num(c, 'cost'))}</b> },
        { label: 'Fund balance now', value: rand(fund.balance) },
        { label: 'Levies billed', value: rand(fund.levies) },
        { label: 'Spent and approved', value: rand(fund.spent + fund.approved) },
      ]} />
      {planned && can('marketing') && (
        <div className="mall-inline" style={{ marginTop: 12 }}>
          <Field label="Cost (excl. VAT)"><input className="input num" type="number" min={0} step="1000" aria-label="Campaign cost" value={cost} onChange={(e) => setCost(e.target.value)} data-testid="campaign-cost" /></Field>
          <button className="btn" disabled={Number(cost) === num(c, 'cost')} data-testid="save-cost" onClick={() => { if (!(Number(cost) > 0)) return act.toast('Type the cost of the campaign.', 'err'); act.update('campaigns', id, { cost: Number(cost) }, `Cost set to ${randOf(Number(cost))}`); act.toast(`${c.ref}: cost saved`); }}>Save cost</button>
        </div>
      )}
      {planned && !can('marketing') && <p className="muted-note" style={{ marginTop: 10 }}>{permissionHint(config, data, 'marketing')}</p>}
    </Panel>
  );
}
