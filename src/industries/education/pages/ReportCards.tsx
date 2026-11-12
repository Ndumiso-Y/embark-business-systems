import { useState } from 'react';
import { useActions, useData, useUser } from '../../../core/context';
import { records, str } from '../../../core/engine';
import { Notice, Panel, Stat } from '../../../core/components/ui';
import { RegisterPage } from '../../../core/components/records';
import { classLearners, ownClass, reportFor, signBlockers, sortedClasses, termLabel, termOf, todayStr } from '../helpers';
import { useFeedback } from './feedback';
import { ModuleLink, WhoCan } from './shared';

/** Report card register with the per-class run: generate drafts, then sign and release the ones that are ready. */
export default function ReportCards() {
  const data = useData();
  const act = useActions();
  const { can, user } = useUser();
  const fb = useFeedback();
  const term = termOf(todayStr());
  const classes = sortedClasses(data);
  // Start where the signed-in person has work: their own class, else a class with reports ready to sign, else one still to generate.
  const [classId, setClassId] = useState(() => {
    const readyIn = (id: string) => classLearners(data, id).some((l) => { const r = reportFor(data, l.id, term); return !!r && r.status === 'commented' && !signBlockers(r, data).length; });
    return ownClass(data, user)?.id ?? (can('reports.signoff') ? classes.find((c) => readyIn(c.id))?.id : undefined) ?? classes.find((c) => classLearners(data, c.id).some((l) => !reportFor(data, l.id, term)))?.id ?? classes[0]?.id ?? '';
  });
  const all = records(data, 'reports').filter((r) => str(r, 'term') === term);
  const count = (status: string) => all.filter((r) => r.status === status).length;
  const learners = classLearners(data, classId);
  const mine = learners.map((l) => reportFor(data, l.id, term)).filter((r) => !!r);
  const missing = learners.filter((l) => !reportFor(data, l.id, term));
  const ready = mine.filter((r) => r.status === 'commented' && !signBlockers(r, data).length);
  const signed = mine.filter((r) => r.status === 'signed');
  const blocked = mine.filter((r) => r.status === 'commented' && signBlockers(r, data).length);
  const unpublished = [...new Map(blocked.flatMap((r) => signBlockers(r, data)).filter((b) => b.task).map((b) => [b.task!.id, b])).values()];
  const name = str(classes.find((c) => c.id === classId), 'name');

  const generate = () => {
    for (const l of missing) act.create('reports', { learner: l.id, term, comment: '' }, 'draft', `Report card generated for ${termLabel(term)}`);
    act.toast(`${missing.length} draft report card${missing.length === 1 ? '' : 's'} generated for ${name}`);
    fb.ok(`${missing.length} draft${missing.length === 1 ? '' : 's'} created. Each one now needs the class teacher’s comment — open them from the list below.`);
  };
  const run = (list: typeof mine, to: string, done: string) => {
    let n = 0;
    let refused = '';
    for (const r of list) { const res = act.transition('reports', r.id, to); if (res.ok) n++; else refused = res.reason; }
    if (n) { act.toast(`${n} report card${n === 1 ? '' : 's'} ${done}`); fb.ok(`${n} ${name} report card${n === 1 ? '' : 's'} ${done}.`); }
    if (refused) fb.fail(refused);
  };

  return (
    <RegisterPage>
      <div className="stat-grid">
        <Stat label="Drafts needing a comment" value={count('draft')} sub="waiting for the class teacher" />
        <Stat label="Awaiting principal sign-off" value={count('commented')} tone={count('commented') ? 'red' : undefined} sub="teacher comment done" />
        <Stat label="Signed, to release" value={count('signed')} sub="figures frozen at sign-off" />
        <Stat label={`Released · ${termLabel(term)}`} value={count('released')} tone="accent" sub="logged only — nothing is sent" />
      </div>
      <Panel title={`Class run — ${termLabel(term)}`} meta="One report per learner, built from published marks, the class average and the register"
        right={<select className="select sm" style={{ width: 'auto', minWidth: 140 }} aria-label="Class for the report run" value={classId} onChange={(e) => { setClassId(e.target.value); fb.clear(); }}>{classes.map((c) => <option key={c.id} value={c.id}>{str(c, 'name')}</option>)}</select>}>
        <p className="muted-note" data-testid="run-summary">{name}: {learners.length} learners · {mine.length} report cards ({mine.filter((r) => r.status === 'draft').length} draft, {mine.filter((r) => r.status === 'commented').length} commented, {signed.length} signed, {mine.filter((r) => r.status === 'released').length} released){missing.length ? ` · ${missing.length} not generated yet` : ''}.</p>
        <div className="btns" style={{ marginTop: 12 }}>
          {can('reports.comment') && <button className="btn primary" disabled={!missing.length} onClick={generate} data-testid="generate-reports">Generate {missing.length || ''} report card{missing.length === 1 ? '' : 's'}</button>}
          {can('reports.signoff') && <button className="btn" disabled={!ready.length} onClick={() => run(ready, 'signed', 'signed')} data-testid="sign-ready">Sign the {ready.length} that {ready.length === 1 ? 'is' : 'are'} ready</button>}
          {can('reports.signoff') && <button className="btn" disabled={!signed.length} onClick={() => run(signed, 'released', 'released to parents (logged only)')} data-testid="release-signed">Release {signed.length} signed</button>}
        </div>
        {blocked.length > 0 && (
          <div style={{ marginTop: 12 }} data-testid="run-blocked">
            <Notice tone="amber">
              {blocked.length} commented report card{blocked.length === 1 ? '' : 's'} in {name} cannot be signed yet because marks are not published:{' '}
              {unpublished.map((b, i) => <span key={b.task!.id}>{i ? ', ' : ''}<ModuleLink module="assessments" id={b.task!.id}>{b.text.replace(' is not published yet', '')}</ModuleLink></span>)}.
            </Notice>
          </div>
        )}
        {fb.view}
        <WhoCan permission="reports.signoff" what="Signing and releasing report cards:" />
      </Panel>
      <div className="section-gap" />
    </RegisterPage>
  );
}
