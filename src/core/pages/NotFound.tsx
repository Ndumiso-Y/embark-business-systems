import { Link } from 'react-router-dom';
import { PageHeader } from '../components/ui';
import { LOCKED_INDUSTRY } from '../../industries/registry';

export default function NotFound() {
  return (
    <>
      <PageHeader kicker="Demo" title="Page not found" subtitle="That route does not exist in this demonstration." />
      <Link className="btn" to="/">{LOCKED_INDUSTRY ? 'Back to dashboard' : 'All industry demos'}</Link>
    </>
  );
}
