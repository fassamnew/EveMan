'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { type Session, loadSession } from '../../../lib/session';

export function useSuperAdminSession(): { session: Session | null; ready: boolean } {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const current = loadSession();
    if (!current || !current.roles.includes('SUPER_ADMIN')) {
      router.replace('/sa');
      return;
    }

    setSession(current);
    setReady(true);
  }, [router]);

  return { session, ready };
}
