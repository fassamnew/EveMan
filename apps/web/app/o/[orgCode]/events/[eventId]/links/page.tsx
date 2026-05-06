'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { loadSession } from '../../../../../../lib/session';

type LinkItem = {
  id: string;
  slug: string;
  title: string;
  rule?: {
    visibility: 'PUBLIC' | 'UNLISTED' | 'PRIVATE';
    approvalMode: 'AUTO' | 'MANUAL';
    capacity: number | null;
  } | null;
};

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5001';

export default function EventLinksPage() {
  const router = useRouter();
  const params = useParams<{ orgCode: string; eventId: string }>();
  const { orgCode, eventId } = params;
  const [links, setLinks] = useState<LinkItem[]>([]);
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function fetchLinks() {
    const session = loadSession();
    if (!session) {
      router.replace(`/o/${orgCode}`);
      return;
    }

    const response = await fetch(`${API_BASE}/org/${orgCode}/events/${eventId}/links`, {
      headers: {
        Authorization: `Bearer ${session.accessToken}`
      }
    });

    if (!response.ok) {
      setError('Failed to load links');
      return;
    }

    setLinks((await response.json()) as LinkItem[]);
  }

  useEffect(() => {
    if (!orgCode || !eventId) {
      return;
    }

    void fetchLinks();
  }, [orgCode, eventId]);

  async function onCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const session = loadSession();
    if (!session) {
      return;
    }

    const response = await fetch(`${API_BASE}/org/${orgCode}/events/${eventId}/links`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        Authorization: `Bearer ${session.accessToken}`
      },
      body: JSON.stringify({
        title,
        slug,
        visibility: 'PUBLIC',
        approvalMode: 'AUTO'
      })
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as { message?: string };
      setError(payload.message || 'Failed to create link');
      return;
    }

    setTitle('');
    setSlug('');
    await fetchLinks();
  }

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10 text-slate-100">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-3xl font-semibold tracking-tight">Registration Links</h1>
          <button
            type="button"
            onClick={() => router.push(`/o/${orgCode}/events`)}
            className="rounded-lg border border-slate-700 px-3 py-1 text-sm"
          >
            Back to events
          </button>
        </div>

        <form onSubmit={onCreate} className="mb-6 grid gap-3 rounded-xl border border-slate-800 bg-slate-900/60 p-4 md:grid-cols-3">
          <input
            value={title}
            onChange={event => setTitle(event.target.value)}
            required
            placeholder="Link title"
            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
          />
          <input
            value={slug}
            onChange={event => setSlug(event.target.value)}
            required
            placeholder="vip-registration"
            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
          />
          <button type="submit" className="rounded-lg bg-cyan-400 px-4 py-2 font-semibold text-slate-950">
            Create link
          </button>
        </form>

        {error ? <p className="mb-4 text-sm text-red-300">{error}</p> : null}

        <section className="rounded-xl border border-slate-800 bg-slate-900/60">
          <div className="border-b border-slate-800 px-4 py-3 text-sm font-semibold">Links</div>
          {links.length === 0 ? <p className="px-4 py-4 text-sm text-slate-300">No links yet.</p> : null}
          {links.length > 0 ? (
            <ul>
              {links.map(item => (
                <li key={item.id} className="border-t border-slate-800 px-4 py-3 text-sm">
                  <p className="font-medium">{item.title}</p>
                  <p className="text-slate-400">/{item.slug}</p>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      </div>
    </main>
  );
}
