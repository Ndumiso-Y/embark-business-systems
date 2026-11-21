import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import config, {
  addMonths, consentProblem, consentState, duplicatesOf, estFee, feesBilled, funnel, guaranteeEndFor, interviewClash, invoiceOverdue, invoiceTotals, margin, mondayOf,
  ownershipConflict, placementFeeCents, quarterRange, refundFor, s198aCheck, sendCvProblems, setTodayForTests, teamTarget, termsProblem, timeToFill, timesheetHours,
  weightedPipeline, workday,
} from '../src/industries/recruitment';
import { ILLUSTRATIVE_EARNINGS_THRESHOLD, WEEKLY_HOURS_CAP } from '../src/industries/recruitment/data';
import { applyTransition, findRecord, findTransition, hasModule, num, records, str, validateConfig } from '../src/core/engine';
import { buildIndustryData } from '../src/core/seed';
import { themeFromHex } from '../src/core/brand';
import type { DemoRecord, EffectApi, IndustryData, Values } from '../src/core/types';

const TODAY = '2026-11-18'; // a Wednesday
let data: IndustryData;
const user = (id: string) => data.users.find((u) => u.id === id)!;
const wf = (k: string) => config.collections.find((c) => c.key === k)!.workflow!;
const get = (collection: string, id: string) => findRecord(data, collection, id)!;
const withValues = (r: DemoRecord, v: Values, status = r.status): DemoRecord => ({ ...r, status, values: { ...r.values, ...v } });
const patched = (collection: string, id: string, v: Values, status?: string, base = data): IndustryData => ({
  ...base, collections: { ...base.collections, [collection]: records(base, collection).map((r) => (r.id === id ? withValues(r, v, status ?? r.status) : r)) },
});
const move = (collection: string, r: DemoRecord, to: string, userId: string, note?: string, d = data) => applyTransition(wf(collection), r, to, user(userId), d, note, 'Tester');
const reason = (res: ReturnType<typeof move>) => (res.ok ? '' : res.reason);
const fakeApi = () => {
  const created: Array<{ collection: string; values: Values; status?: string }> = [];
  const api: EffectApi = {
    create: vi.fn((collection: string, values: Values, status?: string) => { created.push({ collection, values, status }); return { id: `${collection}_new`, ref: 'NEW-0001', values, status, history: [], createdAt: '', updatedAt: '' }; }),
    update: vi.fn(), toast: vi.fn(), transition: vi.fn(() => ({ ok: true as const, value: {} as DemoRecord })),
  };
  return { api, created };
};
const after = (collection: string, from: string, to: string, record: DemoRecord, userId = 'u_dir', d = data) => {
  const fx = fakeApi();
  findTransition(wf(collection), from, to)!.after!({ record, data: d, api: fx.api, today: TODAY, user: user(userId) });
  return fx;
};

beforeAll(() => {
  setTodayForTests(TODAY);
  data = buildIndustryData(config, TODAY);
});
afterAll(() => setTodayForTests(null));

describe('recruitment configuration', () => {
  it('is internally consistent, including the six-step guide', () => {
    expect(validateConfig(config)).toEqual([]);
    expect(config.guide).toHaveLength(6);
    for (const g of config.guide!) expect(hasModule(user(g.as!), g.to.split('/')[0])).toBe(true);
  });

  it('keeps the fixed identity and a theme derived from #0e7490', () => {
    expect([config.id, config.industry, config.businessName, config.monogram, config.priority]).toEqual(['recruitment', 'Recruitment agency', 'Fynbos Talent Partners', 'FT', 14]);
    expect(config.theme).toEqual(themeFromHex('#0e7490'));
    expect(config.highlights.length).toBeGreaterThanOrEqual(3);
    expect(config.boundaries.join(' ')).toMatch(/not tax invoices/);
    expect(config.boundaries.join(' ')).toMatch(/not the current legal threshold/);
  });

  it('seeds deterministically and stays small', () => {
    const again = buildIndustryData(config, TODAY);
    for (const k of config.collections.map((c) => c.key)) {
      expect(JSON.stringify(records(again, k).map((r) => [r.id, r.status, r.values]))).toBe(JSON.stringify(records(data, k).map((r) => [r.id, r.status, r.values])));
    }
    expect(new TextEncoder().encode(JSON.stringify(data)).length).toBeLessThan(250_000);
    expect(records(data, 'clients')).toHaveLength(12);
    expect(records(data, 'consultants')).toHaveLength(6);
    expect(records(data, 'jobs').length).toBeGreaterThanOrEqual(30);
    expect(records(data, 'placements').length).toBeGreaterThanOrEqual(18);
  });

  it('uses only fictional contact details and never hard-codes the business name in records', () => {
    for (const c of [...records(data, 'candidates'), ...records(data, 'clients')]) {
      expect(str(c, 'email')).toMatch(/@example\.com$/);
      expect(str(c, 'phone')).toMatch(/^0\d{2} 555 \d{4}$/);
    }
    expect(JSON.stringify(data.collections)).not.toContain('Fynbos');
  });

  it('gives each of the six roles a different menu and permissions', () => {
    expect(data.users.map((u) => u.role)).toEqual(['director', 'senior', 'consultant', 'resourcer', 'contracts', 'finance']);
    expect(new Set(data.users.map((u) => [...u.modules].sort().join(','))).size).toBe(6);
    expect(user('u_dir').isSuperAdmin).toBe(true);
    expect(user('u_res').permissions).not.toContain('submit');
    expect(user('u_res').permissions).toContain('longlist');
    expect(user('u_cons').permissions).not.toContain('terms.manage');
    expect(user('u_contracts').permissions).not.toContain('fees.view');
    expect(hasModule(user('u_fin'), 'pipeline')).toBe(false);
    expect(hasModule(user('u_contracts'), 'timesheets')).toBe(true);
  });
});

describe('clients and terms of business', () => {
  it('will not open a job order until the client’s terms are signed and current', () => {
    const job = get('jobs', 'jobs_1');
    expect(job.status).toBe('draft');
    expect(reason(move('jobs', job, 'open', 'u_senior'))).toMatch(/has not signed the terms of business yet/);
    const signed = patched('clients', 'clients_1', { termsSignedOn: TODAY, termsExpiry: addMonths(TODAY, 12) }, 'signed');
    expect(move('jobs', job, 'open', 'u_senior', undefined, signed)).toMatchObject({ ok: true });
    // Signed but past the expiry date is not current either.
    const lapsed = patched('clients', 'clients_1', { termsSignedOn: '2025-01-01', termsExpiry: '2025-12-31' }, 'signed');
    expect(reason(move('jobs', job, 'open', 'u_senior', undefined, lapsed))).toMatch(/expired on 31 Dec 2025/);
    expect(termsProblem(get('clients', 'clients_11'), TODAY)).toMatch(/no terms of business yet/);
    expect(termsProblem(get('clients', 'clients_10'), TODAY)).toMatch(/have expired/);
  });

  it('copies the client’s fee % onto the job when it opens', () => {
    const fx = after('jobs', 'draft', 'open', get('jobs', 'jobs_1'));
    expect(fx.api.update).toHaveBeenCalledWith('jobs', 'jobs_1', { openedOn: TODAY, feePct: 20 }, expect.stringContaining('20% fee'));
  });

  it('checks the terms before they are sent, signed or marked expired', () => {
    const draft = get('clients', 'clients_11');
    expect(reason(move('clients', withValues(draft, { feePct: '' }), 'sent', 'u_senior'))).toMatch(/fee %/);
    expect(move('clients', draft, 'sent', 'u_senior')).toMatchObject({ ok: true });
    const sent = get('clients', 'clients_1');
    expect(reason(move('clients', sent, 'signed', 'u_senior'))).toMatch(/Record the date the client signed/);
    expect(reason(move('clients', withValues(sent, { termsSignedOn: TODAY, termsExpiry: '2026-01-01' }), 'signed', 'u_senior'))).toMatch(/expire after/);
    expect(reason(move('clients', get('clients', 'clients_2'), 'expired', 'u_senior'))).toMatch(/The terms run until/);
    expect(reason(move('clients', sent, 'signed', 'u_cons'))).toMatch(/permission/);
  });
});

describe('job orders', () => {
  it('estimates the fee as package × fee %, and a free replacement carries none', () => {
    expect(estFee(get('jobs', 'jobs_2'), data)).toBe(14_040_000); // R780,000 × 18%
    const replacement = records(data, 'jobs').find((j) => str(j, 'replacementFor'))!;
    expect(estFee(replacement, data)).toBe(0);
    expect(config.collections.find((c) => c.key === 'jobs')!.flags!(replacement, data, TODAY).map((f) => f.label)).toContain('Free replacement');
  });

  it('needs a CV sent before “Shortlist sent” and an accepted offer before “Filled”', () => {
    const qa = records(data, 'jobs').find((j) => str(j, 'title') === 'QA Automation Engineer' && j.status === 'sourcing')!;
    expect(reason(move('jobs', qa, 'shortlist', 'u_cons'))).toMatch(/Send at least one CV/);
    expect(reason(move('jobs', get('jobs', 'jobs_3'), 'filled', 'u_cons'))).toMatch(/only filled by an accepted offer/);
    expect(reason(move('jobs', get('jobs', 'jobs_2'), 'interviewing', 'u_cons'))).toMatch(/Book a client interview/);
    expect(reason(move('jobs', get('jobs', 'jobs_2'), 'lost', 'u_cons', ' '))).toMatch(/note is required/);
  });

  it('flags a job open for two weeks with no CVs sent', () => {
    const stale = records(data, 'jobs').find((j) => str(j, 'title') === 'Payroll Administrator')!;
    expect(config.collections.find((c) => c.key === 'jobs')!.flags!(stale, data, TODAY).map((f) => f.label)).toContain('Open 21 days · no CVs sent');
  });
});

describe('candidates and POPIA consent (illustrative)', () => {
  it('classifies consent and explains what blocks a CV', () => {
    expect(consentState(get('candidates', 'candidates_1'), TODAY)).toBe('expired');
    expect(consentProblem(get('candidates', 'candidates_1'), TODAY)).toMatch(/Kevin Naidoo’s consent expired/);
    expect(consentState(get('candidates', 'candidates_3'), TODAY)).toBe('current');
    const noShare = withValues(get('candidates', 'candidates_3'), { consentShare: false });
    expect(consentProblem(noShare, TODAY)).toMatch(/not to sharing the CV/);
    expect(consentProblem(withValues(noShare, { consentGiven: '', consentExpiry: '' }), TODAY)).toMatch(/No POPIA consent/);
    expect(records(data, 'candidates').some((c) => consentState(c, TODAY) === 'expiring')).toBe(true);
  });

  it('warns about a duplicate with the same mobile number', () => {
    const thandi = records(data, 'candidates').find((c) => str(c, 'firstName') === 'Thandi')!;
    const dups = duplicatesOf(data, thandi);
    expect(dups).toHaveLength(1);
    expect(str(dups[0], 'phone')).toBe(str(thandi, 'phone'));
    // Nobody else in the seed is accidentally a duplicate.
    expect(records(data, 'candidates').filter((c) => duplicatesOf(data, c).length)).toHaveLength(2);
  });

  it('needs consent, package and notice to screen, and consent to share to activate', () => {
    const fresh = withValues(get('candidates', 'candidates_3'), { consentGiven: '', consentExpiry: '', expectedPackage: '', notice: '' }, 'new');
    expect(reason(move('candidates', fresh, 'screened', 'u_res'))).toMatch(/POPIA consent/);
    expect(move('candidates', withValues(get('candidates', 'candidates_3'), {}, 'new'), 'screened', 'u_res')).toMatchObject({ ok: true });
    expect(reason(move('candidates', withValues(get('candidates', 'candidates_3'), { consentShare: false }, 'screened'), 'active', 'u_res'))).toMatch(/not to sharing/);
  });
});

describe('sending CVs: consent and the six-month ownership rule', () => {
  it('blocks a CV without current consent, and sends it once consent is recorded', () => {
    const s1 = get('submissions', 'submissions_1');
    expect(reason(move('submissions', s1, 'submitted', 'u_cons'))).toMatch(/consent expired/);
    const renewed = patched('candidates', 'candidates_1', { consentGiven: TODAY, consentExpiry: addMonths(TODAY, 12), consentShare: true });
    expect(move('submissions', s1, 'submitted', 'u_cons', undefined, renewed)).toMatchObject({ ok: true });
  });

  it('blocks anyone from re-submitting a candidate to the same client within six months, saying who and when', () => {
    const s2 = get('submissions', 'submissions_2');
    const own = ownershipConflict(data, s2, TODAY)!;
    expect(own.by).toBe('Ayesha Patel');
    expect(own.until).toBe(addMonths(own.on, 6));
    expect(reason(move('submissions', s2, 'submitted', 'u_cons'))).toMatch(/already sent to Kalahari Byte Labs by Ayesha Patel on .* nobody may submit them to this client again until/);
    // The director is blocked too — the rule is about the client, not the consultant.
    expect(reason(move('submissions', s2, 'submitted', 'u_dir'))).toMatch(/ownership rule/);
    // Six months later the candidate may be submitted again.
    expect(ownershipConflict(data, s2, addMonths(own.on, 6))).toBeNull();
  });

  it('lets a consultant but not a resourcer send a CV, and records who sent it', () => {
    const s3 = get('submissions', 'submissions_3');
    expect(sendCvProblems(s3, data, TODAY)).toEqual([]);
    expect(reason(move('submissions', s3, 'submitted', 'u_res'))).toMatch(/does not hold this permission/);
    expect(move('submissions', s3, 'submitted', 'u_cons')).toMatchObject({ ok: true });
    const fx = after('submissions', 'longlist', 'submitted', s3, 'u_cons');
    expect(fx.api.update).toHaveBeenCalledWith('submissions', 'submissions_3', { submittedOn: TODAY, submittedBy: 'consultants_3' }, expect.stringContaining('Sipho Nkosi'));
  });

  it('will not send a CV for a job that has not been opened', () => {
    const onDraft = withValues(get('submissions', 'submissions_3'), { job: 'jobs_1' });
    expect(sendCvProblems(onDraft, data, TODAY)[0]).toMatch(/not open for submissions .*draft/);
  });
});

describe('interviews, offers and acceptance', () => {
  it('moves to Interview only once an interview is booked', () => {
    expect(reason(move('submissions', get('submissions', 'submissions_5'), 'interview', 'u_res'))).toMatch(/Book the interview first/);
    expect(move('submissions', get('submissions', 'submissions_6'), 'final', 'u_res')).toMatchObject({ ok: false });
  });

  it('refuses an interview slot that overlaps the candidate’s other interview', () => {
    const other = get('interviews', 'interviews_1');
    const tshepo = str(get('submissions', 'submissions_5'), 'candidate');
    expect(interviewClash(data, { candidate: tshepo, date: str(other, 'date'), time: str(other, 'time'), duration: 60 })?.id).toBe('interviews_1');
    expect(interviewClash(data, { candidate: tshepo, date: str(other, 'date'), time: '09:30', duration: 45 })?.id).toBe('interviews_1');
    expect(interviewClash(data, { candidate: tshepo, date: str(other, 'date'), time: '11:00', duration: 60 })).toBeNull();
    expect(interviewClash(data, { candidate: 'candidates_3', date: str(other, 'date'), time: str(other, 'time'), duration: 60 })).toBeNull();
  });

  it('completes an interview only on the day, with rating, outcome and feedback', () => {
    const iv = get('interviews', 'interviews_1');
    expect(reason(move('interviews', iv, 'completed', 'u_res'))).toMatch(/The interview is only on/);
    const held = withValues(iv, { date: TODAY });
    expect(reason(move('interviews', held, 'completed', 'u_res'))).toMatch(/rating/);
    expect(move('interviews', withValues(held, { rating: '4', outcome: 'progress', feedback: 'Strong on key accounts.' }), 'completed', 'u_res')).toMatchObject({ ok: true });
  });

  it('needs a package and start date to make an offer', () => {
    const s4 = get('submissions', 'submissions_4');
    expect(reason(move('submissions', s4, 'offer', 'u_cons'))).toMatch(/offered annual package/);
    expect(move('submissions', withValues(s4, { offerPackage: 850000, offerStart: '2026-12-21' }), 'offer', 'u_cons')).toMatchObject({ ok: true });
  });

  it('creates the placement, fills the job and places the candidate when an offer is accepted', () => {
    const offered = withValues(get('submissions', 'submissions_4'), { offerPackage: 850000, offerStart: '2026-12-21' }, 'offer');
    expect(move('submissions', offered, 'accepted', 'u_cons')).toMatchObject({ ok: true });
    const fx = after('submissions', 'offer', 'accepted', offered, 'u_cons');
    const p = fx.created.find((c) => c.collection === 'placements')!;
    expect(p.status).toBe('accepted');
    expect(p.values).toMatchObject({ fee: 153000, feePct: 18, guaranteeMonths: 3, startDate: '2026-12-21', guaranteeEnd: '2027-03-20', remedy: 'refund' });
    expect(fx.api.transition).toHaveBeenCalledWith('jobs', 'jobs_3', 'filled');
    expect(fx.api.transition).toHaveBeenCalledWith('candidates', 'candidates_4', 'placed');
    // A second acceptance on a filled job is refused.
    const other = records(data, 'submissions').find((s) => str(s, 'job') === 'jobs_3' && s.status === 'interview')!;
    const filled = patched('submissions', 'submissions_4', {}, 'accepted');
    expect(reason(move('submissions', withValues(other, { offerPackage: 800000, offerStart: '2027-01-04' }, 'offer'), 'accepted', 'u_cons', undefined, filled))).toMatch(/already been filled by Naledi Pillay/);
  });
});

describe('placements, fees and guarantees', () => {
  it('works out fees in cents and the guarantee end date', () => {
    expect(placementFeeCents(690000, 17.5)).toBe(12_075_000);
    expect(guaranteeEndFor('2026-01-31', 3)).toBe('2026-04-29');
    expect(guaranteeEndFor('2026-11-01', 3)).toBe('2027-01-31');
  });

  it('starts a placement only on its start date and then raises the fee invoice', () => {
    const waiting = records(data, 'placements').find((p) => p.status === 'accepted')!;
    expect(reason(move('placements', waiting, 'started', 'u_cons'))).toMatch(/only starts on/);
    const due = withValues(waiting, { startDate: TODAY });
    expect(move('placements', due, 'started', 'u_cons')).toMatchObject({ ok: true });
    const fx = after('placements', 'accepted', 'started', due);
    const inv = fx.created.find((c) => c.collection === 'invoices')!;
    expect(inv.status).toBe('draft');
    expect(inv.values).toMatchObject({ kind: 'fee', date: TODAY, dueDate: '2026-12-18', placement: waiting.id });
    expect(invoiceTotals({ ...waiting, values: inv.values }).net).toBe(Math.round(num(waiting, 'fee') * 100));
  });

  it('refunds the unused share of the guarantee, pro rata by day', () => {
    const p1 = get('placements', 'placements_1');
    const r = refundFor(p1, TODAY);
    expect(r.fee).toBe(12_075_000);
    expect(r.used + r.remaining).toBe(r.total);
    expect(r.refund).toBe(Math.round((12_075_000 * r.remaining) / r.total));
    expect(refundFor(p1, str(p1, 'startDate')).refund).toBe(12_075_000);
  });

  it('records a fall-off only with a leaving date inside the guarantee', () => {
    const p1 = get('placements', 'placements_1');
    expect(reason(move('placements', p1, 'felloff', 'u_senior', 'Resigned'))).toMatch(/Record the date the candidate left/);
    expect(reason(move('placements', withValues(p1, { fellOffOn: '2027-06-01' }), 'felloff', 'u_senior', 'Resigned'))).toMatch(/cannot be in the future/);
    expect(move('placements', withValues(p1, { fellOffOn: TODAY }), 'felloff', 'u_senior', 'Resigned')).toMatchObject({ ok: true });
    expect(reason(move('placements', p1, 'guaranteed', 'u_senior'))).toMatch(/guarantee runs until/);
  });

  it('raises a credit note under refund terms, and a free replacement job under replacement terms', () => {
    const p1 = withValues(get('placements', 'placements_1'), { fellOffOn: TODAY });
    const refund = after('placements', 'started', 'felloff', p1);
    const cn = refund.created.find((c) => c.collection === 'invoices')!;
    expect(cn.values).toMatchObject({ kind: 'credit', creditFor: 'invoices_1' });
    expect(Math.round((cn.values.lines as Array<{ unitPrice: number }>)[0].unitPrice * 100)).toBe(refundFor(p1, TODAY).refund);
    expect(refund.api.transition).toHaveBeenCalledWith('candidates', 'candidates_6', 'active');
    const repl = after('placements', 'started', 'felloff', withValues(p1, { remedy: 'replacement' }));
    const job = repl.created.find((c) => c.collection === 'jobs')!;
    expect(job.status).toBe('open');
    expect(job.values).toMatchObject({ feePct: 0, replacementFor: 'placements_1', client: 'clients_3' });
  });
});

describe('contractors and timesheets', () => {
  it('works out the margin and refuses an assignment that runs at a loss', () => {
    expect(margin(get('assignments', 'assignments_1'))).toMatchObject({ pay: 52000, charge: 68000, perHour: 16000, pct: 23.5 });
    const pending = records(data, 'assignments').find((a) => a.status === 'pending')!;
    expect(reason(move('assignments', withValues(pending, { chargeRate: 500 }), 'active', 'u_contracts'))).toMatch(/charge rate must be higher/);
    expect(reason(move('assignments', pending, 'active', 'u_contracts'))).toMatch(/only starts on/);
  });

  it('flags lower earners approaching three months (illustrative s198A constant), not higher earners', () => {
    expect(ILLUSTRATIVE_EARNINGS_THRESHOLD).toBe(250_000);
    const capturer = records(data, 'assignments').find((a) => str(a, 'role') === 'Data Capturer (contract)')!;
    const flag = s198aCheck(capturer, TODAY)!;
    expect(flag).toMatchObject({ annual: 197_600, passed: false });
    expect(flag.daysLeft).toBeGreaterThan(0);
    expect(s198aCheck(records(data, 'assignments').find((a) => str(a, 'role') === 'Payroll Clerk (contract)')!, TODAY)?.passed).toBe(true);
    expect(s198aCheck(get('assignments', 'assignments_1'), TODAY)).toBeNull();
  });

  it('will not end an assignment while timesheets are open', () => {
    expect(reason(move('assignments', get('assignments', 'assignments_1'), 'ended', 'u_contracts'))).toMatch(/TS-0001.*before the assignment can end/);
  });

  it('flags a week above the cap and invoices only a client-approved timesheet', () => {
    const ts = get('timesheets', 'timesheets_1');
    expect(timesheetHours(ts)).toBe(48);
    expect(WEEKLY_HOURS_CAP).toBe(45);
    expect(config.collections.find((c) => c.key === 'timesheets')!.flags!(ts, data, TODAY).map((f) => f.label)).toContain('48 h — above the 45 h weekly cap');
    expect(reason(move('timesheets', ts, 'invoiced', 'u_contracts'))).toMatch(/Only a client-approved timesheet can be invoiced/);
    expect(reason(move('timesheets', ts, 'approved', 'u_contracts'))).toMatch(/note is required/);
    const approved = move('timesheets', ts, 'approved', 'u_contracts', 'Approved by Kyle Fortuin by email');
    expect(approved).toMatchObject({ ok: true });
    expect(reason(move('timesheets', ts, 'invoiced', 'u_res'))).toMatch(/permission/);
    expect(move('timesheets', withValues(ts, {}, 'approved'), 'invoiced', 'u_contracts')).toMatchObject({ ok: true });
    const fx = after('timesheets', 'approved', 'invoiced', withValues(ts, {}, 'approved'));
    const inv = fx.created.find((c) => c.collection === 'invoices')!;
    expect(inv.values).toMatchObject({ kind: 'contract', client: 'clients_12', timesheet: 'timesheets_1' });
    expect(invoiceTotals({ ...ts, values: inv.values }).net).toBe(48 * 68000);
  });

  it('refuses hours outside the assignment dates, on future days or for a week already covered', () => {
    const draft = records(data, 'timesheets').find((t) => t.status === 'draft' && str(t, 'assignment') === 'assignments_1')!;
    const a1 = get('assignments', 'assignments_1');
    const before = withValues(draft, { weekStart: mondayOf(addMonths(str(a1, 'startDate'), -1)), h0: 8, h1: 0, h2: 0, h3: 0, h4: 0 });
    expect(reason(move('timesheets', before, 'submitted', 'u_contracts'))).toMatch(/outside the assignment/);
    const future = withValues(draft, { h0: 0, h1: 0, h2: 0, h3: 0, h4: 8 });
    expect(reason(move('timesheets', future, 'submitted', 'u_contracts'))).toMatch(/not happened yet/);
    const twin = withValues(draft, { weekStart: str(get('timesheets', 'timesheets_1'), 'weekStart'), h0: 8, h1: 0, h2: 0, h3: 0, h4: 0 });
    expect(reason(move('timesheets', twin, 'submitted', 'u_contracts'))).toMatch(/already covers the week/);
    const ok = withValues(draft, { h0: 8, h1: 8, h2: 0, h3: 0, h4: 0, h5: 0, h6: 0 });
    expect(move('timesheets', ok, 'submitted', 'u_contracts')).toMatchObject({ ok: true });
  });
});

describe('invoices and reports', () => {
  it('adds VAT at 15%, signs credit notes negative and flags overdue invoices', () => {
    const t = invoiceTotals(get('invoices', 'invoices_1'));
    expect(t.net).toBe(12_075_000);
    expect(t.vat).toBe(1_811_250);
    expect(t.total).toBe(13_886_250);
    expect(t.sign).toBe(1);
    expect(records(data, 'invoices').filter((i) => str(i, 'kind') === 'credit').every((i) => invoiceTotals(i).sign === -1)).toBe(true);
    const overdue = records(data, 'invoices').filter((i) => invoiceOverdue(i, TODAY));
    expect(overdue).toHaveLength(2);
    expect(invoiceOverdue(withValues(overdue[0], {}, 'paid'), TODAY)).toBe(false);
  });

  it('will not issue an empty invoice or an unlinked credit note', () => {
    const draft = withValues(get('invoices', 'invoices_1'), { lines: [] }, 'draft');
    expect(reason(move('invoices', draft, 'issued', 'u_fin'))).toMatch(/at least one line/);
    expect(reason(move('invoices', withValues(get('invoices', 'invoices_1'), { kind: 'credit', creditFor: '' }, 'draft'), 'issued', 'u_fin'))).toMatch(/Link the credit note/);
    expect(move('invoices', withValues(get('invoices', 'invoices_1'), {}, 'draft'), 'issued', 'u_fin')).toMatchObject({ ok: true });
    expect(reason(move('invoices', withValues(get('invoices', 'invoices_1'), {}, 'draft'), 'issued', 'u_cons'))).toMatch(/permission/);
  });

  it('counts fees billed less credit notes against target, per consultant', () => {
    const all = feesBilled(data, '2000-01-01', '2100-01-01');
    const byConsultant = records(data, 'consultants').reduce((n, c) => n + feesBilled(data, '2000-01-01', '2100-01-01', c.id), 0);
    expect(byConsultant).toBe(all);
    const credits = records(data, 'invoices').filter((i) => str(i, 'kind') === 'credit').reduce((n, i) => n + invoiceTotals(i).net, 0);
    const gross = records(data, 'invoices').filter((i) => str(i, 'kind') === 'fee').reduce((n, i) => n + invoiceTotals(i).net, 0);
    expect(all).toBe(gross - credits);
    expect(teamTarget(data)).toBe(42_500_000);
  });

  it('builds a funnel, time to fill and a weighted pipeline from the records', () => {
    const f = funnel(data);
    expect(f.submitted).toBeGreaterThan(f.interviewed);
    expect(f.interviewed).toBeGreaterThanOrEqual(f.offered);
    expect(f.offered).toBeGreaterThanOrEqual(f.placed);
    expect(f.placed).toBeGreaterThan(10);
    expect(timeToFill(data).avg).toBeGreaterThan(10);
    const wp = weightedPipeline(data);
    const j3 = wp.rows.find((r) => r.job.id === 'jobs_3')!;
    expect(j3.stage).toBe('final');
    expect(j3.weighted).toBe(Math.round(estFee(get('jobs', 'jobs_3'), data) * 0.4));
    expect(wp.total).toBeLessThan(wp.unweighted);
  });

  it('handles calendar arithmetic used by the rules', () => {
    expect(addMonths('2026-08-31', 6)).toBe('2027-02-28');
    expect(mondayOf('2026-11-22')).toBe('2026-11-16');
    expect(workday('2026-11-21', 0)).toBe('2026-11-23');
    expect(workday('2026-11-20', 1)).toBe('2026-11-23');
    expect(quarterRange('2026-11-18')).toEqual({ from: '2026-10-01', to: '2026-12-31', label: 'Q4 2026' });
  });
});

describe('more rules', () => {
  it('will not resume a job on hold while the client’s terms have lapsed', () => {
    const ba = records(data, 'jobs').find((j) => str(j, 'title') === 'Business Analyst' && j.status === 'sourcing')!;
    expect(config.collections.find((c) => c.key === 'jobs')!.flags!(ba, data, TODAY).map((f) => f.label)).toContain('Client terms not current');
    expect(reason(move('jobs', withValues(ba, {}, 'onhold'), 'sourcing', 'u_cons'))).toMatch(/Marula Shield Insurance’s terms of business have expired/);
    expect(move('jobs', withValues(get('jobs', 'jobs_2'), {}, 'onhold'), 'sourcing', 'u_cons')).toMatchObject({ ok: true });
  });

  it('places a candidate only through an accepted offer', () => {
    expect(reason(move('candidates', get('candidates', 'candidates_3'), 'placed', 'u_cons'))).toMatch(/placed automatically when an offer/);
  });

  it('re-opens the job when a placement falls off before the start date', () => {
    const waiting = records(data, 'placements').find((p) => p.status === 'accepted')!;
    expect(move('placements', waiting, 'felloff', 'u_cons', 'Counter-offered')).toMatchObject({ ok: true });
    const fx = after('placements', 'accepted', 'felloff', waiting);
    expect(fx.api.transition).toHaveBeenCalledWith('jobs', str(waiting, 'job'), 'sourcing', expect.stringContaining('fell off before the start date'));
    expect(fx.created).toHaveLength(0); // no invoice, no credit note
    // The job cannot be re-opened while its placement is still live.
    expect(reason(move('jobs', get('jobs', str(waiting, 'job')), 'sourcing', 'u_cons', 'Fell off'))).toMatch(/still live/);
  });

  it('flags terms about to expire, unanswered CVs and offers below expectation', () => {
    const clientFlags = config.collections.find((c) => c.key === 'clients')!.flags!;
    expect(clientFlags(get('clients', 'clients_5'), data, TODAY).map((f) => f.label)).toContain('Terms expire in 18 d');
    const subFlags = config.collections.find((c) => c.key === 'submissions')!.flags!;
    const reviewing = records(data, 'submissions').find((s) => str(s, 'job') === 'jobs_2' && s.status === 'reviewing')!;
    expect(subFlags(reviewing, data, TODAY).map((f) => f.label)).toContain('No client feedback 9 d');
    const low = withValues(get('submissions', 'submissions_4'), { offerPackage: 700000 }, 'offer');
    expect(subFlags(low, data, TODAY).map((f) => f.label)).toContain('Offer below expectation');
    expect(subFlags(get('submissions', 'submissions_2'), data, TODAY).map((f) => f.label)).toContain('Ownership rule');
  });

  it('keeps the walkthrough’s records in the same state whatever the weekday', () => {
    for (let d = 16; d <= 22; d++) {
      const s = config.seed(`2026-11-${d}`);
      const status = (c: string, id: string) => s.collections[c].find((r) => r.id === id)?.status;
      expect([status('jobs', 'jobs_1'), status('jobs', 'jobs_2'), status('submissions', 'submissions_4'), status('submissions', 'submissions_5'), status('placements', 'placements_1'), status('timesheets', 'timesheets_1')])
        .toEqual(['draft', 'shortlist', 'final', 'reviewing', 'started', 'submitted']);
    }
  });
});
