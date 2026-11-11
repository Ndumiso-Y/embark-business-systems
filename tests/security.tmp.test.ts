import { it, expect } from 'vitest';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import config, { setTodayForTests } from '../src/industries/security';
import { IndustryContext } from '../src/core/context';
import { buildIndustryData } from '../src/core/seed';
import { useStore } from '../src/core/store';
import { ModuleDetailView, ModuleView } from '../src/core/components/records';
import { writeFileSync, mkdirSync } from 'node:fs';

const OUT = process.env.SMOKE_OUT!;
const render = (path: string, el: ReturnType<typeof h>) => renderToStaticMarkup(
  h(IndustryContext.Provider, { value: config }, h(MemoryRouter, { initialEntries: [path] }, h(Routes, null,
    h(Route, { path: '/security', element: el }),
    h(Route, { path: '/security/:module', element: h(ModuleView) }),
    h(Route, { path: '/security/:module/:id', element: h(ModuleDetailView) })))),
);

it('renders every page', () => {
  mkdirSync(OUT, { recursive: true });
  for (const time of ['12:00', '20:30', '03:15']) {
    setTodayForTests('2026-11-11', time);
    const data = buildIndustryData(config, '2026-11-11');
    for (const uid of ['u_dir', 'u_ctl', 'u_acc']) {
      useStore.setState({ data: { security: { ...data, currentUserId: uid } } });
      (useStore.getInitialState() as { data: unknown }).data = useStore.getState().data;
      const dash = render('/security', h(config.dashboard));
      expect(dash.length).toBeGreaterThan(2000);
      if (uid === 'u_dir' && time === '12:00') writeFileSync(`${OUT}/dashboard.html`, dash);
      for (const m of config.modules) {
        const html = render(`/security/${m.key}`, h('div'));
        expect(html.length, m.key).toBeGreaterThan(500);
        if (uid === 'u_dir' && time === '12:00') writeFileSync(`${OUT}/${m.key}.html`, html);
        if (m.collection) {
          const list = data.collections[m.collection];
          const ids = [list[0].id, list[Math.floor(list.length / 2)].id, list[list.length - 1].id];
          if (m.collection === 'roster') ids.push(...list.filter((r) => ['open', 'absent', 'onduty'].includes(r.status ?? '')).slice(-6).map((r) => r.id));
          if (m.collection === 'callouts') ids.push('callouts_1', 'callouts_2', 'callouts_3');
          for (const id of ids) {
            const d = render(`/security/${m.key}/${id}`, h('div'));
            expect(d.length, `${m.key}/${id}`).toBeGreaterThan(500);
            if (uid === 'u_dir' && time === '12:00' && id === ids[0]) writeFileSync(`${OUT}/${m.key}-detail.html`, d);
          }
        }
      }
    }
  }
  setTodayForTests(null);
});
