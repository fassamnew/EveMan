'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { loadSession } from '../../../../lib/session';

type CommunicationTemplate = {
  id: string;
  name: string;
  channel: 'EMAIL' | 'SMS';
  subject: string | null;
  body: string;
  isActive: boolean;
};

type CommunicationLog = {
  id: string;
  channel: 'EMAIL' | 'SMS';
  status: 'QUEUED' | 'SENT' | 'FAILED';
  recipientAddress: string;
  createdAt: string;
  sentAt: string | null;
  errorMessage: string | null;
};

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5001';

export default function CommunicationsPage() {
  const params = useParams<{ orgCode: string }>();
  const router = useRouter();
  const orgCode = params.orgCode;

  const [templates, setTemplates] = useState<CommunicationTemplate[]>([]);
  const [logs, setLogs] = useState<CommunicationLog[]>([]);
  const [name, setName] = useState('');
  const [channel, setChannel] = useState<'EMAIL' | 'SMS'>('EMAIL');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('Hello {{fullName}}');

  const [bulkTemplateId, setBulkTemplateId] = useState('');
  const [attendeeIdsText, setAttendeeIdsText] = useState('');

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

  async function fetchData(): Promise<void> {
    const token = getSessionToken();
    if (!token) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const [templatesRes, logsRes] = await Promise.all([
        fetch(`${API_BASE}/org/${orgCode}/communications/templates`, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }),
        fetch(`${API_BASE}/org/${orgCode}/communications/logs`, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        })
      ]);

      if (!templatesRes.ok || !logsRes.ok) {
        throw new Error('Failed to load communications data');
      }

      const templatesPayload = (await templatesRes.json()) as CommunicationTemplate[];
      const logsPayload = (await logsRes.json()) as CommunicationLog[];

      setTemplates(templatesPayload);
      setLogs(logsPayload);

      if (!bulkTemplateId && templatesPayload.length > 0) {
        setBulkTemplateId(templatesPayload[0].id);
      }
    } catch {
      setError('Unable to load communications data');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    if (!orgCode) {
      return;
    }

    void fetchData();
  }, [orgCode]);

  async function createTemplate(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    const token = getSessionToken();
    if (!token) {
      return;
    }

    setError(null);

    const response = await fetch(`${API_BASE}/org/${orgCode}/communications/templates`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        name,
        channel,
        subject: subject || undefined,
        body
      })
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as { message?: string };
      setError(payload.message || 'Failed to create template');
      return;
    }

    setName('');
    setSubject('');
    setBody('Hello {{fullName}}');
    await fetchData();
  }

  async function updateTemplate(templateId: string): Promise<void> {
    const token = getSessionToken();
    if (!token) {
      return;
    }

    const current = templates.find(item => item.id === templateId);
    if (!current) {
      return;
    }

    const response = await fetch(`${API_BASE}/org/${orgCode}/communications/templates/${templateId}`, {
      method: 'PATCH',
      headers: {
        'content-type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        isActive: !current.isActive
      })
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as { message?: string };
      setError(payload.message || 'Failed to update template');
      return;
    }

    await fetchData();
  }

  async function queueBulkSend(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    const token = getSessionToken();
    if (!token) {
      return;
    }

    const attendeeIds = attendeeIdsText
      .split(',')
      .map(item => item.trim())
      .filter(Boolean);

    const response = await fetch(`${API_BASE}/org/${orgCode}/communications/bulk-send`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        templateId: bulkTemplateId,
        attendeeIds: attendeeIds.length > 0 ? attendeeIds : undefined
      })
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as { message?: string };
      setError(payload.message || 'Failed to queue bulk send');
      return;
    }

    await fetchData();
  }

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10 text-slate-100">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-3xl font-semibold tracking-tight">Communications</h1>
          <button
            type="button"
            onClick={() => router.push(`/o/${orgCode}`)}
            className="rounded-lg border border-slate-700 px-3 py-1 text-sm"
          >
            Back to portal
          </button>
        </div>

        {error ? <p className="mb-4 text-sm text-red-300">{error}</p> : null}

        <form onSubmit={createTemplate} className="mb-6 grid gap-3 rounded-xl border border-slate-800 bg-slate-900/60 p-4 md:grid-cols-[1fr_120px_1fr]">
          <input
            value={name}
            onChange={event => setName(event.target.value)}
            required
            placeholder="Template name"
            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
          />
          <select
            value={channel}
            onChange={event => setChannel(event.target.value as 'EMAIL' | 'SMS')}
            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
          >
            <option value="EMAIL">EMAIL</option>
            <option value="SMS">SMS</option>
          </select>
          <input
            value={subject}
            onChange={event => setSubject(event.target.value)}
            placeholder="Subject (optional for SMS)"
            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
          />
          <textarea
            value={body}
            onChange={event => setBody(event.target.value)}
            rows={4}
            className="md:col-span-3 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
          />
          <button type="submit" className="rounded-lg bg-cyan-400 px-4 py-2 font-semibold text-slate-950 md:col-span-3">
            Create template
          </button>
        </form>

        <section className="mb-6 rounded-xl border border-slate-800 bg-slate-900/60">
          <div className="border-b border-slate-800 px-4 py-3 text-sm font-semibold">Templates</div>
          {isLoading ? <p className="px-4 py-4 text-sm text-slate-300">Loading...</p> : null}
          {!isLoading && templates.length === 0 ? <p className="px-4 py-4 text-sm text-slate-300">No templates yet.</p> : null}
          {!isLoading && templates.length > 0 ? (
            <ul>
              {templates.map(item => (
                <li key={item.id} className="border-t border-slate-800 px-4 py-3 text-sm">
                  <div className="grid gap-2 md:grid-cols-[1fr_120px_120px_1fr_auto] md:items-center">
                    <p className="font-medium">{item.name}</p>
                    <p className="text-xs text-slate-300">{item.channel}</p>
                    <p className="text-xs text-slate-300">{item.isActive ? 'ACTIVE' : 'INACTIVE'}</p>
                    <p className="truncate text-xs text-slate-400">{item.subject || item.body}</p>
                    <button
                      type="button"
                      onClick={() => void updateTemplate(item.id)}
                      className="rounded-md border border-slate-700 px-3 py-1"
                    >
                      {item.isActive ? 'Disable' : 'Enable'}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          ) : null}
        </section>

        <form onSubmit={queueBulkSend} className="mb-6 grid gap-3 rounded-xl border border-slate-800 bg-slate-900/60 p-4 md:grid-cols-[1fr_2fr_auto]">
          <select
            value={bulkTemplateId}
            onChange={event => setBulkTemplateId(event.target.value)}
            required
            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
          >
            {templates.map(item => (
              <option key={item.id} value={item.id}>
                {item.name} ({item.channel})
              </option>
            ))}
          </select>
          <input
            value={attendeeIdsText}
            onChange={event => setAttendeeIdsText(event.target.value)}
            placeholder="Optional attendee IDs (comma-separated)"
            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
          />
          <button type="submit" className="rounded-lg bg-emerald-400 px-4 py-2 font-semibold text-slate-950">
            Queue send
          </button>
        </form>

        <section className="rounded-xl border border-slate-800 bg-slate-900/60">
          <div className="border-b border-slate-800 px-4 py-3 text-sm font-semibold">Delivery logs (latest 200)</div>
          {!isLoading && logs.length === 0 ? <p className="px-4 py-4 text-sm text-slate-300">No logs yet.</p> : null}
          {logs.length > 0 ? (
            <ul>
              {logs.map(item => (
                <li key={item.id} className="border-t border-slate-800 px-4 py-3 text-sm">
                  <div className="grid gap-2 md:grid-cols-[120px_100px_1fr_220px] md:items-center">
                    <p className="text-xs text-slate-300">{item.channel}</p>
                    <p className="text-xs text-slate-300">{item.status}</p>
                    <p className="truncate">{item.recipientAddress}</p>
                    <p className="text-xs text-slate-400">{new Date(item.createdAt).toLocaleString()}</p>
                  </div>
                  {item.errorMessage ? <p className="mt-1 text-xs text-rose-300">{item.errorMessage}</p> : null}
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      </div>
    </main>
  );
}
