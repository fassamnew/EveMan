'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5001';

export default function ActivateInvitePage() {
  const router = useRouter();
  const params = useParams<{ orgCode: string }>();
  const searchParams = useSearchParams();
  const orgCode = typeof params.orgCode === 'string' ? params.orgCode : '';
  const tokenFromUrl = searchParams.get('token') ?? '';

  const [token, setToken] = useState(tokenFromUrl);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (tokenFromUrl) setToken(tokenFromUrl);
  }, [tokenFromUrl]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      const res = await fetch(`${API_BASE}/org/${orgCode}/users/activate`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token: token.trim(), password, firstName: firstName.trim(), lastName: lastName.trim() })
      });

      if (!res.ok) {
        const payload = (await res.json().catch(() => ({}))) as { message?: string | string[] };
        const msg = Array.isArray(payload.message) ? payload.message.join(', ') : payload.message;
        setError(msg || 'Activation failed');
        return;
      }

      setDone(true);
      // After 2s redirect to org login
      setTimeout(() => router.replace(`/o/${orgCode}`), 2000);
    } catch {
      setError('Network error during activation');
    } finally {
      setIsSubmitting(false);
    }
  }

  if (done) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center px-6">
        <div className="text-center">
          <div className="text-4xl mb-4">✓</div>
          <h1 className="text-2xl font-semibold text-emerald-300">Account activated!</h1>
          <p className="mt-2 text-slate-400">Redirecting to your organization portal…</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto flex min-h-screen w-full max-w-lg items-center px-6 py-10">
        <section className="w-full rounded-3xl border border-slate-800 bg-slate-900/70 p-8 shadow-2xl shadow-cyan-900/20 backdrop-blur">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-300">Organization Portal</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">Accept your invitation</h1>
          <p className="mt-2 text-sm text-slate-400">
            You&apos;ve been invited to{' '}
            <span className="font-semibold text-cyan-200">{orgCode}</span>. Set up your account below.
          </p>

          <form onSubmit={onSubmit} className="mt-6 grid gap-4">
            {!tokenFromUrl && (
              <label className="grid gap-1 text-sm">
                <span className="text-slate-300">Invite token</span>
                <input
                  value={token}
                  onChange={e => setToken(e.target.value)}
                  required
                  placeholder="Paste your invite token"
                  className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-xs outline-none ring-cyan-300 focus:ring"
                />
              </label>
            )}

            <div className="grid grid-cols-2 gap-3">
              <label className="grid gap-1 text-sm">
                <span className="text-slate-300">First name</span>
                <input
                  value={firstName}
                  onChange={e => setFirstName(e.target.value)}
                  required
                  maxLength={80}
                  className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 outline-none ring-cyan-300 focus:ring"
                />
              </label>
              <label className="grid gap-1 text-sm">
                <span className="text-slate-300">Last name</span>
                <input
                  value={lastName}
                  onChange={e => setLastName(e.target.value)}
                  required
                  maxLength={80}
                  className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 outline-none ring-cyan-300 focus:ring"
                />
              </label>
            </div>

            <label className="grid gap-1 text-sm">
              <span className="text-slate-300">Password</span>
              <input
                value={password}
                onChange={e => setPassword(e.target.value)}
                type="password"
                required
                minLength={8}
                maxLength={128}
                className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 outline-none ring-cyan-300 focus:ring"
              />
            </label>

            <label className="grid gap-1 text-sm">
              <span className="text-slate-300">Confirm password</span>
              <input
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                type="password"
                required
                minLength={8}
                className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 outline-none ring-cyan-300 focus:ring"
              />
            </label>

            {error && (
              <p className="rounded-lg border border-rose-500/40 bg-rose-950/40 px-3 py-2 text-sm text-rose-300">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="mt-1 rounded-xl bg-cyan-400 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? 'Activating…' : 'Activate account & continue'}
            </button>
          </form>

          <p className="mt-4 text-xs text-slate-500 text-center">
            Already have an account?{' '}
            <button
              type="button"
              onClick={() => router.push(`/o/${orgCode}`)}
              className="text-cyan-400 hover:underline"
            >
              Sign in here
            </button>
          </p>
        </section>
      </div>
    </main>
  );
}
