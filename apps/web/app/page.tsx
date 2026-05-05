import { StatusBadge } from '@evemange/ui';
import Link from 'next/link';

export default async function HomePage() {
  let apiStatus = 'unreachable';

  try {
    const response = await fetch('http://localhost:5001/health', { cache: 'no-store' });
    if (response.ok) {
      apiStatus = 'ok';
    }
  } catch {
    apiStatus = 'unreachable';
  }

  return (
    <main className="container">
      <h1>EveMange Rewrite Baseline</h1>
      <p>Phase 0 scaffold is now active.</p>
      <ul>
        <li>Web app: Next.js on port 3500</li>
        <li>API app: NestJS on port 5001</li>
        <li>Infrastructure: MySQL and Redis via Docker Compose</li>
      </ul>
      <p>
        <Link href="/sa">Super Admin login</Link>
      </p>
      <p>
        <Link href="/o/acme">Organization login example</Link>
      </p>
      <p>
        API health status:{' '}
        <StatusBadge label={apiStatus} tone={apiStatus === 'ok' ? 'success' : 'warning'} />
      </p>
    </main>
  );
}
