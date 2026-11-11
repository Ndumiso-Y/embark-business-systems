// Real-estate helpers shared by the configuration, its pages and tests.
// Kept separate from index.ts so pages can import them without a cycle.
// Money is stored in rand on records and computed here in integer cents.
import type { DemoRecord, IndustryData } from '../../core/types';
import { findRecord, num, records, str } from '../../core/engine';
import { addDays, daysBetween, formatDate } from '../../core/lib/dates';
import { formatRandWhole, toCents } from '../../core/lib/money';
import { BUDGET_BAND, DEFAULT_AGENT_SPLIT, DEFAULT_COMMISSION_RATE, OWNER_APPROVAL_LIMIT, SUBURBS, VAT_RATE, suburbLabel } from './data';

/* ---------------- Today (pinnable for tests) ---------------- */
let todayOverride: string | null = null;
export function setTodayForTests(iso: string | null) { todayOverride = iso; }
export function todayStr() {
  if (todayOverride) return todayOverride;
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export const rand = (cents: number) => formatRandWhole(cents);
/** Whole-rand display of a rand amount stored on a record. */
export const randOf = (amount: number) => formatRandWhole(toCents(amount));
export const plural = (n: number, word: string, many = `${word}s`) => `${n} ${n === 1 ? word : many}`;

/* ---------------- Lookups ---------------- */
export const agentOf = (data: IndustryData, id: unknown) => findRecord(data, 'agents', String(id ?? ''));
export const agentName = (data: IndustryData, id: unknown) => str(agentOf(data, id), 'name') || 'Unassigned';
export const agentForUser = (data: IndustryData, userId: string) => records(data, 'agents').find((a) => str(a, 'userId') === userId);
export const listingOf = (data: IndustryData, r: DemoRecord | undefined) => findRecord(data, 'listings', str(r, 'listing'));
export const listingName = (data: IndustryData, id: unknown) => {
  const l = findRecord(data, 'listings', String(id ?? ''));
  return l ? `${str(l, 'address')}, ${suburbLabel(str(l, 'suburb'))}` : 'Unknown property';
};
export const leadName = (data: IndustryData, id: unknown) => str(findRecord(data, 'leads', String(id ?? '')), 'name') || 'No buyer linked';
export const leaseName = (data: IndustryData, id: unknown) => {
  const l = findRecord(data, 'leases', String(id ?? ''));
  return l ? `${str(l, 'address')}, ${suburbLabel(str(l, 'suburb'))}` : 'Unknown rental';
};

/* ---------------- Agents & Fidelity Fund Certificates (fictional) ---------------- */
export type FfcState = 'valid' | 'expiring' | 'expired' | 'missing';
export function ffcState(agent: DemoRecord | undefined, today: string): FfcState {
  const exp = str(agent, 'ffcExpiry');
  if (!agent || !exp) return 'missing';
  const diff = daysBetween(today, exp);
  if (diff < 0) return 'expired';
  return diff <= 30 ? 'expiring' : 'valid';
}

/* ---------------- Listings & mandates ---------------- */
export const LISTING_OPEN = ['valuation', 'mandate', 'listed', 'underoffer', 'sold'];
export const ON_MARKET = ['listed', 'underoffer'];

/** Problems that stop a listing going live. Each one is a readable reason. */
export function goLiveProblems(listing: DemoRecord, data: IndustryData, today: string): string[] {
  const out: string[] = [];
  const signed = str(listing, 'mandateSigned');
  const expiry = str(listing, 'mandateExpiry');
  if (!signed) out.push('Record the date the seller signed the mandate (Edit → Mandate signed on).');
  else if (signed > today) out.push('The mandate signature date is in the future.');
  if (!expiry) out.push('Record the mandate expiry date — use “Renew mandate” in the go-live checks.');
  else if (expiry <= today) out.push(`The mandate expired on ${formatDate(expiry)}. Renew it with the seller (“Renew mandate” in the go-live checks) before marketing the property.`);
  if (listing.values.sellerFica !== true) out.push('The seller’s FICA documents have not been verified (simulated) — use “Mark FICA verified” in the go-live checks.');
  const agent = agentOf(data, listing.values.agent);
  if (!agent) out.push('Assign a listing agent.');
  else {
    const s = ffcState(agent, today);
    if (s === 'missing') out.push(`${str(agent, 'name')} has no Fidelity Fund Certificate on record (fictional register).`);
    if (s === 'expired') out.push(`${str(agent, 'name')}’s Fidelity Fund Certificate expired on ${formatDate(str(agent, 'ffcExpiry'))}. An agent without a valid FFC may not market property — reassign the listing in the go-live checks, or renew the certificate on the agent’s record.`);
  }
  if (!(num(listing, 'askingPrice') > 0)) out.push('Set an asking price.');
  return out;
}

/** Days on market: from the listing date to sale (or today while still on the market). */
export function daysOnMarket(listing: DemoRecord, today: string): number | null {
  const from = str(listing, 'listedOn');
  if (!from) return null;
  const to = ['sold', 'registered'].includes(listing.status ?? '') && str(listing, 'soldOn') ? str(listing, 'soldOn') : today;
  return Math.max(0, daysBetween(from, to));
}

export const priceReduced = (listing: DemoRecord) => num(listing, 'originalPrice') > num(listing, 'askingPrice') && num(listing, 'askingPrice') > 0;
export const reductionPct = (listing: DemoRecord) => (priceReduced(listing) ? Math.round((1 - num(listing, 'askingPrice') / num(listing, 'originalPrice')) * 1000) / 10 : 0);

export function mandateDaysLeft(listing: DemoRecord, today: string): number | null {
  const exp = str(listing, 'mandateExpiry');
  return exp ? daysBetween(today, exp) : null;
}

/** Expected commission on a listing at a given price (cents, excl. VAT). */
export const commissionRate = (listing: DemoRecord | undefined) => num(listing, 'commissionRate') || DEFAULT_COMMISSION_RATE;
export const commissionOn = (listing: DemoRecord | undefined, priceRand: number) => toCents((priceRand * commissionRate(listing)) / 100);

/* ---------------- Offers to purchase ---------------- */
export const OFFER_LIVE = ['submitted', 'countered', 'accepted'];
export const offersFor = (data: IndustryData, listingId: string) => records(data, 'offers').filter((o) => str(o, 'listing') === listingId);
export const binding = (o: DemoRecord) => o.status === 'accepted' || o.status === 'unconditional';
export const unconditionalOffer = (data: IndustryData, listingId: string) => offersFor(data, listingId).find((o) => o.status === 'unconditional');

export function acceptProblems(offer: DemoRecord, data: IndustryData): string[] {
  const out: string[] = [];
  const listing = listingOf(data, offer);
  if (!listing) return ['Link the offer to a listing.'];
  if (!ON_MARKET.includes(listing.status ?? '')) {
    out.push(`${listing.ref} is not on the market (status: ${listing.status ?? 'unknown'}). Only a listing that is listed or under offer can accept an offer.`);
  }
  const other = offersFor(data, listing.id).find((o) => o.id !== offer.id && binding(o));
  if (other) out.push(`Offer ${other.ref} on this property has already been accepted. Lapse or cancel it before accepting another.`);
  if (!(num(offer, 'amount') > 0)) out.push('Enter the offer amount.');
  if (offer.values.bondRequired === true && !str(offer, 'bondDeadline')) out.push('The offer is subject to a bond — set the bond approval deadline first.');
  return out;
}

export function conditionsProblems(offer: DemoRecord): string[] {
  const out: string[] = [];
  if (offer.values.bondRequired === true && offer.values.bondApproved !== true) {
    out.push('Bond approval has not been recorded — use “Record bond approval” under Suspensive conditions. If the bond deadline passes without approval, lapse the offer.');
  }
  if (num(offer, 'deposit') > 0 && offer.values.depositPaid !== true) out.push('The deposit has not been confirmed as paid into the conveyancer’s trust account (simulated) — use “Record deposit paid” under Suspensive conditions.');
  if (str(offer, 'conditions').trim() && offer.values.conditionsFulfilled !== true) out.push('Other suspensive conditions are recorded but not marked fulfilled — use “Mark fulfilled” under Suspensive conditions.');
  return out;
}

export function bondDaysLeft(offer: DemoRecord, today: string): number | null {
  if (offer.values.bondRequired !== true || offer.values.bondApproved === true || !str(offer, 'bondDeadline')) return null;
  return daysBetween(today, str(offer, 'bondDeadline'));
}

/* ---------------- Transfers (conveyancing tracker, simulated) ---------------- */
export const TRANSFER_OPEN = ['otp', 'bond', 'docs', 'lodged'];
export const transferFor = (data: IndustryData, listingId: string) => records(data, 'transfers').find((t) => str(t, 'listing') === listingId && t.status !== 'cancelled');
export function bondStepProblem(transfer: DemoRecord, data: IndustryData): string | null {
  const offer = findRecord(data, 'offers', str(transfer, 'offer'));
  if (!offer) return 'Link the transfer to the accepted offer to purchase.';
  if (offer.values.bondRequired === true && offer.values.bondApproved !== true) return `The buyer’s bond on ${offer.ref} has not been approved yet — record it on the offer.`;
  return null;
}
export function lodgementProblems(transfer: DemoRecord): string[] {
  const out: string[] = [];
  if (!str(transfer, 'conveyancer')) out.push('Select the transferring conveyancer — open the transfer and use the conveyancing checklist.');
  if (transfer.values.transferDuty !== true) out.push('Transfer duty receipt not yet recorded (simulated) — open the transfer and tick it off in the conveyancing checklist.');
  if (transfer.values.ratesClearance !== true) out.push('Rates clearance certificate not yet recorded (simulated) — open the transfer and tick it off in the conveyancing checklist.');
  return out;
}

/** Commission figures (cents) for a commission record. */
export function commissionSplit(r: DemoRecord) {
  const gross = toCents((num(r, 'salePrice') * (num(r, 'rate') || DEFAULT_COMMISSION_RATE)) / 100);
  const vat = Math.round((gross * VAT_RATE) / 100);
  const agentPct = num(r, 'agentSplit') || DEFAULT_AGENT_SPLIT;
  const agent = Math.round((gross * agentPct) / 100);
  return { gross, vat, incl: gross + vat, agent, company: gross - agent, agentPct };
}

/* ---------------- Buyers ↔ listings matching ---------------- */
/** Suburb values recognised in free text such as "Marula Heights, Quartz Hill". */
export function suburbsIn(text: string): string[] {
  const t = text.toLowerCase();
  return SUBURBS.filter((s) => t.includes(s.label.toLowerCase())).map((s) => s.value);
}
export function unknownSuburbs(text: string): string[] {
  const known = SUBURBS.map((s) => s.label.toLowerCase());
  return text.split(/[;,]/).map((x) => x.trim()).filter((x) => x && !known.includes(x.toLowerCase()));
}

export type Match = { ok: boolean; reasons: string[]; misses: string[]; diffPct: number };

/**
 * Does a listing suit a buyer? Price within ±10% of budget, in one of the
 * preferred suburbs (any, if none given), at least the bedrooms asked for and
 * the property type if one was chosen. Pure — unit tested.
 */
export function matchListing(lead: DemoRecord, listing: DemoRecord): Match {
  const reasons: string[] = [];
  const misses: string[] = [];
  const budget = num(lead, 'budget');
  const price = num(listing, 'askingPrice');
  const diffPct = budget > 0 ? Math.round(((price - budget) / budget) * 1000) / 10 : 100;
  if (budget > 0 && Math.abs(price - budget) <= budget * BUDGET_BAND + 1e-6) reasons.push(diffPct === 0 ? 'On budget' : `${diffPct > 0 ? '+' : ''}${diffPct}% of budget`);
  else misses.push(`Price ${randOf(price)} is outside ${randOf(budget)} ±${BUDGET_BAND * 100}%`);
  const subs = suburbsIn(str(lead, 'suburbs'));
  if (!subs.length || subs.includes(str(listing, 'suburb'))) reasons.push(subs.length ? suburbLabel(str(listing, 'suburb')) : 'Any suburb');
  else misses.push(`${suburbLabel(str(listing, 'suburb'))} is not a preferred suburb`);
  const beds = num(listing, 'beds');
  if (beds >= num(lead, 'minBeds')) reasons.push(`${beds} bed`);
  else misses.push(`${beds} bed — wants ${num(lead, 'minBeds')}+`);
  const type = str(lead, 'propertyType');
  if (type && type !== 'any' && type !== str(listing, 'type')) misses.push('Different property type');
  return { ok: misses.length === 0, reasons, misses, diffPct };
}

export const LEAD_OPEN = ['new', 'contacted', 'viewing', 'offer'];

/** Listings on the market that match a buyer, closest price first. */
export function matchingListings(data: IndustryData, lead: DemoRecord) {
  return records(data, 'listings')
    .filter((l) => l.status === 'listed')
    .map((l) => ({ listing: l, match: matchListing(lead, l) }))
    .filter((x) => x.match.ok)
    .sort((a, b) => Math.abs(a.match.diffPct) - Math.abs(b.match.diffPct));
}

/** Active buyers who match a listing. */
export function matchingBuyers(data: IndustryData, listing: DemoRecord) {
  return records(data, 'leads')
    .filter((l) => LEAD_OPEN.includes(l.status ?? ''))
    .map((lead) => ({ lead, match: matchListing(lead, listing) }))
    .filter((x) => x.match.ok)
    .sort((a, b) => Math.abs(a.match.diffPct) - Math.abs(b.match.diffPct));
}

/* ---------------- Viewings ---------------- */
export const byDateTime = (a: DemoRecord, b: DemoRecord) => (str(a, 'date') + str(a, 'time')).localeCompare(str(b, 'date') + str(b, 'time'));
export function completeViewingProblems(v: DemoRecord, today: string): string[] {
  const out: string[] = [];
  if (str(v, 'date') > today) out.push('A viewing cannot be completed before it takes place.');
  if (!str(v, 'interest')) out.push('Record the buyer’s interest level first — open the viewing and use “Feedback after the viewing”.');
  if (!str(v, 'feedback').trim()) out.push('Record the feedback from the viewing first — open the viewing and use “Feedback after the viewing”.');
  return out;
}
/** Checks before booking a viewing: listing on the market, agent FFC valid, no double booking. */
export function bookingProblem(data: IndustryData, v: Record<string, unknown>, today: string, ignoreId?: string): string | null {
  const listing = findRecord(data, 'listings', String(v.listing ?? ''));
  if (!listing) return 'Select a listing.';
  if (!ON_MARKET.includes(listing.status ?? '')) return `${listing.ref} is not on the market — viewings can only be booked on listed or under-offer properties.`;
  if (String(v.date ?? '') < today) return 'A viewing cannot be booked in the past.';
  const agent = agentOf(data, v.agent);
  if (agent && ffcState(agent, today) === 'expired') return `${str(agent, 'name')}’s FFC has expired — choose another agent to host the viewing.`;
  const clash = records(data, 'viewings').find((x) => x.id !== ignoreId && x.status === 'booked' && str(x, 'agent') === v.agent && str(x, 'date') === v.date && str(x, 'time') === v.time);
  if (clash) return `${agentName(data, v.agent)} already has a viewing at ${String(v.time)} on ${formatDate(String(v.date))} (${clash.ref}).`;
  return null;
}

/* ---------------- Rentals & leases ---------------- */
export const LEASE_LIVE = ['signed', 'active', 'notice'];
export function leaseSignProblems(lease: DemoRecord): string[] {
  const out: string[] = [];
  if (str(lease, 'vetting') !== 'approved') out.push('The tenant’s vetting outcome must be “Approved” (simulated credit & reference check).');
  if (lease.values.depositReceived !== true) out.push(`The deposit${num(lease, 'deposit') > 0 ? ` of ${randOf(num(lease, 'deposit'))}` : ''} has not been received into trust (simulated) — use “Record deposit received” on the lease.`);
  if (!(num(lease, 'rent') > 0)) out.push('Enter the monthly rent.');
  if (!str(lease, 'startDate') || !str(lease, 'endDate')) out.push('Enter the lease start and end dates.');
  else if (str(lease, 'endDate') <= str(lease, 'startDate')) out.push('The lease must end after it starts.');
  return out;
}
export const leaseEndsIn = (lease: DemoRecord, today: string) => (str(lease, 'endDate') ? daysBetween(today, str(lease, 'endDate')) : null);
/** Rent after the next annual escalation. */
export const escalatedRent = (lease: DemoRecord) => Math.round(num(lease, 'rent') * (1 + num(lease, 'escalation') / 100));
export function nextEscalation(lease: DemoRecord, today: string): string | null {
  const start = str(lease, 'startDate');
  if (!start) return null;
  let d = addDays(start, 365);
  while (d <= today) d = addDays(d, 365);
  return d <= str(lease, 'endDate') ? d : null;
}

/* ---------------- Maintenance ---------------- */
export function maintenanceApprovalProblem(job: DemoRecord): string | null {
  const quote = num(job, 'quote');
  if (!(quote > 0)) return 'Record the contractor’s quote first — open the job and use “Quote & approval”.';
  if (quote > OWNER_APPROVAL_LIMIT && job.values.ownerApproved !== true) {
    return `The quote of ${randOf(quote)} is above the ${randOf(OWNER_APPROVAL_LIMIT)} demo limit — open the job and record the owner’s written approval first.`;
  }
  return null;
}
