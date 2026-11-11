import { Link, useSearchParams } from 'react-router-dom';
import { useBase, useData, useIndustry, useUser } from '../context';
import { searchText } from '../engine';
import { Empty, PageHeader, Panel, StatusTag } from '../components/ui';

/** Searches every collection the user's modules expose. */
export default function SearchPage() {
  const config = useIndustry();
  const data = useData();
  const base = useBase();
  const { hasModule } = useUser();
  const [params] = useSearchParams();
  const q = (params.get('q') ?? '').trim().toLowerCase();
  const hits = config.modules
    .filter((m) => m.collection && hasModule(m.key))
    .flatMap((m) => {
      const def = config.collections.find((c) => c.key === m.collection)!;
      return (data.collections[def.key] ?? []).filter((r) => q && searchText(def, r, data).includes(q)).map((r) => ({ m, def, r }));
    })
    .slice(0, 60);
  return (
    <>
      <PageHeader kicker={`${config.businessName} / Search`} title={`Results for “${params.get('q') ?? ''}”`} subtitle="Searches the modules your simulated user can open." />
      <Panel>
        {hits.length ? (
          <ul className="list" data-testid="search-results">
            {hits.map(({ m, def, r }) => (
              <li key={def.key + r.id}>
                <div className="grow">
                  <Link to={`${base}/${m.key}/${r.id}`}><b>{def.title(r, data)}</b></Link>
                  <small>{m.label} · {r.ref}{def.subtitle ? ` · ${def.subtitle(r, data)}` : ''}</small>
                </div>
                <StatusTag workflow={def.workflow} status={r.status} />
              </li>
            ))}
          </ul>
        ) : <Empty title="No matching records" body="Try a name, reference or keyword." />}
      </Panel>
    </>
  );
}
