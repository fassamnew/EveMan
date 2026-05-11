'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { loadSession } from '../../../../lib/session';

type AttendeeStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

type AttendeeItem = {
  id: string;
  referenceCode: string;
  fullName: string;
  email: string;
  lifecycleStatus: AttendeeStatus;
  createdAt: string;
  latestBadge: {
    id: string;
    status: string;
  } | null;
};

type AttendeeListResponse = {
  items: AttendeeItem[];
  pagination: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
};

type AttendeeCommunicationItem = {
  id: string;
  channel: 'EMAIL' | 'SMS';
  status: 'QUEUED' | 'SENT' | 'FAILED';
  recipientAddress: string;
  errorMessage: string | null;
  createdAt: string;
  sentAt: string | null;
  template: {
    id: string;
    name: string;
    channel: 'EMAIL' | 'SMS';
  } | null;
};

type AttendeeCommunicationResponse = {
  items: AttendeeCommunicationItem[];
  pagination: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
};

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5001';

export default function AttendeesPage() {
  const params = useParams<{ orgCode: string }>();
  const router = useRouter();
  const orgCode = params.orgCode;

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'ALL' | AttendeeStatus>('ALL');
  const [attendees, setAttendees] = useState<AttendeeItem[]>([]);
  const [pagination, setPagination] = useState<AttendeeListResponse['pagination']>({
    total: 0,
    page: 1,
    pageSize: 20,
    totalPages: 1
  });
  const [editById, setEditById] = useState<Record<string, { fullName: string; email: string }>>({});
  const [openHistoryById, setOpenHistoryById] = useState<Record<string, boolean>>({});
  const [historyById, setHistoryById] = useState<Record<string, AttendeeCommunicationItem[]>>({});
  const [historyLoadingById, setHistoryLoadingById] = useState<Record<string, boolean>>({});
  const [historyFilterById, setHistoryFilterById] = useState<Record<string, 'ALL' | 'QUEUED' | 'SENT' | 'FAILED'>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function getSessionToken(): string | null {
    const session = loadSession();
    if (!session) {
      router.replace(`/o/${orgCode}`);
      return null;
    }

    return session.accessToken;
  }

  async function fetchAttendees(page = 1): Promise<void> {
    const token = getSessionToken();
    if (!token) {
      return;
    }

    setIsLoading(true);
    setError(null);

    const query = new URLSearchParams();
    query.set('page', String(page));
    query.set('pageSize', '20');
    if (search.trim()) {
      query.set('search', search.trim());
    }
    if (status !== 'ALL') {
      query.set('status', status);
    }

    try {
      const response = await fetch(`${API_BASE}/org/${orgCode}/attendees?${query.toString()}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to load attendees');
      }

      const payload = (await response.json()) as AttendeeListResponse;
      setAttendees(payload.items);
      setPagination(payload.pagination);

      const nextEdits: Record<string, { fullName: string; email: string }> = {};
      for (const item of payload.items) {
        nextEdits[item.id] = { fullName: item.fullName, email: item.email };
      }
      setEditById(nextEdits);
    } catch {
      setError('Unable to load attendees');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    if (!orgCode) {
      return;
    }

    void fetchAttendees(1);
  }, [orgCode]);

  async function updateAttendee(attendeeId: string): Promise<void> {
    const token = getSessionToken();
    if (!token) {
      return;
    }

    const edit = editById[attendeeId];
    if (!edit) {
      return;
    }

    setError(null);

    const response = await fetch(`${API_BASE}/org/${orgCode}/attendees/${attendeeId}`, {
      method: 'PATCH',
      headers: {
        'content-type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        fullName: edit.fullName,
        email: edit.email
      })
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as { message?: string };
      setError(payload.message || 'Failed to update attendee');
      return;
    }

    await fetchAttendees(pagination.page);
  }

  async function transitionAttendee(attendeeId: string, action: 'approve' | 'reject' | 'resend-badge') {
    const token = getSessionToken();
    if (!token) {
      return;
    }

    setError(null);

    const response = await fetch(`${API_BASE}/org/${orgCode}/attendees/${attendeeId}/${action}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as { message?: string };
      setError(payload.message || `Failed to ${action}`);
      return;
    }

    await fetchAttendees(pagination.page);
  }

  async function onSearch(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    await fetchAttendees(1);
  }

  async function loadCommunicationHistory(attendeeId: string, statusFilter: 'ALL' | 'QUEUED' | 'SENT' | 'FAILED') {
    const token = getSessionToken();
    if (!token) {
      return;
    }

    setHistoryLoadingById(current => ({ ...current, [attendeeId]: true }));

    const query = new URLSearchParams();
    query.set('page', '1');
    query.set('pageSize', '20');
    if (statusFilter !== 'ALL') {
      query.set('status', statusFilter);
    }

    try {
      const response = await fetch(
        `${API_BASE}/org/${orgCode}/attendees/${attendeeId}/communications?${query.toString()}`,
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { message?: string };
        setError(payload.message || 'Failed to load communication history');
        return;
      }

      const payload = (await response.json()) as AttendeeCommunicationResponse;
      setHistoryById(current => ({ ...current, [attendeeId]: payload.items }));
    } catch {
      setError('Unable to load communication history');
    } finally {
      setHistoryLoadingById(current => ({ ...current, [attendeeId]: false }));
    }
  }

  async function toggleHistory(attendeeId: string) {
    const nextOpen = !openHistoryById[attendeeId];
    setOpenHistoryById(current => ({ ...current, [attendeeId]: nextOpen }));
    if (nextOpen) {
      const currentFilter = historyFilterById[attendeeId] || 'ALL';
      await loadCommunicationHistory(attendeeId, currentFilter);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10 text-slate-100">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-3xl font-semibold tracking-tight">Attendee Operations</h1>
          <button
            type="button"
            onClick={() => router.push(`/o/${orgCode}`)}
            className="rounded-lg border border-slate-700 px-3 py-1 text-sm"
          >
            Back to portal
          </button>
        </div>

        <form onSubmit={onSearch} className="mb-6 grid gap-3 rounded-xl border border-slate-800 bg-slate-900/60 p-4 md:grid-cols-[1fr_180px_auto]">
          <input
            value={search}
            onChange={event => setSearch(event.target.value)}
            placeholder="Search by name, email, or reference"
            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
          />
          <select
            value={status}
            onChange={event => setStatus(event.target.value as 'ALL' | AttendeeStatus)}
            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
          >
            <option value="ALL">All statuses</option>
            <option value="PENDING">PENDING</option>
            <option value="APPROVED">APPROVED</option>
            <option value="REJECTED">REJECTED</option>
          </select>
          <button type="submit" className="rounded-lg bg-cyan-400 px-4 py-2 font-semibold text-slate-950">
            Apply filters
          </button>
        </form>

        {error ? <p className="mb-4 text-sm text-red-300">{error}</p> : null}

        <section className="rounded-xl border border-slate-800 bg-slate-900/60">
          <div className="border-b border-slate-800 px-4 py-3 text-sm font-semibold">
            Attendees ({pagination.total})
          </div>

          {isLoading ? <p className="px-4 py-4 text-sm text-slate-300">Loading...</p> : null}
          {!isLoading && attendees.length === 0 ? (
            <p className="px-4 py-4 text-sm text-slate-300">No attendees found.</p>
          ) : null}

          {!isLoading && attendees.length > 0 ? (
            <ul>
              {attendees.map(item => (
                <li key={item.id} className="border-t border-slate-800 px-4 py-4 text-sm">
                  <div className="grid gap-3 md:grid-cols-[1.2fr_1.2fr_120px_180px_auto_auto_auto_auto] md:items-center">
                    <input
                      value={editById[item.id]?.fullName || ''}
                      onChange={event =>
                        setEditById(current => ({
                          ...current,
                          [item.id]: {
                            ...current[item.id],
                            fullName: event.target.value
                          }
                        }))
                      }
                      className="rounded border border-slate-700 bg-slate-950 px-2 py-1"
                    />
                    <input
                      value={editById[item.id]?.email || ''}
                      onChange={event =>
                        setEditById(current => ({
                          ...current,
                          [item.id]: {
                            ...current[item.id],
                            email: event.target.value
                          }
                        }))
                      }
                      className="rounded border border-slate-700 bg-slate-950 px-2 py-1"
                    />
                    <p className="text-xs text-slate-300">{item.lifecycleStatus}</p>
                    <p className="text-xs text-slate-400">{item.referenceCode}</p>
                    <button
                      type="button"
                      onClick={() => void updateAttendee(item.id)}
                      className="rounded-md border border-cyan-500 px-3 py-1 text-cyan-200"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => void transitionAttendee(item.id, 'approve')}
                      className="rounded-md border border-emerald-500 px-3 py-1 text-emerald-200"
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      onClick={() => void transitionAttendee(item.id, 'reject')}
                      className="rounded-md border border-rose-500 px-3 py-1 text-rose-200"
                    >
                      Reject
                    </button>
                    <button
                      type="button"
                      onClick={() => void transitionAttendee(item.id, 'resend-badge')}
                      className="rounded-md border border-amber-500 px-3 py-1 text-amber-200"
                    >
                      Resend badge
                    </button>
                    <button
                      type="button"
                      onClick={() => void toggleHistory(item.id)}
                      className="rounded-md border border-indigo-500 px-3 py-1 text-indigo-200"
                    >
                      {openHistoryById[item.id] ? 'Hide history' : 'View history'}
                    </button>
                  </div>
                  <p className="mt-2 text-xs text-slate-500">
                    Latest badge: {item.latestBadge ? `${item.latestBadge.id} (${item.latestBadge.status})` : 'none'}
                  </p>

                  {openHistoryById[item.id] ? (
                    <div className="mt-3 rounded-lg border border-slate-800 bg-slate-950/60 p-3">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-300">
                          Communication history
                        </p>
                        <select
                          value={historyFilterById[item.id] || 'ALL'}
                          onChange={event => {
                            const next = event.target.value as 'ALL' | 'QUEUED' | 'SENT' | 'FAILED';
                            setHistoryFilterById(current => ({ ...current, [item.id]: next }));
                            void loadCommunicationHistory(item.id, next);
                          }}
                          className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs"
                        >
                          <option value="ALL">All statuses</option>
                          <option value="QUEUED">QUEUED</option>
                          <option value="SENT">SENT</option>
                          <option value="FAILED">FAILED</option>
                        </select>
                      </div>

                      {historyLoadingById[item.id] ? (
                        <p className="text-xs text-slate-400">Loading history...</p>
                      ) : (historyById[item.id] || []).length === 0 ? (
                        <p className="text-xs text-slate-400">No communication logs found.</p>
                      ) : (
                        <ul className="space-y-2">
                          {(historyById[item.id] || []).map(log => (
                            <li key={log.id} className="rounded border border-slate-800 bg-slate-900/60 p-2 text-xs">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-medium text-slate-200">{log.channel}</span>
                                <span className="text-slate-300">{log.status}</span>
                                <span className="text-slate-500">{new Date(log.createdAt).toLocaleString()}</span>
                              </div>
                              <p className="mt-1 text-slate-300">Recipient: {log.recipientAddress}</p>
                              {log.template ? <p className="text-slate-400">Template: {log.template.name}</p> : null}
                              {log.errorMessage ? <p className="text-rose-300">Error: {log.errorMessage}</p> : null}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}
        </section>

        <div className="mt-4 flex items-center gap-3 text-sm">
          <button
            type="button"
            disabled={pagination.page <= 1}
            onClick={() => void fetchAttendees(pagination.page - 1)}
            className="rounded-md border border-slate-700 px-3 py-1 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Previous
          </button>
          <p className="text-slate-300">
            Page {pagination.page} of {pagination.totalPages}
          </p>
          <button
            type="button"
            disabled={pagination.page >= pagination.totalPages}
            onClick={() => void fetchAttendees(pagination.page + 1)}
            className="rounded-md border border-slate-700 px-3 py-1 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>
    </main>
  );
}
