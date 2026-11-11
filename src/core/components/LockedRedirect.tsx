import { Navigate, useLocation } from 'react-router-dom';

/**
 * In a single-industry client build, any address outside that industry returns to its
 * dashboard. Keyed by the attempted address so every attempt redirects, even several in
 * quick succession (an unkeyed <Navigate> with unchanged props would not fire again).
 */
export default function LockedRedirect({ to }: { to: string }) {
  const { pathname } = useLocation();
  return <Navigate key={pathname} to={`/${to}`} replace />;
}
