import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useBase, useData, useUser } from '../../../core/context';
import { records, str } from '../../../core/engine';
import { Panel, Stat, Tag } from '../../../core/components/ui';
import { RegisterPage } from '../../../core/components/records';
import { PASS_MARK, subjectLabel, subjectsForGrade } from '../data';
import { classLearners, ownClass, pct, sortedClasses, subjectAverage, termLabel, termOf, termPercent, todayStr, weightSum } from '../helpers';

/** Task register with the moderation queue and a class's term picture per subject. */
export default function Assessments() {
  const data = useData();
  const base = useBase();
  const { user } = useUser();
  const term = termOf(todayStr());
  const classes = sortedClasses(data);
  const [classId, setClassId] = useState(() => ownClass(data, user)?.id ?? classes[0]?.id ?? '');
  const tasks = records(data, 'assessments').filter((t) => str(t, 'term') === term);
  const count = (status: string) => tasks.filter((t) => t.status === status).length;
  const queue = tasks.filter((t) => t.status === 'captured' || t.status === 'moderated');
  const cls = classes.find((c) => c.id === classId);
  const rows = (cls ? subjectsForGrade(str(cls, 'grade')) : []).map((subject) => {
    const list = tasks.filter((t) => str(t, 'class') === classId && str(t, 'subject') === subject);
    const pcts = classLearners(data, classId).map((l) => termPercent(data, l, subject, term)).filter((p): p is number => p !== null);
    return { subject, list, published: list.filter((t) => t.status === 'published').length, sum: weightSum(list), avg: subjectAverage(data, classId, subject, term), pass: pcts.length ? Math.round((pcts.filter((p) => p >= PASS_MARK).length / pcts.length) * 100) : null };
  });

  return (
    <RegisterPage>
      <div className="stat-grid">
        <Stat label="Still being captured" value={count('draft')} sub="draft tasks with marks to finish" />
        <Stat label="Awaiting moderation" value={count('captured')} tone={count('captured') ? 'red' : undefined} sub="captured — a second person must moderate" />
        <Stat label="Moderated, to publish" value={count('moderated')} sub="the deputy or principal publishes" />
        <Stat label={`Published · ${termLabel(term)}`} value={`${count('published')}/${tasks.length}`} tone="accent" sub="count towards term percentages" />
      </div>
      <div className="grid-2">
        <Panel title="Term picture by subject" meta={`${termLabel(term)} · published marks only`}
          right={<select className="select sm" style={{ width: 'auto', minWidth: 140 }} aria-label="Class for the term picture" value={classId} onChange={(e) => setClassId(e.target.value)}>{classes.map((c) => <option key={c.id} value={c.id}>{str(c, 'name')}</option>)}</select>}>
          <div className="table-wrap">
            <table className="table" data-testid="term-picture">
              <thead><tr><th>Subject</th><th className="num">Tasks published</th><th className="num">Weightings</th><th className="num">Class average</th><th className="num">Pass rate</th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.subject}>
                    <td><strong>{subjectLabel(r.subject)}</strong></td>
                    <td className="num">{r.published}/{r.list.length}</td>
                    <td className="num">{r.sum === 100 ? '100%' : <Tag tone="amber">{r.sum}%</Tag>}</td>
                    <td className="num">{pct(r.avg)}</td>
                    <td className="num">{pct(r.pass)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="muted-note" style={{ marginTop: 8 }}>Term % = each published task’s percentage × its weighting. The demo carries three to five subjects per class.</p>
        </Panel>
        <Panel title="Moderation queue" meta="Captured marks wait for a second person; moderated marks wait to be published">
          {queue.length ? (
            <ul className="list" data-testid="moderation-queue">
              {queue.map((t) => (
                <li key={t.id} style={{ padding: '9px 0' }}>
                  <div className="grow"><Link to={`${base}/assessments/${t.id}`}><b>{subjectLabel(str(t, 'subject'))} — {str(t, 'title')}</b></Link><small>{classes.find((c) => c.id === str(t, 'class')) ? str(classes.find((c) => c.id === str(t, 'class')), 'name') : ''} · captured by {str(t, 'capturedBy')}</small></div>
                  <Tag tone={t.status === 'captured' ? 'amber' : 'blue'}>{t.status === 'captured' ? 'To moderate' : 'To publish'}</Tag>
                </li>
              ))}
            </ul>
          ) : <p className="muted-note">Nothing is waiting for moderation or publishing.</p>}
        </Panel>
      </div>
    </RegisterPage>
  );
}
