// Law-firm helpers shared by the configuration, its pages and tests.
// Kept separate from index.ts so pages can import them without a cycle.
// All money arithmetic is in integer cents.
import type { DemoRecord, IndustryData, Line, Values } from '../../core/types';
import { findRecord, lines, linesTotals, num, records, str } from '../../core/engine';
import { addDays, daysBetween, formatDate, parseIso } from '../../core/lib/dates';
import { formatRand, toCents } from '../../core/lib/money';
import { earner } from './data';

/* ---------------- Today (pinnable for tests) ---------------- */
let todayOverride: string | null = null;
export function setTodayForTests(iso: string | null) { todayOverride = iso; }
export function todayStr() {
  if (todayOverride) return todayOverride;
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/* ---------------- Names ---------------- */
export const clientName = (data: IndustryData, id: unknown) => {
  const c = findRecord(data, 'clients', String(id ?? ''));
  return c ? str(c, 'name') : 'Unknown client';
};
export const matterName = (data: IndustryData, id: unknown) => {
  const m = findRecord(data, 'matters', String(id ?? ''));
  return m ? str(m, 'name') : 'Unknown matter';
};
export const matterOf = (data: IndustryData, r: DemoRecord | undefined) => findRecord(data, 'matters', str(r, 'matter'));

/** Open matters are those the firm is still working on. */
export const OPEN_MATTER_STATES = ['intake', 'conflict', 'engagement', 'active', 'closing'];
export const WORKING_MATTER_STATES = ['engagement', 'active', 'closing'];

/* ---------------- Time entries ---------------- */
export const MAX_HOURS = 12;

/** Hours must be positive, in 0.1 (six-minute) units and at most 12 per entry. */
export function hoursProblem(v: unknown): string | null {
  const h = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(h)) return 'Hours must be a number.';
  if (h <= 0) return 'Hours must be more than zero.';
  if (h > MAX_HOURS) return `A single entry cannot exceed ${MAX_HOURS} hours.`;
  if (Math.abs(h * 10 - Math.round(h * 10)) > 1e-6) return 'Record time in 0.1 hour (six-minute) units, e.g. 0.3 or 1.2.';
  return null;
}

/** Value of a time entry in cents. */
export const timeValue = (r: DemoRecord) => toCents(num(r, 'hours') * num(r, 'rate'));

/** Billable time not yet on a fee note (work in progress). */
export const isWip = (r: DemoRecord) => r.status === 'unbilled' && r.values.billable === true;

export function unbilledEntries(data: IndustryData, matterId: string): DemoRecord[] {
  return records(data, 'time').filter((t) => str(t, 'matter') === matterId && isWip(t)).sort((a, b) => str(a, 'date').localeCompare(str(b, 'date')));
}

export function wipCents(data: IndustryData, filter: (r: DemoRecord) => boolean = () => true): number {
  return records(data, 'time').filter((t) => isWip(t) && filter(t)).reduce((n, t) => n + timeValue(t), 0);
}

/** Monday (ISO date) of the week containing `iso`. */
export function weekStart(iso: string): string {
  const dow = parseIso(iso).getDay(); // 0 = Sunday
  return addDays(iso, dow === 0 ? -6 : 1 - dow);
}

/** Weekdays from `from` to `to` inclusive. */
export function workingDays(from: string, to: string): number {
  let n = 0;
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const w = parseIso(d).getDay();
    if (w !== 0 && w !== 6) n += 1;
  }
  return n;
}

/* ---------------- Trust ledger (simulated) ---------------- */
export const isOutflow = (type: unknown) => type === 'payment' || type === 'transfer';
export const signedTrustCents = (r: DemoRecord) => (isOutflow(str(r, 'type')) ? -1 : 1) * toCents(num(r, 'amount'));

export function trustTxns(data: IndustryData, matterId: string): DemoRecord[] {
  return records(data, 'trust')
    .filter((t) => str(t, 'matter') === matterId)
    .sort((a, b) => str(a, 'date').localeCompare(str(b, 'date')) || a.createdAt.localeCompare(b.createdAt) || a.ref.localeCompare(b.ref));
}

/** Approved trust balance for one matter (only approved transactions count). */
export function trustBalanceOf(txns: DemoRecord[], matterId: string): number {
  return txns.filter((t) => str(t, 'matter') === matterId && t.status === 'approved').reduce((n, t) => n + signedTrustCents(t), 0);
}
export const trustBalance = (data: IndustryData, matterId: string) => trustBalanceOf(records(data, 'trust'), matterId);

/** Captured (not yet approved) payments and transfers for a matter. */
export function pendingOutflowCents(data: IndustryData, matterId: string, exceptId?: string): number {
  return records(data, 'trust')
    .filter((t) => str(t, 'matter') === matterId && t.status === 'captured' && isOutflow(str(t, 'type')) && t.id !== exceptId)
    .reduce((n, t) => n + toCents(num(t, 'amount')), 0);
}

/** Balance still available after pending payments are taken into account. */
export const trustAvailable = (data: IndustryData, matterId: string) => trustBalance(data, matterId) - pendingOutflowCents(data, matterId);

/**
 * Core rule: a payment or transfer can never exceed the matter's approved trust balance,
 * so the ledger cannot go negative. Pure — unit tested.
 */
export function outflowProblem(balanceCents: number, amountRand: number): string | null {
  const amount = toCents(amountRand);
  if (!(amount > 0)) return 'Enter an amount greater than zero.';
  if (amount > balanceCents) return `This would overdraw the matter's trust balance (${formatCents(balanceCents)} available). Trust money for one client may never be used for another.`;
  return null;
}

export const formatCents = (c: number) => formatRand(c);

/** Problems that block approving a captured trust transaction. */
export function trustApprovalProblems(r: DemoRecord, data: IndustryData): string[] {
  const out: string[] = [];
  const matterId = str(r, 'matter');
  if (!findRecord(data, 'matters', matterId)) out.push('Link the transaction to a matter.');
  if (!(num(r, 'amount') > 0)) out.push('Enter an amount greater than zero.');
  if (isOutflow(str(r, 'type'))) {
    const p = outflowProblem(trustBalance(data, matterId), num(r, 'amount'));
    if (p) out.push(p);
  }
  if (str(r, 'type') === 'transfer') {
    const inv = findRecord(data, 'invoices', str(r, 'invoice'));
    if (!inv) out.push('A transfer to the business account must be linked to an issued fee note.');
    else if (str(inv, 'matter') !== matterId) out.push(`Fee note ${inv.ref} belongs to a different matter.`);
    else if (toCents(num(r, 'amount')) > invoiceOutstanding(inv)) out.push(`The transfer exceeds the amount outstanding on fee note ${inv.ref} (${formatCents(invoiceOutstanding(inv))}).`);
  }
  return out;
}

/** Problem with capturing a new transaction (checks available balance incl. pending payments). */
export function captureProblem(data: IndustryData, matterId: string, type: string, amountRand: number): string | null {
  if (!matterId) return 'Select a matter.';
  if (!(toCents(amountRand) > 0)) return 'Enter an amount greater than zero.';
  if (!isOutflow(type)) return null;
  return outflowProblem(trustAvailable(data, matterId), amountRand);
}

/** Ledger rows with a running approved balance. Pending/rejected rows carry the balance unchanged. */
export function ledgerRows(data: IndustryData, matterId: string) {
  let bal = 0;
  return trustTxns(data, matterId).map((t) => {
    if (t.status === 'approved') bal += signedTrustCents(t);
    return { record: t, balance: bal };
  });
}

/* ---------------- Conflicts ---------------- */
export type ConflictHit = { name: string; role: 'Client' | 'Opposing party' | 'Other party'; matterId?: string; clientId?: string; ref: string; status?: string };

/** Search a name across clients, and the client, opposing and other parties of every matter. */
export function searchConflicts(data: IndustryData, term: string): ConflictHit[] {
  const needle = term.trim().toLowerCase();
  if (needle.length < 2) return [];
  const hits: ConflictHit[] = [];
  const has = (s: string) => s.toLowerCase().includes(needle);
  for (const c of records(data, 'clients')) if (has(str(c, 'name'))) hits.push({ name: str(c, 'name'), role: 'Client', clientId: c.id, ref: c.ref });
  for (const m of records(data, 'matters')) {
    if (has(str(m, 'opposingParty'))) hits.push({ name: str(m, 'opposingParty'), role: 'Opposing party', matterId: m.id, ref: m.ref, status: m.status });
    for (const p of str(m, 'otherParties').split(/[;,]/).map((x) => x.trim()).filter(Boolean)) {
      if (has(p)) hits.push({ name: p, role: 'Other party', matterId: m.id, ref: m.ref, status: m.status });
    }
  }
  return hits;
}

export type ConflictStatus = 'none' | 'pending' | 'cleared' | 'conflict';
export function conflictChecks(data: IndustryData, matterId: string) {
  return records(data, 'conflicts').filter((c) => str(c, 'matter') === matterId);
}
export function conflictStatus(data: IndustryData, matterId: string): ConflictStatus {
  const checks = conflictChecks(data, matterId);
  if (checks.some((c) => c.status === 'conflict')) return 'conflict';
  if (checks.some((c) => c.status === 'cleared')) return 'cleared';
  if (checks.some((c) => c.status === 'pending')) return 'pending';
  return 'none';
}
export function engagementProblem(data: IndustryData, matterId: string): string | null {
  const s = conflictStatus(data, matterId);
  if (s === 'cleared') return null;
  if (s === 'conflict') return 'A conflict was confirmed for this matter. Decline it instead.';
  if (s === 'pending') {
    const c = conflictChecks(data, matterId).find((x) => x.status === 'pending');
    return `Conflict check ${c?.ref ?? ''} has not been cleared by someone holding the conflicts.clear permission.`;
  }
  return 'No conflict check has been recorded for this matter. Run one on the Conflict checks page.';
}

/* ---------------- Matter lifecycle rules ---------------- */
export function activationProblems(r: DemoRecord): string[] {
  const out: string[] = [];
  if (r.values.engagementSigned !== true) out.push('The engagement letter has not been signed (Edit → Engagement letter signed).');
  if (r.values.ficaVerified !== true) out.push('FICA documents have not been confirmed for this matter (Edit → FICA verified).');
  return out;
}

export function closeProblems(r: DemoRecord, data: IndustryData): string[] {
  const out: string[] = [];
  const bal = trustBalance(data, r.id);
  if (bal !== 0) out.push(`Trust balance must be R0.00 before closing — ${formatCents(bal)} is still held. Pay out or refund it first.`);
  const pend = records(data, 'trust').filter((t) => str(t, 'matter') === r.id && t.status === 'captured');
  if (pend.length) out.push(`${pend.length} trust transaction(s) await approval or rejection.`);
  const wip = unbilledEntries(data, r.id);
  if (wip.length) out.push(`${wip.length} unbilled time entr${wip.length === 1 ? 'y' : 'ies'} (${formatCents(wip.reduce((n, t) => n + timeValue(t), 0))}) must be billed or written off.`);
  return out;
}

/** Billed (excl. VAT) and recorded value for a matter. */
export function matterMoney(data: IndustryData, matterId: string) {
  const entries = records(data, 'time').filter((t) => str(t, 'matter') === matterId);
  const recorded = entries.filter((t) => t.values.billable === true).reduce((n, t) => n + timeValue(t), 0);
  const wip = entries.filter(isWip).reduce((n, t) => n + timeValue(t), 0);
  const invs = records(data, 'invoices').filter((i) => str(i, 'matter') === matterId);
  const billed = invs.reduce((n, i) => n + linesTotals(lines(i)).net, 0);
  const outstanding = invs.reduce((n, i) => n + invoiceOutstanding(i), 0);
  const hours = entries.reduce((n, t) => n + num(t, 'hours'), 0);
  return { recorded, wip, billed, outstanding, hours: Math.round(hours * 10) / 10 };
}

/* ---------------- Fee notes ---------------- */
export const VAT_RATE = 15;
export const invoiceTotal = (r: DemoRecord) => linesTotals(lines(r), VAT_RATE).total;
export const invoiceOutstanding = (r: DemoRecord) => (r.status === 'paid' ? 0 : Math.max(0, invoiceTotal(r) - toCents(num(r, 'paid'))));

/** Build a fee note from a matter's unbilled billable time (one line per entry). */
export function buildFeeNote(data: IndustryData, matterId: string, today: string): { values: Values; entryIds: string[] } | null {
  const entries = unbilledEntries(data, matterId);
  if (!entries.length) return null;
  const feeLines: Line[] = entries.map((t) => ({
    id: `ln_${t.id}`,
    code: earner(str(t, 'feeEarner'))?.short ?? '',
    description: `${formatDate(str(t, 'date'))} — ${str(t, 'narrative')}`,
    qty: num(t, 'hours'),
    unitPrice: num(t, 'rate'),
  }));
  return {
    values: { matter: matterId, date: today, dueDate: addDays(today, 30), paid: 0, notes: `Fees for ${entries.length} time entr${entries.length === 1 ? 'y' : 'ies'} to ${formatDate(str(entries[entries.length - 1], 'date'))}.`, lines: feeLines },
    entryIds: entries.map((t) => t.id),
  };
}

/* ---------------- Diary ---------------- */
export type DeadlineWindow = 'overdue' | 'week' | 'month' | 'later' | 'closed';
export function deadlineWindow(r: DemoRecord, today: string): DeadlineWindow {
  if (r.status !== 'upcoming') return 'closed';
  const diff = daysBetween(today, str(r, 'date'));
  if (diff < 0) return 'overdue';
  if (diff <= 7) return 'week';
  if (diff <= 30) return 'month';
  return 'later';
}
/** Prescription dates first, then by date and time. */
export const byDeadline = (a: DemoRecord, b: DemoRecord) =>
  Number(str(b, 'type') === 'prescription') - Number(str(a, 'type') === 'prescription') || (str(a, 'date') + str(a, 'time')).localeCompare(str(b, 'date') + str(b, 'time'));

export function upcomingDeadlines(data: IndustryData, today: string, days: number): DemoRecord[] {
  return records(data, 'diary').filter((d) => d.status === 'upcoming' && daysBetween(today, str(d, 'date')) <= days).sort(byDeadline);
}

/* ---------------- Clients ---------------- */
export function ficaState(c: DemoRecord | undefined, today: string): 'ok' | 'expiring' | 'expired' | 'missing' {
  if (!c || str(c, 'ficaStatus') !== 'verified') return 'missing';
  const exp = str(c, 'ficaExpiry');
  if (!exp) return 'ok';
  const diff = daysBetween(today, exp);
  return diff < 0 ? 'expired' : diff <= 30 ? 'expiring' : 'ok';
}

export const diaryWhen = (r: DemoRecord) => `${formatDate(str(r, 'date'))}${str(r, 'time') ? ` · ${str(r, 'time')}` : ''}`;
