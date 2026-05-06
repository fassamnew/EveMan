'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { loadSession } from '../../../../../../lib/session';

type LinkItem = {
  id: string;
  slug: string;
  title: string;
  isActive: boolean;
  rule?: {
    visibility: 'PUBLIC' | 'UNLISTED' | 'PRIVATE';
    approvalMode: 'AUTO' | 'MANUAL';
    capacity: number | null;
    opensAt: string | null;
    closesAt: string | null;
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
  const [visibility, setVisibility] = useState<'PUBLIC' | 'UNLISTED' | 'PRIVATE'>('PUBLIC');
  const [approvalMode, setApprovalMode] = useState<'AUTO' | 'MANUAL'>('AUTO');
  const [capacity, setCapacity] = useState('');
  const [opensAt, setOpensAt] = useState('');
  const [closesAt, setClosesAt] = useState('');
  const [error, setError] = useState<string | null>(null);

  function readMessage(payload: unknown, fallback: string): string {
    if (!payload || typeof payload !== 'object') {
      return fallback;
    }

    const response = payload as { message?: string; suggestions?: string[] };
    if (!response.message) {
      return fallback;
    }

    if (Array.isArray(response.suggestions) && response.suggestions.length > 0) {
      return `${response.message}. Try: ${response.suggestions.join(', ')}`;
    }

    return response.message;
  }

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
        visibility,
        approvalMode,
        capacity: capacity ? Number(capacity) : undefined,
        opensAt: opensAt || undefined,
        closesAt: closesAt || undefined
      })
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      setError(readMessage(payload, 'Failed to create link'));
      return;
    }

    setTitle('');
    setSlug('');
    setVisibility('PUBLIC');
    setApprovalMode('AUTO');
    setCapacity('');
    setOpensAt('');
    setClosesAt('');
    await fetchLinks();
  }

  async function updateLink(input: {
    linkId: string;
    title: string;
    visibility: 'PUBLIC' | 'UNLISTED' | 'PRIVATE';
    approvalMode: 'AUTO' | 'MANUAL';
    capacity: number | null;
    opensAt?: string | null;
    closesAt?: string | null;
    isActive: boolean;
  }) {
    const session = loadSession();
    if (!session) {
      return;
    }

    const response = await fetch(`${API_BASE}/org/${orgCode}/events/${eventId}/links/${input.linkId}`, {
      method: 'PATCH',
      headers: {
        'content-type': 'application/json',
        Authorization: `Bearer ${session.accessToken}`
      },
      body: JSON.stringify({
        title: input.title,
        visibility: input.visibility,
        approvalMode: input.approvalMode,
        capacity: input.capacity,
        opensAt: input.opensAt,
        closesAt: input.closesAt,
        isActive: input.isActive
      })
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      setError(readMessage(payload, 'Failed to update link'));
      return;
    }

    await fetchLinks();
  }

  async function deleteLink(linkId: string) {
    const session = loadSession();
    if (!session) {
      return;
    }

    const response = await fetch(`${API_BASE}/org/${orgCode}/events/${eventId}/links/${linkId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${session.accessToken}`
      }
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      setError(readMessage(payload, 'Failed to delete link'));
      return;
    }

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

        <form onSubmit={onCreate} className="mb-6 grid gap-3 rounded-xl border border-slate-800 bg-slate-900/60 p-4 md:grid-cols-7">
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
          <select
            value={visibility}
            onChange={event => setVisibility(event.target.value as 'PUBLIC' | 'UNLISTED' | 'PRIVATE')}
            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
          >
            <option value="PUBLIC">PUBLIC</option>
            <option value="UNLISTED">UNLISTED</option>
            <option value="PRIVATE">PRIVATE</option>
          </select>
          <input
            value={capacity}
            onChange={event => setCapacity(event.target.value)}
            placeholder="Capacity"
            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
          />
          <input
            value={opensAt}
            onChange={event => setOpensAt(event.target.value)}
            placeholder="Opens at (ISO)"
            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
          />
          <input
            value={closesAt}
            onChange={event => setClosesAt(event.target.value)}
            placeholder="Closes at (ISO)"
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
                  <div className="grid gap-3 md:grid-cols-9">
                    <input
                      defaultValue={item.title}
                      id={`title-${item.id}`}
                      className="rounded border border-slate-700 bg-slate-950 px-2 py-1"
                    />
                    <div className="rounded border border-slate-800 px-2 py-1 text-slate-400">/{item.slug}</div>
                    <select
                      id={`visibility-${item.id}`}
                      defaultValue={item.rule?.visibility || 'PUBLIC'}
                      className="rounded border border-slate-700 bg-slate-950 px-2 py-1"
                    >
                      <option value="PUBLIC">PUBLIC</option>
                      <option value="UNLISTED">UNLISTED</option>
                      <option value="PRIVATE">PRIVATE</option>
                    </select>
                    <select
                      id={`approval-${item.id}`}
                      defaultValue={item.rule?.approvalMode || 'AUTO'}
                      className="rounded border border-slate-700 bg-slate-950 px-2 py-1"
                    >
                      <option value="AUTO">AUTO</option>
                      <option value="MANUAL">MANUAL</option>
                    </select>
                    <input
                      id={`capacity-${item.id}`}
                      defaultValue={item.rule?.capacity ?? ''}
                      placeholder="Capacity"
                      className="rounded border border-slate-700 bg-slate-950 px-2 py-1"
                    />
                    <input
                      id={`opensAt-${item.id}`}
                      defaultValue={item.rule?.opensAt ?? ''}
                      placeholder="Opens at (ISO)"
                      className="rounded border border-slate-700 bg-slate-950 px-2 py-1"
                    />
                    <input
                      id={`closesAt-${item.id}`}
                      defaultValue={item.rule?.closesAt ?? ''}
                      placeholder="Closes at (ISO)"
                      className="rounded border border-slate-700 bg-slate-950 px-2 py-1"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const titleInput = document.getElementById(`title-${item.id}`) as HTMLInputElement | null;
                        const visibilityInput = document.getElementById(`visibility-${item.id}`) as HTMLSelectElement | null;
                        const approvalInput = document.getElementById(`approval-${item.id}`) as HTMLSelectElement | null;
                        const capacityInput = document.getElementById(`capacity-${item.id}`) as HTMLInputElement | null;
                        const opensAtInput = document.getElementById(`opensAt-${item.id}`) as HTMLInputElement | null;
                        const closesAtInput = document.getElementById(`closesAt-${item.id}`) as HTMLInputElement | null;

                        void updateLink({
                          linkId: item.id,
                          title: titleInput?.value || item.title,
                          visibility: (visibilityInput?.value as 'PUBLIC' | 'UNLISTED' | 'PRIVATE') || 'PUBLIC',
                          approvalMode: (approvalInput?.value as 'AUTO' | 'MANUAL') || 'AUTO',
                          capacity: capacityInput?.value ? Number(capacityInput.value) : null,
                          opensAt: opensAtInput?.value ? opensAtInput.value : null,
                          closesAt: closesAtInput?.value ? closesAtInput.value : null,
                          isActive: item.isActive
                        });
                      }}
                      className="rounded border border-cyan-500 px-2 py-1 text-cyan-200"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        void deleteLink(item.id);
                      }}
                      className="rounded border border-rose-500 px-2 py-1 text-rose-200"
                    >
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      </div>
    </main>
  );
}
