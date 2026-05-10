'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { authFetch } from '../../../lib/session';
import { API_BASE } from '../_lib/constants';
import { PlatformEvent } from '../_lib/types';
import { useSuperAdminSession } from '../_lib/use-super-admin-session';

export default function SuperAdminEventsPage() {
  const router = useRouter();
  const { ready } = useSuperAdminSession();
  const [events, setEvents] = useState<PlatformEvent[]>([]);

  useEffect(() => {
    if (!ready) {
      return;
    }

    authFetch(`${API_BASE}/super-admin/platform/events`, {}, () => router.replace('/sa'))
      .then(r => (r.ok ? r.json() : []))
      .then((data: PlatformEvent[]) => {
        if (Array.isArray(data)) {
          setEvents(data);
        }
      })
      .catch(() => {
        // non-fatal
      });
  }, [ready, router]);

  return (
    <div className="space-y-6">
      <header className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
        <h1 className="text-2xl font-semibold">Events</h1>
        <p className="mt-1 text-sm text-slate-300">View all events across organizations.</p>
      </header>

      <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
        <div className="rounded-xl border border-slate-800 bg-slate-950/60">
          <div className="grid grid-cols-[1.3fr_1fr_90px_140px] gap-2 border-b border-slate-800 px-3 py-2 text-[11px] uppercase tracking-wide text-slate-400">
            <span>Event</span>
            <span>Organization</span>
            <span>Status</span>
            <span>Created</span>
          </div>
          {events.length === 0 ? (
            <p className="px-3 py-4 text-sm text-slate-300">No events found.</p>
          ) : (
            <ul>
              {events.map(item => (
                <li key={item.id} className="grid grid-cols-[1.3fr_1fr_90px_140px] gap-2 border-t border-slate-800 px-3 py-3 text-sm">
                  <span className="truncate">{item.name}</span>
                  <span className="font-mono text-cyan-200 truncate">{item.organization.code}</span>
                  <span className="text-slate-300">{item.status}</span>
                  <span className="text-slate-400">{new Date(item.createdAt).toLocaleDateString()}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
