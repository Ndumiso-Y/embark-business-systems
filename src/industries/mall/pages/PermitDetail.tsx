import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useActions, useData, useIndustry, useUser } from '../../../core/context';
import { findRecord, permissionHint, str } from '../../../core/engine';
import { formatDate } from '../../../core/lib/dates';
import { Field, KeyValues, Notice, Panel, Tag } from '../../../core/components/ui';
import { RecordDetail } from '../../../core/components/records';
import { PERMIT_WINDOWS, label } from '../data';
import { activeLease, insuranceProblem, permitExpired, permitProblems, permitTypeLabel, shopLabel, todayStr, unitOf } from '../helpers';
import { Checklist, MallStyles, RecLink } from './shared';

export default function PermitDetail() {
  const { id } = useParams();
  const data = useData();
  const p = findRecord(data, 'permits', id);
  return (
    <RecordDetail aside={p ? <Aside id={p.id} /> : undefined}>
      {p && <Main key={p.id} id={p.id} />}
    </RecordDetail>
  );
}

function Main({ id }: { id: string }) {
  const config = useIndustry();
  const data = useData();
  const act = useActions();
  const { can } = useUser();
  const today = todayStr();
  const p = findRecord(data, 'permits', id)!;
  const status = p.status ?? '';
  const type = str(p, 'type');
  const issue = can('permits.issue');
  const pre = status === 'requested' || status === 'approved';
  const until = str(p, 'validTo') || str(p, 'validFrom');
  const [insurance, setInsurance] = useState(str(p, 'insuranceExpiry'));
  const [watch, setWatch] = useState(str(p, 'fireWatch'));
  const [rDate, setRDate] = useState(str(p, 'reinstateDate') || until);
  const [rTime, setRTime] = useState(str(p, 'reinstateTime'));
  const [from, setFrom] = useState(str(p, 'validFrom'));
  const [to, setTo] = useState(until);
  const problems = permitProblems(p);
  const insOk = !insuranceProblem(str(p, 'insuranceExpiry'), until);
  const reinstateOk = !!str(p, 'reinstateDate') && !!str(p, 'reinstateTime') && str(p, 'reinstateDate') >= str(p, 'validFrom');
  return (
    <>
      <MallStyles />
      {permitExpired(p, today) && (
        <Notice tone="red"><b>Expired but still active.</b> This permit ran out on {formatDate(until)}. Confirm the work has stopped and close it{type === 'hot' || type === 'sprinkler' ? ' (see “Close-out” below)' : ''}, or have the contractor apply for a new permit.</Notice>
      )}
      {pre && (
        <Panel title="Before approval" meta="Checked by “Approve permit” and again by “Make active”" right={<Tag tone={problems.length ? 'red' : 'green'}>{problems.length ? `${problems.length} outstanding` : 'Ready to approve'}</Tag>}>
          <Checklist items={[
            { label: 'Contractor’s public-liability insurance in date', ok: insOk, detail: str(p, 'insuranceExpiry') ? `Valid until ${formatDate(str(p, 'insuranceExpiry'))}${insOk ? '' : ` — it must cover the work up to ${formatDate(until)}`}` : 'No certificate on file',
              action: issue ? (
                <span className="mall-inline">
                  <input className="input sm" type="date" style={{ width: 150 }} aria-label="Public-liability insurance valid until" value={insurance} onChange={(e) => setInsurance(e.target.value)} data-testid="permit-insurance" />
                  <button className="btn sm" data-testid="save-permit-insurance" onClick={() => { if (!insurance) return act.toast('Type the expiry date from the insurance certificate.', 'err'); act.update('permits', id, { insuranceExpiry: insurance }, `Public-liability insurance on file, valid until ${formatDate(insurance)}`); act.toast(`${p.ref}: insurance recorded`); }}>Save</button>
                </span>
              ) : undefined },
            { label: 'Site induction done', ok: p.values.inducted === true, detail: 'Centre rules, emergency exits, isolation points and working hours',
              action: issue && p.values.inducted !== true ? <button className="btn sm" data-testid="permit-inducted" onClick={() => { act.update('permits', id, { inducted: true }, 'Site induction recorded'); act.toast(`${p.ref}: induction recorded`); }}>Record induction</button> : undefined },
            ...(type === 'hot' ? [{ label: 'Fire watch named', ok: !!str(p, 'fireWatch').trim(), detail: str(p, 'fireWatch') || 'Someone must watch for sparks during the work and for 60 minutes after',
              action: issue ? (
                <span className="mall-inline">
                  <input className="input sm" style={{ width: 170 }} aria-label="Fire watch name" placeholder="Name of the fire watch" value={watch} onChange={(e) => setWatch(e.target.value)} data-testid="fire-watch" />
                  <button className="btn sm" data-testid="save-fire-watch" onClick={() => { if (!watch.trim()) return act.toast('Type the name of the person who will stand fire watch.', 'err'); act.update('permits', id, { fireWatch: watch.trim() }, `Fire watch named: ${watch.trim()}`); act.toast(`${p.ref}: fire watch named`); }}>Save</button>
                </span>
              ) : undefined }] : []),
            ...(type === 'sprinkler' ? [{ label: 'Reinstatement date and time set', ok: reinstateOk, detail: reinstateOk ? `Sprinklers back in service by ${formatDate(str(p, 'reinstateDate'))} at ${str(p, 'reinstateTime')}` : 'The zone may not stay isolated open-endedly',
              action: issue ? (
                <span className="mall-inline">
                  <input className="input sm" type="date" style={{ width: 150 }} aria-label="Reinstatement date" value={rDate} onChange={(e) => setRDate(e.target.value)} data-testid="reinstate-date" />
                  <input className="input sm" type="time" style={{ width: 110 }} aria-label="Reinstatement time" value={rTime} onChange={(e) => setRTime(e.target.value)} data-testid="reinstate-time" />
                  <button className="btn sm" data-testid="save-reinstate" onClick={() => { if (!rDate || !rTime) return act.toast('Set both the date and the time the sprinklers will be back in service.', 'err'); act.update('permits', id, { reinstateDate: rDate, reinstateTime: rTime }, `Sprinklers to be reinstated by ${formatDate(rDate)} ${rTime}`); act.toast(`${p.ref}: reinstatement set`); }}>Save</button>
                </span>
              ) : undefined }] : []),
          ]} />
          {!issue && <p className="muted-note" style={{ marginTop: 10 }}>{permissionHint(config, data, 'permits.issue')}</p>}
        </Panel>
      )}
      {pre && issue && (
        <Panel title="Permit dates" meta="A permit can only be made active on its own dates">
          <div className="mall-inline">
            <Field label="Valid from"><input className="input" type="date" aria-label="Valid from" value={from} onChange={(e) => setFrom(e.target.value)} data-testid="valid-from" /></Field>
            <Field label="Valid to"><input className="input" type="date" aria-label="Valid to" value={to} onChange={(e) => setTo(e.target.value)} data-testid="valid-to" /></Field>
            <button className="btn" disabled={from === str(p, 'validFrom') && to === until} data-testid="save-dates" onClick={() => { if (!from || !to || to < from) return act.toast('The permit must end on or after the day it starts.', 'err'); act.update('permits', id, { validFrom: from, validTo: to }, `Permit dates set: ${formatDate(from)} – ${formatDate(to)}`); act.toast(`${p.ref}: dates saved`); }}>Save dates</button>
            {status === 'approved' && str(p, 'validFrom') > today && <button className="btn ghost sm" type="button" data-testid="start-today" onClick={() => { setFrom(today); if (to < today) setTo(today); }}>Work starts today</button>}
          </div>
        </Panel>
      )}
      {status === 'active' && (type === 'hot' || type === 'sprinkler') && (
        <Panel title="Close-out" meta="“Close permit” is refused until this is confirmed">
          <Checklist items={type === 'hot' ? [
            { label: 'Fire watch stayed 60 minutes after the work', ok: p.values.fireWatchDone === true, detail: `Fire watch: ${str(p, 'fireWatch') || 'not named'}`,
              action: issue && p.values.fireWatchDone !== true ? <button className="btn sm" data-testid="confirm-fire-watch" onClick={() => { act.update('permits', id, { fireWatchDone: true }, 'Fire watch confirmed complete'); act.toast(`${p.ref}: fire watch confirmed`); }}>Confirm</button> : undefined },
          ] : [
            { label: 'Sprinklers reinstated and tested', ok: p.values.reinstated === true, detail: `Due back by ${formatDate(str(p, 'reinstateDate'))} ${str(p, 'reinstateTime')}`,
              action: issue && p.values.reinstated !== true ? <button className="btn sm" data-testid="confirm-reinstated" onClick={() => { act.update('permits', id, { reinstated: true }, 'Sprinklers confirmed reinstated'); act.toast(`${p.ref}: sprinklers confirmed reinstated`); }}>Confirm</button> : undefined },
          ]} />
        </Panel>
      )}
      <Panel title="Work to be done">
        <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6 }}>{str(p, 'work') || 'No description given.'}</p>
      </Panel>
    </>
  );
}

function Aside({ id }: { id: string }) {
  const data = useData();
  const p = findRecord(data, 'permits', id)!;
  const unit = unitOf(data, str(p, 'unit'));
  const lease = unit ? activeLease(data, unit.id) : undefined;
  return (
    <Panel title="Permit">
      <KeyValues items={[
        { label: 'Type', value: permitTypeLabel(p) },
        { label: 'When', value: label(PERMIT_WINDOWS, str(p, 'window')) },
        { label: 'Contractor', value: str(p, 'contractor'), wide: true },
        { label: 'Where', value: unit ? <><RecLink module="units" id={unit.id}>{shopLabel(unit)}</RecLink>{lease ? ` · ${str(lease, 'tenant')}` : ''}{str(p, 'location') ? ` · ${str(p, 'location')}` : ''}</> : str(p, 'location') || 'Common area', wide: true },
        { label: 'Valid', value: `${formatDate(str(p, 'validFrom'))} – ${formatDate(str(p, 'validTo') || str(p, 'validFrom'))}`, wide: true },
        { label: 'Fire watch', value: str(p, 'fireWatch') },
        { label: 'Approved by', value: str(p, 'approvedBy') },
      ]} />
      <p className="muted-note" style={{ marginTop: 10 }}>Illustrative only — not an occupational health and safety permit system.</p>
    </Panel>
  );
}
