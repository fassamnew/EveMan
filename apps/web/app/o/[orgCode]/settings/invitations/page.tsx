'use client';

import { ChangeEvent, FormEvent, useCallback, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { authFetch, loadSession } from '../../../../../lib/session';
import { useTheme } from '../../../../../lib/theme-provider';

type BulkInviteResult = {
  row: number;
  email: string;
  roleName: 'ORG_ADMIN' | 'ORG_STAFF';
  success: boolean;
  message?: string;
  inviteToken?: string;
  expiresAt?: string;
};

type BulkInviteResponse = {
  organizationCode: string;
  totals: {
    attempted: number;
    successful: number;
    failed: number;
  };
  results: BulkInviteResult[];
};

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || '/api';
const CSV_TEMPLATE = 'email,roleName\nmember1@example.com,ORG_STAFF\nmanager@example.com,ORG_ADMIN';

export default function BulkInvitationsPage() {
  const params = useParams<{ orgCode: string }>();
  const router = useRouter();
  const { theme } = useTheme();
  const orgCode = params.orgCode;

  const [csvContent, setCsvContent] = useState(CSV_TEMPLATE);
  const [defaultRoleName, setDefaultRoleName] = useState<'ORG_STAFF' | 'ORG_ADMIN'>('ORG_STAFF');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BulkInviteResponse | null>(null);

  const onSessionExpired = useCallback(() => router.replace(`/o/${orgCode}`), [orgCode, router]);

  async function onFileSelected(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      setCsvContent(text);
      setError(null);
    } catch {
      setError('Unable to read selected CSV file');
    }
  }

  function readErrorMessage(payload: unknown): string {
    if (!payload || typeof payload !== 'object') return 'Unable to send bulk invites';
    const value = payload as { message?: string | string[] };
    if (!value.message) return 'Unable to send bulk invites';
    return Array.isArray(value.message) ? value.message.join(', ') : value.message;
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();

    const session = loadSession();
    if (!session) {
      onSessionExpired();
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setResult(null);

    try {
      const response = await authFetch(
        `${API_BASE}/org/${orgCode}/users/invite/bulk`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            csvContent,
            defaultRoleName
          })
        },
        onSessionExpired
      );

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(readErrorMessage(payload));
        return;
      }

      setResult(payload as BulkInviteResponse);
    } catch {
      setError('Network error while sending invites');
    } finally {
      setIsSubmitting(false);
    }
  }

  const panelClass =
    theme === 'dark'
      ? 'border-slate-800 bg-slate-900 text-slate-100'
      : 'border-slate-200 bg-slate-50 text-slate-900';

  return (
    <main className="mx-auto max-w-5xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Bulk User Invitations</h1>
        <p className={`mt-1 text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
          Upload or paste CSV with columns: email, roleName.
        </p>
      </header>

      <section className={`rounded-xl border p-5 ${panelClass}`}>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <label className="text-sm font-medium" htmlFor="bulk-invite-file">CSV file</label>
            <input
              id="bulk-invite-file"
              type="file"
              accept=".csv,text/csv"
              onChange={onFileSelected}
              className="text-sm"
            />
          </div>

          <label className="grid gap-1 text-sm">
            <span className="font-medium">Default role (used when roleName column is empty)</span>
            <select
              value={defaultRoleName}
              onChange={e => setDefaultRoleName(e.target.value as 'ORG_STAFF' | 'ORG_ADMIN')}
              className={`w-56 rounded-lg border px-3 py-2 ${
                theme === 'dark' ? 'border-slate-700 bg-slate-950' : 'border-slate-300 bg-white'
              }`}
            >
              <option value="ORG_STAFF">ORG_STAFF</option>
              <option value="ORG_ADMIN">ORG_ADMIN</option>
            </select>
          </label>

          <label className="grid gap-1 text-sm">
            <span className="font-medium">CSV content</span>
            <textarea
              rows={12}
              value={csvContent}
              onChange={e => setCsvContent(e.target.value)}
              className={`rounded-lg border px-3 py-2 font-mono text-xs ${
                theme === 'dark' ? 'border-slate-700 bg-slate-950' : 'border-slate-300 bg-white'
              }`}
            />
          </label>

          {error && (
            <p className={`rounded-lg border px-3 py-2 text-sm ${
              theme === 'dark'
                ? 'border-rose-500/40 bg-rose-950/40 text-rose-300'
                : 'border-rose-300 bg-rose-100 text-rose-700'
            }`}>
              {error}
            </p>
          )}

          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className={`rounded-lg px-4 py-2 text-sm font-semibold transition disabled:opacity-60 ${
                theme === 'dark'
                  ? 'bg-cyan-400 text-slate-950 hover:bg-cyan-300'
                  : 'bg-blue-600 text-white hover:bg-blue-500'
              }`}
            >
              {isSubmitting ? 'Sending...' : 'Send Bulk Invites'}
            </button>
          </div>
        </form>
      </section>

      {result && (
        <section className={`rounded-xl border p-5 ${panelClass}`}>
          <h2 className="text-lg font-semibold">Result Summary</h2>
          <p className={`mt-1 text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
            Attempted: {result.totals.attempted} | Successful: {result.totals.successful} | Failed: {result.totals.failed}
          </p>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[680px] text-left text-sm">
              <thead>
                <tr className={theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}>
                  <th className="pb-2">Row</th>
                  <th className="pb-2">Email</th>
                  <th className="pb-2">Role</th>
                  <th className="pb-2">Status</th>
                  <th className="pb-2">Message</th>
                </tr>
              </thead>
              <tbody>
                {result.results.map(item => (
                  <tr key={`${item.row}-${item.email}`} className="border-t border-slate-700/30">
                    <td className="py-2">{item.row}</td>
                    <td className="py-2">{item.email}</td>
                    <td className="py-2">{item.roleName}</td>
                    <td className="py-2">{item.success ? 'Success' : 'Failed'}</td>
                    <td className="py-2">{item.message || 'Invite created'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </main>
  );
}
