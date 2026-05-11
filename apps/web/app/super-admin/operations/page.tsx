'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { authFetch } from '../../../lib/session';
import { API_BASE } from '../_lib/constants';
import { BackupArtifacts, BackupRestoreDrillTriggerResult } from '../_lib/types';
import { useSuperAdminSession } from '../_lib/use-super-admin-session';

export default function SuperAdminOperationsPage() {
  const router = useRouter();
  const { ready } = useSuperAdminSession();
  const [artifacts, setArtifacts] = useState<BackupArtifacts>({ directory: null, reports: [] });
  const [isTriggering, setIsTriggering] = useState(false);
  const [triggerMessage, setTriggerMessage] = useState<string | null>(null);

  async function triggerBackupRestoreDrill() {
    if (isTriggering) {
      return;
    }

    setIsTriggering(true);
    setTriggerMessage(null);

    try {
      const response = await authFetch(
        `${API_BASE}/super-admin/operations/backup-restore/drill`,
        {
          method: 'POST'
        },
        () => router.replace('/sa')
      );

      if (!response.ok) {
        setTriggerMessage('Unable to trigger backup/restore drill.');
        return;
      }

      const result = (await response.json()) as BackupRestoreDrillTriggerResult;
      setTriggerMessage(`Drill started (pid ${result.pid}) at ${new Date(result.startedAt).toLocaleString()}.`);
    } catch {
      setTriggerMessage('Unable to trigger backup/restore drill.');
    } finally {
      setIsTriggering(false);
    }
  }

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
        <div className="mb-4 flex items-center justify-between gap-3">
          <p className="text-sm text-slate-300">Trigger the scripted backup/restore drill and monitor artifacts below.</p>
          <button
            type="button"
            onClick={() => {
              void triggerBackupRestoreDrill();
            }}
            disabled={isTriggering}
            className="rounded-lg border border-cyan-500/50 bg-cyan-500/10 px-3 py-2 text-xs font-semibold text-cyan-200 transition hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isTriggering ? 'Triggering...' : 'Trigger Backup/Restore Drill'}
          </button>
        </div>
        {triggerMessage && (
          <p className="mb-3 rounded border border-slate-700 bg-slate-950/60 px-3 py-2 text-xs text-slate-200">{triggerMessage}</p>
        )}
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
