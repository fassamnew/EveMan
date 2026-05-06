'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { loadSession } from '../../../../lib/session';

type EventItem = {
  id: string;
  name: string;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  createdAt: string;
};

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5001';

export default function OrgEventsPage() {
  const router = useRouter();
  const params = useParams<{ orgCode: string }>();
  const orgCode = params.orgCode;
  const [events, setEvents] = useState<EventItem[]>([]);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function fetchEvents(): Promise<void> {
    const session = loadSession();
    if (!session) {
      router.replace(`/o/${orgCode}`);
      return;
    }

    if (session.organizationCode !== orgCode && !session.roles.includes('SUPER_ADMIN')) {
      router.replace(`/o/${orgCode}`);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/org/${orgCode}/events`, {
        headers: {
          Authorization: `Bearer ${session.accessToken}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to load events');
      }

      const payload = (await response.json()) as EventItem[];
      setEvents(payload);
    } catch {
      setError('Unable to load events');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    if (!orgCode) {
      return;
    }

    void fetchEvents();
  }, [orgCode]);

  async function onCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const session = loadSession();
    if (!session) {
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/org/${orgCode}/events`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          Authorization: `Bearer ${session.accessToken}`
        },
        body: JSON.stringify({ name })
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { message?: string };
        setError(payload.message || 'Failed to create event');
        return;
      }

      setName('');
      await fetchEvents();
    } catch {
      setError('Network error while creating event');
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10 text-slate-100">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-3xl font-semibold tracking-tight">Event Management</h1>
          <button
            type="button"
            onClick={() => router.push(`/o/${orgCode}`)}
            className="rounded-lg border border-slate-700 px-3 py-1 text-sm"
          >
            Back to portal
          </button>
        </div>

        <form onSubmit={onCreate} className="mb-6 grid gap-3 rounded-xl border border-slate-800 bg-slate-900/60 p-4 md:grid-cols-[1fr_auto]">
          <input
            value={name}
            onChange={event => setName(event.target.value)}
            required
            placeholder="New event name"
            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
          />
          <button
            type="submit"
            className="rounded-lg bg-cyan-400 px-4 py-2 font-semibold text-slate-950"
          >
            Create event
          </button>
        </form>

        {error ? <p className="mb-4 text-sm text-red-300">{error}</p> : null}

        <section className="rounded-xl border border-slate-800 bg-slate-900/60">
          <div className="border-b border-slate-800 px-4 py-3 text-sm font-semibold">Events</div>
          {isLoading ? <p className="px-4 py-4 text-sm text-slate-300">Loading...</p> : null}
          {!isLoading && events.length === 0 ? (
            <p className="px-4 py-4 text-sm text-slate-300">No events yet.</p>
          ) : null}
          {!isLoading && events.length > 0 ? (
            <ul>
              {events.map(item => (
                <li key={item.id} className="flex items-center justify-between border-t border-slate-800 px-4 py-3 text-sm">
                  <div>
                    <p className="font-medium">{item.name}</p>
                    <p className="text-slate-400">{item.status}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => router.push(`/o/${orgCode}/events/${item.id}/links`)}
                    className="rounded-md border border-slate-700 px-3 py-1"
                  >
                    Manage links
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      </div>
    </main>
  );
}
