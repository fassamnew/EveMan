'use client';

import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';

export default function LoginPage() {
  const router = useRouter();
  const [orgCode, setOrgCode] = useState('');

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!orgCode.trim()) {
      return;
    }

    router.push(`/o/${orgCode.trim()}`);
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl items-center px-6 py-10">
        <section className="grid w-full gap-8 lg:grid-cols-2">
          <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-8 shadow-2xl shadow-cyan-900/20 backdrop-blur">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-300">EveMange Access</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight">Choose Login Portal</h1>
            <p className="mt-4 text-sm text-slate-300">
              Super Admin and Organization login pages are now split by URL.
            </p>

            <form onSubmit={onSubmit} className="mt-6 grid gap-4">
              <label className="grid gap-1 text-sm">
                <span className="text-slate-300">Organization Code</span>
                <input
                  value={orgCode}
                  onChange={event => setOrgCode(event.target.value)}
                  placeholder="acme"
                  required
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 outline-none ring-cyan-300 focus:ring"
                />
              </label>

              <button
                type="submit"
                className="mt-2 rounded-xl bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Go to Organization Login
              </button>
            </form>

            <button
              type="button"
              onClick={() => router.push('/sa')}
              className="mt-3 w-full rounded-xl border border-cyan-400/40 px-4 py-2 text-sm font-semibold text-cyan-200 transition hover:border-cyan-300 hover:text-cyan-100"
            >
              Go to Super Admin Login
            </button>
          </div>

          <aside className="rounded-3xl border border-cyan-900/40 bg-gradient-to-br from-cyan-500/20 via-teal-400/10 to-slate-900 p-8">
            <h2 className="text-2xl font-semibold">Access model</h2>
            <ul className="mt-4 space-y-3 text-sm text-slate-200">
              <li>Super Admin login URL: /sa</li>
              <li>Organization login URL: /o/:orgCode</li>
              <li>Organization users authenticate with organization ID on that route.</li>
            </ul>
          </aside>
        </section>
      </div>
    </main>
  );
}
