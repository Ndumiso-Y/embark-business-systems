import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { DemoRecord, IndustryData } from '../../../core/types';
import { num, permissionHint, str } from '../../../core/engine';
import { useActions, useBase, useData, useIndustry, useUser } from '../../../core/context';
import { addDays, formatDate } from '../../../core/lib/dates';
import { Field, Modal, StatusTag, Tag } from '../../../core/components/ui';
import { CONSENT_MONTHS, LOCATIONS, NOTICE_PERIODS, REMEDIES, label } from '../data';
import { addMonths, clientOf, consentState, fullName, initials, randOf, termsCurrent, todayStr } from '../helpers';
import './recruitment.css';

/** Link to a record when the simulated user has the module; plain text otherwise. */
export function RecLink({ module, id, children }: { module: string; id: string | undefined; children: ReactNode }) {
  const base = useBase();
  const { hasModule } = useUser();
  return hasModule(module) && id ? <Link to={`${base}/${module}/${id}`}>{children}</Link> : <>{children}</>;
}

export function Avatar({ name, tone = 'accent' }: { name: string; tone?: string }) {
  return <span className={`avatar rc-av ${tone}`} aria-hidden="true">{initials(name)}</span>;
}

export function ConsentTag({ c, today }: { c: DemoRecord | undefined; today: string }) {
  const s = consentState(c, today);
  if (s === 'none') return <Tag tone="red">No POPIA consent</Tag>;
  if (s === 'expired') return <Tag tone="red">Consent expired {formatDate(str(c, 'consentExpiry'))}</Tag>;
  if (s === 'noshare') return <Tag tone="amber">Consent to process only — not to share</Tag>;
  if (s === 'expiring') return <Tag tone="amber">Consent lapses {formatDate(str(c, 'consentExpiry'))}</Tag>;
  return <Tag tone="green">Consent to {formatDate(str(c, 'consentExpiry'))}</Tag>;
}

export function CandidateCard({ data, id, today, extra }: { data: IndustryData; id: unknown; today: string; extra?: ReactNode }) {
  const config = useIndustry();
  const c = data.collections.candidates?.find((x) => x.id === id);
  if (!c) return <p className="muted-note">Candidate not found.</p>;
  const def = config.collections.find((x) => x.key === 'candidates')!;
  return (
    <div className="patient-card">
      <Avatar name={fullName(c)} />
      <div className="grow">
        <RecLink module="candidates" id={c.id}><b>{fullName(c)}</b></RecLink>
        <small>{c.ref} · {str(c, 'headline')} · {label(LOCATIONS, str(c, 'location'))}</small>
        <small>Expects {randOf(num(c, 'expectedPackage'))} · notice {label(NOTICE_PERIODS, str(c, 'notice')).toLowerCase()}</small>
        <small>{str(c, 'email')} · {str(c, 'phone')}</small>
        <div className="btns" style={{ marginTop: 6 }}><ConsentTag c={c} today={today} /><StatusTag workflow={def.workflow} status={c.status} /></div>
        {extra}
      </div>
    </div>
  );
}

export function ClientTermsCard({ data, id, today }: { data: IndustryData; id: unknown; today: string }) {
  const config = useIndustry();
  const c = clientOf(data, id);
  if (!c) return <p className="muted-note">Client not found.</p>;
  const def = config.collections.find((x) => x.key === 'clients')!;
  return (
    <div className="patient-card">
      <Avatar name={str(c, 'name')} tone="dark" />
      <div className="grow">
        <RecLink module="clients" id={c.id}><b>{str(c, 'name')}</b></RecLink>
        <small>{str(c, 'contactName')} · {str(c, 'contactRole')}</small>
        <small>{num(c, 'feePct')}% fee · {num(c, 'paymentDays')}-day terms · {num(c, 'guaranteeMonths')}-month guarantee · {label(REMEDIES, str(c, 'remedy')).toLowerCase()}</small>
        <div className="btns" style={{ marginTop: 6 }}>
          <StatusTag workflow={def.workflow} status={c.status} />
          {str(c, 'termsExpiry') && <Tag tone={termsCurrent(c, today) ? 'dark' : 'red'}>Expiry {formatDate(str(c, 'termsExpiry'))}</Tag>}
        </div>
      </div>
    </div>
  );
}

/** Pass / fail checklist. An item may carry the control that fixes it, right where it is reported. */
export function Checklist({ items, testid }: { items: Array<{ label: string; ok: boolean; detail?: ReactNode; action?: ReactNode }>; testid?: string }) {
  return (
    <ul className="list" data-testid={testid}>
      {items.map((i) => (
        <li key={i.label} style={{ flexWrap: 'wrap' }}>
          <span className={`dot ${i.ok ? 'green' : 'red'}`} />
          <div className="grow" style={{ minWidth: 160 }}><b>{i.label}</b>{i.detail && <small>{i.detail}</small>}</div>
          {i.action}
          <Tag tone={i.ok ? 'green' : 'red'}>{i.ok ? 'OK' : 'Blocked'}</Tag>
        </li>
      ))}
    </ul>
  );
}

/** “Record consent”: the fix for every consent block, available wherever the block is shown. */
export function ConsentButton({ candidateId, small = true }: { candidateId: string; small?: boolean }) {
  const config = useIndustry();
  const data = useData();
  const act = useActions();
  const { can } = useUser();
  const today = todayStr();
  const [open, setOpen] = useState(false);
  const [given, setGiven] = useState(today);
  const [months, setMonths] = useState(String(CONSENT_MONTHS));
  const [share, setShare] = useState(true);
  const [err, setErr] = useState('');
  const c = data.collections.candidates?.find((x) => x.id === candidateId);
  if (!c) return null;
  if (!can('candidates.manage')) return <small className="muted-note">{permissionHint(config, data, 'candidates.manage')}</small>;
  const save = () => {
    const m = Number(months);
    if (!given || given > today) return setErr('Enter the date the candidate gave consent (not in the future).');
    if (!(m >= 1 && m <= 24)) return setErr('Consent is recorded for 1 to 24 months in this demo.');
    const expiry = addMonths(given, m);
    if (expiry < today) return setErr('That consent would already have lapsed — record a more recent consent date.');
    act.update('candidates', c.id, { consentGiven: given, consentExpiry: expiry, consentShare: share }, `POPIA consent recorded — ${share ? 'process and share CV with clients' : 'process only'} until ${formatDate(expiry)} (illustrative)`);
    act.toast(`${fullName(c)}: consent recorded until ${formatDate(expiry)}`);
    setOpen(false); setErr('');
  };
  return (
    <>
      <button type="button" className={`btn ${small ? 'xs' : 'sm'}`} onClick={() => setOpen(true)} data-testid={`record-consent-${c.id}`}>Record consent</button>
      <Modal open={open} title={`Record POPIA consent — ${fullName(c)}`} sub="Illustrative consent record: the date the candidate agreed, and whether their CV may be shared with clients." onClose={() => setOpen(false)}
        footer={<><button className="btn" onClick={() => setOpen(false)}>Cancel</button><button className="btn primary" onClick={save} data-testid="save-consent">Save consent</button></>}>
        <div className="form-grid">
          <Field label="Consent given on"><input className="input" type="date" aria-label="Consent given on" value={given} onChange={(e) => setGiven(e.target.value)} /></Field>
          <Field label="Valid for (months)" hint={`Valid until ${given ? formatDate(addMonths(given, Number(months) || 0)) : '—'}`}><input className="input num" type="number" min={1} max={24} aria-label="Valid for (months)" value={months} onChange={(e) => setMonths(e.target.value)} /></Field>
          <div className="span-2">
            <label className="check"><input type="checkbox" checked={share} onChange={(e) => setShare(e.target.checked)} aria-label="Consents to the CV being shared with clients" /> Consents to the CV being shared with prospective employers</label>
          </div>
          {err && <div className="span-2 field-error" role="alert">{err}</div>}
        </div>
      </Modal>
    </>
  );
}

/** “Record signed terms”: dates of the signed terms of business; moves the client to Signed. */
export function TermsForm({ clientId, onDone }: { clientId: string; onDone?: () => void }) {
  const config = useIndustry();
  const data = useData();
  const act = useActions();
  const { can } = useUser();
  const today = todayStr();
  const [signed, setSigned] = useState(today);
  const [expiry, setExpiry] = useState(addDays(addMonths(today, 12), -1));
  const [err, setErr] = useState('');
  const c = clientOf(data, clientId);
  if (!c) return null;
  if (!can('terms.manage')) return <p className="muted-note">{permissionHint(config, data, 'terms.manage')}</p>;
  const save = () => {
    if (!signed || !expiry) return setErr('Enter both dates.');
    if (signed > today) return setErr('The signature date cannot be in the future.');
    if (expiry <= signed || expiry < today) return setErr('The expiry date must be after the signature date and not in the past.');
    if (c.status === 'signed') {
      act.update('clients', c.id, { termsSignedOn: signed, termsExpiry: expiry }, `Renewed terms recorded — valid until ${formatDate(expiry)}`);
      act.toast(`${str(c, 'name')}: renewed terms recorded until ${formatDate(expiry)}`);
      setErr(''); onDone?.();
      return;
    }
    act.update('clients', c.id, { termsSignedOn: signed, termsExpiry: expiry });
    // Signed terms imply they were sent: a draft or expired client goes through “sent” first.
    for (const step of c.status === 'sent' ? ['signed'] : ['sent', 'signed']) {
      const res = act.transition('clients', c.id, step);
      if (!res.ok) { setErr(res.reason); act.toast(res.reason, 'err'); return; }
    }
    act.toast(`${str(c, 'name')}: terms of business signed, valid until ${formatDate(expiry)}`);
    setErr('');
    onDone?.();
  };
  return (
    <form className="rc-inline-form" onSubmit={(e) => { e.preventDefault(); save(); }} noValidate data-testid="terms-form">
      <Field label="Signed on"><input className="input" type="date" aria-label="Terms signed on" value={signed} onChange={(e) => setSigned(e.target.value)} /></Field>
      <Field label="Valid until"><input className="input" type="date" aria-label="Terms valid until" value={expiry} onChange={(e) => setExpiry(e.target.value)} /></Field>
      <button className="btn primary" type="submit" data-testid="record-terms">{c.status === 'signed' ? 'Record renewed terms' : 'Record signed terms'}</button>
      {err && <div className="field-error" role="alert" style={{ flexBasis: '100%' }}>{err}</div>}
    </form>
  );
}
