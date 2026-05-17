'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { authFetch } from '../../../../lib/session';
import { useTheme } from '../../../../lib/theme-provider';

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

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || '/api';

export default function ImportsPage() {
  const params = useParams<{ orgCode: string }>();
  const router = useRouter();
  const { theme } = useTheme();
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
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedFilename, setSelectedFilename] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isDark = theme === 'dark';
  const pageClass = isDark ? 'min-h-screen bg-slate-950 px-6 py-10 text-slate-100' : 'min-h-screen bg-slate-50 px-6 py-10 text-slate-950';
  const cardClass = isDark ? 'rounded-xl border border-slate-800 bg-slate-900/60' : 'rounded-xl border border-slate-200 bg-white';
  const fieldClass = isDark
    ? 'rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100'
    : 'rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-950';
  const subtleTextClass = isDark ? 'text-slate-400' : 'text-slate-600';
  const secondaryTextClass = isDark ? 'text-slate-300' : 'text-slate-700';

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

    if (!selectedFile) {
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

    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('sourceFilename', sourceFilename);
    formData.append('sourceFileType', sourceFileType);
    formData.append('duplicateStrategy', duplicateStrategy);
    formData.append(
      'mappingProfile',
      JSON.stringify({
        fullName: mappingFullName,
        email: mappingEmail,
        phone: mappingPhone.trim() || undefined,
        category: useCategoryMapping ? mappingCategory.trim() || undefined : undefined
      })
    );
    formData.append('eventId', eventId);

    if (!useCategoryMapping && registrationLinkId) {
      formData.append('registrationLinkId', registrationLinkId);
    }

    const response = await authFetch(`${API_BASE}/org/${orgCode}/imports/jobs`, {
      method: 'POST',
      body: formData
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
      setSelectedFile(null);
      setSelectedFilename('');
      return;
    }

    const extension = file.name.toLowerCase().split('.').pop();
    if (extension === 'xlsx') {
      setSourceFileType('XLSX');
    } else {
      setSourceFileType('CSV');
    }

    setSelectedFile(file);
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
    <main className={pageClass}>
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-3xl font-semibold tracking-tight">Attendee Imports</h1>
          <button
            type="button"
            onClick={() => router.push(`/o/${orgCode}`)}
            className={isDark ? 'rounded-lg border border-slate-700 px-3 py-1 text-sm' : 'rounded-lg border border-slate-300 px-3 py-1 text-sm'}
          >
            Back to portal
          </button>
        </div>

        {error ? <p className={isDark ? 'mb-4 text-sm text-red-300' : 'mb-4 text-sm text-red-600'}>{error}</p> : null}

        <form onSubmit={createImportJob} className={`mb-6 grid gap-3 p-4 md:grid-cols-2 ${cardClass}`}>
          <input
            value={sourceFilename}
            onChange={event => setSourceFilename(event.target.value)}
            required
            className={fieldClass}
            placeholder="attendees.csv"
          />
          <select
            value={sourceFileType}
            onChange={event => setSourceFileType(event.target.value as 'CSV' | 'XLSX')}
            className={fieldClass}
          >
            <option value="CSV">CSV</option>
            <option value="XLSX">XLSX</option>
          </select>

          <select
            value={duplicateStrategy}
            onChange={event => setDuplicateStrategy(event.target.value as 'SKIP' | 'UPDATE' | 'FLAG')}
            className={fieldClass}
          >
            <option value="SKIP">Duplicate strategy: SKIP</option>
            <option value="UPDATE">Duplicate strategy: UPDATE</option>
            <option value="FLAG">Duplicate strategy: FLAG</option>
          </select>

          <select
            value={eventId}
            onChange={event => setEventId(event.target.value)}
            className={fieldClass}
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
            className={fieldClass}
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
              className={fieldClass}
            />
            <input
              value={mappingEmail}
              onChange={event => setMappingEmail(event.target.value)}
              required
              placeholder="email column"
              className={fieldClass}
            />
            <input
              value={mappingPhone}
              onChange={event => setMappingPhone(event.target.value)}
              placeholder="phone column (optional)"
              className={fieldClass}
            />
            <input
              value={mappingCategory}
              onChange={event => setMappingCategory(event.target.value)}
              required={useCategoryMapping}
              placeholder="category column"
              className={fieldClass}
            />
          </div>

          <label className={`md:col-span-2 flex items-center gap-2 text-sm ${secondaryTextClass}`}>
            <input
              type="checkbox"
              checked={useCategoryMapping}
              onChange={event => setUseCategoryMapping(event.target.checked)}
            />
            Match registration link from category column (title, slug, or link id)
          </label>

          {useCategoryMapping ? (
            <p className={`md:col-span-2 text-xs ${subtleTextClass}`}>
              Default link is disabled while category mapping is active.
            </p>
          ) : null}

          <div className="md:col-span-2 rounded-lg border border-cyan-700/40 bg-cyan-950/20 px-3 py-3 text-sm">
            <p className="font-semibold text-cyan-200">CSV format guide</p>
            <p className={`mt-1 ${secondaryTextClass}`}>
              Your file must have a header row. The column names should match the mapping fields below.
            </p>
            <p className={`mt-2 ${secondaryTextClass}`}>
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
            <div className={isDark ? 'mt-3 overflow-x-auto rounded border border-slate-700 bg-slate-950/80 p-3 font-mono text-xs text-slate-200' : 'mt-3 overflow-x-auto rounded border border-slate-300 bg-white p-3 font-mono text-xs text-slate-800'}>
              <p>{`${mappingFullName || 'name'},${mappingEmail || 'email'},${mappingPhone || 'phone'},${mappingCategory || 'category'}`}</p>
              <p>Abel Tesfaye,abel@example.com,+251900000000,vip</p>
              <p>Sara Demissie,sara@example.com,+251911111111,standard</p>
            </div>
            <p className={`mt-2 text-xs ${subtleTextClass}`}>
              For XLSX files, use the same header names in the first row.
            </p>
          </div>

          <div className={isDark ? 'md:col-span-2 rounded-lg border border-slate-700 bg-slate-950 px-3 py-3' : 'md:col-span-2 rounded-lg border border-slate-300 bg-white px-3 py-3'}>
            <label className={`block text-xs font-semibold uppercase tracking-wide ${secondaryTextClass}`}>Upload file</label>
            <input
              type="file"
              accept=".csv,.xlsx"
              onChange={event => {
                const file = event.currentTarget.files?.[0] || null;
                void onFileSelected(file);
              }}
              className="mt-2 text-sm"
            />
            <p className={`mt-2 text-xs ${subtleTextClass}`}>
              Selected: {selectedFilename || 'none'}
            </p>
          </div>

          <button type="submit" className="rounded-lg bg-cyan-400 px-4 py-2 font-semibold text-slate-950 md:col-span-2">
            Queue import job
          </button>
        </form>

        <section className={`mb-6 ${cardClass}`}>
          <div className={isDark ? 'border-b border-slate-800 px-4 py-3 text-sm font-semibold' : 'border-b border-slate-200 px-4 py-3 text-sm font-semibold'}>Import jobs</div>
          {isLoading ? <p className={`px-4 py-4 text-sm ${secondaryTextClass}`}>Loading...</p> : null}
          {!isLoading && jobs.length === 0 ? <p className={`px-4 py-4 text-sm ${secondaryTextClass}`}>No jobs yet.</p> : null}
          {!isLoading && jobs.length > 0 ? (
            <ul>
              {jobs.map(item => (
                <li key={item.id} className={isDark ? 'border-t border-slate-800 px-4 py-3 text-sm' : 'border-t border-slate-200 px-4 py-3 text-sm'}>
                  <div className="grid gap-2 md:grid-cols-[1.6fr_1fr_1fr_1fr_1fr_auto] md:items-center">
                    <p className="truncate">{item.sourceFilename}</p>
                    <p className={`text-xs ${secondaryTextClass}`}>{item.status}</p>
                    <p className={`text-xs ${secondaryTextClass}`}>{item.duplicateStrategy}</p>
                    <p className={`text-xs ${subtleTextClass}`}>
                      {item.successfulRows ?? 0}/{item.totalRows ?? 0}
                    </p>
                    <p className={`text-xs ${subtleTextClass}`}>Failed: {item.failedRows ?? 0}</p>
                    <button
                      type="button"
                      onClick={() => void loadErrors(item.id)}
                      className={isDark ? 'rounded-md border border-slate-700 px-3 py-1' : 'rounded-md border border-slate-300 px-3 py-1'}
                    >
                      View errors
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          ) : null}
        </section>

        <section className={cardClass}>
          <div className={isDark ? 'border-b border-slate-800 px-4 py-3 text-sm font-semibold' : 'border-b border-slate-200 px-4 py-3 text-sm font-semibold'}>
            Import errors {selectedJobId ? `(job ${selectedJobId.slice(0, 8)})` : ''}
          </div>
          {errors.length === 0 ? (
            <p className={`px-4 py-4 text-sm ${secondaryTextClass}`}>No errors loaded.</p>
          ) : (
            <ul>
              {errors.map(item => (
                <li key={item.id} className={isDark ? 'border-t border-slate-800 px-4 py-3 text-sm' : 'border-t border-slate-200 px-4 py-3 text-sm'}>
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
