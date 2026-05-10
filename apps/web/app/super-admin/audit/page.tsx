'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { authFetch } from '../../../lib/session';
import { API_BASE } from '../_lib/constants';
import { AuditLogEntry } from '../_lib/types';
import { useSuperAdminSession } from '../_lib/use-super-admin-session';

export default function SuperAdminAuditPage() {
  const router = useRouter();
  const { ready } = useSuperAdminSession();
  const [items, setItems] = useState<AuditLogEntry[]>([]);

  useEffect(() => {
    if (!ready) {
      return;
    }

    authFetch(`${API_BASE}/super-admin/system/audit-logs?limit=100`, {}, () => router.replace('/sa'))
      .then(r => (r.ok ? r.json() : []))
      .then((data: AuditLogEntry[]) => {
        if (Array.isArray(data)) {
          setItems(data);
        }
      })
      .catch(() => {
        // non-fatal
      });
  }, [ready, router]);

  return (
    <div className="space-y-6">
      <header className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
        <h1 className="text-2xl font-semibold">Audit Logs</h1>
        <p className="mt-1 text-sm text-slate-300">Platform activity and system action trail.</p>
      </header>

      <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
        <div className="space-y-2">
          {items.length === 0 ? (
            <p className="rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-4 text-sm text-slate-300">No audit entries available.</p>
          ) : (
            items.map(item => (
              <article key={item.id} className="rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm text-slate-100">{item.action}</p>
                    <p className="mt-1 text-xs text-slate-400">
                      {item.actorUser?.email || 'system'}
                      {item.organization ? ` · ${item.organization.code}` : ' · platform'}
                      {item.targetId ? ` · ${item.targetType}:${item.targetId}` : ` · ${item.targetType}`}
                    </p>
                  </div>
                  <span className={`rounded-full px-2 py-1 text-[11px] ${item.outcome === 'SUCCESS' ? 'bg-emerald-950 text-emerald-300' : 'bg-rose-950 text-rose-300'}`}>
                    {item.outcome}
                  </span>
                </div>
                <p className="mt-2 text-[11px] text-slate-500">{new Date(item.createdAt).toLocaleString()}</p>
              </article>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
