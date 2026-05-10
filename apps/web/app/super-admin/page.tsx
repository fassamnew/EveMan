'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { authFetch } from '../../lib/session';
import { API_BASE } from './_lib/constants';
import { PlatformEvent, PlatformOverview } from './_lib/types';
import { useSuperAdminSession } from './_lib/use-super-admin-session';

export default function SuperAdminDashboardPage() {
  const router = useRouter();
  const { ready } = useSuperAdminSession();
  const [overview, setOverview] = useState<PlatformOverview | null>(null);
  const [events, setEvents] = useState<PlatformEvent[]>([]);

  useEffect(() => {
    if (!ready) {
      return;
    }

    authFetch(`${API_BASE}/super-admin/platform/overview`, {}, () => router.replace('/sa'))
      .then(r => (r.ok ? r.json() : null))
      .then((data: PlatformOverview | null) => {
        if (data) {
          setOverview(data);
        }
      })
      .catch(() => {
        // non-fatal
      });

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
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="mt-1 text-sm text-slate-300">Platform-level KPIs and latest event activity.</p>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <article className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <p className="text-xs uppercase tracking-wide text-slate-400">Organizations</p>
          <p className="mt-2 text-2xl font-semibold text-cyan-200">{overview?.organizations ?? '-'}</p>
        </article>
        <article className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <p className="text-xs uppercase tracking-wide text-slate-400">Active organizations</p>
          <p className="mt-2 text-2xl font-semibold text-emerald-200">{overview?.activeOrganizations ?? '-'}</p>
        </article>
        <article className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <p className="text-xs uppercase tracking-wide text-slate-400">System users</p>
          <p className="mt-2 text-2xl font-semibold text-cyan-200">{overview?.users ?? '-'}</p>
        </article>
        <article className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <p className="text-xs uppercase tracking-wide text-slate-400">Audit entries</p>
          <p className="mt-2 text-2xl font-semibold text-amber-200">{overview?.auditLogCount ?? '-'}</p>
        </article>
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
        <h2 className="text-lg font-semibold">Recent Platform Events</h2>
        <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/60">
          <div className="grid grid-cols-[1.4fr_1fr_1fr] gap-2 border-b border-slate-800 px-3 py-2 text-[11px] uppercase tracking-wide text-slate-400">
            <span>Event</span>
            <span>Organization</span>
            <span>Status</span>
          </div>
          {events.length === 0 ? (
            <p className="px-3 py-4 text-sm text-slate-300">No events found.</p>
          ) : (
            <ul>
              {events.slice(0, 10).map(item => (
                <li key={item.id} className="grid grid-cols-[1.4fr_1fr_1fr] gap-2 border-t border-slate-800 px-3 py-2 text-sm">
                  <span className="truncate">{item.name}</span>
                  <span className="font-mono text-cyan-200 truncate">{item.organization.code}</span>
                  <span className="text-slate-300">{item.status}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
