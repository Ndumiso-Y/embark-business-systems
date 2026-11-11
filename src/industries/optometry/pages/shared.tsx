import { Link } from 'react-router-dom';
import type { DemoRecord, IndustryData } from '../../../core/types';
import { findRecord, str } from '../../../core/engine';
import { useBase, useUser } from '../../../core/context';
import { formatDate } from '../../../core/lib/dates';
import { Tag } from '../../../core/components/ui';
import { anisometropia, eyeFrom, formatEye, iopFlag, signed, sphericalEquivalent } from '../rx';
import { SCHEMES, label } from '../data';

/** Read-only prescription grid. */
export function RxCard({ values, showVA, caption }: { values: Record<string, unknown>; showVA?: boolean; caption?: string }) {
  const r = eyeFrom(values, 'r');
  const l = eyeFrom(values, 'l');
  const cell = (n: number | null | undefined, axis?: boolean) => (n === null || n === undefined ? '—' : axis ? String(n).padStart(3, '0') : signed(n));
  return (
    <div className="rx-card" data-testid="rx-card">
      <table className="table rx-table">
        <thead><tr><th>Eye</th><th className="num">Sphere</th><th className="num">Cylinder</th><th className="num">Axis</th><th className="num">Add</th>{showVA && <th>VA</th>}</tr></thead>
        <tbody>
          {([['R', r, 'r'], ['L', l, 'l']] as const).map(([name, e, k]) => (
            <tr key={name}>
              <td><strong>{name}</strong><small>{formatEye(e)}</small></td>
              <td className="num">{e.sph === 0 ? 'Plano' : cell(e.sph)}</td><td className="num">{cell(e.cyl)}</td><td className="num">{e.cyl ? cell(e.axis, true) : '—'}</td><td className="num">{cell(e.add)}</td>
              {showVA && <td>{String(values[`${k}_va`] ?? '—')}</td>}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="rx-foot">
        {values.pd ? <span>PD {String(values.pd)} mm</span> : null}
        <span>SE R {fmt(sphericalEquivalent(r))} · L {fmt(sphericalEquivalent(l))}</span>
        {anisometropia(r, l) && <Tag tone="amber">Anisometropia ≥ 2.00 D — review</Tag>}
        {caption && <span>{caption}</span>}
      </div>
    </div>
  );
}
const fmt = (n: number | null) => (n === null ? '—' : signed(n));

export function IopTags({ values }: { values: Record<string, unknown> }) {
  const tags = (['r', 'l'] as const).map((s) => ({ s, f: iopFlag(values[`${s}_iop`] === null || values[`${s}_iop`] === '' ? null : Number(values[`${s}_iop`])) }));
  return <>{tags.filter((t) => t.f === 'review').map((t) => <Tag key={t.s} tone="red">{t.s.toUpperCase()} IOP above 21 mmHg — for review</Tag>)}</>;
}

/** Compact patient summary with a link to the profile. */
export function PatientCard({ data, patientId }: { data: IndustryData; patientId: unknown }) {
  const base = useBase();
  const { can } = useUser();
  const p = findRecord(data, 'patients', String(patientId ?? ''));
  if (!p) return null;
  return (
    <div className="patient-card">
      <span className="avatar">{str(p, 'firstName')[0]}{str(p, 'lastName')[0]}</span>
      <div className="grow">
        <Link to={`${base}/patients/${p.id}`}><b>{str(p, 'firstName')} {str(p, 'lastName')}</b></Link>
        <small>{p.ref} · born {formatDate(str(p, 'dob'))} · {label(SCHEMES, str(p, 'scheme'))}</small>
        <small>{str(p, 'phone')} · {str(p, 'email')}</small>
        {can('clinical.view') && str(p, 'medicalNotes') && <small className="med">Medical: {str(p, 'medicalNotes')}</small>}
      </div>
    </div>
  );
}

export const byDateTime = (a: DemoRecord, b: DemoRecord) => (str(a, 'date') + str(a, 'time')).localeCompare(str(b, 'date') + str(b, 'time'));
