'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { clearSession, loadSession } from '../../lib/session';

export default function SuperAdminPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');

  useEffect(() => {
    const session = loadSession();
    if (!session || !session.roles.includes('SUPER_ADMIN')) {
      router.replace('/login');
      return;
    }
    setEmail(session.email);
  }, [router]);

  return (
    <main className="container">
      <h1>Super Admin Dashboard</h1>
      <p>Signed in as {email || '...'}</p>
      <p>This interface manages organizations and global platform controls.</p>
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
