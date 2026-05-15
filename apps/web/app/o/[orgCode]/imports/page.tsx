'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { authFetch } from '../../../../lib/session';

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
  const [mappingPhone, setMappingPhone] = useState('phone');
  const [mappingCategory, setMappingCategory] = useState('category');
  const [useCategoryMapping, setUseCategoryMapping] = useState(false);
  const [fileContentBase64, setFileContentBase64] = useState('');
  const [selectedFilename, setSelectedFilename] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSessionExpired = useCallback(() => {
    router.replace(`/o/${orgCode}`);
  }, [orgCode, router]);

  async function fetchEventsAndJobs(): Promise<void> {
    setIsLoading(true);
    setError(null);

    try {
      const [eventsRes, jobsRes] = await Promise.all([
        authFetch(`${API_BASE}/org/${orgCode}/events`, {}, onSessionExpired),
        authFetch(`${API_BASE}/org/${orgCode}/imports/jobs`, {}, onSessionExpired)
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
    if (!selectedEventId) {
      return;
    }

    const linksRes = await authFetch(
      `${API_BASE}/org/${orgCode}/events/${selectedEventId}/links`,
      {},
      onSessionExpired
    );

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
  }, [orgCode, onSessionExpired]);

  useEffect(() => {
    if (!eventId) {
      return;
    }

    void fetchLinks(eventId);
  }, [eventId, onSessionExpired]);

  async function createImportJob(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    if (!fileContentBase64) {
      setError('Select a CSV or XLSX file first');
      return;
    }

    if (useCategoryMapping && !mappingCategory.trim()) {
      setError('Provide a category column name when category mapping is enabled');
      return;
    }

    if (!useCategoryMapping && !registrationLinkId) {
      setError('Select a registration link or enable category mapping');
      return;
    }

    setError(null);

    const response = await authFetch(`${API_BASE}/org/${orgCode}/imports/jobs`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        sourceFilename,
        sourceFileType,
        duplicateStrategy,
        mappingProfile: {
          fullName: mappingFullName,
          email: mappingEmail,
          phone: mappingPhone.trim() || undefined,
          category: useCategoryMapping ? mappingCategory.trim() : undefined
        },
        eventId,
        registrationLinkId: useCategoryMapping ? undefined : registrationLinkId || undefined,
        fileContentBase64
      })
    }, onSessionExpired);

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
    setSelectedJobId(jobId);

    const response = await authFetch(
      `${API_BASE}/org/${orgCode}/imports/jobs/${jobId}/errors`,
      {},
      onSessionExpired
    );

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
            disabled={useCategoryMapping}
            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
          >
            {links.map(item => (
              <option key={item.id} value={item.id}>
                Link: {item.title} ({item.slug})
              </option>
            ))}
          </select>

          <div className="grid grid-cols-2 gap-2 md:grid-cols-4 md:col-span-2">
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
            <input
              value={mappingPhone}
              onChange={event => setMappingPhone(event.target.value)}
              placeholder="phone column (optional)"
              className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
            />
            <input
              value={mappingCategory}
              onChange={event => setMappingCategory(event.target.value)}
              required={useCategoryMapping}
              placeholder="category column"
              className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
            />
          </div>

          <label className="md:col-span-2 flex items-center gap-2 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={useCategoryMapping}
              onChange={event => setUseCategoryMapping(event.target.checked)}
            />
            Match registration link from category column (title, slug, or link id)
          </label>

          {useCategoryMapping ? (
            <p className="md:col-span-2 text-xs text-slate-400">
              Default link is disabled while category mapping is active.
            </p>
          ) : null}

          <div className="md:col-span-2 rounded-lg border border-cyan-700/40 bg-cyan-950/20 px-3 py-3 text-sm">
            <p className="font-semibold text-cyan-200">CSV format guide</p>
            <p className="mt-1 text-slate-300">
              Your file must have a header row. The column names should match the mapping fields below.
            </p>
            <p className="mt-2 text-slate-300">
              Expected headers right now:
              <span className="ml-2 rounded bg-slate-900 px-2 py-0.5 font-mono text-xs text-cyan-200">
                {mappingFullName || 'name'}
              </span>
              <span className="ml-2 rounded bg-slate-900 px-2 py-0.5 font-mono text-xs text-cyan-200">
                {mappingEmail || 'email'}
              </span>
              <span className="ml-2 rounded bg-slate-900 px-2 py-0.5 font-mono text-xs text-cyan-200">
                {mappingPhone || 'phone'}
              </span>
              <span className="ml-2 rounded bg-slate-900 px-2 py-0.5 font-mono text-xs text-cyan-200">
                {mappingCategory || 'category'}
              </span>
            </p>
            <div className="mt-3 overflow-x-auto rounded border border-slate-700 bg-slate-950/80 p-3 font-mono text-xs text-slate-200">
              <p>{`${mappingFullName || 'name'},${mappingEmail || 'email'},${mappingPhone || 'phone'},${mappingCategory || 'category'}`}</p>
              <p>Abel Tesfaye,abel@example.com,+251900000000,vip</p>
              <p>Sara Demissie,sara@example.com,+251911111111,standard</p>
            </div>
            <p className="mt-2 text-xs text-slate-400">
              For XLSX files, use the same header names in the first row.
            </p>
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
