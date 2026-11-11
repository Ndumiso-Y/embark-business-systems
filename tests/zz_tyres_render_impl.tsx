import { expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import config, { setTodayForTests } from '../src/industries/tyres';
import { IndustryContext } from '../src/core/context';
import { useStore } from '../src/core/store';
import { ModuleDetailView, ModuleView } from '../src/core/components/records';
import { records } from '../src/core/engine';
import { todayIso } from '../src/core/lib/dates';

function render(path: string) {
  return renderToString(
    <IndustryContext.Provider value={config}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/tyres" element={<config.dashboard />} />
          <Route path="/tyres/:module" element={<ModuleView />} />
          <Route path="/tyres/:module/:id" element={<ModuleDetailView />} />
        </Routes>
      </MemoryRouter>
    </IndustryContext.Provider>,
  );
}

export function runSmoke() {
  setTodayForTests(todayIso());
  useStore.getState().reset(config);
  const d = useStore.getState().data.tyres!;
  const paths = ['/tyres', ...config.modules.map((m) => `/tyres/${m.key}`)];
  for (const m of config.modules) if (m.collection) for (const r of records(d, m.collection).slice(-25)) paths.push(`/tyres/${m.key}/${r.id}`);
  let n = 0;
  for (const u of d.users) {
    useStore.getState().signInAs('tyres', u.id);
    (useStore.getInitialState().data as Record<string, unknown>).tyres = useStore.getState().data.tyres;
    for (const p of paths) {
      try { const html = render(p); expect(html.length).toBeGreaterThan(100); n++; } catch (e) { throw new Error(`${u.id} ${p}: ${(e as Error).stack}`); }
    }
  }
  useStore.getState().signInAs('tyres', 'u_mgr');
  (useStore.getInitialState().data as Record<string, unknown>).tyres = useStore.getState().data.tyres;
  const html = render(`/tyres/jobs/${records(d, 'jobs').find((j) => j.status === 'inspected')!.id}`);
  expect(html).toContain('wheel-diagram');
  expect(html).toContain('Quote with customer refusal');
  console.log('rendered', n, 'pages; bytes', JSON.stringify(d).length);
}
