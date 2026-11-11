/**
 * Money helpers. All arithmetic is performed on integer cents to avoid
 * floating-point drift. Amounts flowing through the UI are rand values
 * (numbers) and are converted at the boundary.
 */

export type LineInput = {
  id: string;
  description: string;
  qty: number;
  unitPrice: number; // rand, as entered
  discountPct?: number; // 0-100
};

export type LineTotals = {
  id: string;
  excl: number; // cents, after discount, excluding VAT
  vat: number; // cents
  incl: number; // cents
  discount: number; // cents of discount applied (on the entered price basis)
};

export type DocTotals = {
  subtotal: number; // cents, before discount, excl VAT
  discount: number; // cents, excl VAT basis
  net: number; // cents, excl VAT after discount
  vat: number; // cents
  total: number; // cents
  lines: LineTotals[];
};

/** Round half away from zero to the nearest integer (cents). */
export function roundCents(value: number): number {
  const sign = value < 0 ? -1 : 1;
  // A tiny epsilon absorbs binary floating-point noise such as 1.005 * 100 = 100.49999999999999.
  return sign * Math.round(Math.abs(value) + 1e-9);
}

export function toCents(rand: number): number {
  if (!Number.isFinite(rand)) return 0;
  return roundCents(rand * 100);
}

export function fromCents(cents: number): number {
  return cents / 100;
}

/** Group an integer with comma thousands separators (locale-independent). */
export function group(n: number): string {
  return Math.trunc(Math.abs(n)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/** Format cents as "R1,234.56". Negative values render as "-R1,234.56". */
export function formatRand(cents: number, opts: { compact?: boolean } = {}): string {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  if (opts.compact && abs >= 100_000_00) {
    return `${sign}R${(abs / 100_000_00).toFixed(abs >= 1_000_000_00 ? 1 : 2)}m`;
  }
  const rand = Math.floor(abs / 100);
  const c = abs % 100;
  return `${sign}R${group(rand)}.${c.toString().padStart(2, '0')}`;
}

/** Format a whole-rand figure without cents, e.g. "R218,750". */
export function formatRandWhole(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  const rand = Math.round(Math.abs(cents) / 100);
  return `${sign}R${group(rand)}`;
}

/**
 * Compute totals for a document.
 *
 * - `vatRate` is a percentage (15 means 15%).
 * - When `pricesIncludeVat` is true the entered unit prices are VAT-inclusive
 *   and the VAT portion is extracted from the gross line total.
 * - Discounts are a percentage per line, applied before VAT.
 * - Every line is rounded independently to cents, then summed, so the
 *   document total always equals the sum of its printed lines.
 */
export function computeTotals(
  items: LineInput[],
  vatRate: number,
  pricesIncludeVat: boolean,
): DocTotals {
  const rate = Number.isFinite(vatRate) && vatRate >= 0 ? vatRate / 100 : 0;
  const lines: LineTotals[] = [];
  let subtotal = 0;
  let discount = 0;
  let net = 0;
  let vat = 0;
  let total = 0;

  for (const item of items) {
    const qty = Number.isFinite(item.qty) ? item.qty : 0;
    const unit = Number.isFinite(item.unitPrice) ? item.unitPrice : 0;
    const discPct = Number.isFinite(item.discountPct ?? 0) ? Math.min(Math.max(item.discountPct ?? 0, 0), 100) : 0;

    // Gross value of the line on the entered-price basis, in cents.
    const grossEntered = roundCents(qty * unit * 100);
    const discEntered = roundCents(grossEntered * (discPct / 100));
    const afterDiscEntered = grossEntered - discEntered;

    let excl: number;
    let lineVat: number;
    let lineSubtotal: number;
    let lineDiscount: number;

    if (pricesIncludeVat) {
      // Entered figures are inclusive: extract the VAT portion.
      excl = roundCents(afterDiscEntered / (1 + rate));
      lineVat = afterDiscEntered - excl;
      lineSubtotal = roundCents(grossEntered / (1 + rate));
      lineDiscount = lineSubtotal - excl;
    } else {
      excl = afterDiscEntered;
      lineVat = roundCents(excl * rate);
      lineSubtotal = grossEntered;
      lineDiscount = discEntered;
    }

    const incl = excl + lineVat;
    lines.push({ id: item.id, excl, vat: lineVat, incl, discount: lineDiscount });
    subtotal += lineSubtotal;
    discount += lineDiscount;
    net += excl;
    vat += lineVat;
    total += incl;
  }

  return { subtotal, discount, net, vat, total, lines };
}

export type LineValidation = { qty?: string; unitPrice?: string; description?: string; discountPct?: string };

export function validateLine(item: LineInput): LineValidation {
  const errors: LineValidation = {};
  if (!item.description || !item.description.trim()) errors.description = 'Description is required.';
  if (!Number.isFinite(item.qty)) errors.qty = 'Enter a quantity.';
  else if (item.qty <= 0) errors.qty = 'Quantity must be greater than zero.';
  if (!Number.isFinite(item.unitPrice)) errors.unitPrice = 'Enter a unit price.';
  else if (item.unitPrice < 0) errors.unitPrice = 'Price cannot be negative.';
  if (item.discountPct !== undefined && Number.isFinite(item.discountPct)) {
    if (item.discountPct < 0) errors.discountPct = 'Discount cannot be negative.';
    else if (item.discountPct > 100) errors.discountPct = 'Discount cannot exceed 100%.';
  }
  return errors;
}

export function hasErrors(v: LineValidation): boolean {
  return Object.keys(v).length > 0;
}

/** Parse a user-typed number; returns NaN when not a number. */
export function parseNumber(raw: string): number {
  const cleaned = raw.replace(/[R,\s]/g, '');
  if (cleaned === '' || cleaned === '-' || cleaned === '.') return NaN;
  return Number(cleaned);
}
