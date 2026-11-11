// Non-component helpers for the automotive pages (kept apart for fast refresh).
import type { IndustryData, Line } from '../../../core/types';
import { num, records, str } from '../../../core/engine';
import { newId } from '../../../core/store';
import { JOB_TEMPLATES, LABOUR_RATE } from '../data';

export { kmText as km } from '../helpers';

/** Lines for a job template, priced from the live parts register. */
export function templateLines(data: IndustryData, key: string, diesel: boolean): Line[] {
  const t = JOB_TEMPLATES.find((x) => x.key === key);
  if (!t) return [];
  const partsList = diesel && t.partsDiesel ? t.partsDiesel : t.parts;
  return [
    ...t.labour.map(([description, hours]) => ({ id: newId('ln'), code: 'LAB', description, qty: hours, unitPrice: LABOUR_RATE })),
    ...partsList.map(([no, qty]) => {
      const p = records(data, 'parts').find((x) => str(x, 'partNo') === no);
      return { id: newId('ln'), code: no, description: p ? str(p, 'description') : no, qty, unitPrice: p ? num(p, 'sell') : 0 };
    }),
  ];
}
