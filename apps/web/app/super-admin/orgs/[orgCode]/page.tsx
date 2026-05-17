'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { loadSession, authFetch } from '../../../../lib/session';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || '/api';

type OrgMember = {
  id: string;
  user: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    isActive: boolean;
    lastLoginAt: string | null;
  };
  role: { name: string };
};

type PendingInvite = {
  id: string;
  email: string;
  expiresAt: string;
  createdAt: string;
  role: { name: string };
};

type OrgDetail = {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
  createdAt: string;
  userRoles: OrgMember[];
  invites: PendingInvite[];
};

export default function OrgManagementPage() {
  const router = useRouter();
  const params = useParams<{ orgCode: string }>();
  const orgCode = typeof params.orgCode === 'string' ? params.orgCode : '';

  const [token, setToken] = useState('');
  const [org, setOrg] = useState<OrgDetail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'ORG_ADMIN' | 'ORG_STAFF'>('ORG_ADMIN');
  const [inviteStatus, setInviteStatus] = useState<string | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [activationUrl, setActivationUrl] = useState<string | null>(null);
  const [isInviting, setIsInviting] = useState(false);

  const loadOrg = useCallback(async (code: string) => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const res = await authFetch(`${API_BASE}/super-admin/organizations/${code}`, {}, () => router.replace('/sa'));
      if (!res.ok) {
        const payload = (await res.json().catch(() => ({}))) as { message?: string };
        setLoadError(payload.message || 'Failed to load organization');
        return;
      }
      const data = (await res.json()) as OrgDetail;
      setOrg(data);
    } catch {
      setLoadError('Network error loading organization');
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  useEffect(() => {
    const session = loadSession();
    if (!session || !session.roles.includes('SUPER_ADMIN')) {
      router.replace('/sa');
      return;
    }
    setToken(session.accessToken);
    if (orgCode) {
      loadOrg(orgCode);
    }
  }, [orgCode, router, loadOrg]);

  async function onInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setInviteError(null);
    setInviteStatus(null);
    setActivationUrl(null);
    setIsInviting(true);

    try {
      const res = await authFetch(`${API_BASE}/super-admin/organizations/${orgCode}/invite`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail.trim(), roleName: inviteRole })
      }, () => router.replace('/sa'));

      if (!res.ok) {
        const payload = (await res.json().catch(() => ({}))) as { message?: string | string[] };
        const msg = Array.isArray(payload.message) ? payload.message.join(', ') : payload.message;
        setInviteError(msg || 'Failed to send invite');
        return;
      }

      const result = (await res.json()) as { inviteToken: string; email: string; roleName: string };
      const url = `${window.location.origin}/o/${orgCode}/activate?token=${encodeURIComponent(result.inviteToken)}`;
      setActivationUrl(url);
      setInviteStatus(`Invite created for ${result.email} as ${result.roleName}`);
      setInviteEmail('');
      // Reload org to show updated pending invites
      await loadOrg(orgCode);
    } catch {
      setInviteError('Network error sending invite');
    } finally {
      setIsInviting(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl text-slate-100">
        {/* Header */}
        <header className="mb-6 rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-300">
                Platform Control Plane &rsaquo; Organization
              </p>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight">
                {isLoading ? 'Loading…' : (org?.name ?? orgCode)}
              </h1>
              {org && (
                <p className="mt-1 text-sm text-slate-400 font-mono">
                  {org.code} &middot; {org.isActive ? (
                    <span className="text-emerald-300">Active</span>
                  ) : (
                    <span className="text-rose-300">Inactive</span>
                  )} &middot; Created {new Date(org.createdAt).toLocaleDateString()}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => router.push('/super-admin')}
              className="rounded-lg border border-slate-600 px-3 py-2 text-sm text-slate-300 transition hover:bg-slate-800"
            >
              ← Back to dashboard
            </button>
          </div>
        </header>

        {loadError && (
          <p className="mb-4 rounded-lg border border-rose-500/40 bg-rose-950/40 px-4 py-3 text-sm text-rose-300">
            {loadError}
          </p>
        )}

        {isLoading && !loadError && (
          <p className="text-sm text-slate-400">Loading organization data…</p>
        )}

        {org && (
          <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
            {/* Invite user panel */}
            <div className="space-y-6">
              <article className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
                <h2 className="text-lg font-semibold">Invite User</h2>
                <p className="mt-1 text-sm text-slate-400">
                  Send an invite link to add an admin or staff member to this organization.
                </p>

                <form onSubmit={onInvite} className="mt-4 grid gap-3">
                  <label className="grid gap-1 text-sm">
                    <span className="text-slate-300">Email address</span>
                    <input
                      type="email"
                      value={inviteEmail}
                      onChange={e => setInviteEmail(e.target.value)}
                      required
                      maxLength={320}
                      placeholder="user@example.com"
                      className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 outline-none ring-cyan-300 focus:ring"
                    />
                  </label>

                  <label className="grid gap-1 text-sm">
                    <span className="text-slate-300">Role</span>
                    <select
                      value={inviteRole}
                      onChange={e => setInviteRole(e.target.value as 'ORG_ADMIN' | 'ORG_STAFF')}
                      className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 outline-none ring-cyan-300 focus:ring"
                    >
                      <option value="ORG_ADMIN">ORG_ADMIN — Full org management</option>
                      <option value="ORG_STAFF">ORG_STAFF — Limited access</option>
                    </select>
                  </label>

                  <button
                    type="submit"
                    disabled={isInviting}
                    className="mt-1 rounded-lg bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isInviting ? 'Sending…' : 'Send invite'}
                  </button>
                </form>

                {inviteStatus && (
                  <p className="mt-3 text-sm text-emerald-300">{inviteStatus}</p>
                )}
                {activationUrl && (
                  <div className="mt-3 rounded-lg border border-cyan-700/40 bg-cyan-950/40 p-3">
                    <p className="text-xs font-semibold text-cyan-300 uppercase tracking-wide mb-1">Activation link (share with user)</p>
                    <p className="break-all font-mono text-xs text-slate-200 mb-2">{activationUrl}</p>
                    <button
                      type="button"
                      onClick={() => navigator.clipboard.writeText(activationUrl)}
                      className="rounded px-2 py-1 text-xs border border-cyan-600 text-cyan-300 hover:bg-cyan-600/20 transition"
                    >
                      Copy link
                    </button>
                  </div>
                )}
                {inviteError && (
                  <p className="mt-3 text-sm text-rose-300">{inviteError}</p>
                )}
              </article>

              {/* Pending Invites */}
              <article className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
                <h2 className="text-lg font-semibold">Pending Invites</h2>
                <p className="mt-1 text-sm text-slate-400">
                  Invites not yet accepted that are still valid.
                </p>
                {org.invites.length === 0 ? (
                  <p className="mt-3 text-sm text-slate-500">No pending invites.</p>
                ) : (
                  <ul className="mt-3 space-y-2">
                    {org.invites.map(inv => (
                      <li key={inv.id} className="rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2">
                        <p className="text-sm font-medium">{inv.email}</p>
                        <p className="mt-0.5 text-xs text-slate-400">
                          {inv.role.name} &middot; Expires {new Date(inv.expiresAt).toLocaleDateString()}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </article>
            </div>

            {/* Members table */}
            <article className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
              <h2 className="text-lg font-semibold">Members</h2>
              <p className="mt-1 mb-4 text-sm text-slate-400">
                {org.userRoles.length} member{org.userRoles.length !== 1 ? 's' : ''} in this organization.
              </p>

              {org.userRoles.length === 0 ? (
                <p className="text-sm text-slate-500">No members yet. Invite users above.</p>
              ) : (
                <div className="rounded-xl border border-slate-800 bg-slate-950/60 overflow-hidden">
                  <div className="grid grid-cols-[1fr_100px_80px] gap-2 border-b border-slate-800 px-3 py-2 text-[11px] uppercase tracking-wide text-slate-400">
                    <span>User</span>
                    <span>Role</span>
                    <span>Status</span>
                  </div>
                  <ul>
                    {org.userRoles.map(member => (
                      <li key={member.id} className="grid grid-cols-[1fr_100px_80px] gap-2 border-t border-slate-800 px-3 py-3">
                        <div>
                          <p className="text-sm truncate">
                            {member.user.firstName || member.user.lastName
                              ? `${member.user.firstName ?? ''} ${member.user.lastName ?? ''}`.trim()
                              : member.user.email}
                          </p>
                          <p className="text-xs text-slate-400 truncate">{member.user.email}</p>
                          {member.user.lastLoginAt && (
                            <p className="text-xs text-slate-500">
                              Last login {new Date(member.user.lastLoginAt).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                        <span className="self-center text-xs font-mono text-cyan-200">
                          {member.role.name}
                        </span>
                        <span className={`self-center text-xs ${member.user.isActive ? 'text-emerald-300' : 'text-rose-300'}`}>
                          {member.user.isActive ? 'active' : 'inactive'}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </article>
          </div>
        )}
    </div>
  );
}
