// Spectacle prescription helpers for the optometry demo.
// These are data-entry checks for a demonstration, NOT clinical decision
// support. Ranges are typical entry limits, not medical guidance.

export type EyeRx = { sph?: number | null; cyl?: number | null; axis?: number | null; add?: number | null };

const isQuarter = (n: number) => Math.abs(n * 4 - Math.round(n * 4)) < 1e-9;
const present = (n: number | null | undefined): n is number => typeof n === 'number' && Number.isFinite(n);

/** Validate one eye. Returns field → message. */
export function validateEye(rx: EyeRx): Partial<Record<keyof EyeRx, string>> {
  const e: Partial<Record<keyof EyeRx, string>> = {};
  if (!present(rx.sph)) e.sph = 'Sphere is required (use 0.00 for plano).';
  else if (rx.sph < -20 || rx.sph > 20) e.sph = 'Sphere must be between -20.00 and +20.00.';
  else if (!isQuarter(rx.sph)) e.sph = 'Sphere must be in 0.25 steps.';

  if (present(rx.cyl) && rx.cyl !== 0) {
    if (rx.cyl < -8 || rx.cyl > 8) e.cyl = 'Cylinder must be between -8.00 and +8.00.';
    else if (!isQuarter(rx.cyl)) e.cyl = 'Cylinder must be in 0.25 steps.';
    if (!present(rx.axis)) e.axis = 'Axis is required when cylinder is entered.';
    else if (!Number.isInteger(rx.axis) || rx.axis < 1 || rx.axis > 180) e.axis = 'Axis must be a whole number from 1 to 180.';
  } else if (present(rx.axis) && (rx.axis < 0 || rx.axis > 180)) {
    e.axis = 'Axis must be from 1 to 180.';
  }

  if (present(rx.add) && rx.add !== 0) {
    if (rx.add < 0.75 || rx.add > 3.5) e.add = 'Reading addition must be between +0.75 and +3.50.';
    else if (!isQuarter(rx.add)) e.add = 'Reading addition must be in 0.25 steps.';
  }
  return e;
}

export function signed(n: number): string {
  if (n === 0) return '0.00';
  return `${n > 0 ? '+' : '−'}${Math.abs(n).toFixed(2)}`;
}

/** "+1.25 / −0.50 × 180  Add +2.00" or "Plano". */
export function formatEye(rx: EyeRx): string {
  if (!present(rx.sph)) return '—';
  const sph = rx.sph === 0 ? 'Plano' : signed(rx.sph);
  const cyl = present(rx.cyl) && rx.cyl !== 0 ? ` / ${signed(rx.cyl)} × ${String(rx.axis ?? '').padStart(3, '0')}` : ' DS';
  const add = present(rx.add) && rx.add !== 0 ? `  Add ${signed(rx.add)}` : '';
  return `${sph}${cyl}${add}`;
}

/** Convert between minus- and plus-cylinder notation (same optical power). */
export function transpose(rx: EyeRx): EyeRx {
  if (!present(rx.sph) || !present(rx.cyl) || rx.cyl === 0 || !present(rx.axis)) return { ...rx };
  const axis = rx.axis > 90 ? rx.axis - 90 : rx.axis + 90;
  return { ...rx, sph: round2(rx.sph + rx.cyl), cyl: round2(-rx.cyl), axis };
}

export function sphericalEquivalent(rx: EyeRx): number | null {
  if (!present(rx.sph)) return null;
  return round2(rx.sph + (present(rx.cyl) ? rx.cyl / 2 : 0));
}

/** Demo attention rule: spherical equivalents differ by 2.00 D or more. */
export function anisometropia(r: EyeRx, l: EyeRx): boolean {
  const a = sphericalEquivalent(r);
  const b = sphericalEquivalent(l);
  return a !== null && b !== null && Math.abs(a - b) >= 2;
}

/** Demo attention rule only: IOP above 21 mmHg is shown for clinician review. */
export function iopFlag(iop: number | null | undefined): 'review' | 'ok' | 'none' {
  if (!present(iop)) return 'none';
  return iop > 21 ? 'review' : 'ok';
}

/** Snellen-style metric acuity entry, e.g. 6/6, 6/7.5, 6/60, CF, HM, PL. */
export function validVA(v: string | undefined | null): boolean {
  if (!v) return true;
  return /^6\/(3|3\.8|4\.8|5|6|7\.5|9|12|15|18|24|30|36|48|60)([+-]\d)?$/.test(v.trim()) || /^(CF|HM|PL|NPL)$/i.test(v.trim());
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

export function eyeFrom(values: Record<string, unknown>, side: 'r' | 'l'): EyeRx {
  const n = (k: string) => {
    const v = values[`${side}_${k}`];
    if (v === '' || v === undefined || v === null) return null;
    const x = Number(v);
    return Number.isFinite(x) ? x : null;
  };
  return { sph: n('sph'), cyl: n('cyl'), axis: n('axis'), add: n('add') };
}
