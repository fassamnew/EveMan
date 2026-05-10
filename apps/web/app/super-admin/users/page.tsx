'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { authFetch } from '../../../lib/session';
import { API_BASE } from '../_lib/constants';
import { SystemUser } from '../_lib/types';
import { useSuperAdminSession } from '../_lib/use-super-admin-session';

export default function SuperAdminUsersPage() {
  const router = useRouter();
  const { ready } = useSuperAdminSession();
  const [users, setUsers] = useState<SystemUser[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!ready) {
      return;
    }

    authFetch(`${API_BASE}/super-admin/system/users`, {}, () => router.replace('/sa'))
      .then(r => (r.ok ? r.json() : []))
      .then((data: SystemUser[]) => {
        if (Array.isArray(data)) {
          setUsers(data);
        }
      })
      .catch(() => {
        // non-fatal
      });
  }, [ready, router]);

  async function toggleUserStatus(user: SystemUser) {
    setError(null);
    setStatus(null);

    try {
      const response = await authFetch(`${API_BASE}/super-admin/system/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ isActive: !user.isActive })
      }, () => router.replace('/sa'));

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { message?: string | string[] };
        const message = Array.isArray(payload.message) ? payload.message.join(', ') : payload.message;
        setError(message || 'Failed to update user status');
        return;
      }

      const updated = (await response.json()) as { id: string; isActive: boolean };
      setUsers(prev => prev.map(item => (item.id === updated.id ? { ...item, isActive: updated.isActive } : item)));
      setStatus(`Updated user ${user.email} to ${updated.isActive ? 'active' : 'inactive'}.`);
    } catch {
      setError('Network error while updating user status');
    }
  }

  return (
    <div className="space-y-6">
      <header className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
        <h1 className="text-2xl font-semibold">System Users</h1>
        <p className="mt-1 text-sm text-slate-300">Manage platform user activation status.</p>
      </header>

      {status ? <p className="text-sm text-emerald-300">{status}</p> : null}
      {error ? <p className="text-sm text-rose-300">{error}</p> : null}

      <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
        <div className="rounded-xl border border-slate-800 bg-slate-950/60">
          <div className="grid grid-cols-[1.4fr_1fr_88px] gap-2 border-b border-slate-800 px-3 py-2 text-[11px] uppercase tracking-wide text-slate-400">
            <span>User</span>
            <span>Roles</span>
            <span></span>
          </div>
          {users.length === 0 ? (
            <p className="px-3 py-4 text-sm text-slate-300">No users found.</p>
          ) : (
            <ul>
              {users.map(user => (
                <li key={user.id} className="grid grid-cols-[1.4fr_1fr_88px] gap-2 border-t border-slate-800 px-3 py-3 text-sm items-start">
                  <div>
                    <p className="truncate text-slate-100">
                      {user.firstName || user.lastName
                        ? `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim()
                        : user.email}
                    </p>
                    <p className="truncate text-xs text-slate-400">{user.email}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {user.isActive ? 'Active' : 'Inactive'}
                      {user.lastLoginAt ? ` · Last login ${new Date(user.lastLoginAt).toLocaleDateString()}` : ''}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {user.userRoles.map((role, index) => (
                      <span key={`${user.id}-${role.role.name}-${index}`} className="rounded-full border border-cyan-800/70 px-2 py-1 text-[11px] text-cyan-200">
                        {role.role.name}
                        {role.organization ? `:${role.organization.code}` : ''}
                      </span>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => void toggleUserStatus(user)}
                    className="rounded border border-slate-600 px-2 py-1 text-xs text-slate-200 transition hover:bg-slate-800"
                  >
                    {user.isActive ? 'Disable' : 'Enable'}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
