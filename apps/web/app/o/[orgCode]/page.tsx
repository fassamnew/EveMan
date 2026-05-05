'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { clearSession, loadSession } from '../../../lib/session';

export default function OrganizationPortalPage() {
  const router = useRouter();
  const params = useParams<{ orgCode: string }>();
  const [email, setEmail] = useState('');
  const orgCode = params.orgCode;

  useEffect(() => {
    if (!orgCode) {
      return;
    }

    const session = loadSession();
    if (!session) {
      router.replace('/login');
      return;
    }

    if (session.organizationCode !== orgCode && !session.roles.includes('SUPER_ADMIN')) {
      router.replace('/login');
      return;
    }

    setEmail(session.email);
  }, [orgCode, router]);

  return (
    <main className="container">
      <h1>Organization Portal</h1>
      <p>Organization code: {orgCode}</p>
      <p>Signed in as {email || '...'}</p>
      <button
        type="button"
        onClick={() => {
          clearSession();
          router.push('/login');
        }}
      >
        Sign out
      </button>
    </main>
  );
}
