// Small display components shared by the cleaning pages.
import type { ReactNode } from 'react';
import type { DemoRecord, IndustryData, Line } from '../../../core/types';
import { linesTotals, str } from '../../../core/engine';
import { formatDate } from '../../../core/lib/dates';
import { BarChart, Empty, Tag } from '../../../core/components/ui';
import { VAT_RATE } from '../data';
import { inspectionScore, rand, siteInspections, slaTarget, type Staffing } from '../helpers';

/** One row of a pass/fail checklist. */
export function Check({ ok, label, detail }: { ok: boolean | null; label: string; detail?: ReactNode }) {
  return (
    <li>
      <span className={`dot ${ok === null ? 'dark' : ok ? 'green' : 'red'}`} />
      <div className="grow"><b>{label}</b>{detail && <small>{detail}</small>}</div>
      <span className={`tag ${ok === null ? 'dark' : ok ? 'green' : 'red'}`}>{ok === null ? 'n/a' : ok ? 'OK' : 'Blocked'}</span>
    </li>
  );
}

/** "3/4 present" pill, coloured by how far the site is from its contracted staffing. */
export function StaffingTag({ st, started = true }: { st: Staffing; started?: boolean }) {
  if (!started) return <Tag tone={st.unfilled ? 'red' : 'dark'}>{st.rostered}/{st.contracted} rostered</Tag>;
  return <Tag tone={st.present >= st.contracted ? 'green' : st.present >= st.contracted - 1 && st.contracted > 2 ? 'amber' : 'red'}>{st.present}/{st.contracted} present</Tag>;
}

/** Inspection scores for a site against its SLA target (accent = score, dark = target). */
export function ScoreTrend({ data, site, count = 6 }: { data: IndustryData; site: DemoRecord; count?: number }) {
  const list = siteInspections(data, site.id).slice(-count);
  if (!list.length) return <Empty title="No inspections submitted yet" />;
  const target = slaTarget(site);
  return (
    <>
      <BarChart label={`Inspection scores for ${str(site, 'name')}`} alt="SLA target" format={(n) => `${n}%`}
        data={list.map((i) => ({ label: formatDate(str(i, 'date')).slice(0, 6), value: inspectionScore(i) ?? 0, alt: target }))} />
      <p className="muted-note" style={{ marginTop: 8 }}>Score per inspection (accent) against the {target}% SLA target (dark).</p>
    </>
  );
}

/** Read-only priced lines with an optional credit row and VAT totals. */
export function LinesTable({ lines, credit = 0, creditLabel }: { lines: Line[]; credit?: number; creditLabel?: string }) {
  const t = linesTotals(lines, VAT_RATE);
  const creditCents = Math.min(t.net, Math.round(credit * 100));
  const net = t.net - creditCents;
  const vat = Math.round((net * VAT_RATE) / 100);
  return (
    <div className="table-wrap">
      <table className="table" data-testid="lines-table">
        <thead><tr><th>Description</th><th className="num">Qty</th><th className="num">Rate</th><th className="num">Amount</th></tr></thead>
        <tbody>
          {lines.map((l, i) => (
            <tr key={l.id}><td>{l.description}</td><td className="num">{l.qty}</td><td className="num">{rand(Math.round(l.unitPrice * 100))}</td><td className="num">{rand(t.lines[i]?.excl ?? 0)}</td></tr>
          ))}
          {creditCents > 0 && <tr><td><strong>Credit — shifts not staffed</strong><small>{creditLabel}</small></td><td /><td /><td className="num">−{rand(creditCents)}</td></tr>}
          <tr><td colSpan={3} className="num">Excl. VAT</td><td className="num">{rand(net)}</td></tr>
          <tr><td colSpan={3} className="num">VAT {VAT_RATE}%</td><td className="num">{rand(vat)}</td></tr>
          <tr><td colSpan={3} className="num"><strong>Total</strong></td><td className="num"><strong>{rand(net + vat)}</strong></td></tr>
        </tbody>
      </table>
    </div>
  );
}
