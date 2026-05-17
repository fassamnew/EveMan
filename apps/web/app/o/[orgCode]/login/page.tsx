'use client';

import { FormEvent, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { clearSession, loadSession, saveSession } from '../../../../lib/session';

type LoginResponse = {
  accessToken: string;
  refreshToken: string;
  user: {
    email: string;
    roles: string[];
    organizationId: string | null;
    organizationCode: string | null;
  };
};

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || '/api';

export default function OrgLoginPage() {
  const router = useRouter();
  const params = useParams<{ orgCode: string }>();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const orgCode = params.orgCode;
  const normalizedOrgCode = useMemo(() => (typeof orgCode === 'string' ? orgCode : ''), [orgCode]);

  useEffect(() => {
    if (!normalizedOrgCode) return;

    const session = loadSession();

    if (session) {
      if (session.roles.includes('SUPER_ADMIN')) {
        router.replace('/super-admin');
      } else if (session.organizationCode === normalizedOrgCode) {
        router.replace(`/o/${normalizedOrgCode}`);
      } else {
        clearSession();
      }
    }
  }, [normalizedOrgCode, router]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!normalizedOrgCode) return;

    setError(null);
    setIsSubmitting(true);

    try {
      const response = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          orgCode: normalizedOrgCode
        })
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { message?: string };
        setError(payload.message || 'Login failed');
        return;
      }

      const payload = (await response.json()) as LoginResponse;

      if (payload.user.organizationCode !== normalizedOrgCode) {
        setError('Credentials are valid but not for this organization portal');
        return;
      }

      saveSession({
        accessToken: payload.accessToken,
        refreshToken: payload.refreshToken,
        organizationId: payload.user.organizationId,
        organizationCode: payload.user.organizationCode,
        roles: payload.user.roles,
        email: payload.user.email
      });

      setPassword('');
      setError(null);
      router.push(`/o/${normalizedOrgCode}`);
    } catch {
      setError('Network error while attempting login');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100">
      <div className="mx-auto flex min-h-screen w-full max-w-2xl items-center px-6 py-10">
        <section className="w-full space-y-8 rounded-3xl border border-slate-800 bg-slate-900/70 p-8 shadow-2xl shadow-cyan-900/20 backdrop-blur">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-300">Organization Portal</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight">{normalizedOrgCode || 'organization'} Sign in</h1>
            <p className="mt-4 text-sm text-slate-300">
              This login page is scoped to <span className="font-semibold text-cyan-200">/o/{normalizedOrgCode}</span>.
            </p>
          </div>

          <form onSubmit={onSubmit} className="grid gap-4">
            <label className="grid gap-1 text-sm">
              <span className="text-slate-300">Email</span>
              <input
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                type="email"
                required
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 outline-none ring-cyan-300 focus:ring"
              />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="text-slate-300">Password</span>
              <input
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                type="password"
                required
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 outline-none ring-cyan-300 focus:ring"
              />
            </label>

            <button
              disabled={isSubmitting}
              type="submit"
              className="mt-2 rounded-xl bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? 'Signing in...' : 'Sign in to Organization Portal'}
            </button>

            {error && <p className="text-sm text-red-300">{error}</p>}
          </form>
        </section>
      </div>
    </main>
  );
}
