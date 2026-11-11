import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import config, {
  acceptProblems, commissionSplit, conditionsProblems, daysOnMarket, ffcState, goLiveProblems, leaseSignProblems, maintenanceApprovalProblem, matchListing,
  matchingBuyers, matchingListings, setTodayForTests, suburbsIn, unknownSuburbs,
} from '../src/industries/realestate';
import { applyTransition, findTransition, hasModule, records, str, validateConfig } from '../src/core/engine';
import { buildIndustryData } from '../src/core/seed';
import type { DemoRecord, EffectApi, IndustryData, Values } from '../src/core/types';

const TODAY = '2026-11-11';
let data: IndustryData;
const user = (id: string) => data.users.find((u) => u.id === id)!;
const def = (k: string) => config.collections.find((c) => c.key === k)!;
const wf = (k: string) => def(k).workflow!;
const by = (k: string, field: string, value: string) => records(data, k).find((r) => str(r, field) === value)!;
const listing = (address: string) => by('listings', 'address', address);
const lease = (address: string) => by('leases', 'address', address);
const offerOn = (address: string) => records(data, 'offers').find((o) => str(o, 'listing') === listing(address).id && o.status !== 'declined' && o.status !== 'lapsed')!;
const fake = (id: string, values: Values, status?: string): DemoRecord => ({ id, ref: id, status, values, history: [], createdAt: `${TODAY}T08:00:00.000Z`, updatedAt: '' });
const withRecord = (k: string, r: DemoRecord): IndustryData => ({ ...data, collections: { ...data.collections, [k]: records(data, k).map((x) => (x.id === r.id ? r : x)) } });
const go = (k: string, r: DemoRecord, to: string, u = 'u_principal', d = data, note?: string) => applyTransition(wf(k), r, to, user(u), d, note, 'Test');

beforeAll(() => {
  setTodayForTests(TODAY);
  data = buildIndustryData(config, TODAY);
});
afterAll(() => setTodayForTests(null));

describe('real-estate configuration', () => {
  it('is internally consistent', () => {
    expect(validateConfig(config)).toEqual([]);
  });

  it('seeds a deterministic, realistic agency', () => {
    const again = buildIndustryData(config, TODAY);
    expect(JSON.stringify(again.collections)).toBe(JSON.stringify(data.collections));
    const listings = records(data, 'listings');
    expect(listings.length).toBeGreaterThanOrEqual(30);
    for (const s of ['valuation', 'mandate', 'listed', 'underoffer', 'sold', 'registered', 'withdrawn', 'expired']) expect(listings.some((l) => l.status === s)).toBe(true);
    expect(records(data, 'leads').length).toBeGreaterThanOrEqual(40);
    expect(records(data, 'viewings').filter((v) => str(v, 'date') === TODAY).length).toBeGreaterThanOrEqual(5);
    expect(records(data, 'offers').length).toBeGreaterThanOrEqual(12);
    expect(records(data, 'transfers').filter((t) => ['otp', 'bond', 'docs', 'lodged'].includes(t.status ?? '')).length).toBe(8);
    expect(records(data, 'leases').length).toBeGreaterThanOrEqual(20);
    expect(records(data, 'maintenance').length).toBeGreaterThanOrEqual(8);
    expect(records(data, 'agents').length).toBe(6);
    expect(records(data, 'agents').filter((a) => ffcState(a, TODAY) === 'expired').length).toBe(1);
  });

  it('uses only fictional contact details and visibly fake certificate numbers', () => {
    for (const k of ['leads', 'agents']) {
      for (const r of records(data, k)) {
        expect(str(r, 'phone')).toMatch(/^0\d{2} 555 \d{4}$/);
        expect(str(r, 'email')).toMatch(/@example\.com$/);
      }
    }
    for (const l of records(data, 'listings')) expect(str(l, 'sellerEmail')).toMatch(/@example\.com$/);
    for (const a of records(data, 'agents')) expect(str(a, 'ffcNumber')).toMatch(/^DEMO-FFC-/);
  });

  it('keeps the seeded pipeline coherent', () => {
    for (const l of records(data, 'listings').filter((x) => x.status === 'underoffer')) expect(records(data, 'offers').some((o) => str(o, 'listing') === l.id && o.status === 'accepted')).toBe(true);
    for (const l of records(data, 'listings').filter((x) => x.status === 'sold' || x.status === 'registered')) {
      expect(records(data, 'transfers').some((t) => str(t, 'listing') === l.id)).toBe(true);
      expect(Number(l.values.soldPrice)).toBeGreaterThan(0);
    }
    for (const c of records(data, 'commissions')) expect(records(data, 'transfers').find((t) => t.id === str(c, 'transfer'))?.status).toBe('registered');
  });

  it('flags mandates expiring, long days on market and price reductions', () => {
    const weaver = listing('18 Weaver Crescent');
    const labels = def('listings').flags!(weaver, data, TODAY).map((f) => f.label);
    expect(labels).toContain('Mandate expires in 10 days');
    expect(labels).toContain('104 days on market');
    expect(labels.some((l) => l.startsWith('Reduced'))).toBe(true);
    expect(daysOnMarket(weaver, TODAY)).toBe(104);
  });
});

describe('listing go-live rules', () => {
  it('is blocked when the listing agent’s FFC has expired, and allowed once it is renewed', () => {
    const l = listing('22 Wild Olive Avenue');
    const res = go('listings', l, 'listed', 'u_admin');
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toMatch(/Fidelity Fund Certificate expired/);
    const agent = records(data, 'agents').find((a) => a.id === str(l, 'agent'))!;
    const renewed = withRecord('agents', { ...agent, values: { ...agent.values, ffcExpiry: '2027-11-30' } });
    expect(go('listings', l, 'listed', 'u_admin', renewed)).toMatchObject({ ok: true });
  });

  it('is blocked without seller FICA and with an expired mandate', () => {
    const fica = go('listings', listing('5 Quartz Ridge Road'), 'listed', 'u_admin');
    expect(fica.ok).toBe(false);
    if (!fica.ok) expect(fica.reason).toMatch(/FICA/);
    const expired = go('listings', listing('31 Kingfisher Drive'), 'listed', 'u_admin');
    expect(expired.ok).toBe(false);
    if (!expired.ok) expect(expired.reason).toMatch(/mandate expired/i);
    expect(goLiveProblems(listing('31 Kingfisher Drive'), data, TODAY).length).toBe(1);
  });

  it('goes live when every check passes, but only for a role holding mandates.approve', () => {
    const ok = listing('9 Bramble Lane');
    expect(goLiveProblems(ok, data, TODAY)).toEqual([]);
    expect(go('listings', ok, 'listed', 'u_sales')).toEqual({ ok: false, reason: 'Your simulated role does not hold this permission.' });
    expect(go('listings', ok, 'listed', 'u_admin')).toMatchObject({ ok: true });
  });

  it('a mandate cannot be marked expired while it is still current', () => {
    const res = go('listings', listing('41 Stonechat Road'), 'expired', 'u_admin', data, 'Seller unhappy');
    expect(res.ok).toBe(false);
    expect(go('listings', listing('31 Kingfisher Drive'), 'expired', 'u_admin', data, 'Lapsed')).toMatchObject({ ok: true });
  });
});

describe('offers to purchase', () => {
  it('accepting requires the listing to be listed or under offer', () => {
    const notLive = fake('o_x', { listing: listing('9 Bramble Lane').id, lead: records(data, 'leads')[0].id, amount: 2000000 }, 'submitted');
    const res = go('offers', notLive, 'accepted');
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toMatch(/not on the market/);
    const live = offerOn('41 Stonechat Road');
    expect(live.status).toBe('submitted');
    expect(go('offers', live, 'accepted')).toMatchObject({ ok: true });
  });

  it('a second offer cannot be accepted while another is binding', () => {
    const second = fake('o_y', { listing: listing('14 Hornbill Close').id, lead: records(data, 'leads')[0].id, amount: 2800000 }, 'submitted');
    expect(acceptProblems(second, data).some((p) => /already been accepted/.test(p))).toBe(true);
  });

  it('conditions met requires bond approval (and the deposit) when applicable', () => {
    const bondPending = offerOn('14 Hornbill Close');
    const res = go('offers', bondPending, 'unconditional');
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toMatch(/Bond approval/);
    expect(go('offers', { ...bondPending, values: { ...bondPending.values, bondApproved: true } }, 'unconditional')).toMatchObject({ ok: true });
    expect(conditionsProblems(offerOn('2 Kingfisher Mews'))[0]).toMatch(/deposit/);
    expect(go('offers', offerOn('33 Wildfig Avenue'), 'unconditional')).toMatchObject({ ok: true });
  });

  it('a listing cannot be sold before the offer is unconditional', () => {
    const res = go('listings', listing('14 Hornbill Close'), 'sold');
    expect(res.ok).toBe(false);
  });
});

describe('rentals and maintenance', () => {
  it('lease signing requires the deposit in trust and approved vetting', () => {
    const noDeposit = lease('28 Quartz Lane');
    const res = go('leases', noDeposit, 'signed', 'u_rental');
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toMatch(/deposit/i);
    const ready = lease('Unit 2 Bramble Court');
    expect(go('leases', ready, 'signed', 'u_rental')).toMatchObject({ ok: true });
    const unvetted = { ...ready, values: { ...ready.values, vetting: 'pending' } };
    expect(leaseSignProblems(unvetted)[0]).toMatch(/vetting/);
    expect(go('leases', unvetted, 'signed', 'u_rental').ok).toBe(false);
  });

  it('notice needs a note, and a lease in arrears cannot end', () => {
    const active = lease('3 Hornbill Close');
    expect(go('leases', active, 'notice', 'u_rental')).toEqual({ ok: false, reason: 'A note is required for this step.' });
    expect(go('leases', lease('Unit 19 Silverleaf Mews'), 'ended', 'u_rental').ok).toBe(false);
    expect(go('leases', lease('6 Fernwood Lane'), 'ended', 'u_rental')).toMatchObject({ ok: true });
  });

  it('quotes above the R2,500 demo limit need the owner’s approval', () => {
    const geyser = by('maintenance', 'title', 'Replace burst 150 L geyser');
    const res = go('maintenance', geyser, 'approved', 'u_admin');
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toMatch(/R2,500/);
    expect(go('maintenance', { ...geyser, values: { ...geyser.values, ownerApproved: true } }, 'approved', 'u_admin')).toMatchObject({ ok: true });
    expect(maintenanceApprovalProblem(by('maintenance', 'title', 'Kitchen plug point tripping the DB'))).toBeNull();
    expect(maintenanceApprovalProblem(fake('m', { quote: 2500 }))).toBeNull();
    expect(maintenanceApprovalProblem(fake('m', { quote: 2500.01 }))).toMatch(/owner/);
  });
});

describe('viewings and commission', () => {
  it('a viewing cannot be completed without feedback and an interest level', () => {
    const outstanding = records(data, 'viewings').find((v) => v.status === 'booked' && str(v, 'date') < TODAY)!;
    expect(go('viewings', outstanding, 'completed').ok).toBe(false);
    const withFeedback = { ...outstanding, values: { ...outstanding.values, interest: 'warm', feedback: 'Liked the garden.' } };
    expect(go('viewings', withFeedback, 'completed')).toMatchObject({ ok: true });
    const future = fake('v_f', { ...withFeedback.values, date: '2026-11-20' }, 'booked');
    expect(go('viewings', future, 'completed').ok).toBe(false);
  });

  it('splits commission between agent and company in cents', () => {
    const s = commissionSplit(fake('c', { salePrice: 2000000, rate: 7.5, agentSplit: 50 }));
    expect(s).toMatchObject({ gross: 15000000, vat: 2250000, agent: 7500000, company: 7500000 });
    const payable = records(data, 'commissions').find((c) => c.status === 'payable')!;
    expect(go('commissions', payable, 'paid', 'u_book')).toMatchObject({ ok: true });
    expect(go('commissions', payable, 'paid', 'u_sales').ok).toBe(false);
  });
});

describe('buyer ↔ listing matching', () => {
  const lead = (budget: number, suburbs = 'Marula Heights', minBeds = 3, propertyType = 'any') => fake('l', { budget, suburbs, minBeds, propertyType });
  const prop = (askingPrice: number, suburb = 'marula', beds = 3, type = 'house') => fake('p', { askingPrice, suburb, beds, type }, 'listed');

  it('matches within ±10% of budget, in a preferred suburb, with enough bedrooms', () => {
    expect(matchListing(lead(2000000), prop(2200000)).ok).toBe(true);
    expect(matchListing(lead(2000000), prop(1800000)).ok).toBe(true);
    expect(matchListing(lead(2000000), prop(2210000)).ok).toBe(false);
    expect(matchListing(lead(2000000), prop(1790000)).ok).toBe(false);
    expect(matchListing(lead(2000000), prop(2000000, 'quartz')).misses[0]).toMatch(/Quartz Hill is not a preferred suburb/);
    expect(matchListing(lead(2000000), prop(2000000, 'marula', 2)).ok).toBe(false);
    expect(matchListing(lead(2000000, ''), prop(2000000, 'quartz')).ok).toBe(true);
    expect(matchListing(lead(2000000, '', 3, 'apartment'), prop(2000000)).ok).toBe(false);
  });

  it('parses suburb lists and rejects unknown suburbs', () => {
    expect(suburbsIn('Marula Heights, quartz hill')).toEqual(['marula', 'quartz']);
    expect(unknownSuburbs('Marula Heights, Sandton')).toEqual(['Sandton']);
  });

  it('only suggests listings that are on the market, and finds buyers for a listing', () => {
    for (const b of records(data, 'leads').filter((l) => ['new', 'contacted', 'viewing'].includes(l.status ?? ''))) {
      for (const m of matchingListings(data, b)) {
        expect(m.listing.status).toBe('listed');
        expect(m.match.ok).toBe(true);
      }
    }
    expect(records(data, 'leads').some((b) => matchingListings(data, b).length > 0)).toBe(true);
    expect(records(data, 'listings').filter((l) => l.status === 'listed').some((l) => matchingBuyers(data, l).length > 0)).toBe(true);
  });
});

describe('guided walkthrough and on-screen fixes', () => {
  it('every guide step opens a module its fictional user holds, on a record in the state the step describes', () => {
    expect(config.guide?.length).toBe(6);
    for (const g of config.guide ?? []) expect(hasModule(user(g.as!), g.to.split('/')[0]), g.title).toBe(true);
    const rec = (to: string) => { const [mod, id] = to.split('/'); return records(data, config.modules.find((m) => m.key === mod)!.collection!).find((r) => r.id === id)!; };
    const [goLive, buyer, offer, , leaseStep, repair] = config.guide!;
    expect(goLiveProblems(rec(goLive.to), data, TODAY)).toHaveLength(1); // only seller FICA
    expect(goLiveProblems(rec(goLive.to), data, TODAY)[0]).toMatch(/FICA/);
    expect(['new', 'contacted']).toContain(rec(buyer.to).status);
    expect(matchingListings(data, rec(buyer.to)).length).toBeGreaterThan(0);
    expect(rec(offer.to).status).toBe('submitted');
    expect(acceptProblems(rec(offer.to), data)).toEqual([]);
    expect(records(data, 'transfers').some((t) => t.status === 'lodged')).toBe(true);
    expect(rec(leaseStep.to).status).toBe('approved');
    expect(leaseSignProblems(rec(leaseStep.to))).toHaveLength(1);
    expect(maintenanceApprovalProblem(rec(repair.to))).toMatch(/owner/);
  });

  it('blocked steps point at a control on the screen, not at the generic edit form', () => {
    for (const l of records(data, 'listings').filter((x) => x.status === 'mandate')) {
      for (const p of goLiveProblems(l, data, TODAY)) expect(p).not.toMatch(/Edit →/);
    }
    for (const o of records(data, 'offers').filter((x) => x.status === 'accepted')) for (const p of conditionsProblems(o)) expect(p).not.toMatch(/Edit →/);
    expect(leaseSignProblems(lease('28 Quartz Lane'))[0]).toMatch(/Record deposit received/);
  });

  it('marking commission paid records the payout date', () => {
    const payable = records(data, 'commissions').find((c) => c.status === 'payable')!;
    const updates: Array<[string, string, Values]> = [];
    const api: EffectApi = { create: () => payable, update: (c, id, v) => { updates.push([c, id, v]); }, transition: () => ({ ok: false, reason: 'not used' }), toast: () => undefined };
    findTransition(wf('commissions'), 'payable', 'paid')!.after!({ record: payable, data, api, today: TODAY, user: user('u_book') });
    expect(updates).toEqual([['commissions', payable.id, { paidOn: TODAY }]]);
  });
});
