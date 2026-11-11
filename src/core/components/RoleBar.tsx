import { useIndustry, useData, useUser } from '../context';
import { useStore } from '../store';

/**
 * "Signed in as" control. Switches the simulated demo user. A static demo has
 * no real authentication: anyone can switch users from here.
 */
export default function RoleBar({ note, compact }: { note?: string; compact?: boolean }) {
  const config = useIndustry();
  const data = useData();
  const { user, roleLabel } = useUser();
  const signInAs = useStore((s) => s.signInAs);
  return (
    <div className={`role-bar ${compact ? 'compact' : ''}`} data-testid="role-bar">
      <span className="label">Signed in as</span>
      <select className="select sm" style={{ width: 'auto', minWidth: compact ? 0 : 230 }} value={user.id} onChange={(e) => signInAs(config.id, e.target.value)} aria-label="Switch simulated user" data-testid="user-switcher-inline">
        {data.users.map((u) => <option key={u.id} value={u.id}>{u.name} · {u.title}</option>)}
      </select>
      <span className="tag accent">{roleLabel}{user.isSuperAdmin ? ' · all access' : ''}</span>
      <span className="warn">{note ?? 'Users and permissions are simulated in the browser for demonstration. This demo has no real sign-in or access control.'}</span>
    </div>
  );
}
