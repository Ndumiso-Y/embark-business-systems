import { useRef, useState, type ReactNode } from 'react';
import type { CollectionDef, DemoRecord, FieldDef, IndustryData, Line, Value, Values } from '../types';
import { can, linesTotals, records, validateValues } from '../engine';
import { formatDate } from '../lib/dates';
import { formatRand } from '../lib/money';
import { useData, useIndustry, useUser } from '../context';
import { Field, Modal } from './ui';
import { IcoPlus, IcoTrash } from './Icons';
import { newId } from '../store';

export const money = (rand: number) => formatRand(Math.round(rand * 100));

/** Human display of a stored value. */
export function formatValue(f: FieldDef, v: Value, data: IndustryData, collections: CollectionDef[]): ReactNode {
  if (v === undefined || v === null || v === '') return '—';
  switch (f.type) {
    case 'date': return formatDate(String(v));
    case 'money': return money(Number(v));
    case 'boolean': return v ? 'Yes' : 'No';
    case 'select': return f.options?.find((o) => o.value === v)?.label ?? String(v);
    case 'ref': {
      const target = records(data, f.ref!).find((r) => r.id === v);
      const def = collections.find((c) => c.key === f.ref);
      return target && def ? def.title(target, data) : '—';
    }
    case 'lines': {
      const t = linesTotals(Array.isArray(v) ? v : []);
      return `${Array.isArray(v) ? v.length : 0} line(s) · ${formatRand(t.total)} incl. VAT`;
    }
    default: return String(v);
  }
}

/* ---------------- Lines editor ---------------- */
export function LinesEditor({ value, onChange, codes }: { value: Line[]; onChange: (l: Line[]) => void; codes?: boolean }) {
  const set = (id: string, p: Partial<Line>) => onChange(value.map((l) => (l.id === id ? { ...l, ...p } : l)));
  const t = linesTotals(value);
  return (
    <div className="lines-editor">
      <div className="table-wrap">
        <table className="table items-table">
          <thead><tr>{codes && <th>Code</th>}<th>Description</th><th className="num">Qty</th><th className="num">Unit (excl.)</th><th className="num">Line</th><th /></tr></thead>
          <tbody>
            {value.map((l, i) => (
              <tr key={l.id}>
                {codes && <td style={{ width: 110 }}><input className="input" aria-label={`Line ${i + 1} code`} value={l.code ?? ''} onChange={(e) => set(l.id, { code: e.target.value })} /></td>}
                <td><input className="input" aria-label={`Line ${i + 1} description`} value={l.description} onChange={(e) => set(l.id, { description: e.target.value })} /></td>
                <td style={{ width: 70 }}><input className="input num" type="number" min={0} step="1" aria-label={`Line ${i + 1} quantity`} value={l.qty} onChange={(e) => set(l.id, { qty: Number(e.target.value) })} /></td>
                <td style={{ width: 120 }}><input className="input num" type="number" min={0} step="0.01" aria-label={`Line ${i + 1} unit price`} value={l.unitPrice} onChange={(e) => set(l.id, { unitPrice: Number(e.target.value) })} /></td>
                <td className="num">{formatRand(t.lines[i]?.excl ?? 0)}</td>
                <td style={{ width: 40 }}><button type="button" className="btn ghost xs" aria-label={`Remove line ${i + 1}`} onClick={() => onChange(value.filter((x) => x.id !== l.id))}><IcoTrash /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="lines-foot">
        <button type="button" className="btn sm" onClick={() => onChange([...value, { id: newId('ln'), description: '', qty: 1, unitPrice: 0 }])}><IcoPlus /> Add line</button>
        <span className="lines-total">Excl. {formatRand(t.net)} · VAT {formatRand(t.vat)} · <b>{formatRand(t.total)}</b></span>
      </div>
    </div>
  );
}

/* ---------------- Single input ---------------- */
export function FieldInput({ f, value, onChange, error, data, collections }: { f: FieldDef; value: Value; onChange: (v: Value) => void; error?: string; data: IndustryData; collections: CollectionDef[] }) {
  const id = `f_${f.key}`;
  const common = { id, 'aria-invalid': error ? true : undefined, 'aria-label': f.label } as const;
  let input: ReactNode;
  switch (f.type) {
    case 'textarea':
      input = <textarea className="textarea" {...common} placeholder={f.placeholder} value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} />;
      break;
    case 'number':
    case 'money':
      input = <input className="input num" type="number" {...common} min={f.min} max={f.max} step={f.step ?? (f.type === 'money' ? 0.01 : 1)} value={value === undefined || value === null || value === '' ? '' : Number(value)} onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))} />;
      break;
    case 'date':
      input = <input className="input" type="date" {...common} value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} />;
      break;
    case 'time':
      input = <input className="input" type="time" {...common} value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} />;
      break;
    case 'select':
      input = (
        <select className="select" {...common} value={String(value ?? '')} onChange={(e) => onChange(e.target.value)}>
          <option value="">Select…</option>
          {f.options!.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      );
      break;
    case 'ref': {
      const def = collections.find((c) => c.key === f.ref)!;
      const opts = records(data, f.ref!);
      input = (
        <select className="select" {...common} value={String(value ?? '')} onChange={(e) => onChange(e.target.value)}>
          <option value="">Select {def.singular.toLowerCase()}…</option>
          {opts.map((r) => <option key={r.id} value={r.id}>{def.title(r, data)} · {r.ref}</option>)}
        </select>
      );
      break;
    }
    case 'boolean':
      return (
        <label className="check" style={{ alignSelf: 'end', minHeight: 44 }}>
          <input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} /> {f.label}
        </label>
      );
    case 'lines':
      input = <LinesEditor value={Array.isArray(value) ? value : []} onChange={onChange} codes />;
      break;
    default:
      input = <input className="input" {...common} placeholder={f.placeholder} value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} />;
  }
  return <Field label={f.label} error={error} hint={f.hint}>{input}</Field>;
}

/** Fields the signed-in demo user may see (simulated field-level restriction). */
export function useVisibleFields(def: CollectionDef): FieldDef[] {
  const { user } = useUser();
  return def.fields.filter((f) => can(user, f.permission));
}

/* ---------------- Create / edit modal ---------------- */
export function RecordFormModal({ def, record, initial, open, onClose, onSave, title }: {
  def: CollectionDef; record?: DemoRecord; initial?: Values; open: boolean; onClose: () => void; onSave: (values: Values) => void; title?: string;
}) {
  const config = useIndustry();
  const data = useData();
  const visible = useVisibleFields(def);
  const fields = !record && def.createFields ? visible.filter((f) => def.createFields!.includes(f.key)) : visible;
  const [values, setValues] = useState<Values>(() => ({ ...(initial ?? {}), ...(record?.values ?? {}) }));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const form = useRef<HTMLFormElement>(null);
  const submit = () => {
    const e = validateValues(fields, values);
    setErrors(e);
    if (Object.keys(e).length) {
      // Take the user to the first problem instead of leaving them to hunt for it.
      requestAnimationFrame(() => {
        const first = form.current?.querySelector<HTMLElement>('[aria-invalid="true"]');
        first?.scrollIntoView({ block: 'center' });
        first?.focus();
      });
      return;
    }
    onSave(values);
  };
  return (
    <Modal open={open} wide title={title ?? (record ? `Edit ${def.singular.toLowerCase()} ${record.ref}` : `New ${def.singular.toLowerCase()}`)} sub="Fictional demonstration record — saved in this browser only." onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" onClick={submit} data-testid="save-record">Save</button></>}>
      <form ref={form} className="form-grid" onSubmit={(e) => { e.preventDefault(); submit(); }} noValidate>
        {/* Lets Enter in any field save the form; the visible Save button lives in the dialog footer. */}
        <button type="submit" hidden aria-hidden="true" tabIndex={-1} />
        {fields.map((f) => (
          <div key={f.key} className={f.wide || f.type === 'textarea' || f.type === 'lines' ? 'span-2' : ''}>
            <FieldInput f={f} value={values[f.key]} error={errors[f.key]} data={data} collections={config.collections} onChange={(v) => setValues((s) => ({ ...s, [f.key]: v }))} />
          </div>
        ))}
        {Object.keys(errors).length > 0 && <div className="span-2 field-error" role="alert">Please correct the highlighted fields.</div>}
      </form>
    </Modal>
  );
}
