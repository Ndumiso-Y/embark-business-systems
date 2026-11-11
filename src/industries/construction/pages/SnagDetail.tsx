import { Link, useParams } from 'react-router-dom';
import { useActions, useBase, useData, useUser } from '../../../core/context';
import { findRecord, str } from '../../../core/engine';
import { Notice, Panel, Tag } from '../../../core/components/ui';
import { RecordDetail } from '../../../core/components/records';
import { SNAG_CATEGORIES, label } from '../data';
import { holders, projectName } from '../helpers';

/** Snag detail: the generic record screen plus a one-click category and what the snag blocks. */
export default function SnagDetail() {
  const { id } = useParams();
  const data = useData();
  const s = findRecord(data, 'snags', id);
  return <RecordDetail aside={s ? <Aside id={s.id} /> : undefined} />;
}

function Aside({ id }: { id: string }) {
  const data = useData();
  const base = useBase();
  const act = useActions();
  const { can, hasModule } = useUser();
  const s = findRecord(data, 'snags', id)!;
  const cat = str(s, 'category');
  const closed = s.status === 'verified';
  const project = hasModule('projects') ? <Link to={`${base}/projects/${str(s, 'project')}`}>{projectName(data, s.values.project)}</Link> : projectName(data, s.values.project);
  const set = (value: string) => {
    act.update('snags', id, { category: value }, `Categorised as ${label(SNAG_CATEGORIES, value).toLowerCase()}`);
    act.toast(`${s.ref}: categorised as ${label(SNAG_CATEGORIES, value).toLowerCase()}`);
  };
  return (
    <div data-testid="snag-panel">
      <Panel title="Effect on completion" right={<Tag tone={closed ? 'green' : cat === 'critical' ? 'red' : cat ? 'amber' : 'dark'}>{cat ? label(SNAG_CATEGORIES, cat) : 'Not categorised'}</Tag>}>
        {closed ? <Notice tone="accent">Verified closed — no longer holds up {project}.</Notice>
          : !cat ? <Notice tone="amber">Not categorised: practical completion of {project} is blocked until every snag is categorised.</Notice>
            : cat === 'critical' ? <Notice tone="red">Open critical snag: practical completion of {project} is blocked until this is fixed and verified.</Notice>
              : <Notice tone="grey">Does not block practical completion of {project}, but the whole snag list must be verified closed before final completion.</Notice>}
        {!closed && can('snags') && (
          <>
            <p className="muted-note" style={{ margin: '12px 0 8px' }}>{cat ? 'Change category' : 'Choose a category'}</p>
            <div className="btns" data-testid="snag-category">
              {SNAG_CATEGORIES.map((c) => <button key={c.value} className={`btn sm ${cat === c.value ? 'primary' : ''}`} onClick={() => set(c.value)} disabled={cat === c.value}>{c.label}</button>)}
            </div>
          </>
        )}
        {!closed && !can('snags') && <p className="muted-note" style={{ marginTop: 10 }}>Snags are categorised and marked fixed by {holders(data, 'snags')}.</p>}
        {s.status === 'fixed' && !can('projects.manage') && <p className="muted-note" style={{ marginTop: 10 }}>The fix is verified by {holders(data, 'projects.manage')}.</p>}
      </Panel>
    </div>
  );
}
