import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import config, {
  addMonths, addWorkingDays, annualBalance, approverProblem, awayOn, balances, bradford, certState, completedMonths, currentEmployees, driversWithoutPrdp,
  employeeFlags, employeeOfUser, exitProblem, familyBalance, fullName, headcountOn, hearingProblem, isWorkingDay, leaveDays, leaveLiability, leaveRequestProblem,
  noticeProblem, noticeWorkingDays, onboardingMissing, outcomeProblem, overtimeApproverProblem, overtimeWeeks, packCsv, packFor, packIssues, packRows, periodLocked,
  probationProblem, publicHolidays, requiredOnboarding, setTodayForTests, sickBalance, startProblem, teamClash, teamLimit, turnover, unpaidDays, warningExpiry, workingDays,
} from '../src/industries/hr';
import { applyTransition, findRecord, findTransition, hasModule, num, records, str, validateConfig } from '../src/core/engine';
import { buildIndustryData } from '../src/core/seed';
import { contrast, themeFromHex } from '../src/core/brand';
import { useStore } from '../src/core/store';
import { todayIso } from '../src/core/lib/dates';
import type { DemoRecord, EffectApi, IndustryData, Values } from '../src/core/types';

const TODAY = '2026-11-18'; // a Wednesday
const PERIOD = '2026-11';
let data: IndustryData;
const user = (id: string) => data.users.find((u) => u.id === id)!;
const wf = (k: string) => config.collections.find((c) => c.key === k)!.workflow!;
const get = (collection: string, id: string, d = data) => findRecord(d, collection, id)!;
const withValues = (r: DemoRecord, v: Values, status = r.status): DemoRecord => ({ ...r, status, values: { ...r.values, ...v } });
/** A copy of the data with one record replaced. */
const put = (collection: string, r: DemoRecord, base = data): IndustryData => ({ ...base, collections: { ...base.collections, [collection]: records(base, collection).map((x) => (x.id === r.id ? r : x)) } });
const add = (collection: string, r: DemoRecord, base = data): IndustryData => ({ ...base, collections: { ...base.collections, [collection]: [...records(base, collection), r] } });
const E = (first: string, d = data) => records(d, 'employees').find((e) => str(e, 'firstName') === first)!;
const move = (collection: string, r: DemoRecord, to: string, userId: string, note?: string, d = data) => applyTransition(wf(collection), r, to, user(userId), d, note, 'Tester');
const reason = (res: ReturnType<typeof move>) => (res.ok ? '' : res.reason);
const fakeApi = (): EffectApi => ({
  create: vi.fn((c: string, values: Values) => ({ id: `${c}_new`, ref: 'NEW-0001', values, history: [], createdAt: '', updatedAt: '' })),
  update: vi.fn(), toast: vi.fn(), transition: vi.fn(() => ({ ok: true as const, value: {} as DemoRecord })),
});
const fakeLeave = (employee: DemoRecord, type: string, start: string, end: string, status = 'requested', extra: Values = {}): DemoRecord =>
  ({ id: `leave_t${start}${type}`, ref: 'LV-T', status, values: { employee: employee.id, type, start, end, medicalCert: false, ...extra }, history: [], createdAt: '', updatedAt: '' });

beforeAll(() => {
  setTodayForTests(TODAY);
  data = buildIndustryData(config, TODAY);
});
afterAll(() => setTodayForTests(null));

describe('hr configuration and seed', () => {
  it('is internally consistent, including the guide', () => {
    expect(validateConfig(config)).toEqual([]);
    expect(config.guide).toHaveLength(6);
    for (const g of config.guide!) expect(hasModule(user(g.as!), g.to.split('/')[0])).toBe(true);
  });

  it('keeps the fixed identity and a contrast-safe violet theme', () => {
    expect(config).toMatchObject({ id: 'hr', industry: 'Human resources', businessName: 'Bluegum Distribution', monogram: 'BG', priority: 13 });
    expect(config.theme).toEqual(themeFromHex('#6a43c2'));
    expect(contrast(config.theme.accentText, config.theme.accentTint)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(config.theme.accent, '#ffffff')).toBeGreaterThanOrEqual(4.5);
    expect(config.highlights.length).toBeGreaterThanOrEqual(3);
    expect(config.boundaries.join(' ')).toMatch(/no salary, PAYE, UIF/);
    expect(config.boundaries.join(' ')).toMatch(/not legal advice/);
  });

  it('seeds the same company every time, under 250 KB', () => {
    const again = buildIndustryData(config, TODAY);
    for (const k of config.collections.map((c) => c.key)) {
      expect(JSON.stringify(records(again, k).map((r) => [r.id, r.status, r.values]))).toBe(JSON.stringify(records(data, k).map((r) => [r.id, r.status, r.values])));
    }
    expect(new TextEncoder().encode(JSON.stringify(data)).length).toBeLessThan(250_000);
  });

  it('describes about fifty staff across four sites and six departments, all computed from records', () => {
    const all = records(data, 'employees');
    expect(all.length).toBeGreaterThanOrEqual(45);
    expect(all.length).toBeLessThanOrEqual(60);
    const current = currentEmployees(data);
    expect(current.length).toBeGreaterThanOrEqual(48);
    expect(current.length).toBeLessThanOrEqual(55);
    expect(new Set(current.map((e) => str(e, 'site')))).toEqual(new Set(['ho', 'jhb', 'dbn', 'gqb']));
    expect(all.map((e) => e.status)).toEqual(expect.arrayContaining(['onboarding', 'probation', 'active', 'notice', 'exited']));
    // Fictional contact details only; no ID, tax or bank numbers are stored.
    for (const e of all) {
      expect(str(e, 'email')).toMatch(/@example\.com$/);
      expect(str(e, 'phone')).toMatch(/^0\d{2} 555 \d{4}$/);
      expect(Object.keys(e.values).join(' ')).not.toMatch(/idNumber|taxNumber|account/i);
    }
    expect(JSON.stringify(data.collections)).not.toContain('Bluegum');
    for (const c of records(data, 'certificates')) expect(str(c, 'number')).toMatch(/^DEMO-/);
  });

  it('gives every simulated user an employee record and a different menu', () => {
    for (const u of data.users) expect(employeeOfUser(data, u), u.id).toBeTruthy();
    const menus = data.users.filter((u) => !u.isSuperAdmin).map((u) => u.modules.slice().sort().join(','));
    expect(new Set(menus).size).toBe(menus.length);
    expect(user('u_emp').modules).toEqual(['dashboard', 'myleave']);
    expect(user('u_emp').permissions).toEqual(['leave.request']);
    expect(hasModule(user('u_mgr'), 'hiring')).toBe(false);
    expect(hasModule(user('u_pay'), 'cases')).toBe(false);
  });
});

describe('working days, public holidays and dates', () => {
  it('knows the South African public holidays, including Easter and the Sunday rule', () => {
    const h = publicHolidays(2026);
    expect(h.get('2026-04-03')).toBe('Good Friday');
    expect(h.get('2026-04-06')).toBe('Family Day');
    expect(h.get('2026-08-10')).toMatch(/observed/); // 9 August 2026 is a Sunday
    expect(isWorkingDay('2026-12-16')).toBe(false);
    expect(isWorkingDay('2026-11-21')).toBe(false); // Saturday
  });

  it('counts working days and moves by them', () => {
    expect(workingDays('2026-11-20', '2026-11-23')).toBe(2); // Fri + Mon
    expect(workingDays('2026-12-14', '2026-12-18')).toBe(4); // 16 Dec is a holiday
    expect(addWorkingDays('2026-11-20', 1)).toBe('2026-11-23');
    expect(addWorkingDays('2026-11-23', -1)).toBe('2026-11-20');
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(completedMonths('2026-01-15', '2026-03-14')).toBe(1);
    expect(completedMonths('2026-01-15', '2026-03-15')).toBe(2);
  });
});

describe('leave balances (demo rules modelled on the BCEA)', () => {
  it('annual leave: 1.25 days per completed month this year plus carry-over, less booked leave', () => {
    const lerato = E('Lerato');
    const b = annualBalance(data, lerato, TODAY);
    expect(b.entitlement).toBe(3 + 10 * 1.25); // carry 3 + Jan–Oct
    const used = records(data, 'leave').filter((l) => str(l, 'employee') === lerato.id && str(l, 'type') === 'annual' && ['approved', 'taken'].includes(l.status ?? '') && str(l, 'start') >= '2026-01-01').reduce((n, l) => n + leaveDays(l), 0);
    expect(b.available).toBe(b.entitlement - used);
    // A newer employee earns from the start date.
    expect(annualBalance(data, E('Kabelo'), TODAY).entitlement).toBe(completedMonths(str(E('Kabelo'), 'startDate'), TODAY) * 1.25);
  });

  it('sick leave: 30 days per 36-month cycle, but one day per 26 worked in the first six months', () => {
    expect(sickBalance(data, E('Sipho'), TODAY).entitlement).toBe(30);
    const kevin = E('Kevin'); // 85 days' service
    const early = sickBalance(data, kevin, TODAY);
    expect(early.entitlement).toBe(Math.floor(workingDays(str(kevin, 'startDate'), TODAY) / 26));
    expect(early.basis).toMatch(/26 days worked/);
  });

  it('family responsibility: three days a year, only after four months’ service', () => {
    expect(familyBalance(data, E('Lerato'), TODAY)).toMatchObject({ entitlement: 3, eligible: true });
    expect(familyBalance(data, E('Mandla'), TODAY)).toMatchObject({ entitlement: 0, eligible: false });
    expect(leaveRequestProblem(data, { employee: E('Mandla').id, type: 'family', start: '2026-11-24', end: '2026-11-24' }, TODAY)).toMatch(/after 4 months’ service.*unpaid/);
  });

  it('refuses annual leave beyond the balance and suggests unpaid leave', () => {
    const lerato = E('Lerato');
    const avail = annualBalance(data, lerato, TODAY).available;
    const problem = leaveRequestProblem(data, { employee: lerato.id, type: 'annual', start: '2026-11-30', end: addWorkingDays('2026-11-30', Math.ceil(avail) + 2) }, TODAY);
    expect(problem).toMatch(/^Only .* days of annual leave available .* as unpaid leave\.$/);
    expect(leaveRequestProblem(data, { employee: lerato.id, type: 'unpaid', start: '2026-11-30', end: addWorkingDays('2026-11-30', 20) }, TODAY)).toBeNull();
    expect(leaveRequestProblem(data, { employee: lerato.id, type: 'annual', start: '2026-11-30', end: '2026-12-01' }, TODAY)).toBeNull();
  });

  it('checks the dates: order, weekends only, overlaps, parental and maternity limits', () => {
    const lerato = E('Lerato');
    const ask = (type: string, start: string, end: string) => leaveRequestProblem(data, { employee: lerato.id, type, start, end }, TODAY);
    expect(ask('annual', '2026-11-27', '2026-11-26')).toMatch(/before the first day/);
    expect(ask('annual', '2026-11-28', '2026-11-29')).toMatch(/no working days/);
    expect(ask('parental', '2026-12-01', '2026-12-14')).toMatch(/up to 10 consecutive days/);
    expect(ask('maternity', '2026-12-01', '2027-04-15')).toMatch(/four consecutive months|4 consecutive months/);
    const priya = get('leave', 'leave_1');
    expect(leaveRequestProblem(data, { employee: str(priya, 'employee'), type: 'sick', start: str(priya, 'start'), end: str(priya, 'start') }, TODAY)).toMatch(/already has annual leave/);
  });
});

describe('leave approval rules', () => {
  it('nobody approves their own leave — not even the HR manager with all access', () => {
    const own = get('leave', 'leave_2');
    expect(employeeOfUser(data, user('u_hrm'))!.id).toBe(str(own, 'employee'));
    expect(reason(move('leave', own, 'approved', 'u_hrm'))).toMatch(/Nobody approves their own leave — this goes to Sipho Mahlangu/);
    expect(approverProblem(data, user('u_md'), own)).toBeNull(); // her own manager
  });

  it('only HR or the employee’s own manager decides', () => {
    const themba = get('leave', 'leave_3'); // reports to the Johannesburg fleet controller
    expect(reason(move('leave', withValues(themba, { medicalCert: true }), 'approved', 'u_mgr'))).toMatch(/Only HR or Themba Mkhize’s own manager \(Willem Swart\)/);
    expect(reason(move('leave', themba, 'declined', 'u_mgr', 'no'))).toMatch(/own manager/);
    expect(reason(move('leave', themba, 'approved', 'u_emp'))).toMatch(/does not hold this permission/);
    expect(reason(move('leave', themba, 'approved', 'u_pay'))).toMatch(/does not hold this permission/);
  });

  it('sick leave of more than two days needs a medical certificate recorded', () => {
    const themba = get('leave', 'leave_3');
    expect(leaveDays(themba)).toBe(3);
    expect(reason(move('leave', themba, 'approved', 'u_hro'))).toMatch(/medical certificate/);
    expect(move('leave', withValues(themba, { medicalCert: true }), 'approved', 'u_hro')).toMatchObject({ ok: true });
  });

  it('warns about team cover: blocked without a cover note, allowed with one', () => {
    const priya = get('leave', 'leave_1');
    const clash = teamClash(data, priya)!;
    expect(clash).toMatchObject({ size: 6, limit: 2, team: 'Warehouse · Durban' });
    expect(clash.away).toHaveLength(2);
    expect(teamLimit(6)).toBe(2);
    expect(reason(move('leave', priya, 'approved', 'u_mgr'))).toMatch(/Team cover: 2 of 6 in Warehouse · Durban are already away .* cover note/);
    expect(move('leave', priya, 'approved', 'u_mgr', 'Kevin covers picking; Saturday overtime approved.')).toMatchObject({ ok: true });
    const api = fakeApi();
    findTransition(wf('leave'), 'requested', 'approved')!.after!({ record: priya, data, api, today: TODAY, user: user('u_mgr'), note: 'Kevin covers' });
    expect(api.update).toHaveBeenCalledWith('leave', 'leave_1', { decidedBy: 'Nokuthula Zungu', coverNote: 'Kevin covers' }, expect.stringContaining('not sent'));
  });

  it('refuses approval beyond the balance, pointing to unpaid leave', () => {
    const kabelo = get('leave', 'leave_4');
    expect(reason(move('leave', kabelo, 'approved', 'u_hro'))).toMatch(/Only 5 days of annual leave available — this request is 8 working days\. Shorten it to 5 days, or request the extra 3 days as unpaid leave\./);
  });

  it('declining needs a note; taken only from the first day; cancelling only by the employee or HR', () => {
    const priya = get('leave', 'leave_1');
    expect(reason(move('leave', priya, 'declined', 'u_mgr'))).toMatch(/note is required/);
    const approved = records(data, 'leave').find((l) => l.status === 'approved' && str(l, 'start') > TODAY)!;
    expect(reason(move('leave', approved, 'taken', 'u_hro'))).toMatch(/marked as taken from its first day/);
    const today = records(data, 'leave').find((l) => l.status === 'approved' && str(l, 'start') <= TODAY && str(l, 'end') >= TODAY)!;
    expect(move('leave', today, 'taken', 'u_hro')).toMatchObject({ ok: true });
    expect(reason(move('leave', today, 'cancelled', 'u_hro', 'x'))).toMatch(/already started/);
    // Lerato can cancel her own request but nobody else's.
    const mine = fakeLeave(E('Lerato'), 'annual', '2026-11-30', '2026-11-30');
    expect(move('leave', mine, 'cancelled', 'u_emp', 'Plans changed', add('leave', mine))).toMatchObject({ ok: true });
    expect(reason(move('leave', priya, 'cancelled', 'u_emp', 'x'))).toMatch(/Only the employee or HR/);
  });

  it('finds who is away on a day', () => {
    const names = awayOn(data, TODAY).map((l) => fullName(get('employees', str(l, 'employee'))));
    expect(names).toEqual(expect.arrayContaining(['Elize Jacobs', 'Gary Reddy', 'Tebogo Masemola']));
  });
});

describe('employees: onboarding, probation and exit', () => {
  const xolani = () => get('employees', 'employees_53');

  it('needs the job’s checklist before employment starts', () => {
    expect(fullName(xolani())).toBe('Xolani Biyela');
    expect(requiredOnboarding(xolani()).map((i) => i.key)).toEqual(['contract', 'idcopy', 'taxno', 'banking', 'emergency', 'induction', 'ppe', 'licence']);
    expect(requiredOnboarding(E('Lerato')).map((i) => i.key)).not.toContain('licence');
    expect(requiredOnboarding(E('Tebogo')).map((i) => i.key)).not.toContain('ppe');
    expect(onboardingMissing(xolani()).map((i) => i.key)).toEqual(['banking', 'ppe', 'licence']);
    expect(reason(move('employees', xolani(), 'probation', 'u_hro'))).toMatch(/3 required items still open: Banking details; PPE issued; Licence and PrDP checked/);
    const ready = withValues(xolani(), { onboarding: 'contract,idcopy,taxno,banking,emergency,induction,ppe,licence' });
    expect(move('employees', ready, 'probation', 'u_hro')).toMatchObject({ ok: true });
    expect(startProblem(withValues(ready, { startDate: '2026-12-01' }), TODAY)).toMatch(/only start on or after/);
    expect(reason(move('employees', ready, 'probation', 'u_mgr'))).toMatch(/does not hold this permission/);
  });

  it('leaves probation only with a recorded “confirmed” review', () => {
    const kevin = E('Kevin');
    expect(reason(move('employees', kevin, 'active', 'u_hro'))).toMatch(/Record the probation review first/);
    expect(probationProblem(withValues(kevin, { probationOutcome: 'extended', probationReviewDate: TODAY }))).toMatch(/extended/);
    expect(probationProblem(withValues(kevin, { probationOutcome: 'notconfirmed', probationReviewDate: TODAY }))).toMatch(/Give notice/);
    expect(move('employees', withValues(kevin, { probationOutcome: 'confirmed', probationReviewDate: TODAY }), 'active', 'u_hro')).toMatchObject({ ok: true });
  });

  it('needs a reason and a last day for notice, and the exit checklist to exit', () => {
    const elize = E('Elize');
    expect(reason(move('employees', elize, 'notice', 'u_hro'))).toMatch(/reason for leaving/);
    expect(noticeProblem(withValues(elize, { exitReason: 'resignation' }), TODAY)).toMatch(/last working day/);
    expect(move('employees', withValues(elize, { exitReason: 'resignation', lastDay: '2026-12-18' }), 'notice', 'u_hro')).toMatchObject({ ok: true });
    const sibusiso = E('Sibusiso');
    expect(reason(move('employees', sibusiso, 'exited', 'u_hro'))).toMatch(/only be completed on or after/);
    const past = withValues(sibusiso, { lastDay: '2026-11-17' });
    expect(exitProblem(past, TODAY)).toMatch(/equipment returned and access removed/);
    expect(exitProblem(withValues(past, { exitEquipment: true }), TODAY)).toMatch(/access removed/);
    expect(move('employees', withValues(past, { exitEquipment: true, exitAccess: true }), 'exited', 'u_hro')).toMatchObject({ ok: true });
  });

  it('flags probations, fixed-term ends, certificates and warnings', () => {
    const labels = (first: string) => employeeFlags(E(first), data, TODAY).map((f) => f.label).join(' | ');
    expect(labels('Mandla')).toMatch(/Probation ends in \d+ days/);
    expect(labels('Luvuyo')).toContain('Probation review overdue');
    expect(labels('Kabelo')).toMatch(/Contract ends in \d+ days/);
    expect(labels('Themba')).toMatch(/Certificate expired.*Final written warning on file/);
    expect(labels('Chantelle')).toContain('Certificate expiring');
    expect(employeeFlags(xolani(), data, TODAY).map((f) => f.label)).toContain('3 onboarding items open');
  });
});

describe('payroll inputs', () => {
  it('groups overtime per employee per week and flags more than 10 hours without a manager approval', () => {
    const weeks = overtimeWeeks(data, PERIOD);
    const vusi = weeks.find((w) => w.employee === E('Vusi').id && w.hours > 10)!;
    expect(vusi).toMatchObject({ hours: 12.5, approved: false });
    const andile = weeks.find((w) => w.employee === E('Andile').id)!;
    expect(andile).toMatchObject({ hours: 11, approved: true });
  });

  it('pulls unpaid days from approved unpaid leave only', () => {
    const u = unpaidDays(data, PERIOD);
    expect(u.get(E('Musa').id)?.days).toBe(2);
    expect(u.has(E('Nadia').id)).toBe(false); // still requested
  });

  it('cannot approve while anything is unresolved, and a second person must approve', () => {
    const pack = packFor(data, PERIOD)!;
    expect(pack.id).toBe('payruns_1');
    expect(packIssues(data, PERIOD).map((i) => i.key.split('-')[0])).toEqual(['ot', 'lv', 'bank']);
    expect(move('payruns', pack, 'checked', 'u_pay')).toMatchObject({ ok: true });
    const checked = withValues(pack, { checkedBy: 'Fatima Ebrahim' }, 'checked');
    expect(reason(move('payruns', checked, 'approved', 'u_md'))).toMatch(/^3 items are unresolved .*Vusi Mabaso: 12\.5 h overtime/);
    expect(reason(move('payruns', checked, 'approved', 'u_pay'))).toMatch(/does not hold this permission/);
    // Resolve: overtime approved, unpaid leave decided, banking captured.
    let d = data;
    for (const i of records(d, 'inputs').filter((x) => str(x, 'employee') === E('Vusi').id && str(x, 'period') === PERIOD)) d = put('inputs', withValues(i, { approvedBy: 'Nokuthula Zungu' }), d);
    d = put('leave', withValues(get('leave', 'leave_5'), {}, 'approved'), d);
    const x = get('employees', 'employees_53');
    d = put('employees', withValues(x, { onboarding: `${str(x, 'onboarding')},banking` }), d);
    expect(packIssues(d, PERIOD)).toEqual([]);
    expect(move('payruns', checked, 'approved', 'u_md', undefined, d)).toMatchObject({ ok: true });
    // The checker cannot also approve, even with the permission.
    expect(reason(applyTransition(wf('payruns'), checked, 'approved', { ...user('u_md'), name: 'Fatima Ebrahim' }, d, undefined, 'Tester'))).toMatch(/second person must approve/);
  });

  it('records who may approve overtime above the limit', () => {
    expect(overtimeApproverProblem(data, user('u_mgr'), E('Vusi').id)).toBeNull(); // her direct report
    expect(overtimeApproverProblem(data, user('u_mgr'), E('Andile').id)).toMatch(/own manager, HR or the managing director/);
    expect(overtimeApproverProblem(data, user('u_md'), E('Andile').id)).toBeNull();
    expect(overtimeApproverProblem(data, user('u_pay'), E('Vusi').id)).toMatch(/Approve overtime/);
  });

  it('freezes the pack on approval and exports it as CSV without any pay calculation', () => {
    const rows = packRows(data, PERIOD);
    expect(rows.map((r) => r.item)).toEqual(expect.arrayContaining(['Starter', 'Overtime hours', 'Unpaid leave days', 'Allowance', 'Deduction']));
    const api = fakeApi();
    const pack = withValues(packFor(data, PERIOD)!, {}, 'checked');
    findTransition(wf('payruns'), 'checked', 'approved')!.after!({ record: pack, data, api, today: TODAY, user: user('u_md') });
    expect(api.update).toHaveBeenCalledWith('payruns', 'payruns_1', expect.objectContaining({ approvedBy: 'Sipho Mahlangu', snapshot: JSON.stringify(rows) }), expect.any(String));
    expect(periodLocked(data, '2026-10')).toBe(true);
    expect(periodLocked(data, PERIOD)).toBe(false);
    const csv = packCsv(rows, PERIOD, 'Test Co');
    expect(csv.split('\n')[1]).toBe('Employee no,Name,Department,Site,Input,Quantity,Amount (R),Note');
    expect(csv).toMatch(/no pay calculated/);
    expect(csv).not.toMatch(/PAYE|UIF|tax/i);
  });
});

describe('hiring', () => {
  it('needs the managing director for an unbudgeted requisition', () => {
    const r = get('requisitions', 'requisitions_1');
    expect(r.values.budgeted).toBe(false);
    expect(reason(move('requisitions', r, 'open', 'u_hro'))).toMatch(/only the managing director/);
    expect(move('requisitions', r, 'open', 'u_md')).toMatchObject({ ok: true });
    expect(move('requisitions', withValues(r, { budgeted: true }), 'open', 'u_hro')).toMatchObject({ ok: true });
  });

  it('moves applicants only with an interview score, an open requisition and an offer', () => {
    const jaco = records(data, 'applicants').find((a) => str(a, 'firstName') === 'Jaco')!;
    expect(reason(move('applicants', jaco, 'interviewed', 'u_hro'))).toMatch(/interview date and score/);
    const kamo = records(data, 'applicants').find((a) => str(a, 'firstName') === 'Kamogelo')!;
    expect(reason(move('applicants', kamo, 'offer', 'u_hro'))).toMatch(/offered monthly salary/);
    expect(reason(move('applicants', withValues(kamo, { interviewScore: '2' }), 'offer', 'u_hro'))).toMatch(/2 or less/);
    expect(move('applicants', withValues(kamo, { offerSalary: 15800, startDate: '2026-12-07' }), 'offer', 'u_hro')).toMatchObject({ ok: true });
    const sizwe = get('applicants', 'applicants_1');
    expect(reason(move('applicants', withValues(sizwe, { offerAccepted: false }), 'hired', 'u_hro'))).toMatch(/accepted the offer/);
  });

  it('hiring creates the employee in Onboarding with their checklist and fills the requisition', () => {
    const sizwe = get('applicants', 'applicants_1');
    expect(move('applicants', sizwe, 'hired', 'u_hro')).toMatchObject({ ok: true });
    const api = fakeApi();
    findTransition(wf('applicants'), 'offer', 'hired')!.after!({ record: sizwe, data, api, today: TODAY, user: user('u_hro') });
    expect(api.create).toHaveBeenCalledWith('employees', expect.objectContaining({ firstName: 'Sizwe', lastName: 'Nhlapo', job: 'driver', site: 'jhb', salary: 15800, onboarding: 'contract' }), 'onboarding', expect.stringContaining(sizwe.ref));
    expect(api.transition).toHaveBeenCalledWith('requisitions', 'requisitions_2', 'filled', expect.any(String));
    const created = (api.create as ReturnType<typeof vi.fn>).mock.results[0].value as DemoRecord;
    expect(requiredOnboarding(created).map((i) => i.key)).toContain('licence');
  });
});

describe('performance reviews', () => {
  it('a rating of 2 needs an improvement plan with a future review date before sign-off', () => {
    const ayanda = get('reviews', 'reviews_1');
    expect(reason(move('reviews', ayanda, 'signed', 'u_mgr'))).toMatch(/needs an improvement plan/);
    expect(reason(move('reviews', withValues(ayanda, { pipActions: 'Daily accuracy check', pipReview: TODAY }), 'signed', 'u_mgr'))).toMatch(/review date in the future/);
    expect(move('reviews', withValues(ayanda, { pipActions: 'Daily accuracy check', pipReview: '2026-12-18' }), 'signed', 'u_mgr')).toMatchObject({ ok: true });
  });

  it('ratings of 1 and 5 are moderated; others are not', () => {
    const sanele = get('reviews', 'reviews_2');
    expect(reason(move('reviews', sanele, 'signed', 'u_mgr'))).toMatch(/must be moderated/);
    expect(move('reviews', sanele, 'moderation', 'u_mgr')).toMatchObject({ ok: true });
    expect(reason(move('reviews', withValues(sanele, { managerRating: '3' }), 'moderation', 'u_mgr'))).toMatch(/Only ratings of 1 or 5/);
    const tebogo = get('reviews', 'reviews_3');
    expect(reason(move('reviews', tebogo, 'signed', 'u_md'))).toMatch(/moderated rating/);
    expect(reason(move('reviews', withValues(tebogo, { moderatedRating: '2' }), 'signed', 'u_md'))).toMatch(/improvement plan/);
    expect(reason(move('reviews', withValues(tebogo, { moderatedRating: '3' }), 'signed', 'u_mgr'))).toMatch(/does not hold this permission/);
    expect(move('reviews', withValues(tebogo, { moderatedRating: '3' }), 'signed', 'u_md')).toMatchObject({ ok: true });
  });

  it('only the employee’s own manager or HR completes the manager review', () => {
    const siya = get('reviews', 'reviews_6');
    expect(reason(move('reviews', withValues(siya, { managerRating: '4' }), 'signed', 'u_mgr'))).toBe('');
    const other = withValues(get('reviews', 'reviews_1'), { employee: E('Craig').id, managerRating: '4' });
    expect(reason(move('reviews', other, 'signed', 'u_mgr'))).toMatch(/Only Craig Naidoo’s own manager or HR/);
  });
});

describe('discipline and grievances', () => {
  it('needs at least two working days between the notice and the hearing', () => {
    const c = get('cases', 'cases_1');
    expect(reason(move('cases', c, 'hearing', 'u_hro'))).toMatch(/Set the hearing date/);
    expect(hearingProblem(withValues(c, { noticeGiven: '2026-11-18', hearingDate: '2026-11-20' }))).toMatch(/Only 1 working day .* at least 2/);
    expect(noticeWorkingDays('2026-11-20', '2026-11-24')).toBe(1); // Friday → Tuesday: only Monday in between
    expect(move('cases', withValues(c, { noticeGiven: '2026-11-18', hearingDate: '2026-11-23' }), 'hearing', 'u_hro')).toMatchObject({ ok: true });
    expect(reason(move('cases', withValues(c, { noticeGiven: '2026-11-18', hearingDate: '2026-11-23' }), 'hearing', 'u_mgr'))).toMatch(/does not hold this permission/);
  });

  it('needs a chairperson who is not the investigator, a finding and a sanction', () => {
    const c = get('cases', 'cases_2');
    expect(c.status).toBe('hearing');
    expect(str(c, 'hearingDate') < TODAY).toBe(true);
    expect(reason(move('cases', c, 'outcome', 'u_hro'))).toMatch(/chairperson/);
    expect(outcomeProblem(withValues(c, { chairperson: str(c, 'investigator') }), TODAY)).toMatch(/must not be the investigator/);
    expect(outcomeProblem(withValues(c, { chairperson: 'Lwazi Ntshona' }), TODAY)).toMatch(/finding/);
    expect(outcomeProblem(withValues(c, { chairperson: 'Lwazi Ntshona', finding: 'guilty' }), TODAY)).toMatch(/sanction/);
    expect(outcomeProblem(withValues(c, { chairperson: 'Lwazi Ntshona', finding: 'upheld' }), TODAY)).toMatch(/Guilty” or “Not guilty/);
    expect(outcomeProblem(withValues(c, { hearingDate: '2026-11-25' }), TODAY)).toMatch(/after it has been held/);
    expect(outcomeProblem(get('cases', 'cases_1'), TODAY)).toMatch(/needs a hearing first/);
    expect(move('cases', withValues(c, { chairperson: 'Lwazi Ntshona', finding: 'guilty', sanction: 'written' }), 'outcome', 'u_hro')).toMatchObject({ ok: true });
  });

  it('a warning sanction lands on the file with its expiry; dismissal starts the exit', () => {
    expect(warningExpiry('verbal', '2026-11-18')).toBe('2027-02-18');
    expect(warningExpiry('written', '2026-11-18')).toBe('2027-05-18');
    expect(warningExpiry('final', '2026-11-18')).toBe('2027-11-18');
    const c = withValues(get('cases', 'cases_2'), { chairperson: 'Lwazi Ntshona', finding: 'guilty', sanction: 'written' }, 'outcome');
    const after = findTransition(wf('cases'), 'hearing', 'outcome')!.after!;
    const api = fakeApi();
    after({ record: c, data, api, today: TODAY, user: user('u_hro') });
    expect(api.create).toHaveBeenCalledWith('warnings', expect.objectContaining({ employee: E('Bongani').id, level: 'written', issued: TODAY, expires: '2027-05-18', case: 'cases_2' }), undefined, expect.any(String));
    const api2 = fakeApi();
    after({ record: withValues(c, { sanction: 'dismissal' }), data, api: api2, today: TODAY, user: user('u_hro') });
    expect(api2.create).not.toHaveBeenCalled();
    expect(api2.update).toHaveBeenCalledWith('employees', E('Bongani').id, expect.objectContaining({ exitReason: 'dismissal', lastDay: TODAY }), expect.any(String));
    expect(api2.transition).toHaveBeenCalledWith('employees', E('Bongani').id, 'notice', expect.stringContaining('cases_2'.replace('cases_', 'CASE-000')));
  });

  it('closing after an appeal needs the appeal result', () => {
    const appeal = records(data, 'cases').find((c) => c.status === 'appeal')!;
    expect(reason(move('cases', appeal, 'closed', 'u_hro'))).toMatch(/note is required/);
    expect(move('cases', appeal, 'closed', 'u_hro', 'Appeal dismissed; warning stands.')).toMatchObject({ ok: true });
  });
});

describe('training and certificates', () => {
  it('completes a course only after it is held and attendance is marked, then issues certificates', () => {
    const course = get('courses', 'courses_1');
    expect(reason(move('courses', course, 'completed', 'u_hro'))).toMatch(/Mark who attended/);
    expect(reason(move('courses', withValues(course, { date: '2026-11-30' }), 'completed', 'u_hro'))).toMatch(/only be completed on or after/);
    const done = withValues(course, { attended: `${E('Zodwa').id},${E('Bongani').id}` });
    expect(move('courses', done, 'completed', 'u_hro')).toMatchObject({ ok: true });
    const api = fakeApi();
    findTransition(wf('courses'), 'planned', 'completed')!.after!({ record: done, data, api, today: TODAY, user: user('u_hro') });
    expect(api.create).toHaveBeenCalledTimes(2);
    expect(api.create).toHaveBeenCalledWith('certificates', expect.objectContaining({ employee: E('Zodwa').id, type: 'forklift', expires: addMonths(str(course, 'date'), 24) }), undefined, expect.any(String));
  });

  it('knows expired, expiring and renewed certificates, and drivers without a valid PrDP', () => {
    const zodwa = records(data, 'certificates').find((c) => str(c, 'employee') === E('Zodwa').id)!;
    expect(certState(zodwa, data, TODAY)).toBe('expired');
    const renewed = { ...zodwa, id: 'certificates_new', values: { ...zodwa.values, issued: TODAY, expires: '2028-11-18' } };
    const d = add('certificates', renewed);
    expect(certState(zodwa, d, TODAY)).toBe('superseded');
    expect(certState(renewed, d, TODAY)).toBe('valid');
    expect(driversWithoutPrdp(data, TODAY).map(fullName)).toEqual(['Themba Mkhize']);
  });
});

describe('reports', () => {
  it('computes turnover, headcount, Bradford factor and leave liability from the records', () => {
    const t = turnover(data, TODAY);
    expect(t.leavers.map(fullName).sort()).toEqual(['Gift Molapo', 'Jacques du Plessis', 'Nosipho Maseko', 'Pule Ramokgopa', 'Shireen Davids']);
    expect(t.pct).toBeCloseTo((5 / ((headcountOn(data, addMonths(TODAY, -12)) + headcountOn(data, TODAY)) / 2)) * 100, 0);
    expect(headcountOn(data, TODAY)).toBe(currentEmployees(data).length);
    const ricardo = bradford(data, E('Ricardo').id, TODAY);
    expect(ricardo.score).toBe(ricardo.spells * ricardo.spells * ricardo.days);
    expect(ricardo.spells).toBeGreaterThanOrEqual(3);
    const liab = leaveLiability(data, TODAY);
    const lerato = liab.rows.find((r) => r.e.id === E('Lerato').id)!;
    expect(lerato.value).toBeCloseTo(annualBalance(data, E('Lerato'), TODAY).available * (num(E('Lerato'), 'salary') / 21.67), 6);
    expect(balances(data, E('Lerato'), TODAY)).toHaveLength(4);
  });
});

describe('guide walkthrough through the store', () => {
  const store = () => useStore.getState();
  const live = () => store().data.hr!;
  const failure = (res: ReturnType<ReturnType<typeof store>['transition']>) => (res.ok ? '' : res.reason);

  beforeAll(() => {
    setTodayForTests(null);
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    store().reset(config);
  });
  afterAll(() => { vi.useRealTimers(); setTodayForTests(TODAY); });

  it('2 · the line manager approves Priya’s leave with a cover note', () => {
    store().signInAs('hr', 'u_mgr');
    expect(failure(store().transition(config, 'leave', 'leave_1', 'approved'))).toMatch(/Team cover/);
    expect(store().transition(config, 'leave', 'leave_1', 'approved', 'Kevin moves to picking')).toMatchObject({ ok: true });
    expect(str(findRecord(live(), 'leave', 'leave_1'), 'coverNote')).toBe('Kevin moves to picking');
  });

  it('3 · HR starts the new driver once the checklist is done', () => {
    store().signInAs('hr', 'u_hro');
    expect(failure(store().transition(config, 'employees', 'employees_53', 'probation'))).toMatch(/onboarding checklist/);
    const x = findRecord(live(), 'employees', 'employees_53')!;
    store().updateRecord(config, 'employees', x.id, { onboarding: `${str(x, 'onboarding')},banking,ppe,licence` });
    expect(store().transition(config, 'employees', 'employees_53', 'probation')).toMatchObject({ ok: true });
  });

  it('4 · hiring Sizwe creates his employee record in Onboarding and fills the requisition', () => {
    const before = records(live(), 'employees').length;
    expect(store().transition(config, 'applicants', 'applicants_1', 'hired')).toMatchObject({ ok: true });
    expect(records(live(), 'employees')).toHaveLength(before + 1);
    const sizwe = records(live(), 'employees').find((e) => str(e, 'firstName') === 'Sizwe')!;
    expect(sizwe.status).toBe('onboarding');
    expect(onboardingMissing(sizwe).map((i) => i.key)).toEqual(['idcopy', 'taxno', 'banking', 'emergency', 'induction', 'ppe', 'licence']);
    expect(findRecord(live(), 'requisitions', 'requisitions_2')!.status).toBe('filled');
  });

  it('5 · a written warning lands on the employee’s file after the hearing', () => {
    store().updateRecord(config, 'cases', 'cases_2', { chairperson: 'Lwazi Ntshona', finding: 'guilty', sanction: 'written' });
    expect(store().transition(config, 'cases', 'cases_2', 'outcome')).toMatchObject({ ok: true });
    const w = records(live(), 'warnings').find((x) => str(x, 'case') === 'cases_2')!;
    expect(w.values).toMatchObject({ level: 'written', issued: todayIso(), expires: addMonths(todayIso(), 6) });
  });

  it('6 · the payroll pack is checked, fixed and approved by a second person', () => {
    store().signInAs('hr', 'u_pay');
    expect(store().transition(config, 'payruns', 'payruns_1', 'checked')).toMatchObject({ ok: true });
    store().signInAs('hr', 'u_md');
    expect(failure(store().transition(config, 'payruns', 'payruns_1', 'approved'))).toMatch(/unresolved/);
    const period = str(findRecord(live(), 'payruns', 'payruns_1'), 'period');
    for (const w of overtimeWeeks(live(), period).filter((x) => x.hours > 10 && !x.approved)) for (const l of w.lines) store().updateRecord(config, 'inputs', l.id, { approvedBy: 'Sipho Mahlangu' });
    expect(store().transition(config, 'leave', 'leave_5', 'declined', 'Use annual leave in January instead')).toMatchObject({ ok: false }); // MD is not Nadia's manager
    store().signInAs('hr', 'u_hro');
    expect(store().transition(config, 'leave', 'leave_5', 'approved')).toMatchObject({ ok: true });
    store().signInAs('hr', 'u_md');
    expect(packIssues(live(), period)).toEqual([]);
    expect(store().transition(config, 'payruns', 'payruns_1', 'approved')).toMatchObject({ ok: true });
    expect(findRecord(live(), 'payruns', 'payruns_1')!.values.snapshot).toContain('Unpaid leave days');
    store().signInAs('hr', 'u_pay');
    expect(store().transition(config, 'payruns', 'payruns_1', 'sent')).toMatchObject({ ok: true });
  });
});
