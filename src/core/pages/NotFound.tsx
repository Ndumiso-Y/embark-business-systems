import { Link } from 'react-router-dom';
import { PageHeader } from '../components/ui';

export default function NotFound() {
  return (
    <>
      <PageHeader kicker="Demo" title="Page not found" subtitle="That route does not exist in this demonstration." />
      <Link className="btn" to="/">All industry demos</Link>
    </>
  );
}
