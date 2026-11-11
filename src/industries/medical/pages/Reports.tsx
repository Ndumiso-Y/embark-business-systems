import { useData, useIndustry } from '../../../core/context';
import { records, str } from '../../../core/engine';
import { addDays, daysBetween, monthKeys, monthShort } from '../../../core/lib/dates';
import { formatRand } from '../../../core/lib/money';
import { BarChart, Meters, Notice, PageHeader, Panel, Stat } from '../../../core/components/ui';
import { CHRONIC_CONDITIONS, DOCTORS, LABS, SCHEMES, label } from '../data';
import { claimTotal, overdueChronic, todayStr } from '../helpers';

const avg = (ns: number[]) => (ns.length ? Math.round((ns.reduce((a, b) => a + b, 0) / ns.length) * 10) / 10 : 0);

export default function Reports() {
  const config = useIndustry();
  const data = useData();
  const today = todayStr();
  const from = addDays(today, -182);
  const months = monthKeys(today, 6);
  const consults = records(data, 'consults').filter((c) => c.status === 'signed' && str(c, 'date') >= from);
  const visits = records(data, 'visits').filter((v) => str(v, 'date') >= from && str(v, 'date') <= today);
  const attended = visits.filter((v) => !['booked', 'cancelled', 'dna'].includes(v.status ?? ''));
  const dna = visits.filter((v) => v.status === 'dna');
  const dnaRate = attended.length + dna.length ? Math.round((dna.length / (attended.length + dna.length)) * 1000) / 10 : 0;
  const claims = records(data, 'claims').filter((c) => str(c, 'date') >= from);
  const totalBilled = claims.reduce((n, c) => n + claimTotal(c), 0);
  const overdue = overdueChronic(data, today);
  const results = records(data, 'results');
  const tat = (list: typeof results) => avg(list.filter((r) => str(r, 'receivedOn')).map((r) => daysBetween(str(r, 'requestedOn'), str(r, 'receivedOn'))));
  const reviewTat = avg(results.filter((r) => str(r, 'receivedOn') && str(r, 'reviewedOn')).map((r) => daysBetween(str(r, 'receivedOn'), str(r, 'reviewedOn'))));

  const perMonth = months.map((m) => ({
    label: monthShort(m),
    value: consults.filter((c) => str(c, 'date').startsWith(m)).length,
    alt: visits.filter((v) => v.status === 'dna' && str(v, 'date').startsWith(m)).length,
  }));
  const billed = months.map((m) => ({ label: monthShort(m), value: claims.filter((c) => str(c, 'date').startsWith(m)).reduce((n, c) => n + claimTotal(c), 0) / 100 }));
  const rand = (n: number) => formatRand(Math.round(n * 100), { compact: true });

  return (
    <>
      <PageHeader kicker={`${config.businessName} / Practice`} title="Practice reports" subtitle="Six-month view computed from the demo records. Figures are fictional and change as you use the demo." />
      <div className="stat-grid">
        <Stat label="Signed consultations (6 months)" value={consults.length} sub={`${new Set(consults.map((c) => str(c, 'patient'))).size} unique patients`} />
        <Stat label="Did-not-attend rate" value={`${dnaRate}%`} tone={dnaRate > 10 ? 'red' : undefined} sub={`${dna.length} of ${attended.length + dna.length} booked visits`} />
        <Stat label="Chronic reviews overdue" value={overdue.length} tone={overdue.length ? 'red' : undefined} sub={`${records(data, 'chronic').filter((c) => c.status === 'active').length} active register entries`} />
        <Stat label="Result turnaround" value={`${tat(results)} d`} tone="accent" sub={`Request → received · review ${reviewTat} d`} />
      </div>
      <div className="section-gap" />
      <div className="grid-2">
        <Panel title="Consultations per month" meta="Signed consultations (accent) vs did-not-attend visits (dark)">
          <BarChart label="Consultations and did-not-attend visits per month" data={perMonth} alt="DNAs" />
        </Panel>
        <Panel title="Consultations per doctor" meta="Signed, last six months">
          <Meters items={DOCTORS.map((d) => ({ label: d.label, value: consults.filter((c) => str(c, 'doctor') === d.value).length }))} />
        </Panel>
      </div>
      <div className="grid-3">
        <Panel title="Billing by funder" meta={`Share of ${formatRand(totalBilled, { compact: true })} billed`}>
          <Meters format={(n) => `${n}%`} items={SCHEMES.map((s) => {
            const v = claims.filter((c) => str(c, 'scheme') === s.value).reduce((n, c) => n + claimTotal(c), 0);
            return { label: label(SCHEMES, s.value).replace(' (fictional)', ''), value: totalBilled ? Math.round((v / totalBilled) * 100) : 0, max: 100 };
          })} />
        </Panel>
        <Panel title="Chronic reviews overdue" meta="Active register entries past their review date">
          <Meters items={CHRONIC_CONDITIONS.map((c) => {
            const all = records(data, 'chronic').filter((x) => x.status === 'active' && str(x, 'condition') === c.value);
            return { label: c.label, value: overdue.filter((x) => str(x, 'condition') === c.value).length, max: all.length || 1, tone: 'red' as const, sub: `${all.length} on register` };
          })} />
        </Panel>
        <Panel title="Result turnaround by lab" meta="Average days from request to result received">
          <Meters format={(n) => `${n} d`} items={LABS.map((l) => {
            const list = results.filter((r) => str(r, 'lab') === l.value);
            return { label: l.label.replace(' (fictional)', ''), value: tat(list), max: 7, sub: `${list.length} requests · ${list.filter((r) => r.status === 'requested').length} outstanding` };
          })} />
        </Panel>
      </div>
      <Panel title="Billed per month" meta="Consultation and nurse accounts, incl. VAT (demo)"><BarChart label="Billed per month" data={billed} format={(n) => rand(n)} /></Panel>
      <div className="section-gap" />
      <Notice tone="grey">Reports are illustrative. A production system would reconcile against real remittances, lab feeds and the accounting system.</Notice>
    </>
  );
}
