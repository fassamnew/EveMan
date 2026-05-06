'use client';

import { FormEvent, useState } from 'react';
import { useSearchParams } from 'next/navigation';

type RetrievalResult = {
  referenceCode: string;
  fullName: string;
  email: string;
  event: {
    id: string;
    name: string;
  };
  link: {
    slug: string;
    title: string;
  };
  organization: {
    code: string;
    name: string;
  };
  badgeRedownloadUrl: string;
};

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5001';

export default function RetrieveClient() {
  const query = useSearchParams();
  const [referenceCode, setReferenceCode] = useState(query.get('referenceCode') || '');
  const [email, setEmail] = useState(query.get('email') || '');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RetrievalResult | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setResult(null);

    const url = new URL(`${API_BASE}/public/register/lookup`);
    url.searchParams.set('referenceCode', referenceCode);
    url.searchParams.set('email', email);

    const response = await fetch(url.toString());
    const payload = (await response.json().catch(() => ({}))) as RetrievalResult & { message?: string };

    if (!response.ok) {
      setError(payload.message || 'Unable to find registration.');
      return;
    }

    setResult(payload);
  }

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10 text-slate-100">
      <div className="mx-auto max-w-xl rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
        <h1 className="text-2xl font-semibold">Retrieve Registration</h1>
        <p className="mt-1 text-sm text-slate-300">Enter your reference code and email to re-open your registration details.</p>

        <form className="mt-4 grid gap-3" onSubmit={onSubmit}>
          <input
            required
            value={referenceCode}
            onChange={event => setReferenceCode(event.target.value)}
            placeholder="Reference code"
            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
          />
          <input
            required
            type="email"
            value={email}
            onChange={event => setEmail(event.target.value)}
            placeholder="Email"
            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
          />
          <button type="submit" className="rounded-lg bg-cyan-400 px-4 py-2 font-semibold text-slate-950">
            Retrieve
          </button>
        </form>

        {error ? <p className="mt-4 rounded border border-rose-500/60 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">{error}</p> : null}

        {result ? (
          <div className="mt-5 rounded-xl border border-emerald-500/50 bg-emerald-500/10 p-4">
            <p className="text-lg font-semibold">{result.fullName}</p>
            <p className="text-sm text-emerald-100">{result.email}</p>
            <p className="mt-2 text-sm">Event: {result.event.name}</p>
            <p className="text-sm">Link: {result.link.title}</p>
            <p className="mt-2 text-xs text-emerald-200">Reference: {result.referenceCode}</p>
            <p className="mt-2 text-xs text-emerald-300">Badge re-download URL: {result.badgeRedownloadUrl}</p>
          </div>
        ) : null}
      </div>
    </main>
  );
}
