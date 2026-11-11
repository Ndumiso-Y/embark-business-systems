// Real-estate agency demo. Fictional agency: Kestrel Property Group (South Africa).
// Listings go from valuation through a signed mandate to listed, under offer,
// sold and registered; buyers are matched to listings; offers to purchase drive
// the listing and open a conveyancing tracker; registration makes commission
// payable. Rentals run from application and (simulated) vetting to an active
// lease, with maintenance jobs that need owner approval above a demo limit.
import type { CollectionDef, EffectContext, IndustryConfig, WorkflowDef } from '../../core/types';
import { findRecord, num, records, str } from '../../core/engine';
import { addDays, daysBetween, formatDate } from '../../core/lib/dates';
import { IcoBriefcase, IcoCalendar, IcoChart, IcoDoc, IcoHome, IcoKey, IcoShield, IcoUsers, IcoWrench } from '../../core/components/Icons';
import {
  CONTRACTORS, CONVEYANCERS, DESIGNATIONS, INTEREST, LEAD_PROPERTY_TYPES, LEAD_SOURCES, MAINT_CATEGORIES, MANAGEMENT, MANDATE_TYPES, OWNER_APPROVAL_LIMIT,
  PRIORITIES, PROPERTY_TYPES, SUBURBS, VETTING, VIEWING_KINDS, label, suburbLabel,
} from './data';
import {
  ON_MARKET, TRANSFER_OPEN, acceptProblems, agentName, agentOf, binding, bondDaysLeft, bondStepProblem, commissionSplit, completeViewingProblems,
  conditionsProblems, daysOnMarket, ffcState, goLiveProblems, leadName, leaseEndsIn, leaseName, leaseSignProblems, listingName, listingOf, lodgementProblems,
  maintenanceApprovalProblem, mandateDaysLeft, matchingListings, offersFor, priceReduced, rand, randOf, reductionPct, todayStr, transferFor, unconditionalOffer,
  unknownSuburbs,
} from './helpers';
export * from './helpers';
import { buildRealEstateSeed } from './seed';
import Dashboard from './pages/Dashboard';
import ListingDetail from './pages/ListingDetail';
import LeadDetail from './pages/LeadDetail';
import Viewings from './pages/Viewings';
import ViewingDetail from './pages/ViewingDetail';
import TransferDetail from './pages/TransferDetail';
import MaintenanceDetail from './pages/MaintenanceDetail';
import OfferDetail from './pages/OfferDetail';
import LeaseDetail from './pages/LeaseDetail';
import Reports from './pages/Reports';

type FlagList = Array<{ tone: 'red' | 'amber' | 'accent' | 'dark' | 'green' | 'blue'; label: string }>;

/* ---------------- Side effects ---------------- */
function onOfferAccepted({ record, data, api }: EffectContext) {
  const listing = listingOf(data, record);
  if (listing?.status === 'listed') {
    const res = api.transition('listings', listing.id, 'underoffer');
    if (res.ok) api.toast(`${listing.ref} is now under offer`, 'info');
    else api.toast(`${listing.ref} could not be moved under offer: ${res.reason}`, 'err');
  }
  const lead = findRecord(data, 'leads', str(record, 'lead'));
  if (lead && ['new', 'contacted', 'viewing'].includes(lead.status ?? '')) api.transition('leads', lead.id, 'offer');
}

/* ---------------- Workflows ---------------- */
const listingWorkflow: WorkflowDef = {
  initial: 'valuation',
  states: [
    { key: 'valuation', label: 'Valuation', tone: 'dark', hint: 'Valuation done, mandate not yet signed' },
    { key: 'mandate', label: 'Mandate signed', tone: 'blue', hint: 'Compliance checks before going live' },
    { key: 'listed', label: 'Listed', tone: 'accent' },
    { key: 'underoffer', label: 'Under offer', tone: 'amber' },
    { key: 'sold', label: 'Sold — pending transfer', tone: 'blue' },
    { key: 'registered', label: 'Registered', tone: 'green', terminal: true },
    { key: 'withdrawn', label: 'Withdrawn', tone: 'dark', terminal: true },
    { key: 'expired', label: 'Mandate expired', tone: 'red', terminal: true },
  ],
  transitions: [
    { from: 'valuation', to: 'mandate', label: 'Mandate signed', permission: 'listings.manage', intent: 'primary',
      guard: ({ record }) => {
        if (!str(record, 'mandateSigned') || !str(record, 'mandateExpiry')) return 'Record the mandate signature and expiry dates first — use “Record the mandate” on the listing.';
        if (str(record, 'mandateExpiry') <= str(record, 'mandateSigned')) return 'The mandate must expire after the date it was signed.';
        return null;
      } },
    { from: 'mandate', to: 'listed', label: 'Go live', permission: 'mandates.approve', intent: 'primary',
      guard: ({ record, data }) => goLiveProblems(record, data, todayStr())[0] ?? null,
      after: ({ record, api, today }) => {
        api.update('listings', record.id, {
          listedOn: str(record, 'listedOn') || today,
          originalPrice: num(record, 'originalPrice') || num(record, 'askingPrice'),
        }, 'Listing date recorded');
        api.toast('Listed — portal syndication is not connected in this demo', 'info');
      } },
    { from: 'listed', to: 'underoffer', label: 'Mark under offer', permission: 'offers.manage',
      guard: ({ record, data }) => (offersFor(data, record.id).some(binding) ? null : 'Accept an offer to purchase first — the listing moves under offer automatically.') },
    { from: 'underoffer', to: 'listed', label: 'Back on the market', permission: 'offers.manage', requiresNote: true,
      guard: ({ record, data }) => {
        const live = offersFor(data, record.id).find(binding);
        return live ? `Offer ${live.ref} is still accepted. Lapse it first (Offers → Lapse offer).` : null;
      } },
    { from: 'underoffer', to: 'sold', label: 'Sold — conditions met', permission: 'offers.manage', intent: 'primary',
      guard: ({ record, data }) => (unconditionalOffer(data, record.id) ? null : 'The accepted offer’s suspensive conditions must be met first (Offers → Conditions met).'),
      after: ({ record, data, api, today }) => {
        const offer = unconditionalOffer(data, record.id);
        if (!offer) return;
        api.update('listings', record.id, { soldPrice: num(offer, 'amount'), soldOn: str(record, 'soldOn') || today }, `Sale price recorded from ${offer.ref}`);
        if (!transferFor(data, record.id)) {
          const t = api.create('transfers', {
            listing: record.id, offer: offer.id, conveyancer: '', purchasePrice: num(offer, 'amount'), otpSignedOn: today,
            expectedRegistration: addDays(today, 90), transferDuty: false, ratesClearance: false, notes: '',
          }, 'otp', `Transfer opened from ${offer.ref}`);
          api.toast(`Transfer ${t.ref} opened — track conveyancing on Transfers`, 'info');
        }
      } },
    { from: 'sold', to: 'registered', label: 'Registered at deeds office', permission: 'offers.manage', intent: 'primary',
      guard: ({ record, data }) => (records(data, 'transfers').some((t) => str(t, 'listing') === record.id && t.status === 'registered') ? null : 'The transfer has not been registered yet — record registration on the Transfers board.') },
    { from: ['valuation', 'mandate', 'listed', 'underoffer'], to: 'withdrawn', label: 'Withdraw', permission: 'listings.manage', requiresNote: true, intent: 'danger',
      guard: ({ record, data }) => {
        const live = offersFor(data, record.id).find(binding);
        return live ? `Offer ${live.ref} has been accepted — it must lapse or be cancelled before the listing can be withdrawn.` : null;
      } },
    { from: ['mandate', 'listed'], to: 'expired', label: 'Mandate expired', permission: 'listings.manage', requiresNote: true,
      guard: ({ record }) => {
        const exp = str(record, 'mandateExpiry');
        return exp && exp > todayStr() ? `The mandate runs until ${formatDate(exp)}. Withdraw the listing instead if the seller has cancelled.` : null;
      } },
    { from: 'expired', to: 'mandate', label: 'Renew mandate', permission: 'listings.manage',
      guard: ({ record }) => (str(record, 'mandateExpiry') > todayStr() ? null : 'Enter the new mandate expiry date first — use “Renew mandate” on the listing.') },
  ],
};

const leadWorkflow: WorkflowDef = {
  initial: 'new',
  states: [
    { key: 'new', label: 'New enquiry', tone: 'dark' },
    { key: 'contacted', label: 'Contacted', tone: 'blue' },
    { key: 'viewing', label: 'Viewing booked', tone: 'accent' },
    { key: 'offer', label: 'Offer made', tone: 'amber' },
    { key: 'bought', label: 'Bought', tone: 'green', terminal: true },
    { key: 'lost', label: 'Lost', tone: 'red', terminal: true },
  ],
  transitions: [
    { from: 'new', to: 'contacted', label: 'Mark contacted', permission: 'leads', intent: 'primary' },
    { from: ['new', 'contacted'], to: 'viewing', label: 'Viewing booked', permission: 'leads',
      guard: ({ record, data }) => (records(data, 'viewings').some((v) => str(v, 'lead') === record.id && ['booked', 'completed'].includes(v.status ?? '')) ? null : 'Book a viewing for this buyer first (Matching listings → Book viewing).') },
    { from: ['new', 'contacted', 'viewing'], to: 'offer', label: 'Offer made', permission: 'leads',
      guard: ({ record, data }) => (records(data, 'offers').some((o) => str(o, 'lead') === record.id) ? null : 'Capture the offer to purchase first — use “Capture offer” on this buyer.') },
    { from: ['new', 'contacted', 'viewing', 'offer'], to: 'bought', label: 'Bought', permission: 'leads',
      guard: ({ record, data }) => (records(data, 'offers').some((o) => str(o, 'lead') === record.id && o.status === 'unconditional') ? null : 'None of this buyer’s offers has had its conditions met yet.') },
    { from: ['new', 'contacted', 'viewing', 'offer'], to: 'lost', label: 'Mark lost', permission: 'leads', requiresNote: true, intent: 'danger' },
    { from: 'lost', to: 'contacted', label: 'Re-activate', permission: 'leads', requiresNote: true },
  ],
};

const viewingWorkflow: WorkflowDef = {
  initial: 'booked',
  states: [
    { key: 'booked', label: 'Booked', tone: 'blue' },
    { key: 'completed', label: 'Completed', tone: 'green', terminal: true },
    { key: 'noshow', label: 'No-show', tone: 'red', terminal: true },
    { key: 'cancelled', label: 'Cancelled', tone: 'dark', terminal: true },
  ],
  transitions: [
    { from: 'booked', to: 'completed', label: 'Complete with feedback', permission: 'leads', intent: 'primary',
      guard: ({ record }) => completeViewingProblems(record, todayStr())[0] ?? null,
      after: ({ record, data, api }) => {
        const lead = findRecord(data, 'leads', str(record, 'lead'));
        if (lead && ['new', 'contacted'].includes(lead.status ?? '')) api.transition('leads', lead.id, 'viewing');
        if (str(record, 'interest') === 'hot') api.toast('Hot buyer — capture the offer to purchase while interest is high', 'info');
      } },
    { from: 'booked', to: 'noshow', label: 'No-show', permission: 'leads',
      guard: ({ record }) => (str(record, 'date') > todayStr() ? 'The viewing has not happened yet.' : null) },
    { from: 'booked', to: 'cancelled', label: 'Cancel viewing', permission: 'leads', requiresNote: true, intent: 'danger' },
  ],
};

const offerWorkflow: WorkflowDef = {
  initial: 'submitted',
  states: [
    { key: 'submitted', label: 'Submitted to seller', tone: 'blue' },
    { key: 'countered', label: 'Seller countered', tone: 'amber' },
    { key: 'accepted', label: 'Accepted — conditions pending', tone: 'accent' },
    { key: 'unconditional', label: 'Conditions met', tone: 'green', terminal: true },
    { key: 'declined', label: 'Declined', tone: 'red', terminal: true },
    { key: 'lapsed', label: 'Lapsed', tone: 'dark', terminal: true },
  ],
  transitions: [
    { from: 'submitted', to: 'accepted', label: 'Seller accepts', permission: 'offers.manage', intent: 'primary',
      guard: ({ record, data }) => acceptProblems(record, data)[0] ?? null,
      after: onOfferAccepted },
    { from: 'submitted', to: 'countered', label: 'Seller counters', permission: 'offers.manage',
      guard: ({ record }) => (num(record, 'counterAmount') > 0 && num(record, 'counterAmount') !== num(record, 'amount') ? null : 'Enter the seller’s counter-offer amount first — use “Seller’s response” on the offer.') },
    { from: 'countered', to: 'accepted', label: 'Buyer accepts counter-offer', permission: 'offers.manage', intent: 'primary',
      guard: ({ record, data }) => acceptProblems(record, data)[0] ?? null,
      after: (ctx) => {
        ctx.api.update('offers', ctx.record.id, { amount: num(ctx.record, 'counterAmount') }, `Price agreed at ${randOf(num(ctx.record, 'counterAmount'))} (counter-offer)`);
        onOfferAccepted(ctx);
      } },
    { from: 'countered', to: 'submitted', label: 'Buyer revises offer', permission: 'offers.manage', requiresNote: true },
    { from: ['submitted', 'countered'], to: 'declined', label: 'Decline', permission: 'offers.manage', requiresNote: true, intent: 'danger' },
    { from: 'accepted', to: 'unconditional', label: 'Conditions met', permission: 'offers.manage', intent: 'primary',
      guard: ({ record }) => conditionsProblems(record)[0] ?? null,
      after: ({ record, data, api }) => {
        const listing = listingOf(data, record);
        if (listing?.status === 'underoffer') {
          const res = api.transition('listings', listing.id, 'sold');
          if (!res.ok) api.toast(`${listing.ref}: ${res.reason}`, 'err');
        }
        const lead = findRecord(data, 'leads', str(record, 'lead'));
        if (lead && !['bought', 'lost'].includes(lead.status ?? '')) api.transition('leads', lead.id, 'bought');
      } },
    { from: 'accepted', to: 'lapsed', label: 'Lapse offer', permission: 'offers.manage', requiresNote: true, intent: 'danger',
      after: ({ record, data, api, note }) => {
        const listing = listingOf(data, record);
        if (listing?.status === 'underoffer') api.transition('listings', listing.id, 'listed', `Offer ${record.ref} lapsed: ${note ?? ''}`.trim());
      } },
  ],
};

const transferWorkflow: WorkflowDef = {
  initial: 'otp',
  states: [
    { key: 'otp', label: 'OTP signed', tone: 'dark' },
    { key: 'bond', label: 'Bond approved / cash confirmed', tone: 'blue' },
    { key: 'docs', label: 'Transfer documents signed', tone: 'accent' },
    { key: 'lodged', label: 'Lodged at deeds office (simulated)', tone: 'amber' },
    { key: 'registered', label: 'Registered', tone: 'green', terminal: true },
    { key: 'cancelled', label: 'Cancelled', tone: 'red', terminal: true },
  ],
  transitions: [
    { from: 'otp', to: 'bond', label: 'Bond approved / cash confirmed', permission: 'offers.manage', intent: 'primary',
      guard: ({ record, data }) => bondStepProblem(record, data) },
    { from: 'bond', to: 'docs', label: 'Transfer documents signed', permission: 'offers.manage', intent: 'primary',
      guard: ({ record }) => (str(record, 'conveyancer') ? null : 'Select the transferring conveyancer first — open the transfer and use the conveyancing checklist.') },
    { from: 'docs', to: 'lodged', label: 'Lodged (simulated)', permission: 'offers.manage', intent: 'primary',
      guard: ({ record }) => lodgementProblems(record)[0] ?? null,
      after: ({ record, api, today }) => api.update('transfers', record.id, { lodgedOn: str(record, 'lodgedOn') || today }, 'Lodgement date recorded') },
    { from: 'lodged', to: 'registered', label: 'Registered (simulated)', permission: 'offers.manage', intent: 'primary',
      after: ({ record, data, api, today }) => {
        const listing = listingOf(data, record);
        const regDate = str(record, 'registeredOn') || today;
        api.update('transfers', record.id, { registeredOn: regDate }, 'Registration date recorded');
        if (!listing) return;
        const agent = agentOf(data, listing.values.agent);
        const c = api.create('commissions', {
          listing: listing.id, transfer: record.id, agent: str(listing, 'agent'), salePrice: num(record, 'purchasePrice'),
          rate: num(listing, 'commissionRate') || 7.5, agentSplit: num(agent, 'agentSplit') || 50, registeredOn: regDate, paidOn: '', notes: '',
        }, 'payable', `Commission payable on registration of ${record.ref}`);
        api.update('listings', listing.id, { registeredOn: regDate }, 'Registration date recorded');
        if (listing.status === 'sold') api.transition('listings', listing.id, 'registered');
        api.toast(`Commission ${c.ref} is now payable (${rand(commissionSplit(c).gross)} excl. VAT)`, 'info');
      } },
    { from: TRANSFER_OPEN, to: 'cancelled', label: 'Cancel transfer', permission: 'offers.manage', requiresNote: true, intent: 'danger' },
  ],
};

const leaseWorkflow: WorkflowDef = {
  initial: 'application',
  states: [
    { key: 'application', label: 'Application', tone: 'dark' },
    { key: 'vetting', label: 'Tenant vetting', tone: 'amber', hint: 'Credit & reference checks are simulated' },
    { key: 'approved', label: 'Approved', tone: 'blue' },
    { key: 'signed', label: 'Lease signed', tone: 'accent' },
    { key: 'active', label: 'Active', tone: 'green' },
    { key: 'notice', label: 'Notice given', tone: 'amber' },
    { key: 'ended', label: 'Ended', tone: 'dark', terminal: true },
    { key: 'declined', label: 'Declined', tone: 'red', terminal: true },
  ],
  transitions: [
    { from: 'application', to: 'vetting', label: 'Start vetting (simulated)', permission: 'rentals.manage', intent: 'primary' },
    { from: 'vetting', to: 'approved', label: 'Approve tenant', permission: 'tenants.vet', intent: 'primary',
      guard: ({ record }) => {
        const v = str(record, 'vetting');
        if (v === 'declined') return 'The vetting outcome is “Declined” — decline the application instead.';
        return v === 'approved' ? null : 'Record the vetting outcome first — use “Record vetting outcome” on the lease. Credit checks are simulated in this demo.';
      } },
    { from: 'vetting', to: 'declined', label: 'Decline application', permission: 'tenants.vet', requiresNote: true, intent: 'danger' },
    { from: 'approved', to: 'signed', label: 'Lease signed', permission: 'rentals.manage', intent: 'primary',
      guard: ({ record }) => leaseSignProblems(record)[0] ?? null },
    { from: 'signed', to: 'active', label: 'Tenant moved in', permission: 'rentals.manage', intent: 'primary',
      guard: ({ record }) => (str(record, 'startDate') && str(record, 'startDate') <= todayStr() ? null : `The lease only starts on ${formatDate(str(record, 'startDate'))}.`) },
    { from: 'active', to: 'notice', label: 'Notice given', permission: 'rentals.manage', requiresNote: true,
      after: ({ record, api, today }) => api.update('leases', record.id, { noticeDate: today }, 'Notice date recorded') },
    { from: 'notice', to: 'active', label: 'Notice withdrawn', permission: 'rentals.manage', requiresNote: true },
    { from: 'notice', to: 'ended', label: 'End lease', permission: 'rentals.manage',
      guard: ({ record }) => (num(record, 'arrears') > 0 ? `Arrears of ${randOf(num(record, 'arrears'))} must be settled or deducted from the deposit before the lease ends — use “Record arrears settled” on the lease.` : null) },
  ],
};

const maintenanceWorkflow: WorkflowDef = {
  initial: 'logged',
  states: [
    { key: 'logged', label: 'Logged', tone: 'dark' },
    { key: 'quoted', label: 'Quoted', tone: 'amber' },
    { key: 'approved', label: 'Approved', tone: 'blue' },
    { key: 'assigned', label: 'Contractor assigned', tone: 'accent' },
    { key: 'completed', label: 'Completed', tone: 'green', terminal: true },
    { key: 'cancelled', label: 'Cancelled', tone: 'dark', terminal: true },
  ],
  transitions: [
    { from: 'logged', to: 'quoted', label: 'Quote received', permission: 'maintenance', intent: 'primary',
      guard: ({ record }) => (num(record, 'quote') > 0 && str(record, 'contractor') ? null : 'Record the contractor and their quote first — open the job and use “Quote & approval”.') },
    { from: 'quoted', to: 'approved', label: 'Approve quote', permission: 'maintenance', intent: 'primary',
      guard: ({ record }) => maintenanceApprovalProblem(record) },
    { from: 'approved', to: 'assigned', label: 'Assign contractor', permission: 'maintenance', intent: 'primary',
      guard: ({ record }) => (str(record, 'contractor') ? null : 'Select a contractor first — open the job and use “Quote & approval”.') },
    { from: 'assigned', to: 'completed', label: 'Mark completed', permission: 'maintenance', requiresNote: true, intent: 'primary' },
    { from: ['logged', 'quoted', 'approved', 'assigned'], to: 'cancelled', label: 'Cancel job', permission: 'maintenance', requiresNote: true, intent: 'danger' },
  ],
};

const commissionWorkflow: WorkflowDef = {
  initial: 'payable',
  states: [
    { key: 'payable', label: 'Payable', tone: 'amber' },
    { key: 'paid', label: 'Paid out (simulated)', tone: 'green', terminal: true },
  ],
  transitions: [
    { from: 'payable', to: 'paid', label: 'Mark paid (simulated)', permission: 'commission.pay', intent: 'primary',
      guard: ({ record, data }) => (findRecord(data, 'transfers', str(record, 'transfer'))?.status === 'registered' ? null : 'Commission is only payable once the transfer is registered.'),
      after: ({ record, api, today }) => api.update('commissions', record.id, { paidOn: str(record, 'paidOn') || today }, 'Payout date recorded (simulated)') },
  ],
};

/* ---------------- Collections ---------------- */
const phoneRule = (v: unknown) => (/^0\d{2} 555 \d{4}$/.test(String(v)) ? null : 'Use a fictional number in the format 0xx 555 xxxx.');
const emailRule = (v: unknown) => (/^[^@\s]+@example\.com$/.test(String(v)) ? null : 'Use a fictional @example.com address.');
const byRefDesc = (a: { ref: string }, b: { ref: string }) => b.ref.localeCompare(a.ref);

const collections: CollectionDef[] = [
  {
    key: 'listings', singular: 'Listing', plural: 'Listings', refPrefix: 'LST', workflow: listingWorkflow, editPermission: 'listings.manage',
    title: (r) => str(r, 'address'),
    subtitle: (r, d) => `${suburbLabel(str(r, 'suburb'))} · ${num(r, 'beds')} bed ${label(PROPERTY_TYPES, str(r, 'type')).toLowerCase()} · ${randOf(num(r, 'askingPrice'))} · ${agentName(d, r.values.agent)}`,
    sort: byRefDesc,
    createFields: ['address', 'suburb', 'type', 'beds', 'baths', 'erf', 'floor', 'valuation', 'askingPrice', 'agent', 'sellerName', 'sellerPhone', 'sellerEmail', 'mandateType', 'commissionRate'],
    flags: (r, d, today) => {
      const out: FlagList = [];
      const st = r.status ?? '';
      if (['mandate', 'listed', 'underoffer'].includes(st)) {
        const left = mandateDaysLeft(r, today);
        if (left !== null && left < 0) out.push({ tone: 'red', label: 'Mandate expired' });
        else if (left !== null && left <= 14) out.push({ tone: 'amber', label: left === 0 ? 'Mandate expires today' : `Mandate expires in ${left} day${left === 1 ? '' : 's'}` });
        if (ffcState(agentOf(d, r.values.agent), today) === 'expired') out.push({ tone: 'red', label: 'Agent FFC expired' });
      }
      if (ON_MARKET.includes(st)) {
        const dom = daysOnMarket(r, today);
        if (dom !== null && dom > 90) out.push({ tone: 'amber', label: `${dom} days on market` });
        if (priceReduced(r)) out.push({ tone: 'accent', label: `Reduced ${reductionPct(r)}%` });
      }
      return out;
    },
    fields: [
      { key: 'address', label: 'Street address (fictional)', type: 'text', required: true, wide: true },
      { key: 'suburb', label: 'Suburb (fictional)', type: 'select', options: SUBURBS, required: true, table: true },
      { key: 'type', label: 'Property type', type: 'select', options: PROPERTY_TYPES, required: true },
      { key: 'beds', label: 'Bedrooms', type: 'number', min: 0, max: 12, required: true, table: true },
      { key: 'baths', label: 'Bathrooms', type: 'number', min: 0, max: 10, step: 0.5 },
      { key: 'erf', label: 'Erf size (m²)', type: 'number', min: 0 },
      { key: 'floor', label: 'Floor area (m²)', type: 'number', min: 0 },
      { key: 'valuation', label: 'Agent valuation', type: 'money', min: 0 },
      { key: 'askingPrice', label: 'Asking price', type: 'money', min: 0, table: true },
      { key: 'originalPrice', label: 'Original asking price', type: 'money', min: 0, hint: 'Set when the listing goes live; used to flag price reductions.' },
      { key: 'agent', label: 'Listing agent', type: 'ref', ref: 'agents', required: true, table: true },
      { key: 'mandateType', label: 'Mandate type', type: 'select', options: MANDATE_TYPES },
      { key: 'mandateSigned', label: 'Mandate signed on', type: 'date' },
      { key: 'mandateExpiry', label: 'Mandate expires', type: 'date', table: true,
        validate: (v, all) => (all.mandateSigned && String(v) <= String(all.mandateSigned) ? 'The mandate must expire after it was signed.' : null) },
      { key: 'listedOn', label: 'Listed on', type: 'date' },
      { key: 'sellerName', label: 'Seller (fictional)', type: 'text', required: true },
      { key: 'sellerPhone', label: 'Seller phone', type: 'text', validate: phoneRule },
      { key: 'sellerEmail', label: 'Seller email', type: 'text', validate: emailRule },
      { key: 'sellerFica', label: 'Seller FICA verified (simulated)', type: 'boolean' },
      { key: 'commissionRate', label: 'Commission % (excl. VAT)', type: 'number', min: 0, max: 10, step: 0.1, hint: 'Demo default 7.5%.' },
      { key: 'soldPrice', label: 'Selling price', type: 'money', min: 0 },
      { key: 'soldOn', label: 'Sold on', type: 'date' },
      { key: 'registeredOn', label: 'Registered on (simulated)', type: 'date' },
      { key: 'notes', label: 'Notes', type: 'textarea' },
    ],
  },
  {
    key: 'leads', singular: 'Buyer', plural: 'Buyers & leads', refPrefix: 'BYR', workflow: leadWorkflow, editPermission: 'leads',
    title: (r) => str(r, 'name'),
    subtitle: (r) => `Budget ${randOf(num(r, 'budget'))} · ${num(r, 'minBeds')}+ bed · ${str(r, 'suburbs') || 'any suburb'}`,
    sort: byRefDesc,
    createFields: ['name', 'phone', 'email', 'source', 'budget', 'suburbs', 'minBeds', 'propertyType', 'preApproved', 'agent', 'notes'],
    flags: (r, d, today) => {
      const out: FlagList = [];
      if (r.status === 'new' && daysBetween(r.createdAt.slice(0, 10), today) >= 2) out.push({ tone: 'amber', label: 'Not contacted 48 h+' });
      if (['new', 'contacted', 'viewing'].includes(r.status ?? '')) {
        const n = matchingListings(d, r).length;
        if (n) out.push({ tone: 'accent', label: `${n} matching listing${n === 1 ? '' : 's'}` });
      }
      if (r.values.preApproved === true && r.status !== 'bought' && r.status !== 'lost') out.push({ tone: 'green', label: 'Bond pre-approved' });
      return out;
    },
    fields: [
      { key: 'name', label: 'Buyer name (fictional)', type: 'text', required: true },
      { key: 'phone', label: 'Phone', type: 'text', required: true, validate: phoneRule },
      { key: 'email', label: 'Email', type: 'text', validate: emailRule },
      { key: 'source', label: 'Lead source', type: 'select', options: LEAD_SOURCES, required: true, table: true },
      { key: 'budget', label: 'Budget', type: 'money', min: 0, required: true, table: true, hint: 'Listings within ±10% are matched.' },
      { key: 'suburbs', label: 'Preferred suburbs', type: 'text', wide: true, placeholder: 'Marula Heights, Quartz Hill', hint: `Comma separated. Known (fictional) suburbs: ${SUBURBS.map((s) => s.label).join(', ')}.`,
        validate: (v) => { const bad = unknownSuburbs(String(v ?? '')); return bad.length ? `Unknown suburb: ${bad.join(', ')}.` : null; } },
      { key: 'minBeds', label: 'Minimum bedrooms', type: 'number', min: 0, max: 8, table: true },
      { key: 'propertyType', label: 'Property type', type: 'select', options: LEAD_PROPERTY_TYPES },
      { key: 'preApproved', label: 'Bond pre-approval (simulated)', type: 'boolean' },
      { key: 'agent', label: 'Agent', type: 'ref', ref: 'agents', table: true },
      { key: 'notes', label: 'Notes', type: 'textarea' },
    ],
  },
  {
    key: 'viewings', singular: 'Viewing', plural: 'Viewings & show days', refPrefix: 'VW', workflow: viewingWorkflow, editPermission: 'leads',
    title: (r, d) => listingName(d, r.values.listing),
    subtitle: (r, d) => `${formatDate(str(r, 'date'))} ${str(r, 'time')} · ${str(r, 'lead') ? leadName(d, r.values.lead) : label(VIEWING_KINDS, str(r, 'kind'))} · ${agentName(d, r.values.agent)}`,
    sort: (a, b) => (str(b, 'date') + str(b, 'time')).localeCompare(str(a, 'date') + str(a, 'time')),
    flags: (r, _d, today) => {
      if (r.status !== 'booked') return [];
      if (str(r, 'date') < today) return [{ tone: 'red', label: 'Feedback outstanding' }];
      if (str(r, 'date') === today) return [{ tone: 'accent', label: 'Today' }];
      return [];
    },
    fields: [
      { key: 'listing', label: 'Listing', type: 'ref', ref: 'listings', required: true },
      { key: 'lead', label: 'Buyer', type: 'ref', ref: 'leads', hint: 'Optional for show days.' },
      { key: 'kind', label: 'Type', type: 'select', options: VIEWING_KINDS, required: true, table: true },
      { key: 'date', label: 'Date', type: 'date', required: true, table: true },
      { key: 'time', label: 'Time', type: 'time', required: true, table: true },
      { key: 'agent', label: 'Hosting agent', type: 'ref', ref: 'agents', required: true, table: true },
      { key: 'interest', label: 'Interest level', type: 'select', options: INTEREST, table: true },
      { key: 'feedback', label: 'Feedback after the viewing', type: 'textarea' },
    ],
  },
  {
    key: 'offers', singular: 'Offer to purchase', plural: 'Offers to purchase', refPrefix: 'OTP', workflow: offerWorkflow, editPermission: 'offers.manage',
    title: (r, d) => listingName(d, r.values.listing),
    subtitle: (r, d) => `${leadName(d, r.values.lead)} · ${randOf(num(r, 'amount'))} (asking ${randOf(num(listingOf(d, r), 'askingPrice'))})`,
    sort: byRefDesc,
    createFields: ['listing', 'lead', 'amount', 'deposit', 'bondRequired', 'bondAmount', 'bondDeadline', 'conditions', 'validUntil', 'notes'],
    flags: (r, d, today) => {
      const out: FlagList = [];
      if (r.status === 'accepted') {
        const left = bondDaysLeft(r, today);
        if (left !== null && left < 0) out.push({ tone: 'red', label: `Bond deadline passed ${-left} day${left === -1 ? '' : 's'} ago` });
        else if (left !== null && left <= 5) out.push({ tone: 'amber', label: left === 0 ? 'Bond deadline today' : `Bond deadline in ${left} day${left === 1 ? '' : 's'}` });
        if (num(r, 'deposit') > 0 && r.values.depositPaid !== true) out.push({ tone: 'amber', label: 'Deposit not yet paid' });
      }
      if (['submitted', 'countered'].includes(r.status ?? '') && str(r, 'validUntil')) {
        const left = daysBetween(today, str(r, 'validUntil'));
        if (left < 0) out.push({ tone: 'red', label: 'Offer period passed' });
        else if (left <= 2) out.push({ tone: 'amber', label: left === 0 ? 'Open until today' : `Open ${left} more day${left === 1 ? '' : 's'}` });
      }
      const ask = num(listingOf(d, r), 'askingPrice');
      if (r.status === 'submitted' && ask > 0 && num(r, 'amount') < ask * 0.9) out.push({ tone: 'dark', label: `${Math.round((1 - num(r, 'amount') / ask) * 100)}% below asking` });
      return out;
    },
    fields: [
      { key: 'listing', label: 'Listing', type: 'ref', ref: 'listings', required: true },
      { key: 'lead', label: 'Buyer', type: 'ref', ref: 'leads', required: true },
      { key: 'amount', label: 'Offer amount', type: 'money', min: 1, required: true, table: true },
      { key: 'deposit', label: 'Deposit', type: 'money', min: 0 },
      { key: 'depositPaid', label: 'Deposit paid into conveyancer’s trust (simulated)', type: 'boolean' },
      { key: 'bondRequired', label: 'Subject to a bond', type: 'boolean' },
      { key: 'bondAmount', label: 'Bond amount', type: 'money', min: 0 },
      { key: 'bondDeadline', label: 'Bond approval deadline', type: 'date', table: true },
      { key: 'bondApproved', label: 'Bond approved (simulated)', type: 'boolean' },
      { key: 'conditions', label: 'Other suspensive conditions', type: 'textarea' },
      { key: 'conditionsFulfilled', label: 'Other conditions fulfilled', type: 'boolean' },
      { key: 'validUntil', label: 'Offer open until', type: 'date', table: true },
      { key: 'counterAmount', label: 'Seller counter-offer', type: 'money', min: 0 },
      { key: 'notes', label: 'Notes', type: 'textarea' },
    ],
  },
  {
    key: 'transfers', singular: 'Transfer', plural: 'Transfers', refPrefix: 'TRF', workflow: transferWorkflow, editPermission: 'offers.manage',
    title: (r, d) => listingName(d, r.values.listing),
    subtitle: (r, d) => `${leadName(d, findRecord(d, 'offers', str(r, 'offer'))?.values.lead)} · ${randOf(num(r, 'purchasePrice'))} · ${str(r, 'conveyancer') ? label(CONVEYANCERS, str(r, 'conveyancer')) : 'conveyancer not set'}`,
    sort: (a, b) => str(a, 'expectedRegistration').localeCompare(str(b, 'expectedRegistration')),
    flags: (r, _d, today) => {
      if (!TRANSFER_OPEN.includes(r.status ?? '')) return [];
      const exp = str(r, 'expectedRegistration');
      if (!exp) return [];
      if (exp < today) return [{ tone: 'red', label: `Expected ${formatDate(exp)} — overdue` }];
      if (exp.slice(0, 7) === today.slice(0, 7)) return [{ tone: 'accent', label: 'Registers this month' }];
      return [];
    },
    fields: [
      { key: 'listing', label: 'Property', type: 'ref', ref: 'listings', required: true },
      { key: 'offer', label: 'Offer to purchase', type: 'ref', ref: 'offers', required: true },
      { key: 'conveyancer', label: 'Transferring conveyancer', type: 'select', options: CONVEYANCERS, table: true },
      { key: 'purchasePrice', label: 'Purchase price', type: 'money', min: 0, table: true },
      { key: 'otpSignedOn', label: 'OTP signed on', type: 'date' },
      { key: 'expectedRegistration', label: 'Expected registration', type: 'date', table: true },
      { key: 'transferDuty', label: 'Transfer duty receipt (simulated)', type: 'boolean' },
      { key: 'ratesClearance', label: 'Rates clearance certificate (simulated)', type: 'boolean' },
      { key: 'lodgedOn', label: 'Lodged on (simulated)', type: 'date' },
      { key: 'registeredOn', label: 'Registered on (simulated)', type: 'date' },
      { key: 'notes', label: 'Notes', type: 'textarea' },
    ],
  },
  {
    key: 'leases', singular: 'Lease', plural: 'Rentals & leases', refPrefix: 'LSE', workflow: leaseWorkflow, editPermission: 'rentals.manage',
    title: (r) => str(r, 'address'),
    subtitle: (r) => `${suburbLabel(str(r, 'suburb'))} · ${str(r, 'tenant') || 'no tenant yet'} · ${randOf(num(r, 'rent'))}/month`,
    sort: byRefDesc,
    createFields: ['address', 'suburb', 'propertyType', 'beds', 'landlord', 'tenant', 'tenantPhone', 'tenantEmail', 'rent', 'escalation', 'deposit', 'startDate', 'endDate', 'agent', 'management'],
    flags: (r, _d, today) => {
      const out: FlagList = [];
      if (num(r, 'arrears') > 0 && ['active', 'notice', 'signed'].includes(r.status ?? '')) out.push({ tone: 'red', label: `Arrears ${randOf(num(r, 'arrears'))}` });
      if (['active', 'notice'].includes(r.status ?? '')) {
        const left = leaseEndsIn(r, today);
        if (left !== null && left < 0) out.push({ tone: 'red', label: 'Lease end date passed' });
        else if (left !== null && left <= 60) out.push({ tone: 'amber', label: `Ends in ${left} days` });
      }
      if (r.status === 'approved' && r.values.depositReceived !== true) out.push({ tone: 'amber', label: 'Deposit outstanding' });
      return out;
    },
    fields: [
      { key: 'address', label: 'Rental property (fictional)', type: 'text', required: true, wide: true },
      { key: 'suburb', label: 'Suburb (fictional)', type: 'select', options: SUBURBS, required: true, table: true },
      { key: 'propertyType', label: 'Property type', type: 'select', options: PROPERTY_TYPES },
      { key: 'beds', label: 'Bedrooms', type: 'number', min: 0, max: 10 },
      { key: 'landlord', label: 'Landlord (fictional)', type: 'text', required: true },
      { key: 'tenant', label: 'Tenant / applicant (fictional)', type: 'text', required: true, table: true },
      { key: 'tenantPhone', label: 'Tenant phone', type: 'text', validate: phoneRule },
      { key: 'tenantEmail', label: 'Tenant email', type: 'text', validate: emailRule },
      { key: 'rent', label: 'Monthly rent', type: 'money', min: 0, required: true, table: true },
      { key: 'escalation', label: 'Annual escalation %', type: 'number', min: 0, max: 20, step: 0.5 },
      { key: 'deposit', label: 'Deposit (held in trust — simulated)', type: 'money', min: 0 },
      { key: 'depositReceived', label: 'Deposit received into trust (simulated)', type: 'boolean' },
      { key: 'vetting', label: 'Vetting outcome (simulated credit check)', type: 'select', options: VETTING, table: true },
      { key: 'vettingNotes', label: 'Vetting notes (restricted)', type: 'textarea', permission: 'tenants.vet', hint: 'Visible only to roles holding tenants.vet (simulated restriction).' },
      { key: 'startDate', label: 'Lease start', type: 'date' },
      { key: 'endDate', label: 'Lease end', type: 'date', table: true },
      { key: 'arrears', label: 'Rent arrears', type: 'money', min: 0 },
      { key: 'agent', label: 'Rental agent', type: 'ref', ref: 'agents' },
      { key: 'management', label: 'Mandate', type: 'select', options: MANAGEMENT },
      { key: 'noticeDate', label: 'Notice given on', type: 'date' },
      { key: 'notes', label: 'Notes', type: 'textarea' },
    ],
  },
  {
    key: 'maintenance', singular: 'Maintenance job', plural: 'Maintenance requests', refPrefix: 'MNT', workflow: maintenanceWorkflow, editPermission: 'maintenance',
    title: (r) => str(r, 'title'),
    subtitle: (r, d) => `${leaseName(d, r.values.lease)} · ${label(PRIORITIES, str(r, 'priority'))}${num(r, 'quote') ? ` · quote ${randOf(num(r, 'quote'))}` : ''}`,
    sort: byRefDesc,
    createFields: ['lease', 'title', 'category', 'priority', 'reportedOn', 'contractor', 'quote', 'notes'],
    flags: (r, _d, today) => {
      const out: FlagList = [];
      const open = ['logged', 'quoted', 'approved', 'assigned'].includes(r.status ?? '');
      if (open && str(r, 'priority') === 'urgent') out.push({ tone: 'red', label: 'Urgent' });
      if (r.status === 'quoted' && num(r, 'quote') > OWNER_APPROVAL_LIMIT && r.values.ownerApproved !== true) out.push({ tone: 'amber', label: 'Owner approval needed' });
      if (open && str(r, 'reportedOn') && daysBetween(str(r, 'reportedOn'), today) > 14) out.push({ tone: 'amber', label: `Open ${daysBetween(str(r, 'reportedOn'), today)} days` });
      return out;
    },
    fields: [
      { key: 'lease', label: 'Rental property', type: 'ref', ref: 'leases', required: true },
      { key: 'title', label: 'Problem', type: 'text', required: true, wide: true },
      { key: 'category', label: 'Category', type: 'select', options: MAINT_CATEGORIES, required: true, table: true },
      { key: 'priority', label: 'Priority', type: 'select', options: PRIORITIES, required: true, table: true },
      { key: 'reportedOn', label: 'Reported on', type: 'date', required: true, table: true },
      { key: 'contractor', label: 'Contractor (fictional)', type: 'select', options: CONTRACTORS },
      { key: 'quote', label: 'Quote (incl. VAT)', type: 'money', min: 0, table: true, hint: `Quotes above R${OWNER_APPROVAL_LIMIT} need the owner’s written approval (demo limit).` },
      { key: 'ownerApproved', label: 'Owner approved in writing (simulated)', type: 'boolean' },
      { key: 'notes', label: 'Notes', type: 'textarea' },
    ],
  },
  {
    key: 'agents', singular: 'Agent', plural: 'Agents & FFCs', refPrefix: 'AG', editPermission: 'agents.manage',
    title: (r) => str(r, 'name'),
    subtitle: (r) => `${label(DESIGNATIONS, str(r, 'designation'))} · ${str(r, 'ffcNumber')}`,
    sort: (a, b) => a.ref.localeCompare(b.ref),
    flags: (r, _d, today) => {
      const s = ffcState(r, today);
      if (s === 'expired') return [{ tone: 'red', label: 'FFC expired' }];
      if (s === 'missing') return [{ tone: 'red', label: 'No FFC on record' }];
      if (s === 'expiring') return [{ tone: 'amber', label: `FFC expires in ${daysBetween(today, str(r, 'ffcExpiry'))} days` }];
      return [{ tone: 'green', label: 'FFC valid' }];
    },
    fields: [
      { key: 'name', label: 'Name (fictional)', type: 'text', required: true },
      { key: 'designation', label: 'Designation', type: 'select', options: DESIGNATIONS, required: true, table: true },
      { key: 'phone', label: 'Phone', type: 'text', required: true, validate: phoneRule },
      { key: 'email', label: 'Email', type: 'text', required: true, validate: emailRule },
      { key: 'ffcNumber', label: 'FFC number (fictional)', type: 'text', required: true, table: true, placeholder: 'DEMO-FFC-0000',
        validate: (v) => (/^DEMO-FFC-/.test(String(v)) ? null : 'Certificate numbers in this demo must start with DEMO-FFC- so they cannot be mistaken for real ones.') },
      { key: 'ffcExpiry', label: 'FFC valid until', type: 'date', required: true, table: true },
      { key: 'agentSplit', label: 'Agent share of commission %', type: 'number', min: 0, max: 100, table: true, hint: 'Demo split — the company keeps the rest.' },
    ],
  },
  {
    key: 'commissions', singular: 'Commission', plural: 'Commission', refPrefix: 'COM', workflow: commissionWorkflow, editPermission: 'commission.pay',
    title: (r, d) => listingName(d, r.values.listing),
    subtitle: (r, d) => `${agentName(d, r.values.agent)} · ${rand(commissionSplit(r).gross)} excl. VAT · registered ${formatDate(str(r, 'registeredOn'))}`,
    sort: (a, b) => str(b, 'registeredOn').localeCompare(str(a, 'registeredOn')),
    fields: [
      { key: 'listing', label: 'Property', type: 'ref', ref: 'listings', required: true },
      { key: 'transfer', label: 'Transfer', type: 'ref', ref: 'transfers', required: true },
      { key: 'agent', label: 'Agent', type: 'ref', ref: 'agents', required: true, table: true },
      { key: 'salePrice', label: 'Selling price', type: 'money', min: 0, required: true, table: true },
      { key: 'rate', label: 'Commission % (excl. VAT)', type: 'number', min: 0, max: 10, step: 0.1, table: true },
      { key: 'agentSplit', label: 'Agent share %', type: 'number', min: 0, max: 100 },
      { key: 'registeredOn', label: 'Registered on', type: 'date', table: true },
      { key: 'paidOn', label: 'Paid on (simulated)', type: 'date' },
      { key: 'notes', label: 'Notes', type: 'textarea' },
    ],
  },
];

const config: IndustryConfig = {
  id: 'realestate',
  industry: 'Real estate',
  businessName: 'Kestrel Property Group',
  monogram: 'KP',
  workspaceTag: 'AGENCY WORKSPACE',
  tagline: 'Sales, rentals and conveyancing tracking for a residential agency',
  summary: 'A residential sales and rentals agency: mandates with go-live compliance checks, buyers matched to listings, viewings with feedback, offers to purchase with bond deadlines, a conveyancing tracker that makes commission payable on registration, and leases with vetting, arrears and maintenance.',
  priority: 6,
  theme: { accent: '#7b4a73', accent2: '#8d5a85', accentSoft: '#d9b3cf', accentTint: '#f5ebf2', accentLine: '#e8d4e2', accentText: '#5e3457' },
  roles: [
    { key: 'principal', label: 'Principal' },
    { key: 'sales', label: 'Sales agent' },
    { key: 'rental', label: 'Rental agent' },
    { key: 'admin', label: 'Property manager / admin' },
    { key: 'bookkeeper', label: 'Bookkeeper' },
  ],
  permissions: [
    { key: 'listings.manage', label: 'Manage listings', description: 'Capture valuations and listings, record mandates, withdraw or expire listings' },
    { key: 'mandates.approve', label: 'Approve go-live', description: 'Put a listing live after the mandate, seller FICA and agent FFC checks' },
    { key: 'leads', label: 'Buyers & viewings', description: 'Capture buyer leads, book viewings and record feedback' },
    { key: 'offers.manage', label: 'Offers & transfers', description: 'Capture and progress offers to purchase and the conveyancing tracker' },
    { key: 'rentals.manage', label: 'Manage leases', description: 'Rental applications, lease signing, notice and arrears' },
    { key: 'tenants.vet', label: 'Vet tenants', description: 'Approve or decline applicants and see vetting notes (simulated checks)' },
    { key: 'maintenance', label: 'Maintenance', description: 'Log maintenance requests, approve quotes and assign contractors' },
    { key: 'agents.manage', label: 'Manage agents', description: 'Edit agent records and Fidelity Fund Certificate dates (fictional register)' },
    { key: 'commission.view', label: 'View commission', description: 'See commission figures and splits' },
    { key: 'commission.pay', label: 'Pay commission', description: 'Mark commission paid out (simulated — no payments are made)' },
  ],
  modules: [
    { key: 'listings', label: 'Listings & mandates', icon: IcoHome, group: 'Sales', collection: 'listings', detail: ListingDetail, description: 'Valuation → mandate → listed → under offer → sold → registered. Going live needs a current mandate, seller FICA and an agent with a valid FFC.' },
    { key: 'leads', label: 'Buyers & leads', icon: IcoUsers, group: 'Sales', collection: 'leads', detail: LeadDetail, description: 'Buyer enquiries with budget, suburbs and bedrooms — each buyer is matched to listings within ±10% of budget.' },
    { key: 'viewings', label: 'Viewings & show days', icon: IcoCalendar, group: 'Sales', collection: 'viewings', page: Viewings, detail: ViewingDetail, description: 'Day schedule per agent. A viewing is only completed once the buyer’s feedback and interest level are recorded.' },
    { key: 'offers', label: 'Offers to purchase', icon: IcoDoc, group: 'Sales', collection: 'offers', detail: OfferDetail, description: 'Offers, counter-offers and suspensive conditions. Accepting puts the listing under offer; conditions met opens the transfer.' },
    { key: 'transfers', label: 'Transfers', icon: IcoBriefcase, group: 'Sales', collection: 'transfers', view: 'board', detail: TransferDetail, description: 'Conveyancing tracker (simulated): OTP → bond → documents → lodged → registered. Commission becomes payable on registration.' },
    { key: 'leases', label: 'Rentals & leases', icon: IcoKey, group: 'Rentals', collection: 'leases', detail: LeaseDetail, description: 'Application → vetting → approved → lease signed → active → notice → ended. Signing needs approved vetting and the deposit in trust (both simulated).' },
    { key: 'maintenance', label: 'Maintenance', icon: IcoWrench, group: 'Rentals', collection: 'maintenance', view: 'board', detail: MaintenanceDetail, description: `Logged → quoted → approved → contractor assigned → completed. Quotes above R${OWNER_APPROVAL_LIMIT} need the owner’s approval.` },
    { key: 'agents', label: 'Agents & FFCs', icon: IcoShield, group: 'Agency', collection: 'agents', description: 'Agents with fictional Fidelity Fund Certificate numbers and expiry dates. An expired FFC blocks new listings going live.' },
    { key: 'commission', label: 'Commission & reports', icon: IcoChart, group: 'Agency', collection: 'commissions', page: Reports, description: 'Pipeline value by stage, commission by agent (demo 50/50 split), days on market, viewing-to-offer conversion and rental arrears.' },
  ],
  collections,
  seed: buildRealEstateSeed,
  dashboard: Dashboard,
  boundaries: [
    'Not compliant with the Property Practitioners Act, PPRA rules or FICA: compliance checks are demo business rules on fictional data.',
    'Fidelity Fund Certificate numbers and dates are fictional and are not checked against any register.',
    'No portal syndication — Property24, Private Property and similar portals are not connected; “listed” is a status only.',
    'No deeds office, conveyancer or bank integration: bond approvals, lodgement and registration are statuses recorded by hand.',
    'Tenant credit and reference checks are simulated outcomes; no credit bureau is contacted.',
    'Deposits “held in trust” are figures only — this is not a trust account and is not PPRA trust-accounting compliant.',
    'No messages are sent: no SMS, email or WhatsApp to buyers, sellers, tenants or contractors.',
    'Suburbs, addresses, people and firms are invented. Commission splits and the R2,500 owner-approval limit are demo settings.',
  ],
  guide: [
    { title: 'Put a listing live', detail: 'The mandate is signed but “Go live” is refused: the seller’s FICA is outstanding. Press “Mark FICA verified” in the go-live checks, then “Go live”.', to: 'listings/listings_4', as: 'u_admin' },
    { title: 'Match a buyer and book a viewing', detail: 'This new enquiry is matched to listings within ±10% of the budget. Press “Book viewing” on the match and save — the buyer moves to “Viewing booked”.', to: 'leads/leads_21', as: 'u_sales' },
    { title: 'Accept an offer to purchase', detail: 'Press “Seller accepts” and the listing goes under offer. Then tick off the bond and the deposit under Suspensive conditions and press “Conditions met” — the listing is sold and a transfer opens.', to: 'offers/offers_16', as: 'u_sales' },
    { title: 'Register a transfer', detail: 'On the conveyancing board, press “Registered (simulated)” on a lodged transfer. The listing is marked registered and its commission becomes payable.', to: 'transfers', as: 'u_admin' },
    { title: 'Sign a lease', detail: 'The tenant is approved, but “Lease signed” is refused until the deposit is in trust. Press “Record deposit received”, then “Lease signed”.', to: 'leases/leases_5', as: 'u_rental' },
    { title: 'Approve a repair above R2,500', detail: 'The geyser quote is R9,850, so “Approve quote” is refused until the owner agrees. Press “Record owner’s approval”, then “Approve quote”.', to: 'maintenance/maintenance_3', as: 'u_rental' },
  ],
  highlights: [
    'Go-live checks: current mandate, seller FICA and agent Fidelity Fund Certificate',
    'Buyers matched to listings within ±10% of budget, suburb and bedrooms',
    'Offer accepted → under offer → conditions met → conveyancing tracker → commission on registration',
    'Leases with simulated vetting, deposit in trust, arrears and owner-approved maintenance',
  ],
};

export default config;
