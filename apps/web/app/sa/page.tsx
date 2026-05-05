'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { saveSession, loadSession } from '../../lib/session';

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

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5001';

export default function SuperAdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const session = loadSession();
    if (session?.roles.includes('SUPER_ADMIN')) {
      router.replace('/super-admin');
    }
  }, [router]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const response = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          email,
          password
        })
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { message?: string };
        setError(payload.message || 'Login failed');
        return;
      }

      const payload = (await response.json()) as LoginResponse;
      if (!payload.user.roles.includes('SUPER_ADMIN')) {
        setError('This account is not a Super Admin account');
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

      router.push('/super-admin');
    } catch {
      setError('Network error while attempting login');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto flex min-h-screen w-full max-w-2xl items-center px-6 py-10">
        <section className="w-full rounded-3xl border border-slate-800 bg-slate-900/70 p-8 shadow-2xl shadow-cyan-900/20 backdrop-blur">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-300">Super Admin Portal</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight">Sign in</h1>
          <p className="mt-4 text-sm text-slate-300">This login is only for platform Super Admin accounts.</p>

          <form onSubmit={onSubmit} className="mt-6 grid gap-4">
            <label className="grid gap-1 text-sm">
              <span className="text-slate-300">Email</span>
              <input
                value={email}
                onChange={event => setEmail(event.target.value)}
                type="email"
                required
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 outline-none ring-cyan-300 focus:ring"
              />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="text-slate-300">Password</span>
              <input
                value={password}
                onChange={event => setPassword(event.target.value)}
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
              {isSubmitting ? 'Signing in...' : 'Sign in as Super Admin'}
            </button>

            {error ? <p className="text-sm text-red-300">{error}</p> : null}
          </form>
        </section>
      </div>
    </main>
  );
}
