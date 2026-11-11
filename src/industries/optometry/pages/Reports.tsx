import { useData, useIndustry } from '../../../core/context';
import { lines, linesTotals, num, records, str } from '../../../core/engine';
import { addDays, monthShort } from '../../../core/lib/dates';
import { formatRand } from '../../../core/lib/money';
import { BarChart, Meters, Notice, PageHeader, Panel, Stat } from '../../../core/components/ui';
import { LENS_OPTIONS, OPTOMETRISTS, SCHEMES, label } from '../data';
import { claimTotal, todayStr } from '../helpers';

export default function Reports() {
  const config = useIndustry();
  const data = useData();
  const today = todayStr();
  const months = Array.from({ length: 6 }, (_, i) => addDays(today, -30.4 * (5 - i)).slice(0, 7));
  const exams = records(data, 'exams').filter((e) => e.status === 'final');
  const orders = records(data, 'orders').filter((o) => o.status !== 'cancelled');
  const claims = records(data, 'claims');

  const billed = months.map((m) => ({ label: monthShort(m), value: claims.filter((c) => str(c, 'date').startsWith(m)).reduce((n, c) => n + claimTotal(c), 0) / 100 }));
  const eyewear = months.map((m) => ({ label: monthShort(m), value: orders.filter((o) => o.createdAt.startsWith(m)).reduce((n, o) => n + linesTotals(lines(o)).total, 0) / 100 }));
  const examPatients = new Set(exams.map((e) => str(e, 'patient')));
  const orderPatients = new Set(orders.map((o) => str(o, 'patient')));
  const converted = [...examPatients].filter((p) => orderPatients.has(p)).length;
  const conversion = examPatients.size ? Math.round((converted / examPatients.size) * 100) : 0;
  const totalBilled = claims.reduce((n, c) => n + claimTotal(c), 0);
  const collected = claims.reduce((n, c) => n + Math.round((num(c, 'schemePaid') + num(c, 'patientPaid')) * 100), 0);
  const stockValue = records(data, 'stock').reduce((n, s) => n + num(s, 'cost') * num(s, 'qty'), 0);
  const lensMix = LENS_OPTIONS.map((l) => ({ label: l.label, value: orders.filter((o) => str(o, 'lens') === l.value).length })).filter((x) => x.value).sort((a, b) => b.value - a.value);
  const patients = records(data, 'patients');
  const recallsDue = patients.filter((p) => str(p, 'recallDue') && str(p, 'recallDue') <= addDays(today, 45));
  const recallsBooked = recallsDue.filter((p) => records(data, 'appointments').some((a) => str(a, 'patient') === p.id && a.status === 'booked' && str(a, 'date') >= today));
  const rand = (n: number) => formatRand(Math.round(n * 100), { compact: true });

  return (
    <>
      <PageHeader kicker={`${config.businessName} / Practice`} title="Practice reports" subtitle="Six-month view computed from the demo records. Figures are fictional and change as you use the demo." />
      <div className="stat-grid">
        <Stat label="Exams (6 months)" value={exams.length} sub={`${examPatients.size} unique patients`} />
        <Stat label="Exam → eyewear conversion" value={`${conversion}%`} tone="accent" sub={`${converted} of ${examPatients.size} patients ordered`} />
        <Stat label="Billed vs collected" value={formatRand(collected, { compact: true })} sub={`of ${formatRand(totalBilled, { compact: true })} billed (claims & accounts)`} />
        <Stat label="Stock at cost" value={rand(stockValue)} sub={`${records(data, 'stock').length} lines`} />
      </div>
      <div className="section-gap" />
      <div className="grid-2">
        <Panel title="Services billed per month" meta="Exam and service accounts, incl. VAT"><BarChart label="Services billed per month" data={billed} format={(n) => rand(n)} /></Panel>
        <Panel title="Eyewear sales per month" meta="Optical orders placed, incl. VAT"><BarChart label="Eyewear sales per month" data={eyewear} format={(n) => rand(n)} /></Panel>
      </div>
      <div className="section-gap" />
      <div className="grid-3">
        <Panel title="Exams by optometrist">
          <Meters items={OPTOMETRISTS.map((o) => ({ label: o.label, value: exams.filter((e) => str(e, 'optometrist') === o.value).length }))} />
        </Panel>
        <Panel title="Billing by funder" meta="Share of billed value">
          <Meters format={(n) => `${n}%`} items={SCHEMES.map((s) => {
            const v = claims.filter((c) => str(c, 'scheme') === s.value).reduce((n, c) => n + claimTotal(c), 0);
            return { label: label(SCHEMES, s.value).replace(' (fictional)', ''), value: totalBilled ? Math.round((v / totalBilled) * 100) : 0, max: 100 };
          })} />
        </Panel>
        <Panel title="Recall effectiveness" meta="Due within 45 days or overdue">
          <Meters items={[
            { label: 'Recalls due', value: recallsDue.length, max: recallsDue.length || 1, tone: 'dark' },
            { label: 'Booked', value: recallsBooked.length, max: recallsDue.length || 1, tone: 'green' },
            { label: 'Contacted, not booked', value: recallsDue.filter((p) => str(p, 'lastContacted') && !recallsBooked.includes(p)).length, max: recallsDue.length || 1, tone: 'amber' },
          ]} />
        </Panel>
      </div>
      <div className="section-gap" />
      <Panel title="Lens & product mix" meta="Optical orders by lens type"><Meters items={lensMix} /></Panel>
      <div className="section-gap" />
      <Notice tone="grey">Reports are illustrative. A production system would reconcile against real remittances, the accounting system and stock counts.</Notice>
    </>
  );
}
