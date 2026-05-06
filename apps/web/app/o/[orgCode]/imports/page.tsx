'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { loadSession } from '../../../../lib/session';

type EventItem = {
  id: string;
  name: string;
};

type LinkItem = {
  id: string;
  title: string;
  slug: string;
};

type ImportJob = {
  id: string;
  sourceFilename: string;
  sourceFileType: string;
  status: string;
  duplicateStrategy: string;
  totalRows: number | null;
  successfulRows: number | null;
  failedRows: number | null;
  createdAt: string;
  completedAt: string | null;
};

type ImportErrorItem = {
  id: string;
  rowNumber: number;
  message: string;
};

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5001';

export default function ImportsPage() {
  const params = useParams<{ orgCode: string }>();
  const router = useRouter();
  const orgCode = params.orgCode;

  const [events, setEvents] = useState<EventItem[]>([]);
  const [links, setLinks] = useState<LinkItem[]>([]);
  const [jobs, setJobs] = useState<ImportJob[]>([]);
  const [errors, setErrors] = useState<ImportErrorItem[]>([]);
  const [selectedJobId, setSelectedJobId] = useState('');

  const [sourceFilename, setSourceFilename] = useState('attendees.csv');
  const [sourceFileType, setSourceFileType] = useState<'CSV' | 'XLSX'>('CSV');
  const [duplicateStrategy, setDuplicateStrategy] = useState<'SKIP' | 'UPDATE' | 'FLAG'>('FLAG');
  const [eventId, setEventId] = useState('');
  const [registrationLinkId, setRegistrationLinkId] = useState('');
  const [mappingFullName, setMappingFullName] = useState('name');
  const [mappingEmail, setMappingEmail] = useState('email');
  const [fileContentBase64, setFileContentBase64] = useState('');
  const [selectedFilename, setSelectedFilename] = useState('');

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

  async function fetchEventsAndJobs(): Promise<void> {
    const token = getSessionToken();
    if (!token) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const [eventsRes, jobsRes] = await Promise.all([
        fetch(`${API_BASE}/org/${orgCode}/events`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch(`${API_BASE}/org/${orgCode}/imports/jobs`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);

      if (!eventsRes.ok || !jobsRes.ok) {
        throw new Error('Failed to load imports data');
      }

      const eventsPayload = (await eventsRes.json()) as EventItem[];
      const jobsPayload = (await jobsRes.json()) as ImportJob[];

      setEvents(eventsPayload);
      setJobs(jobsPayload);

      if (!eventId && eventsPayload.length > 0) {
        setEventId(eventsPayload[0].id);
      }
    } catch {
      setError('Unable to load imports data');
    } finally {
      setIsLoading(false);
    }
  }

  async function fetchLinks(selectedEventId: string): Promise<void> {
    const token = getSessionToken();
    if (!token || !selectedEventId) {
      return;
    }

    const linksRes = await fetch(`${API_BASE}/org/${orgCode}/events/${selectedEventId}/links`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    if (!linksRes.ok) {
      setLinks([]);
      setRegistrationLinkId('');
      return;
    }

    const linksPayload = (await linksRes.json()) as LinkItem[];
    setLinks(linksPayload);

    if (linksPayload.length > 0) {
      setRegistrationLinkId(linksPayload[0].id);
    } else {
      setRegistrationLinkId('');
    }
  }

  useEffect(() => {
    if (!orgCode) {
      return;
    }

    void fetchEventsAndJobs();
  }, [orgCode]);

  useEffect(() => {
    if (!eventId) {
      return;
    }

    void fetchLinks(eventId);
  }, [eventId]);

  async function createImportJob(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    const token = getSessionToken();
    if (!token) {
      return;
    }

    if (!fileContentBase64) {
      setError('Select a CSV or XLSX file first');
      return;
    }

    setError(null);

    const response = await fetch(`${API_BASE}/org/${orgCode}/imports/jobs`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        sourceFilename,
        sourceFileType,
        duplicateStrategy,
        mappingProfile: {
          fullName: mappingFullName,
          email: mappingEmail
        },
        eventId,
        registrationLinkId,
        fileContentBase64
      })
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as { message?: string };
      setError(payload.message || 'Failed to create import job');
      return;
    }

    await fetchEventsAndJobs();
  }

  async function onFileSelected(file: File | null): Promise<void> {
    if (!file) {
      setFileContentBase64('');
      setSelectedFilename('');
      return;
    }

    const extension = file.name.toLowerCase().split('.').pop();
    if (extension === 'xlsx') {
      setSourceFileType('XLSX');
    } else {
      setSourceFileType('CSV');
    }

    const arrayBuffer = await file.arrayBuffer();
    const uint8 = new Uint8Array(arrayBuffer);
    let binary = '';
    for (let i = 0; i < uint8.byteLength; i += 1) {
      binary += String.fromCharCode(uint8[i]);
    }

    setFileContentBase64(btoa(binary));
    setSelectedFilename(file.name);
    setSourceFilename(file.name);
  }

  async function loadErrors(jobId: string): Promise<void> {
    const token = getSessionToken();
    if (!token) {
      return;
    }

    setSelectedJobId(jobId);

    const response = await fetch(`${API_BASE}/org/${orgCode}/imports/jobs/${jobId}/errors`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    if (!response.ok) {
      setErrors([]);
      setError('Failed to load import errors');
      return;
    }

    const payload = (await response.json()) as ImportErrorItem[];
    setErrors(payload);
  }

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10 text-slate-100">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-3xl font-semibold tracking-tight">Attendee Imports</h1>
          <button
            type="button"
            onClick={() => router.push(`/o/${orgCode}`)}
            className="rounded-lg border border-slate-700 px-3 py-1 text-sm"
          >
            Back to portal
          </button>
        </div>

        {error ? <p className="mb-4 text-sm text-red-300">{error}</p> : null}

        <form onSubmit={createImportJob} className="mb-6 grid gap-3 rounded-xl border border-slate-800 bg-slate-900/60 p-4 md:grid-cols-2">
          <input
            value={sourceFilename}
            onChange={event => setSourceFilename(event.target.value)}
            required
            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
            placeholder="attendees.csv"
          />
          <select
            value={sourceFileType}
            onChange={event => setSourceFileType(event.target.value as 'CSV' | 'XLSX')}
            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
          >
            <option value="CSV">CSV</option>
            <option value="XLSX">XLSX</option>
          </select>

          <select
            value={duplicateStrategy}
            onChange={event => setDuplicateStrategy(event.target.value as 'SKIP' | 'UPDATE' | 'FLAG')}
            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
          >
            <option value="SKIP">Duplicate strategy: SKIP</option>
            <option value="UPDATE">Duplicate strategy: UPDATE</option>
            <option value="FLAG">Duplicate strategy: FLAG</option>
          </select>

          <select
            value={eventId}
            onChange={event => setEventId(event.target.value)}
            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
          >
            {events.map(item => (
              <option key={item.id} value={item.id}>
                Event: {item.name}
              </option>
            ))}
          </select>

          <select
            value={registrationLinkId}
            onChange={event => setRegistrationLinkId(event.target.value)}
            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
          >
            {links.map(item => (
              <option key={item.id} value={item.id}>
                Link: {item.title} ({item.slug})
              </option>
            ))}
          </select>

          <div className="grid grid-cols-2 gap-2">
            <input
              value={mappingFullName}
              onChange={event => setMappingFullName(event.target.value)}
              required
              placeholder="full name column"
              className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
            />
            <input
              value={mappingEmail}
              onChange={event => setMappingEmail(event.target.value)}
              required
              placeholder="email column"
              className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
            />
          </div>

          <div className="md:col-span-2 rounded-lg border border-slate-700 bg-slate-950 px-3 py-3">
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-300">Upload file</label>
            <input
              type="file"
              accept=".csv,.xlsx"
              onChange={event => {
                const file = event.currentTarget.files?.[0] || null;
                void onFileSelected(file);
              }}
              className="mt-2 text-sm"
            />
            <p className="mt-2 text-xs text-slate-400">
              Selected: {selectedFilename || 'none'}
            </p>
          </div>

          <button type="submit" className="rounded-lg bg-cyan-400 px-4 py-2 font-semibold text-slate-950 md:col-span-2">
            Queue import job
          </button>
        </form>

        <section className="mb-6 rounded-xl border border-slate-800 bg-slate-900/60">
          <div className="border-b border-slate-800 px-4 py-3 text-sm font-semibold">Import jobs</div>
          {isLoading ? <p className="px-4 py-4 text-sm text-slate-300">Loading...</p> : null}
          {!isLoading && jobs.length === 0 ? <p className="px-4 py-4 text-sm text-slate-300">No jobs yet.</p> : null}
          {!isLoading && jobs.length > 0 ? (
            <ul>
              {jobs.map(item => (
                <li key={item.id} className="border-t border-slate-800 px-4 py-3 text-sm">
                  <div className="grid gap-2 md:grid-cols-[1.6fr_1fr_1fr_1fr_1fr_auto] md:items-center">
                    <p className="truncate">{item.sourceFilename}</p>
                    <p className="text-xs text-slate-300">{item.status}</p>
                    <p className="text-xs text-slate-300">{item.duplicateStrategy}</p>
                    <p className="text-xs text-slate-400">
                      {item.successfulRows ?? 0}/{item.totalRows ?? 0}
                    </p>
                    <p className="text-xs text-slate-400">Failed: {item.failedRows ?? 0}</p>
                    <button
                      type="button"
                      onClick={() => void loadErrors(item.id)}
                      className="rounded-md border border-slate-700 px-3 py-1"
                    >
                      View errors
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          ) : null}
        </section>

        <section className="rounded-xl border border-slate-800 bg-slate-900/60">
          <div className="border-b border-slate-800 px-4 py-3 text-sm font-semibold">
            Import errors {selectedJobId ? `(job ${selectedJobId.slice(0, 8)})` : ''}
          </div>
          {errors.length === 0 ? (
            <p className="px-4 py-4 text-sm text-slate-300">No errors loaded.</p>
          ) : (
            <ul>
              {errors.map(item => (
                <li key={item.id} className="border-t border-slate-800 px-4 py-3 text-sm">
                  Row {item.rowNumber}: {item.message}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
