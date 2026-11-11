// Security helpers shared by the configuration, its pages, the seed and the tests.
// Kept free of page imports so index.ts and pages/*.tsx can both use them
// without circular imports. Every rule here is a demo rule, not a statement of
// PSIRA, Firearms Control Act or labour-law requirements.
import type { DemoRecord, IndustryData, Line, Values } from '../../core/types';
import { lines, linesTotals, num, records, str } from '../../core/engine';
import { addDays, daysBetween, dueState, formatDate, type DueState } from '../../core/lib/dates';
import {
  CHECK_ITEMS, DEFAULT_SLA_MIN, EMPLOYMENT, EXPIRY_WINDOW_DAYS, INSPECTION_INTERVAL_DAYS, PATROL_GRACE_MIN, PERMIT_LABEL,
  SHIFT_SHORT, SHIFT_START, VAT_RATE, gradeRank, label,
} from './data';

/* ---------------- "Today" indirection (tests pin it) ----------------
 * Rules, flags and the seed depend on the DATE only, never on the time of day:
 * the demo's running shift is always today's day shift and tonight's night shift
 * is the next one. `nowTime()` exists only to pre-fill time boxes and to stamp
 * what a user does (book on, write an entry), like the history timestamps. */
let todayOverride: string | null = null;
let timeOverride = '12:00';
export function setTodayForTests(iso: string | null, time = '12:00') { todayOverride = iso; timeOverride = time; }
const pad = (n: number) => String(n).padStart(2, '0');
export function todayStr() {
  if (todayOverride) return todayOverride;
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
/** Wall-clock time HH:MM for pre-filling time inputs and stamping user actions only (pinned while a test date is set). */
export function nowTime() {
  if (todayOverride) return timeOverride;
  const d = new Date();
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/* ---------------- Clock arithmetic ---------------- */
export const toMin = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};
export const fromMin = (m: number) => {
  const x = ((Math.round(m) % 1440) + 1440) % 1440;
  return `${pad(Math.floor(x / 60))}:${pad(x % 60)}`;
};
/** Minutes from time `a` to time `b`. A time more than 12 hours "earlier" is read as after midnight. */
export function minutesFromTo(a: string, b: string) {
  let d = toMin(b) - toMin(a);
  if (d < -720) d += 1440;
  return d;
}
/** Clock time `m` minutes after `t`, wrapping past midnight. */
export const plusMin = (t: string, m: number) => fromMin(toMin(t) + m);
export const duration = (min: number) => (min >= 60 ? `${Math.floor(min / 60)} h ${pad(min % 60)} min` : `${min} min`);

/* ---------------- Shift slots ---------------- */
export type ShiftKind = 'day' | 'night';
export type Slot = { date: string; kind: ShiftKind };
/** Sortable key: the day shift of a date sorts before its night shift. */
export const slotKey = (date: string, kind: string) => `${date}${kind === 'night' ? 'N' : 'D'}`;

/**
 * The demo's running shift: always today's day shift, whatever the time of day.
 * Earlier dates (and last night's shift) are past; tonight and later are upcoming.
 */
export function currentSlot(today = todayStr()): Slot {
  return { date: today, kind: 'day' };
}
export const nextSlot = (s: Slot): Slot => (s.kind === 'day' ? { date: s.date, kind: 'night' } : { date: addDays(s.date, 1), kind: 'day' });
export const prevSlot = (s: Slot): Slot => (s.kind === 'night' ? { date: s.date, kind: 'day' } : { date: addDays(s.date, -1), kind: 'night' });
export function slotPhase(date: string, kind: string, today = todayStr()): 'past' | 'current' | 'future' {
  const cur = currentSlot(today);
  const a = slotKey(date, kind);
  const b = slotKey(cur.date, cur.kind);
  return a < b ? 'past' : a > b ? 'future' : 'current';
}
export const slotLabel = (s: Slot) => `${SHIFT_SHORT[s.kind]} shift, ${formatDate(s.date)}`;

/* ---------------- Cached lookups ---------------- */
const idCache = new WeakMap<DemoRecord[], Map<string, DemoRecord>>();
/** Record by id. Indexed per collection array, so repeated lookups stay cheap on the roster. */
export function rec(data: IndustryData, collection: string, id: unknown): DemoRecord | undefined {
  const list = data.collections[collection];
  if (!list || !id) return undefined;
  let m = idCache.get(list);
  if (!m) { m = new Map(list.map((r) => [r.id, r])); idCache.set(list, m); }
  return m.get(String(id));
}

export const fullName = (o: DemoRecord | undefined) => (o ? `${str(o, 'firstName')} ${str(o, 'lastName')}` : '');
export const officerName = (data: IndustryData, id: unknown) => fullName(rec(data, 'officers', id)) || 'Unassigned';
export const siteName = (data: IndustryData, id: unknown) => str(rec(data, 'sites', id), 'name') || 'Unknown site';
export const postOf = (data: IndustryData, shift: DemoRecord) => rec(data, 'posts', shift.values.post);
export const kindOf = (data: IndustryData, shift: DemoRecord): ShiftKind => (str(postOf(data, shift), 'shift') === 'night' ? 'night' : 'day');
export const siteOfPost = (data: IndustryData, post: DemoRecord | undefined) => rec(data, 'sites', post?.values.site);
export const siteOfShift = (data: IndustryData, shift: DemoRecord) => siteOfPost(data, postOf(data, shift));
export const contractOfSite = (data: IndustryData, siteId: unknown) => rec(data, 'contracts', rec(data, 'sites', siteId)?.values.contract);
export const equipmentLabel = (e: DemoRecord | undefined) => (e ? `${str(e, 'assetNo')} · ${str(e, 'description')}` : '');
export function postLabel(data: IndustryData, post: DemoRecord | undefined) {
  if (!post) return 'Unknown post';
  return `${str(siteOfPost(data, post), 'name')} — ${str(post, 'name')}`;
}
export const shiftTitle = (data: IndustryData, shift: DemoRecord) => postLabel(data, postOf(data, shift));

/** The officer actually working a roster shift ('' when the post is unfilled or the officer is absent). */
export function workingOfficerId(r: DemoRecord): string {
  if (r.status === 'open' || r.status === 'absent') return '';
  return str(r, 'reliefOfficer') || str(r, 'officer');
}

type SlotIndex = { posts: DemoRecord[] | undefined; map: Map<string, DemoRecord[]> };
const slotCache = new WeakMap<DemoRecord[], SlotIndex>();
/** Roster shifts for one date and shift kind. */
export function shiftsIn(data: IndustryData, date: string, kind: string): DemoRecord[] {
  const list = records(data, 'roster');
  const posts = data.collections.posts;
  let idx = slotCache.get(list);
  if (!idx || idx.posts !== posts) {
    const map = new Map<string, DemoRecord[]>();
    for (const r of list) {
      const k = slotKey(str(r, 'date'), kindOf(data, r));
      const arr = map.get(k);
      if (arr) arr.push(r); else map.set(k, [r]);
    }
    idx = { posts, map };
    slotCache.set(list, idx);
  }
  return idx.map.get(slotKey(date, kind)) ?? [];
}

/* ---------------- Officers & compliance ---------------- */
export const inductions = (o: DemoRecord | undefined) => str(o, 'inductions').split(/[,\s]+/).map((s) => s.trim().toUpperCase()).filter(Boolean);

export type Expiry = { key: string; label: string; date: string; state: DueState };
/** Registration, competency, training and medical dates with their state (expired / ≤ 30 days / ok). */
export function officerExpiries(o: DemoRecord, today: string): Expiry[] {
  const items: Array<[string, string]> = [
    ['psiraExpiry', 'PSIRA registration'],
    ['competencyExpiry', 'Firearm competency'],
    ['refresherDue', 'Refresher training'],
    ['medicalDue', 'Medical fitness'],
  ];
  return items
    .filter(([k]) => k !== 'competencyExpiry' || !!str(o, k))
    .map(([key, lbl]) => ({ key, label: lbl, date: str(o, key), state: dueState(str(o, key) || null, today, EXPIRY_WINDOW_DAYS) }));
}

/** Demo rule: an officer is deployable when actively employed with a PSIRA registration valid on `date`. */
export function deployability(o: DemoRecord, date: string): { deployable: boolean; reasons: string[] } {
  const reasons: string[] = [];
  if (str(o, 'employment') !== 'active') reasons.push(label(EMPLOYMENT, str(o, 'employment')).toLowerCase());
  const psira = str(o, 'psiraExpiry');
  if (!psira) reasons.push('no PSIRA registration on record');
  else if (psira < date) reasons.push(`PSIRA registration expired ${formatDate(psira)}`);
  return { deployable: reasons.length === 0, reasons };
}
export const hasCompetency = (o: DemoRecord | undefined, date: string) => !!str(o, 'competencyExpiry') && str(o, 'competencyExpiry') >= date;

/* ---------------- Duty roster: posting rules ---------------- */
/** Checks that depend only on the officer, the post and the shift date (no roster lookups). */
export function staticPostingProblems(officer: DemoRecord, post: DemoRecord | undefined, site: DemoRecord | undefined, date: string): string[] {
  const out: string[] = [];
  const name = fullName(officer);
  if (str(officer, 'employment') !== 'active') out.push(`${name} is ${label(EMPLOYMENT, str(officer, 'employment')).toLowerCase()} and cannot be posted.`);
  const psira = str(officer, 'psiraExpiry');
  if (!psira) out.push(`${name} has no PSIRA registration on record.`);
  else if (psira < date) out.push(`PSIRA registration ${str(officer, 'psiraNo')} expired on ${formatDate(psira)} — ${name} may not be posted.`);
  const need = str(post, 'grade');
  const have = str(officer, 'grade');
  if (gradeRank(have) < gradeRank(need)) out.push(`Grade too low: ${name} is Grade ${have || '—'}; this post requires Grade ${need} or higher.`);
  if (post?.values.armed === true) {
    const c = str(officer, 'competencyExpiry');
    if (!c) out.push(`Armed post: ${name} has no firearm competency on record (demo rule).`);
    else if (c < date) out.push(`Armed post: ${name}'s firearm competency expired on ${formatDate(c)} (demo rule).`);
  }
  if (site?.values.requiresInduction === true && !inductions(officer).includes(str(site, 'code'))) {
    out.push(`${name} has not completed the ${str(site, 'name')} site induction (${str(site, 'code')}).`);
  }
  return out;
}

/**
 * Every reason an officer may not be posted on a roster shift: registration, grade,
 * armed-post competency, site induction, an overlapping shift and the demo rest rule.
 */
export function postingProblems(data: IndustryData, shift: DemoRecord, officerId: string): string[] {
  if (!officerId) return ['Choose an officer for this post (use the picker on the shift page).'];
  const officer = rec(data, 'officers', officerId);
  if (!officer) return ['Officer not found.'];
  const post = postOf(data, shift);
  const date = str(shift, 'date');
  const kind = kindOf(data, shift);
  const name = fullName(officer);
  const out = staticPostingProblems(officer, post, siteOfPost(data, post), date);
  const worksIn = (s: Slot) => shiftsIn(data, s.date, s.kind).find((r) => r.id !== shift.id && workingOfficerId(r) === officerId);
  const same = worksIn({ date, kind });
  if (same) out.push(`${name} is already posted at ${shiftTitle(data, same)} on the same shift (${same.ref}).`);
  const before = worksIn(prevSlot({ date, kind }));
  if (before) {
    out.push(kind === 'day'
      ? `Demo rest rule: ${name} works the night shift that ends at 06:00 on ${formatDate(date)} (${before.ref}) — no day shift straight after a night shift.`
      : `Demo rest rule: ${name} is on the day shift that ends as this night shift starts (${before.ref}) — no back-to-back shifts.`);
  }
  const after = worksIn(nextSlot({ date, kind }));
  if (after) out.push(`Demo rest rule: ${name} is already posted on the ${SHIFT_SHORT[kindOf(data, after)].toLowerCase()} shift that starts as this one ends (${after.ref}) — no back-to-back shifts.`);
  return out;
}

export const postProblem = (data: IndustryData, r: DemoRecord) => postingProblems(data, r, str(r, 'officer'))[0] ?? null;

export function reliefProblem(data: IndustryData, r: DemoRecord): string | null {
  const id = str(r, 'reliefOfficer');
  if (!id) return 'Choose a relief officer first (use the picker on the shift page).';
  if (id === str(r, 'officer')) return 'The relief officer cannot be the officer who is absent.';
  return postingProblems(data, r, id)[0] ?? null;
}

export function bookOnProblem(data: IndustryData, r: DemoRecord, today = todayStr()): string | null {
  const date = str(r, 'date');
  const kind = kindOf(data, r);
  if (date > today) return `This shift only starts at ${SHIFT_START[kind]} on ${formatDate(date)} — officers book on on the day of their shift.`;
  const o = rec(data, 'officers', workingOfficerId(r));
  if (!o) return 'No officer is posted on this shift.';
  const d = deployability(o, date);
  if (!d.deployable) return `${fullName(o)} cannot book on: ${d.reasons.join('; ')}.`;
  return null;
}

/* ---------------- Occurrence book ---------------- */
/**
 * The shift an OB entry belongs to: its recorded shift date when there is one, otherwise worked out
 * from the entry itself (night-shift entries timed after midnight belong to the previous date's shift).
 */
export function entrySlot(e: DemoRecord): Slot {
  const kind: ShiftKind = str(e, 'shift') === 'night' ? 'night' : 'day';
  const date = str(e, 'date');
  if (str(e, 'shiftDate')) return { kind, date: str(e, 'shiftDate') };
  return { kind, date: kind === 'night' && str(e, 'time') < '12:00' ? addDays(date, -1) : date };
}
/** The signed handover entry for a site's shift, if one exists. */
export function handoverEntry(data: IndustryData, siteId: string, date: string, kind: string): DemoRecord | undefined {
  return records(data, 'ob').find((e) => {
    if (e.status !== 'signed' || str(e, 'type') !== 'handover' || str(e, 'site') !== siteId) return false;
    const s = entrySlot(e);
    return s.date === date && s.kind === kind;
  });
}
export function bookOffProblem(data: IndustryData, r: DemoRecord): string | null {
  const site = siteOfShift(data, r);
  const kind = kindOf(data, r);
  if (!site) return 'This shift has no site.';
  if (!handoverEntry(data, site.id, str(r, 'date'), kind)) {
    return `No signed shift handover entry in the ${str(site, 'name')} occurrence book for this ${kind} shift. Write and sign it first — the “Shift handover” panel on the shift page does both.`;
  }
  return null;
}
export function obSignProblem(r: DemoRecord): string | null {
  if (!str(r, 'entry').trim()) return 'Write the entry before signing it.';
  if (!str(r, 'time')) return 'Record the time of the entry.';
  if (!str(r, 'by').trim()) return 'Record who made the entry.';
  return null;
}

/* ---------------- Coverage ---------------- */
export type Unfilled = { post: DemoRecord; shift?: DemoRecord; reason: string };
export type Coverage = { posts: number; covered: number; onDuty: number; pct: number; unfilled: Unfilled[] };
const COVERED = ['posted', 'relief', 'onduty', 'off'];
export const pct = (part: number, whole: number) => (whole ? Math.round((part / whole) * 100) : 0);

/**
 * Coverage of the contracted posts for one shift: a post is covered when an officer is
 * assigned and not absent. Posts with no roster record count as unfilled.
 */
export function coverage(data: IndustryData, date: string, kind: string, siteId?: string): Coverage {
  const posts = records(data, 'posts').filter((p) => (str(p, 'shift') === 'night' ? 'night' : 'day') === kind && (!siteId || str(p, 'site') === siteId));
  const byPost = new Map<string, DemoRecord>();
  for (const r of shiftsIn(data, date, kind)) {
    const k = str(r, 'post');
    const have = byPost.get(k);
    if (!have || (!COVERED.includes(have.status ?? '') && COVERED.includes(r.status ?? ''))) byPost.set(k, r);
  }
  let covered = 0;
  let onDuty = 0;
  const unfilled: Unfilled[] = [];
  for (const post of posts) {
    const shift = byPost.get(post.id);
    if (shift && COVERED.includes(shift.status ?? '')) {
      covered += 1;
      if (shift.status === 'onduty') onDuty += 1;
    } else {
      unfilled.push({ post, shift, reason: !shift ? 'Not rostered' : shift.status === 'absent' ? 'Officer absent — no relief' : 'No officer posted' });
    }
  }
  return { posts: posts.length, covered, onDuty, pct: pct(covered, posts.length), unfilled };
}
export function coverageNow(data: IndustryData, today = todayStr()): Coverage & { slot: Slot } {
  const slot = currentSlot(today);
  return { ...coverage(data, slot.date, slot.kind), slot };
}
/** Both shifts of one date combined. */
export function dailyCoverage(data: IndustryData, date: string, siteId?: string) {
  const d = coverage(data, date, 'day', siteId);
  const n = coverage(data, date, 'night', siteId);
  return { posts: d.posts + n.posts, covered: d.covered + n.covered, pct: pct(d.covered + n.covered, d.posts + n.posts) };
}
/** Absenteeism over a date range: shifts where the rostered officer did not report. */
export function absenteeism(data: IndustryData, from: string, to: string) {
  const list = records(data, 'roster').filter((r) => str(r, 'date') >= from && str(r, 'date') <= to && !!str(r, 'officer'));
  const absent = list.filter((r) => r.status === 'absent' || !!str(r, 'reliefOfficer'));
  return { shifts: list.length, absent: absent.length, relieved: absent.filter((r) => r.status !== 'absent').length, pct: list.length ? Math.round((absent.length / list.length) * 1000) / 10 : 0, list: absent };
}
/** A posted officer who has not booked on although the shift is running (or over). */
export function lateBookOn(data: IndustryData, r: DemoRecord, today = todayStr()): boolean {
  if (r.status !== 'posted' && r.status !== 'relief') return false;
  return slotPhase(str(r, 'date'), kindOf(data, r), today) !== 'future';
}

/* ---------------- Incidents ---------------- */
export const SAPS_RE = /^DEMO-CAS \d{1,4}\/\d{1,2}\/\d{4}$/;
export const isSerious = (r: DemoRecord) => str(r, 'severity') === 'high';
/** Serious incidents need a (fictional) SAPS case number, or a recorded reason why none was opened. */
export function sapsProblem(r: DemoRecord): string | null {
  if (!isSerious(r)) return null;
  if (str(r, 'sapsCase') || str(r, 'noSapsReason').trim()) return null;
  return 'Serious incident: record the SAPS case number (DEMO-CAS …) or the reason no case was opened — use the close-out form on the incident page.';
}
export function incidentReportProblem(r: DemoRecord): string | null {
  if (!str(r, 'rootCause').trim()) return 'Record the root cause before the report goes to the client — use the close-out form on the incident page.';
  return sapsProblem(r);
}
export function incidentCloseProblems(r: DemoRecord): string[] {
  const out: string[] = [];
  if (!str(r, 'clientNotifiedAt')) out.push('The time the client was notified is not recorded — use the close-out form on the incident page.');
  if (!str(r, 'rootCause').trim()) out.push('Root cause not recorded.');
  if (!str(r, 'outcome').trim()) out.push('Outcome not recorded — use the close-out form on the incident page.');
  if (r.values.clientReportSent !== true) out.push('Client report has not been logged as sent.');
  const s = sapsProblem(r);
  if (s) out.push(s);
  return out;
}

/* ---------------- Armed response call-outs ---------------- */
export const ACTIVE_CALLOUT = ['received', 'dispatched', 'onscene'];
export const calloutSla = (data: IndustryData, r: DemoRecord) => num(contractOfSite(data, r.values.site), 'slaMinutes') || DEFAULT_SLA_MIN;
/** Signal received → vehicle on scene, in minutes (null until the vehicle arrives). */
export function responseMinutes(r: DemoRecord): number | null {
  const a = str(r, 'receivedAt');
  const b = str(r, 'onSceneAt');
  return a && b ? Math.max(0, minutesFromTo(a, b)) : null;
}
/** Demo suggestions for the next time on a call-out, derived from the times already recorded (never from the clock). */
export function suggestedTime(r: DemoRecord, step: 'dispatched' | 'onscene' | 'stooddown'): string {
  const received = str(r, 'receivedAt') || '00:00';
  const dispatched = str(r, 'dispatchedAt') || plusMin(received, 2);
  if (step === 'dispatched') return plusMin(received, 2);
  const onScene = str(r, 'onSceneAt') || plusMin(dispatched, 8);
  return step === 'onscene' ? plusMin(dispatched, 8) : plusMin(onScene, 15);
}

export type SlaState = { state: 'met' | 'breached' | 'running' | 'none'; minutes: number; sla: number; dueBy: string };
/**
 * Response time against the SLA, from the recorded times only. Until the vehicle is on scene the
 * call-out is "running" and `dueBy` is the time it must arrive (signal + SLA).
 */
export function slaState(data: IndustryData, r: DemoRecord): SlaState {
  const sla = calloutSla(data, r);
  const dueBy = str(r, 'receivedAt') ? plusMin(str(r, 'receivedAt'), sla) : '';
  const resp = responseMinutes(r);
  if (resp !== null) return { state: resp <= sla ? 'met' : 'breached', minutes: resp, sla, dueBy };
  if (r.status === 'received' || r.status === 'dispatched') return { state: 'running', minutes: 0, sla, dueBy };
  return { state: 'none', minutes: 0, sla, dueBy };
}
export const permitExpired = (item: DemoRecord | undefined, today: string) => !!str(item, 'permitExpiry') && str(item, 'permitExpiry') < today;

export function vehicleProblem(data: IndustryData, vehicleId: string, calloutId: string, today = todayStr()): string | null {
  const v = rec(data, 'equipment', vehicleId);
  if (!v) return 'Choose a response vehicle before dispatching — use the dispatch form on the call-out page.';
  const name = equipmentLabel(v);
  if (str(v, 'category') !== 'vehicle') return `${name} is not a vehicle.`;
  if (v.status === 'repair') return `${name} is in for repair and cannot be dispatched.`;
  if (v.status === 'lost') return `${name} is written off and cannot be dispatched.`;
  if (permitExpired(v, today)) return `${name}: licence disc expired on ${formatDate(str(v, 'permitExpiry'))} — not available for dispatch (demo rule).`;
  const busy = records(data, 'callouts').find((c) => c.id !== calloutId && ['dispatched', 'onscene'].includes(c.status ?? '') && str(c, 'vehicle') === vehicleId);
  if (busy) return `${name} is already committed to ${busy.ref} at ${siteName(data, busy.values.site)}.`;
  return null;
}
export function availableVehicles(data: IndustryData, calloutId: string, today = todayStr()): DemoRecord[] {
  return records(data, 'equipment').filter((e) => str(e, 'category') === 'vehicle' && e.values.response === true && !vehicleProblem(data, e.id, calloutId, today));
}
export function dispatchProblem(data: IndustryData, r: DemoRecord, today = todayStr()): string | null {
  const v = str(r, 'vehicle');
  if (!v && !availableVehicles(data, r.id, today).length) return 'No response vehicle is available — every vehicle is committed, in repair or unlicensed.';
  return vehicleProblem(data, v, r.id, today);
}
export function onSceneProblem(r: DemoRecord): string | null {
  const at = str(r, 'onSceneAt') || suggestedTime(r, 'onscene');
  const d = str(r, 'dispatchedAt');
  if (d && minutesFromTo(d, at) < 0) return `On-scene time ${at} is before the dispatch time ${d}.`;
  return null;
}
export function standDownProblem(r: DemoRecord): string | null {
  if (!str(r, 'outcome')) return 'Select the outcome before standing the vehicle down — use the stand-down form on the call-out page.';
  const at = str(r, 'stoodDownAt') || suggestedTime(r, 'stooddown');
  const s = str(r, 'onSceneAt');
  if (s && minutesFromTo(s, at) < 0) return `Stand-down time ${at} is before the on-scene time ${s}.`;
  return null;
}
/** Average response time and SLA performance for call-outs received in a date range. */
export function responseStats(data: IndustryData, from: string, to: string, siteId?: string) {
  const list = records(data, 'callouts').filter((c) => str(c, 'date') >= from && str(c, 'date') <= to && responseMinutes(c) !== null && (!siteId || str(c, 'site') === siteId));
  const total = list.reduce((n, c) => n + (responseMinutes(c) ?? 0), 0);
  const within = list.filter((c) => (responseMinutes(c) ?? 0) <= calloutSla(data, c)).length;
  return { count: list.length, avg: list.length ? Math.round((total / list.length) * 10) / 10 : 0, within, breaches: list.length - within, pct: pct(within, list.length) };
}

/* ---------------- Equipment & armoury ---------------- */
/** The roster shift an officer is posted on today (day shift first, then tonight) — equipment is issued at book-on. */
export function activeShiftFor(data: IndustryData, officerId: string, today = todayStr()): DemoRecord | undefined {
  const cur = currentSlot(today);
  for (const s of [cur, nextSlot(cur)]) {
    const r = shiftsIn(data, s.date, s.kind).find((x) => ['posted', 'relief', 'onduty'].includes(x.status ?? '') && workingOfficerId(x) === officerId);
    if (r) return r;
  }
  return undefined;
}
export function issueProblems(data: IndustryData, item: DemoRecord, officerId: string, today = todayStr()): string[] {
  const out: string[] = [];
  const cat = str(item, 'category');
  if (permitExpired(item, today)) out.push(`${PERMIT_LABEL[cat] ?? 'Permit'} expired on ${formatDate(str(item, 'permitExpiry'))} — ${str(item, 'assetNo')} cannot be issued (demo rule).`);
  if (!officerId) return [...out, 'Choose the officer the item is issued to (use the issue form on the item page).'];
  const o = rec(data, 'officers', officerId);
  if (!o) return [...out, 'Officer not found.'];
  const name = fullName(o);
  const shift = activeShiftFor(data, officerId, today);
  if (!shift) out.push(`${name} is not posted on today’s day or night shift — equipment is issued at book-on.`);
  if (cat === 'firearm') {
    const c = str(o, 'competencyExpiry');
    if (!c) out.push(`${name} has no firearm competency on record — a firearm cannot be issued (demo rule).`);
    else if (c < today) out.push(`${name}'s firearm competency expired on ${formatDate(c)} — a firearm cannot be issued (demo rule).`);
    const held = records(data, 'equipment').find((x) => x.id !== item.id && x.status === 'issued' && str(x, 'category') === 'firearm' && str(x, 'issuedTo') === officerId);
    if (held) out.push(`${name} already holds ${str(held, 'assetNo')} — one firearm per officer (demo rule).`);
    if (shift && postOf(data, shift)?.values.armed !== true) out.push(`${name} is posted at ${shiftTitle(data, shift)}, which is not an armed post. Firearms are only issued for armed posts (demo rule).`);
  }
  return out;
}
/** Issued for a shift that has since ended: the officer has booked off, or the shift was on an earlier day. */
export function notReturned(data: IndustryData, item: DemoRecord, today = todayStr()): boolean {
  if (item.status !== 'issued') return false;
  const s = rec(data, 'roster', item.values.issuedShift);
  if (!s) return false;
  return s.status === 'off' || slotPhase(str(s, 'date'), kindOf(data, s), today) === 'past';
}
export const issuedTo = (data: IndustryData, officerId: string) => records(data, 'equipment').filter((e) => e.status === 'issued' && str(e, 'issuedTo') === officerId);

/* ---------------- Patrols ---------------- */
export const patrolMissed = (r: DemoRecord) => (r.status === 'completed' ? Math.max(0, num(r, 'checkpoints') - num(r, 'scanned')) : 0);
/** Minutes the round started after its due time, beyond the demo grace period (0 when on time). */
export function patrolLateBy(r: DemoRecord): number {
  const due = str(r, 'dueAt');
  const started = str(r, 'startedAt');
  if (!due || !started) return 0;
  const late = minutesFromTo(due, started);
  return late > PATROL_GRACE_MIN ? late : 0;
}
export function patrolCompleteProblem(r: DemoRecord, note?: string): string | null {
  const total = num(r, 'checkpoints');
  const v = r.values.scanned;
  if (v === '' || v === null || v === undefined) return 'Record how many checkpoints were scanned (use the round form on the Patrols page).';
  const scanned = num(r, 'scanned');
  if (scanned < 0 || scanned > total) return `Scanned checkpoints must be between 0 and ${total}.`;
  if (scanned < total && !str(r, 'missedPoints').trim() && !note?.trim()) return `${total - scanned} checkpoint(s) not scanned — record which were missed and why.`;
  return null;
}

/* ---------------- Site inspections ---------------- */
const scored = (v: unknown) => v === '0' || v === '1' || v === '2' || v === 0 || v === 1 || v === 2;
export function inspectionScore(r: DemoRecord) {
  const items = CHECK_ITEMS.map((c) => ({ ...c, scored: scored(r.values[c.key]), score: scored(r.values[c.key]) ? Number(r.values[c.key]) : 0 }));
  const score = items.reduce((n, i) => n + i.score, 0);
  const max = CHECK_ITEMS.length * 2;
  return { score, max, pct: pct(score, max), complete: items.every((i) => i.scored), failed: items.filter((i) => i.scored && i.score < 2) };
}
export function inspectionSubmitProblem(r: DemoRecord): string | null {
  const s = inspectionScore(r);
  if (!s.complete) return 'Score all five checklist items before submitting the inspection.';
  if (s.failed.length && !str(r, 'findings').trim()) return `Describe the findings for the ${s.failed.length} item(s) scored below satisfactory.`;
  return null;
}
/** Most recent submitted inspection for a site. */
export function lastInspection(data: IndustryData, siteId: string): DemoRecord | undefined {
  return records(data, 'inspections').filter((i) => i.status === 'submitted' && str(i, 'site') === siteId).sort((a, b) => str(b, 'date').localeCompare(str(a, 'date')))[0];
}
export function daysSinceInspection(data: IndustryData, siteId: string, today: string): number | null {
  const l = lastInspection(data, siteId);
  return l ? daysBetween(str(l, 'date'), today) : null;
}
export function inspectionOverdue(data: IndustryData, siteId: string, today: string): boolean {
  const d = daysSinceInspection(data, siteId, today);
  return d === null || d > INSPECTION_INTERVAL_DAYS;
}

/* ---------------- Contracts & invoicing ---------------- */
export const contractSites = (data: IndustryData, contractId: string) => records(data, 'sites').filter((s) => str(s, 'contract') === contractId);
export function contractPosts(data: IndustryData, contractId: string): DemoRecord[] {
  const ids = new Set(contractSites(data, contractId).map((s) => s.id));
  return records(data, 'posts').filter((p) => ids.has(str(p, 'site')));
}
export const contractMonthly = (data: IndustryData, contractId: string) => contractPosts(data, contractId).reduce((n, p) => n + num(p, 'monthlyRate'), 0);

/** Shifts in a month (YYYY-MM) where a contracted post went uncovered. Only shifts that have ended count. */
export function unfilledShifts(data: IndustryData, contractId: string, period: string, today = todayStr()): DemoRecord[] {
  const postIds = new Set(contractPosts(data, contractId).map((p) => p.id));
  return records(data, 'roster').filter((r) => str(r, 'date').startsWith(period) && postIds.has(str(r, 'post')) && (r.status === 'open' || r.status === 'absent')
    && slotPhase(str(r, 'date'), kindOf(data, r), today) === 'past');
}
/** Armed response call-outs in a month, and how many fall outside the contract's included allowance. */
export function calloutExtras(data: IndustryData, contract: DemoRecord, period: string) {
  const siteIds = new Set(contractSites(data, contract.id).map((s) => s.id));
  const count = records(data, 'callouts').filter((c) => str(c, 'date').startsWith(period) && siteIds.has(str(c, 'site')) && c.status !== 'cancelled').length;
  const included = num(contract, 'includedCallouts');
  return { count, included, billable: Math.max(0, count - included), fee: num(contract, 'calloutFee') };
}
/**
 * Values for a monthly invoice: one line per contracted post at its monthly rate, plus
 * billable call-outs. Penalties for unfilled shifts are held as a count × rate (demo rule).
 */
export function buildInvoiceValues(data: IndustryData, contract: DemoRecord, period: string, today = todayStr(), override: { unfilled?: number; billable?: number } = {}): Values {
  const out: Line[] = contractPosts(data, contract.id).map((p) => ({
    id: `${period}-${p.ref}`,
    description: `${postLabel(data, p)} (${SHIFT_SHORT[str(p, 'shift')] ?? 'Day'}, Grade ${str(p, 'grade')}${p.values.armed === true ? ', armed' : ''})`,
    qty: 1,
    unitPrice: num(p, 'monthlyRate'),
  }));
  const extras = calloutExtras(data, contract, period);
  const billable = override.billable ?? extras.billable;
  if (billable > 0 && extras.fee > 0) {
    out.push({ id: `${period}-${contract.ref}-CO`, description: `Armed response call-outs above the ${extras.included} included`, qty: billable, unitPrice: extras.fee });
  }
  return {
    contract: contract.id, period, lines: out,
    unfilledShifts: override.unfilled ?? unfilledShifts(data, contract.id, period, today).length,
    penaltyPerShift: num(contract, 'penaltyPerShift'),
  };
}
/** Invoice build-up in cents: lines, less penalties for unfilled shifts, plus VAT. */
export function invoiceTotals(r: DemoRecord) {
  const gross = linesTotals(lines(r), 0).net;
  const penalty = Math.min(gross, Math.round(num(r, 'unfilledShifts') * num(r, 'penaltyPerShift') * 100));
  const net = gross - penalty;
  const vat = Math.round((net * VAT_RATE) / 100);
  return { gross, penalty, net, vat, total: net + vat };
}
export const invoiceOverdue = (r: DemoRecord, today: string) => r.status === 'issued' && !!str(r, 'dueDate') && str(r, 'dueDate') < today;
export const previousPeriod = (period: string) => addDays(`${period}-01`, -1).slice(0, 7);
