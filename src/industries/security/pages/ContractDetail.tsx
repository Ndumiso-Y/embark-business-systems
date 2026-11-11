import { Link, useParams } from 'react-router-dom';
import type { DemoRecord } from '../../../core/types';
import { useActions, useBase, useData, useUser } from '../../../core/context';
import { num, records, str } from '../../../core/engine';
import { formatRand } from '../../../core/lib/money';
import { addDays, daysBetween, formatDate } from '../../../core/lib/dates';
import { Empty, KeyValues, Panel, StatusTag, Tag } from '../../../core/components/ui';
import { RecordDetail } from '../../../core/components/records';
import { money } from '../../../core/components/fields';
import { CONTRACT_WINDOW_DAYS } from '../data';
import { calloutExtras, contractMonthly, contractPosts, contractSites, dailyCoverage, invoiceTotals, pct, rec, responseStats, unfilledShifts } from '../helpers';
import { pctTone, useClock } from './format';

export default function ContractDetail() {
  const { id } = useParams();
  const data = useData();
  const c = rec(data, 'contracts', id);
  return (
    <RecordDetail aside={c ? <Aside contract={c} /> : undefined}>
      {c && <Body contract={c} />}
    </RecordDetail>
  );
}

function Body({ contract: c }: { contract: DemoRecord }) {
  const data = useData();
  const base = useBase();
  const act = useActions();
  const { hasModule } = useUser();
  const { today } = useClock();
  const sites = contractSites(data, c.id);
  const posts = contractPosts(data, c.id);
  const invoiceDef = act.def('invoices');
  const invoices = records(data, 'invoices').filter((i) => str(i, 'contract') === c.id).sort(invoiceDef.sort);
  return (
    <>
      <Panel title="Sites and posts" meta={`${sites.length} site${sites.length === 1 ? '' : 's'} · ${posts.length} posts · ${money(contractMonthly(data, c.id))} per month excl. VAT`}>
        <div className="table-wrap">
          <table className="table" data-testid="contract-sites">
            <thead><tr><th>Site</th><th className="num">Day posts</th><th className="num">Night posts</th><th className="num">Armed</th><th className="num">Monthly value</th><th>Coverage today</th></tr></thead>
            <tbody>
              {sites.map((s) => {
                const mine = posts.filter((p) => str(p, 'site') === s.id);
                const cov = dailyCoverage(data, today, s.id);
                return (
                  <tr key={s.id}>
                    <td>{hasModule('sites') ? <Link to={`${base}/sites/${s.id}`}><strong>{str(s, 'name')}</strong></Link> : <strong>{str(s, 'name')}</strong>}<small>{str(s, 'code')} · {str(s, 'area')}</small></td>
                    <td className="num">{mine.filter((p) => str(p, 'shift') !== 'night').length}</td>
                    <td className="num">{mine.filter((p) => str(p, 'shift') === 'night').length}</td>
                    <td className="num">{mine.filter((p) => p.values.armed === true).length}</td>
                    <td className="num">{money(mine.reduce((n, p) => n + num(p, 'monthlyRate'), 0))}</td>
                    <td><Tag tone={pctTone(cov.pct)}>{cov.covered}/{cov.posts} · {cov.pct}%</Tag></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>
      <Panel title="Invoices" meta="Monthly invoices for this contract">
        {invoices.length ? (
          <ul className="list" data-testid="contract-invoices">
            {invoices.map((i) => (
              <li key={i.id}>
                <div className="grow">
                  {hasModule('invoices') ? <Link to={`${base}/invoices/${i.id}`}><b>{invoiceDef.title(i, data)}</b></Link> : <b>{invoiceDef.title(i, data)}</b>}
                  <small>{i.ref} · {formatRand(invoiceTotals(i).total)} incl. VAT{num(i, 'unfilledShifts') ? ` · ${num(i, 'unfilledShifts')} unfilled-shift penalt${num(i, 'unfilledShifts') === 1 ? 'y' : 'ies'}` : ''}</small>
                </div>
                <StatusTag workflow={invoiceDef.workflow} status={i.status} />
              </li>
            ))}
          </ul>
        ) : <Empty title="No invoices yet" />}
      </Panel>
    </>
  );
}

function Aside({ contract: c }: { contract: DemoRecord }) {
  const data = useData();
  const { today } = useClock();
  const left = daysBetween(today, str(c, 'endDate'));
  const period = today.slice(0, 7);
  const sites = contractSites(data, c.id);
  const all = sites.map((s) => responseStats(data, addDays(today, -60), today, s.id));
  const count = all.reduce((n, s) => n + s.count, 0);
  const within = all.reduce((n, s) => n + s.within, 0);
  const extras = calloutExtras(data, c, period);
  const unfilled = unfilledShifts(data, c.id, period, today).length;
  return (
    <>
      <Panel title="Contract term" meta={`Flagged when ${CONTRACT_WINDOW_DAYS} days or fewer remain`} right={<Tag tone={left < 0 ? 'red' : left <= CONTRACT_WINDOW_DAYS ? 'amber' : 'green'}>{left < 0 ? 'Ended' : `${left} days left`}</Tag>}>
        <KeyValues items={[
          { label: 'Start', value: formatDate(str(c, 'startDate')) },
          { label: 'End', value: formatDate(str(c, 'endDate')) },
          { label: 'Monthly value', value: `${money(contractMonthly(data, c.id))} excl. VAT`, wide: true },
        ]} />
      </Panel>
      <Panel title="Service this month" meta="Feeds the next invoice (demo rules)">
        <KeyValues items={[
          { label: 'Unfilled shifts', value: `${unfilled} × ${money(num(c, 'penaltyPerShift'))} penalty` },
          { label: 'Call-outs', value: `${extras.count} (${extras.included} included)` },
          { label: 'Response SLA', value: `${num(c, 'slaMinutes')} min` },
          { label: 'Within SLA (60 days)', value: count ? `${pct(within, count)}% of ${count}` : 'No call-outs' },
        ]} />
      </Panel>
    </>
  );
}
