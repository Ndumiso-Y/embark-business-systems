import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { IcoLock } from './Icons';
import { PageHeader, Panel } from './ui';
import RoleBar from './RoleBar';
import { useBase, useIndustry, useUser } from '../context';

/** Renders children only when the simulated user holds the module. */
export default function RequireModule({ module, children }: { module: string; children: ReactNode }) {
  const config = useIndustry();
  const base = useBase();
  const { user, hasModule } = useUser();
  if (hasModule(module)) return <>{children}</>;
  const label = module === 'admin' ? 'Users & permissions' : config.modules.find((m) => m.key === module)?.label ?? module;
  return (
    <>
      <PageHeader kicker={`${config.businessName} / Access`} title="No access to this module" subtitle={`${user.name} (${user.title}) has not been granted ${label}.`} />
      <RoleBar />
      <Panel>
        <div className="empty" data-testid="no-access">
          <IcoLock style={{ width: 28, height: 28, color: 'var(--accent)' }} />
          <b style={{ marginTop: 10 }}>Access is granted by the administrator</b>
          In a production system this would be enforced by the server. In this demonstration the restriction is simulated in the browser only.
          <div style={{ marginTop: 14 }} className="btns">
            <Link className="btn" to={base}>Back to dashboard</Link>
          </div>
        </div>
      </Panel>
    </>
  );
}
