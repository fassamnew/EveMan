'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { authFetch } from '../../../lib/session';
import { API_BASE } from '../_lib/constants';
import { BackupArtifacts } from '../_lib/types';
import { useSuperAdminSession } from '../_lib/use-super-admin-session';

export default function SuperAdminOperationsPage() {
  const router = useRouter();
  const { ready } = useSuperAdminSession();
  const [artifacts, setArtifacts] = useState<BackupArtifacts>({ directory: null, reports: [] });

  useEffect(() => {
    if (!ready) {
      return;
    }

    authFetch(`${API_BASE}/super-admin/operations/backup-restore`, {}, () => router.replace('/sa'))
      .then(r => (r.ok ? r.json() : { directory: null, reports: [] }))
      .then((data: BackupArtifacts) => {
        if (data && Array.isArray(data.reports)) {
          setArtifacts(data);
        }
      })
      .catch(() => {
        // non-fatal
      });
  }, [ready, router]);

  return (
    <div className="space-y-6">
      <header className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
        <h1 className="text-2xl font-semibold">Operations</h1>
        <p className="mt-1 text-sm text-slate-300">Backup and restore artifact visibility.</p>
      </header>

      <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
        <p className="text-xs text-slate-400 break-all">Source directory: {artifacts.directory || 'not found'}</p>
        <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/60 p-4">
          {artifacts.reports.length === 0 ? (
            <p className="text-sm text-slate-300">No backup/restore artifacts discovered.</p>
          ) : (
            <ul className="space-y-2">
              {artifacts.reports.map(item => (
                <li key={item} className="rounded border border-slate-800 bg-slate-900/60 px-2 py-1 text-xs font-mono text-slate-200">
                  {item}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
