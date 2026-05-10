'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { loadSession } from '../../../../lib/session';

type DashboardResponse = {
  organization: {
    id: string;
    code: string;
    name: string;
  };
  kpis: {
    totalEvents: number;
    publishedEvents: number;
    totalRegistrants: number;
    approvedRegistrants: number;
    totalCheckins: number;
    checkinRate: number;
    communicationTotal: number;
    communicationSent: number;
    communicationFailed: number;
  };
  trends: Array<{
    day: string;
    registrations: number;
    checkins: number;
  }>;
  eventPerformance: Array<{
    eventId: string;
    eventName: string;
    startsAt: string | null;
    registrations: number;
    checkins: number;
    checkinRate: number;
    qrIssued: number;
    communicationsSent: number;
    communicationsFailed: number;
  }>;
  usherPerformance: Array<{
    usherUserId: string;
    usherName: string;
    scans: number;
  }>;
  generatedAt: string;
  cached: boolean;
};

type ReportItem = {
  reportId: string;
  status: string;
  format: 'csv' | 'json';
  eventId: string | null;
  createdAt: string | null;
  completedAt: string | null;
  rowCount: number | null;
  downloadReady: boolean;
  failureReason: string | null;
};

type ReportListResponse = {
  reports: ReportItem[];
};

type QueueReportResponse = {
  reportId: string;
  status: string;
  format: 'csv' | 'json';
  eventId: string | null;
};

type DownloadLinkResponse = {
  reportId: string;
  expiresInSeconds: number;
  downloadUrl: string;
  generatedAt: string | null;
  contentType: string | null;
};

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5001';

export default function AnalyticsPage() {
  const params = useParams<{ orgCode: string }>();
  const router = useRouter();
  const orgCode = params.orgCode;

  const [data, setData] = useState<DashboardResponse | null>(null);
  const [eventFilter, setEventFilter] = useState('');
  const [sortBy, setSortBy] = useState<'registrations' | 'checkinRate' | 'communicationsFailed'>(
    'registrations'
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reportFormat, setReportFormat] = useState<'csv' | 'json'>('csv');
  const [reportEventId, setReportEventId] = useState<string>('');
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [reportError, setReportError] = useState<string | null>(null);
  const [isQueueingReport, setIsQueueingReport] = useState(false);
  const [isLoadingReports, setIsLoadingReports] = useState(false);
  const [downloadingReportId, setDownloadingReportId] = useState<string | null>(null);

  const hasExportRole = useMemo(() => {
    const session = loadSession();
    const roles = session?.roles || [];
    return roles.includes('SUPER_ADMIN') || roles.includes('ORG_ADMIN');
  }, []);

  function getSessionToken(): string | null {
    const session = loadSession();
    if (!session) {
      router.replace(`/o/${orgCode}`);
      return null;
    }

    return session.accessToken;
  }

  async function loadDashboard(): Promise<void> {
    const token = getSessionToken();
    if (!token) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/org/${orgCode}/dashboard/overview`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { message?: string };
        setError(payload.message || 'Failed to load dashboard');
        return;
      }

      const payload = (await response.json()) as DashboardResponse;
      setData(payload);
    } catch {
      setError('Network error while loading dashboard');
    } finally {
      setIsLoading(false);
    }
  }

  async function loadReports(): Promise<void> {
    const token = getSessionToken();
    if (!token) {
      return;
    }

    setIsLoadingReports(true);

    try {
      const response = await fetch(`${API_BASE}/org/${orgCode}/dashboard/reports`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (!response.ok) {
        if (response.status === 403) {
          setReportError('Report exports require ORG_ADMIN or SUPER_ADMIN role.');
          return;
        }
        const payload = (await response.json().catch(() => ({}))) as { message?: string };
        setReportError(payload.message || 'Failed to load report jobs');
        return;
      }

      const payload = (await response.json()) as ReportListResponse;
      setReports(payload.reports || []);
    } catch {
      setReportError('Network error while loading report jobs');
    } finally {
      setIsLoadingReports(false);
    }
  }

  async function queueReport(): Promise<void> {
    const token = getSessionToken();
    if (!token) {
      return;
    }

    setIsQueueingReport(true);
    setReportError(null);

    const params = new URLSearchParams();
    params.set('format', reportFormat);
    if (reportEventId.trim()) {
      params.set('eventId', reportEventId.trim());
    }

    try {
      const response = await fetch(`${API_BASE}/org/${orgCode}/dashboard/reports?${params.toString()}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (!response.ok) {
        if (response.status === 403) {
          setReportError('Report exports require ORG_ADMIN or SUPER_ADMIN role.');
          return;
        }
        const payload = (await response.json().catch(() => ({}))) as { message?: string };
        setReportError(payload.message || 'Failed to queue report');
        return;
      }

      const payload = (await response.json()) as QueueReportResponse;
      setReports(current => [
        {
          reportId: payload.reportId,
          status: payload.status,
          format: payload.format,
          eventId: payload.eventId,
          createdAt: new Date().toISOString(),
          completedAt: null,
          rowCount: null,
          downloadReady: false,
          failureReason: null
        },
        ...current
      ]);

      await loadReports();
    } catch {
      setReportError('Network error while queueing report');
    } finally {
      setIsQueueingReport(false);
    }
  }

  async function downloadReport(reportId: string): Promise<void> {
    const token = getSessionToken();
    if (!token) {
      return;
    }

    setDownloadingReportId(reportId);
    setReportError(null);

    try {
      const response = await fetch(
        `${API_BASE}/org/${orgCode}/dashboard/reports/${reportId}/download-link`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      if (!response.ok) {
        if (response.status === 403) {
          setReportError('Report exports require ORG_ADMIN or SUPER_ADMIN role.');
          return;
        }
        const payload = (await response.json().catch(() => ({}))) as { message?: string };
        setReportError(payload.message || 'Failed to create download link');
        return;
      }

      const payload = (await response.json()) as DownloadLinkResponse;
      window.open(payload.downloadUrl, '_blank', 'noopener,noreferrer');
    } catch {
      setReportError('Network error while downloading report');
    } finally {
      setDownloadingReportId(null);
    }
  }

  useEffect(() => {
    if (!orgCode) {
      return;
    }

    void loadDashboard();
    if (hasExportRole) {
      void loadReports();
    }
  }, [orgCode, hasExportRole]);

  useEffect(() => {
    if (!orgCode || !hasExportRole) {
      return;
    }

    const timer = window.setInterval(() => {
      void loadReports();
    }, 5000);

    return () => window.clearInterval(timer);
  }, [orgCode, hasExportRole]);

  const filteredEvents = useMemo(() => {
    if (!data) {
      return [] as DashboardResponse['eventPerformance'];
    }

    const byName = data.eventPerformance.filter(item =>
      item.eventName.toLowerCase().includes(eventFilter.trim().toLowerCase())
    );

    return [...byName].sort((a, b) => {
      if (sortBy === 'registrations') {
        return b.registrations - a.registrations;
      }
      if (sortBy === 'checkinRate') {
        return b.checkinRate - a.checkinRate;
      }
      return b.communicationsFailed - a.communicationsFailed;
    });
  }, [data, eventFilter, sortBy]);

  const maxTrendValue = useMemo(() => {
    if (!data || data.trends.length === 0) {
      return 1;
    }

    return Math.max(
      1,
      ...data.trends.map(item => Math.max(item.registrations, item.checkins))
    );
  }, [data]);

  const eventNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const event of data?.eventPerformance || []) {
      map.set(event.eventId, event.eventName);
    }
    return map;
  }, [data]);

  const communicationInsights = useMemo(() => {
    if (!data) {
      return {
        failureRate: 0,
        topFailures: [] as DashboardResponse['eventPerformance']
      };
    }

    const total = data.kpis.communicationSent + data.kpis.communicationFailed;
    const failureRate = total ? Number(((data.kpis.communicationFailed / total) * 100).toFixed(2)) : 0;

    const topFailures = [...data.eventPerformance]
      .sort((a, b) => b.communicationsFailed - a.communicationsFailed)
      .slice(0, 3);

    return {
      failureRate,
      topFailures
    };
  }, [data]);

  const usherInsights = useMemo(() => {
    if (!data) {
      return {
        totalScans: 0,
        leaderboard: [] as Array<{ usherUserId: string; usherName: string; scans: number; share: number }>
      };
    }

    const totalScans = data.usherPerformance.reduce((sum, usher) => sum + usher.scans, 0);
    const leaderboard = data.usherPerformance.map(usher => ({
      ...usher,
      share: totalScans ? Number(((usher.scans / totalScans) * 100).toFixed(2)) : 0
    }));

    return {
      totalScans,
      leaderboard
    };
  }, [data]);

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10 text-slate-100">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-3xl font-semibold tracking-tight">Analytics Dashboard</h1>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void loadDashboard()}
              className="rounded-lg border border-cyan-500 px-3 py-1 text-sm text-cyan-200"
            >
              Refresh
            </button>
            <button
              type="button"
              onClick={() => router.push(`/o/${orgCode}`)}
              className="rounded-lg border border-slate-700 px-3 py-1 text-sm"
            >
              Back to portal
            </button>
          </div>
        </div>

        {error ? <p className="mb-4 text-sm text-rose-300">{error}</p> : null}
        {isLoading ? <p className="mb-4 text-sm text-slate-300">Loading dashboard...</p> : null}

        {data ? (
          <>
            <p className="mb-4 text-xs text-slate-400">
              Generated: {new Date(data.generatedAt).toLocaleString()} · Cached: {data.cached ? 'yes' : 'no'}
            </p>

            <section className="mb-6 grid gap-3 md:grid-cols-4">
              <KpiCard label="Events" value={`${data.kpis.publishedEvents}/${data.kpis.totalEvents}`} />
              <KpiCard label="Registrants" value={`${data.kpis.totalRegistrants}`} />
              <KpiCard label="Check-ins" value={`${data.kpis.totalCheckins} (${data.kpis.checkinRate}%)`} />
              <KpiCard
                label="Communications"
                value={`${data.kpis.communicationSent} sent / ${data.kpis.communicationFailed} failed`}
              />
            </section>

            <section className="mb-6 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-300">
                7-day trend (registrations vs check-ins)
              </h2>
              <div className="grid gap-2 md:grid-cols-7">
                {data.trends.map(item => {
                  const registrationsPct = Math.round((item.registrations / maxTrendValue) * 100);
                  const checkinsPct = Math.round((item.checkins / maxTrendValue) * 100);

                  return (
                    <div key={item.day} className="rounded-lg border border-slate-800 bg-slate-950/60 p-2">
                      <p className="text-[11px] text-slate-400">{item.day.slice(5)}</p>
                      <div className="mt-2 flex h-20 items-end gap-1">
                        <div className="w-1/2 rounded bg-cyan-400" style={{ height: `${registrationsPct}%` }} />
                        <div className="w-1/2 rounded bg-emerald-400" style={{ height: `${checkinsPct}%` }} />
                      </div>
                      <p className="mt-2 text-[11px] text-slate-300">R {item.registrations} · C {item.checkins}</p>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="mb-6 rounded-xl border border-slate-800 bg-slate-900/60">
              <div className="border-b border-slate-800 px-4 py-3">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">Report exports</h2>
                <p className="mt-1 text-xs text-slate-400">
                  Queue async CSV/JSON exports with signed, time-limited download links.
                </p>
              </div>

              <div className="grid gap-2 border-b border-slate-800 px-4 py-3 md:grid-cols-[1fr_1fr_auto]">
                <select
                  value={reportFormat}
                  onChange={event => setReportFormat(event.target.value as 'csv' | 'json')}
                  className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                >
                  <option value="csv">CSV export</option>
                  <option value="json">JSON export</option>
                </select>
                <select
                  value={reportEventId}
                  onChange={event => setReportEventId(event.target.value)}
                  className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                >
                  <option value="">All events</option>
                  {data.eventPerformance.map(event => (
                    <option key={event.eventId} value={event.eventId}>
                      {event.eventName}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={isQueueingReport || !hasExportRole}
                  onClick={() => void queueReport()}
                  className="rounded-lg border border-emerald-500 px-3 py-2 text-sm text-emerald-200 disabled:opacity-60"
                >
                  {isQueueingReport ? 'Queueing...' : 'Queue export'}
                </button>
              </div>

              {!hasExportRole ? (
                <p className="border-b border-slate-800 px-4 py-3 text-xs text-amber-300">
                  Export actions are restricted to ORG_ADMIN and SUPER_ADMIN roles.
                </p>
              ) : null}

              {reportError ? <p className="px-4 py-3 text-sm text-rose-300">{reportError}</p> : null}
              {isLoadingReports ? <p className="px-4 py-3 text-sm text-slate-300">Loading report jobs...</p> : null}

              {reports.length === 0 ? (
                <p className="px-4 py-4 text-sm text-slate-300">No report jobs yet.</p>
              ) : (
                <ul>
                  {reports.map(report => (
                    <li key={report.reportId} className="border-t border-slate-800 px-4 py-3 text-sm">
                      <div className="grid gap-2 md:grid-cols-[1.2fr_100px_120px_1fr_auto] md:items-center">
                        <div>
                          <p className="font-medium">{report.reportId.slice(0, 8)}...</p>
                          <p className="text-xs text-slate-400">
                            Created:{' '}
                            {report.createdAt ? new Date(report.createdAt).toLocaleString() : 'unknown'}
                            {report.eventId
                              ? ` · ${eventNameById.get(report.eventId) || 'Event scoped'}`
                              : ' · All events'}
                          </p>
                          {report.failureReason ? (
                            <p className="text-xs text-rose-300">Failure: {report.failureReason}</p>
                          ) : null}
                        </div>
                        <p className="text-xs uppercase text-slate-300">{report.format}</p>
                        <p className="text-xs text-cyan-300">{report.status}</p>
                        <p className="text-xs text-slate-300">
                          Rows: {report.rowCount ?? '-'}
                          {report.completedAt
                            ? ` · Completed ${new Date(report.completedAt).toLocaleTimeString()}`
                            : ''}
                        </p>
                        <button
                          type="button"
                          disabled={
                            !hasExportRole || !report.downloadReady || downloadingReportId === report.reportId
                          }
                          onClick={() => void downloadReport(report.reportId)}
                          className="rounded-lg border border-cyan-500 px-3 py-1 text-xs text-cyan-200 disabled:opacity-50"
                        >
                          {downloadingReportId === report.reportId ? 'Preparing...' : 'Download'}
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="mb-6 rounded-xl border border-slate-800 bg-slate-900/60">
              <div className="border-b border-slate-800 px-4 py-3">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">Event performance</h2>
                <div className="mt-3 grid gap-2 md:grid-cols-[1fr_220px]">
                  <input
                    value={eventFilter}
                    onChange={event => setEventFilter(event.target.value)}
                    placeholder="Filter by event name"
                    className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                  />
                  <select
                    value={sortBy}
                    onChange={event =>
                      setSortBy(event.target.value as 'registrations' | 'checkinRate' | 'communicationsFailed')
                    }
                    className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                  >
                    <option value="registrations">Sort: registrations</option>
                    <option value="checkinRate">Sort: check-in rate</option>
                    <option value="communicationsFailed">Sort: communication failures</option>
                  </select>
                </div>
              </div>

              {filteredEvents.length === 0 ? (
                <p className="px-4 py-4 text-sm text-slate-300">No events match current filters.</p>
              ) : (
                <ul>
                  {filteredEvents.map(item => (
                    <li key={item.eventId} className="border-t border-slate-800 px-4 py-3 text-sm">
                      <div className="grid gap-2 md:grid-cols-[1.5fr_120px_120px_120px_160px_160px] md:items-center">
                        <div>
                          <p className="font-medium">{item.eventName}</p>
                          <p className="text-xs text-slate-400">
                            {item.startsAt ? new Date(item.startsAt).toLocaleString() : 'No start date'}
                          </p>
                        </div>
                        <p className="text-xs text-slate-300">Regs: {item.registrations}</p>
                        <p className="text-xs text-slate-300">Check-ins: {item.checkins}</p>
                        <p className="text-xs text-slate-300">Rate: {item.checkinRate}%</p>
                        <p className="text-xs text-emerald-300">Sent: {item.communicationsSent}</p>
                        <p className="text-xs text-rose-300">Failed: {item.communicationsFailed}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="mb-6 rounded-xl border border-slate-800 bg-slate-900/60">
              <div className="border-b border-slate-800 px-4 py-3">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">
                  Communication performance breakdown
                </h2>
                <p className="mt-1 text-xs text-slate-400">
                  Failure rate: {communicationInsights.failureRate}% across {data.kpis.communicationSent + data.kpis.communicationFailed}{' '}
                  tracked sends.
                </p>
              </div>

              {communicationInsights.topFailures.length === 0 ? (
                <p className="px-4 py-4 text-sm text-slate-300">No communication data recorded yet.</p>
              ) : (
                <ul>
                  {communicationInsights.topFailures.map(item => {
                    const totalForEvent = item.communicationsSent + item.communicationsFailed;
                    const eventFailureRate = totalForEvent
                      ? Number(((item.communicationsFailed / totalForEvent) * 100).toFixed(2))
                      : 0;

                    return (
                      <li key={item.eventId} className="border-t border-slate-800 px-4 py-3 text-sm">
                        <div className="grid gap-2 md:grid-cols-[1.5fr_140px_140px_160px] md:items-center">
                          <p>{item.eventName}</p>
                          <p className="text-xs text-emerald-300">Sent: {item.communicationsSent}</p>
                          <p className="text-xs text-rose-300">Failed: {item.communicationsFailed}</p>
                          <p className="text-xs text-amber-300">Failure rate: {eventFailureRate}%</p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            <section className="rounded-xl border border-slate-800 bg-slate-900/60">
              <div className="border-b border-slate-800 px-4 py-3">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">Usher scan performance</h2>
                <p className="mt-1 text-xs text-slate-400">Total scans: {usherInsights.totalScans}</p>
              </div>
              {usherInsights.leaderboard.length === 0 ? (
                <p className="px-4 py-4 text-sm text-slate-300">No usher scans recorded yet.</p>
              ) : (
                <ul>
                  {usherInsights.leaderboard.map(item => (
                    <li key={item.usherUserId} className="border-t border-slate-800 px-4 py-3 text-sm">
                      <div className="flex items-center justify-between">
                        <p>{item.usherName}</p>
                        <p className="text-cyan-300">
                          {item.scans} scans ({item.share}%)
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        ) : null}
      </div>
    </main>
  );
}

function KpiCard(props: { label: string; value: string }) {
  return (
    <article className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      <p className="text-xs uppercase tracking-wide text-slate-400">{props.label}</p>
      <p className="mt-2 text-xl font-semibold text-slate-100">{props.value}</p>
    </article>
  );
}
