'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { authFetch } from '../../../lib/session';
import { API_BASE } from '../_lib/constants';
import { CreatedOrganization } from '../_lib/types';
import { useSuperAdminSession } from '../_lib/use-super-admin-session';

export default function SuperAdminOrganizationsPage() {
  const router = useRouter();
  const { ready } = useSuperAdminSession();
  const [orgs, setOrgs] = useState<CreatedOrganization[]>([]);
  const [search, setSearch] = useState('');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!ready) {
      return;
    }

    authFetch(`${API_BASE}/super-admin/organizations`, {}, () => router.replace('/sa'))
      .then(r => (r.ok ? r.json() : []))
      .then((data: CreatedOrganization[]) => {
        if (Array.isArray(data)) {
          setOrgs(data);
        }
      })
      .catch(() => {
        // non-fatal
      });
  }, [ready, router]);

  async function onCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setStatus(null);
    setIsSubmitting(true);

    try {
      const response = await authFetch(`${API_BASE}/super-admin/organizations`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          code: code.trim().toLowerCase()
        })
      }, () => router.replace('/sa'));

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { message?: string | string[] };
        const message = Array.isArray(payload.message) ? payload.message.join(', ') : payload.message;
        setError(message || 'Failed to create organization');
        return;
      }

      const created = (await response.json()) as CreatedOrganization;
      setOrgs(prev => [created, ...prev.filter(item => item.id !== created.id)]);
      setStatus(`Organization created: ${created.name} (${created.code})`);
      setName('');
      setCode('');
    } catch {
      setError('Network error while creating organization');
    } finally {
      setIsSubmitting(false);
    }
  }

  const filtered = orgs.filter(item => {
    const q = search.trim().toLowerCase();
    if (!q) {
      return true;
    }

    return item.name.toLowerCase().includes(q) || item.code.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-6">
      <header className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
        <h1 className="text-2xl font-semibold">Organizations</h1>
        <p className="mt-1 text-sm text-slate-300">Create, search, and manage tenant organizations.</p>
      </header>

      <section className="grid gap-6 lg:grid-cols-[1fr_1.3fr]">
        <article className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
          <h2 className="text-lg font-semibold">Create Organization</h2>
          <form onSubmit={onCreate} className="mt-4 grid gap-3">
            <label className="grid gap-1 text-sm">
              <span className="text-slate-300">Organization name</span>
              <input
                value={name}
                onChange={event => setName(event.target.value)}
                required
                minLength={3}
                maxLength={120}
                className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 outline-none ring-cyan-300 focus:ring"
              />
            </label>

            <label className="grid gap-1 text-sm">
              <span className="text-slate-300">Organization code</span>
              <input
                value={code}
                onChange={event => setCode(event.target.value.toLowerCase())}
                required
                minLength={3}
                maxLength={64}
                className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 outline-none ring-cyan-300 focus:ring"
              />
            </label>

            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-lg bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? 'Creating...' : 'Create organization'}
            </button>
          </form>

          {status ? <p className="mt-4 text-sm text-emerald-300">{status}</p> : null}
          {error ? <p className="mt-2 text-sm text-rose-300">{error}</p> : null}
        </article>

        <article className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Organization List</h2>
            <input
              value={search}
              onChange={event => setSearch(event.target.value)}
              placeholder="Search by name or code"
              className="w-full max-w-56 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none ring-cyan-300 focus:ring"
            />
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950/60">
            <div className="grid grid-cols-[1.4fr_1fr_90px_70px] gap-2 border-b border-slate-800 px-3 py-2 text-[11px] uppercase tracking-wide text-slate-400">
              <span>Organization</span>
              <span>Code</span>
              <span>Status</span>
              <span></span>
            </div>
            {filtered.length === 0 ? (
              <p className="px-3 py-4 text-sm text-slate-300">No organizations found.</p>
            ) : (
              <ul>
                {filtered.map(item => (
                  <li key={item.id} className="grid grid-cols-[1.4fr_1fr_90px_70px] gap-2 border-t border-slate-800 px-3 py-3 text-sm items-center">
                    <span className="truncate">{item.name}</span>
                    <span className="font-mono text-cyan-200">{item.code}</span>
                    <span className="text-emerald-300">{item.isActive === false ? 'inactive' : 'active'}</span>
                    <button
                      type="button"
                      onClick={() => router.push(`/super-admin/orgs/${item.code}`)}
                      className="rounded px-2 py-1 text-xs border border-cyan-600 text-cyan-300 hover:bg-cyan-600/20 transition"
                    >
                      Manage
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </article>
      </section>
    </div>
  );
}
