import type { RouteObject } from 'react-router-dom';
import { Navigate, useParams } from 'react-router-dom';
import { LOCKED_INDUSTRY } from '../industries/registry';
import IndustryLayout from './IndustryLayout';
import Gallery from './pages/Gallery';
import UsersPage from './pages/UsersPage';
import SettingsPage from './pages/SettingsPage';
import SearchPage from './pages/SearchPage';
import NotFound from './pages/NotFound';
import RequireModule from './components/RequireModule';
import { ModuleDetailView, ModuleView } from './components/records';
import { useIndustry } from './context';

function Dashboard() {
  const config = useIndustry();
  const D = config.dashboard;
  return <RequireModule module="dashboard"><D /></RequireModule>;
}

function ModuleRoute({ detail }: { detail?: boolean }) {
  const config = useIndustry();
  const { module } = useParams();
  const m = config.modules.find((x) => x.key === module);
  if (!m) return <NotFound />;
  return <RequireModule module={m.key}>{detail ? <ModuleDetailView key={module} /> : <ModuleView key={module} />}</RequireModule>;
}

export const routes: RouteObject[] = [
  // A locked client build has no gallery: the root opens that industry's dashboard.
  { path: '/', element: LOCKED_INDUSTRY ? <Navigate to={`/${LOCKED_INDUSTRY}`} replace /> : <Gallery /> },
  {
    path: '/:industry',
    element: <IndustryLayout />,
    children: [
      { index: true, element: <Dashboard /> },
      { path: 'admin', element: <RequireModule module="admin"><UsersPage /></RequireModule> },
      { path: 'settings', element: <SettingsPage /> },
      { path: 'search', element: <SearchPage /> },
      { path: ':module', element: <ModuleRoute /> },
      { path: ':module/:id', element: <ModuleRoute detail /> },
      { path: '*', element: <NotFound /> },
    ],
  },
  { path: '*', element: LOCKED_INDUSTRY ? <Navigate to={`/${LOCKED_INDUSTRY}`} replace /> : <div className="content"><NotFound /></div> },
];
