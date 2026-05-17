'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { authFetch, loadSession } from '../../../../lib/session';
import { useTheme } from '../../../../lib/theme-provider';

type EventItem = {
  id: string;
  name: string;
  description: string | null;
  startsAt: string | null;
  endsAt: string | null;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  createdAt: string;
};

type EventTemplate = {
  id: string;
  name: string;
  eventDraft: {
    name: string;
    description?: string;
    startsAt?: string;
    endsAt?: string;
  };
  createdAt: string;
  updatedAt: string;
};

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || '/api';

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Draft',
  PUBLISHED: 'Published',
  ARCHIVED: 'Archived'
};

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'text-amber-300 bg-amber-500/10 border-amber-500/30',
  PUBLISHED: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30',
  ARCHIVED: 'text-slate-400 bg-slate-700/30 border-slate-600/30'
};

function formatDateTime(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

function toDatetimeLocal(iso: string | null): string {
  if (!iso) return '';
  // format: YYYY-MM-DDTHH:MM
  return iso.slice(0, 16);
}

export default function OrgEventsPage() {
  const router = useRouter();
  const { theme } = useTheme();
  const params = useParams<{ orgCode: string }>();
  const orgCode = typeof params.orgCode === 'string' ? params.orgCode : '';

  const [events, setEvents] = useState<EventItem[]>([]);
  const [templates, setTemplates] = useState<EventTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [templateName, setTemplateName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isApplyingTemplate, setIsApplyingTemplate] = useState(false);
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);

  // Create form state
  const [showCreate, setShowCreate] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createDesc, setCreateDesc] = useState('');
  const [createStartsAt, setCreateStartsAt] = useState('');
  const [createEndsAt, setCreateEndsAt] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // Edit state (one at a time)
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editStartsAt, setEditStartsAt] = useState('');
  const [editEndsAt, setEditEndsAt] = useState('');
  const [editStatus, setEditStatus] = useState('');
  const [editError, setEditError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const isDark = theme === 'dark';
  const pageClass = isDark
    ? 'min-h-screen bg-slate-950 px-6 py-8 text-slate-100'
    : 'min-h-screen bg-slate-50 px-6 py-8 text-slate-950';
  const cardClass = isDark
    ? 'rounded-2xl border border-slate-800 bg-slate-900/60'
    : 'rounded-2xl border border-slate-200 bg-white';
  const fieldClass = isDark
    ? 'rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 outline-none ring-cyan-300 focus:ring'
    : 'rounded-lg border border-slate-300 bg-white px-3 py-2 outline-none ring-blue-300 focus:ring';
  const secondaryTextClass = isDark ? 'text-slate-300' : 'text-slate-700';
  const subtleTextClass = isDark ? 'text-slate-400' : 'text-slate-600';

  const onSessionExpired = useCallback(() => router.replace(`/o/${orgCode}`), [orgCode, router]);

  const fetchEvents = useCallback(async () => {
    const session = loadSession();
    if (!session) { router.replace(`/o/${orgCode}`); return; }

    setIsLoading(true);
    setPageError(null);
    try {
      const res = await authFetch(`${API_BASE}/org/${orgCode}/events`, {}, onSessionExpired);
      if (!res.ok) throw new Error('Failed to load events');
      setEvents(await res.json() as EventItem[]);
    } catch {
      setPageError('Unable to load events');
    } finally {
      setIsLoading(false);
    }
  }, [orgCode, router, onSessionExpired]);

  const fetchTemplates = useCallback(async () => {
    const session = loadSession();
    if (!session) {
      router.replace(`/o/${orgCode}`);
      return;
    }

    try {
      const res = await authFetch(`${API_BASE}/org/${orgCode}/event-templates`, {}, onSessionExpired);
      if (!res.ok) {
        return;
      }

      const payload = (await res.json()) as EventTemplate[];
      setTemplates(payload);
      if (!selectedTemplateId && payload.length > 0) {
        setSelectedTemplateId(payload[0].id);
      }
    } catch {
      // Non-fatal.
    }
  }, [orgCode, onSessionExpired, router, selectedTemplateId]);

  useEffect(() => {
    if (!orgCode) return;
    void fetchEvents();
    void fetchTemplates();
  }, [orgCode, fetchEvents, fetchTemplates]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setCreateError(null);
    setIsCreating(true);
    try {
      const res = await authFetch(`${API_BASE}/org/${orgCode}/events`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: createName.trim(),
          description: createDesc.trim() || undefined,
          startsAt: createStartsAt || undefined,
          endsAt: createEndsAt || undefined
        })
      }, onSessionExpired);

      if (!res.ok) {
        const p = (await res.json().catch(() => ({}))) as { message?: string | string[] };
        setCreateError(Array.isArray(p.message) ? p.message.join(', ') : (p.message || 'Failed to create event'));
        return;
      }
      setShowCreate(false);
      setCreateName(''); setCreateDesc(''); setCreateStartsAt(''); setCreateEndsAt('');
      await fetchEvents();
    } catch {
      setCreateError('Network error');
    } finally {
      setIsCreating(false);
    }
  }

  function openEdit(item: EventItem) {
    setEditId(item.id);
    setEditName(item.name);
    setEditDesc(item.description ?? '');
    setEditStartsAt(toDatetimeLocal(item.startsAt));
    setEditEndsAt(toDatetimeLocal(item.endsAt));
    setEditStatus(item.status);
    setEditError(null);
  }

  async function onSaveEdit(e: FormEvent) {
    e.preventDefault();
    if (!editId) return;
    setEditError(null);
    setIsSaving(true);
    try {
      const res = await authFetch(`${API_BASE}/org/${orgCode}/events/${editId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: editName.trim(),
          description: editDesc.trim() || undefined,
          startsAt: editStartsAt || undefined,
          endsAt: editEndsAt || undefined,
          status: editStatus
        })
      }, onSessionExpired);

      if (!res.ok) {
        const p = (await res.json().catch(() => ({}))) as { message?: string | string[] };
        setEditError(Array.isArray(p.message) ? p.message.join(', ') : (p.message || 'Failed to save'));
        return;
      }
      setEditId(null);
      await fetchEvents();
    } catch {
      setEditError('Network error');
    } finally {
      setIsSaving(false);
    }
  }

  async function onArchive(eventId: string) {
    try {
      const res = await authFetch(`${API_BASE}/org/${orgCode}/events/${eventId}/archive`, {
        method: 'POST'
      }, onSessionExpired);
      if (!res.ok) {
        const p = (await res.json().catch(() => ({}))) as { message?: string };
        setPageError(p.message || 'Failed to archive event');
        return;
      }
      await fetchEvents();
    } catch {
      setPageError('Network error while archiving');
    }
  }

  async function onSaveTemplateFromDraft() {
    if (!templateName.trim()) {
      setPageError('Template name is required');
      return;
    }

    if (!createName.trim()) {
      setPageError('Fill event name in draft form before saving template');
      return;
    }

    setIsSavingTemplate(true);
    setPageError(null);
    try {
      const res = await authFetch(
        `${API_BASE}/org/${orgCode}/event-templates`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            name: templateName.trim(),
            eventName: createName.trim()
          })
        },
        onSessionExpired
      );

      if (!res.ok) {
        const payload = (await res.json().catch(() => ({}))) as { message?: string | string[] };
        setPageError(Array.isArray(payload.message) ? payload.message.join(', ') : payload.message || 'Failed to save template');
        return;
      }

      setTemplateName('');
      await fetchTemplates();
    } catch {
      setPageError('Network error while saving template');
    } finally {
      setIsSavingTemplate(false);
    }
  }

  async function onApplyTemplate() {
    if (!selectedTemplateId) {
      setPageError('Select a template first');
      return;
    }

    setIsApplyingTemplate(true);
    setPageError(null);
    try {
      const res = await authFetch(
        `${API_BASE}/org/${orgCode}/event-templates/${selectedTemplateId}/apply`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({})
        },
        onSessionExpired
      );

      if (!res.ok) {
        const payload = (await res.json().catch(() => ({}))) as { message?: string | string[] };
        setPageError(Array.isArray(payload.message) ? payload.message.join(', ') : payload.message || 'Failed to apply template');
        return;
      }

      await fetchEvents();
    } catch {
      setPageError('Network error while applying template');
    } finally {
      setIsApplyingTemplate(false);
    }
  }

  async function onDeleteTemplate(templateId: string) {
    try {
      const res = await authFetch(
        `${API_BASE}/org/${orgCode}/event-templates/${templateId}`,
        { method: 'DELETE' },
        onSessionExpired
      );

      if (!res.ok) {
        const payload = (await res.json().catch(() => ({}))) as { message?: string | string[] };
        setPageError(Array.isArray(payload.message) ? payload.message.join(', ') : payload.message || 'Failed to delete template');
        return;
      }

      if (selectedTemplateId === templateId) {
        setSelectedTemplateId('');
      }
      await fetchTemplates();
    } catch {
      setPageError('Network error while deleting template');
    }
  }

  return (
    <main className={pageClass}>
      <div className="mx-auto max-w-5xl">
        {/* Header */}
        <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <button
              type="button"
              onClick={() => router.push(`/o/${orgCode}`)}
              className={isDark ? 'mb-1 text-xs text-slate-400 hover:text-slate-200' : 'mb-1 text-xs text-slate-600 hover:text-slate-800'}
            >
              ← Back to portal
            </button>
            <h1 className="text-2xl font-semibold tracking-tight">Events</h1>
          </div>
          <button
            type="button"
            onClick={() => { setShowCreate(v => !v); setCreateError(null); }}
            className="rounded-xl bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-300 transition"
          >
            {showCreate ? 'Cancel' : '+ New event'}
          </button>
        </header>

        {pageError && (
          <p className={isDark ? 'mb-4 rounded-lg border border-rose-500/40 bg-rose-950/40 px-4 py-3 text-sm text-rose-300' : 'mb-4 rounded-lg border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-700'}>{pageError}</p>
        )}

        <section className={`mb-6 p-5 ${cardClass}`}>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className={isDark ? 'text-base font-semibold text-cyan-200' : 'text-base font-semibold text-blue-700'}>Event Templates</h2>
            <span className={`text-xs ${subtleTextClass}`}>{templates.length} template{templates.length !== 1 ? 's' : ''}</span>
          </div>
          <div className="grid gap-3 md:grid-cols-[1fr_auto]">
            <select
              value={selectedTemplateId}
              onChange={event => setSelectedTemplateId(event.target.value)}
              className={`${fieldClass} text-sm`}
            >
              <option value="">Select template</option>
              {templates.map(template => (
                <option key={template.id} value={template.id}>
                  {template.name} · {template.eventDraft.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => void onApplyTemplate()}
              disabled={isApplyingTemplate || !selectedTemplateId}
              className="rounded-lg border border-cyan-500 px-4 py-2 text-sm font-semibold text-cyan-200 disabled:opacity-60"
            >
              {isApplyingTemplate ? 'Applying…' : 'Apply template'}
            </button>
          </div>

          {templates.length > 0 ? (
            <ul className="mt-3 space-y-2">
              {templates.map(template => (
                <li key={template.id} className={isDark ? 'flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-2 text-xs' : 'flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs'}>
                  <div>
                    <p className={isDark ? 'font-medium text-slate-200' : 'font-medium text-slate-800'}>{template.name}</p>
                    <p className={subtleTextClass}>Draft: {template.eventDraft.name}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void onDeleteTemplate(template.id)}
                    className="rounded-md border border-rose-500/50 px-2.5 py-1 text-rose-200"
                  >
                    Delete
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </section>

        {/* Create form */}
        {showCreate && (
          <form onSubmit={onCreate} className={isDark ? 'mb-6 rounded-2xl border border-cyan-500/30 bg-slate-900/70 p-5' : 'mb-6 rounded-2xl border border-blue-300 bg-white p-5'}>
            <h2 className={isDark ? 'mb-4 text-base font-semibold text-cyan-200' : 'mb-4 text-base font-semibold text-blue-700'}>New event</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="col-span-full grid gap-1 text-sm">
                <span className={secondaryTextClass}>Event name <span className="text-rose-400">*</span></span>
                <input
                  value={createName}
                  onChange={e => setCreateName(e.target.value)}
                  required maxLength={160}
                  placeholder="e.g. Annual Tech Summit 2026"
                  className={fieldClass}
                />
              </label>
              <label className="col-span-full grid gap-1 text-sm">
                <span className={secondaryTextClass}>Description</span>
                <textarea
                  value={createDesc}
                  onChange={e => setCreateDesc(e.target.value)}
                  maxLength={500} rows={3}
                  placeholder="Brief description of the event (optional)"
                  className={`${fieldClass} resize-none`}
                />
              </label>
              <label className="grid gap-1 text-sm">
                <span className={secondaryTextClass}>Start date &amp; time</span>
                <input
                  type="datetime-local"
                  value={createStartsAt}
                  onChange={e => setCreateStartsAt(e.target.value)}
                  className={fieldClass}
                  style={{ colorScheme: theme }}
                />
              </label>
              <label className="grid gap-1 text-sm">
                <span className={secondaryTextClass}>End date &amp; time</span>
                <input
                  type="datetime-local"
                  value={createEndsAt}
                  onChange={e => setCreateEndsAt(e.target.value)}
                  className={fieldClass}
                  style={{ colorScheme: theme }}
                />
              </label>
            </div>
            {createError && <p className={isDark ? 'mt-3 text-sm text-rose-300' : 'mt-3 text-sm text-rose-600'}>{createError}</p>}
            <div className="mt-3 grid gap-2 md:grid-cols-[1fr_auto]">
              <input
                value={templateName}
                onChange={event => setTemplateName(event.target.value)}
                placeholder="Template name to save this draft"
                className={`${fieldClass} text-sm`}
              />
              <button
                type="button"
                onClick={() => void onSaveTemplateFromDraft()}
                disabled={isSavingTemplate}
                className="rounded-lg border border-indigo-500 px-4 py-2 text-sm font-semibold text-indigo-200 disabled:opacity-60"
              >
                {isSavingTemplate ? 'Saving template…' : 'Save as template'}
              </button>
            </div>
            <div className="mt-4 flex gap-2">
              <button
                type="submit"
                disabled={isCreating}
                className="rounded-lg bg-cyan-400 px-5 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-300 disabled:opacity-60 disabled:cursor-not-allowed transition"
              >
                {isCreating ? 'Creating…' : 'Create event'}
              </button>
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className={isDark ? 'rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800 transition' : 'rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 transition'}
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {/* Events list */}
        <section className={cardClass}>
          <div className={isDark ? 'border-b border-slate-800 px-5 py-3 text-sm font-semibold text-slate-300' : 'border-b border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700'}>
            {events.length} event{events.length !== 1 ? 's' : ''}
          </div>

          {isLoading && <p className={`px-5 py-6 text-sm ${subtleTextClass}`}>Loading…</p>}
          {!isLoading && events.length === 0 && (
            <p className={`px-5 py-6 text-sm ${subtleTextClass}`}>No events yet. Create one above.</p>
          )}

          <ul>
            {events.map(item => (
              <li key={item.id} className={isDark ? 'border-t border-slate-800' : 'border-t border-slate-200'}>
                {editId === item.id ? (
                  /* ── Inline edit form ── */
                  <form onSubmit={onSaveEdit} className={isDark ? 'p-5 grid gap-4 sm:grid-cols-2 bg-slate-800/40' : 'p-5 grid gap-4 sm:grid-cols-2 bg-slate-100/50'}>
                    <label className="col-span-full grid gap-1 text-sm">
                      <span className={secondaryTextClass}>Event name <span className="text-rose-400">*</span></span>
                      <input
                        value={editName}
                        onChange={e => setEditName(e.target.value)}
                        required maxLength={160}
                        className={fieldClass}
                      />
                    </label>
                    <label className="col-span-full grid gap-1 text-sm">
                      <span className={secondaryTextClass}>Description</span>
                      <textarea
                        value={editDesc}
                        onChange={e => setEditDesc(e.target.value)}
                        maxLength={500} rows={2}
                        className={`${fieldClass} resize-none`}
                      />
                    </label>
                    <label className="grid gap-1 text-sm">
                      <span className={secondaryTextClass}>Start date &amp; time</span>
                      <input type="datetime-local" value={editStartsAt} onChange={e => setEditStartsAt(e.target.value)}
                        className={fieldClass} style={{ colorScheme: theme }} />
                    </label>
                    <label className="grid gap-1 text-sm">
                      <span className={secondaryTextClass}>End date &amp; time</span>
                      <input type="datetime-local" value={editEndsAt} onChange={e => setEditEndsAt(e.target.value)}
                        className={fieldClass} style={{ colorScheme: theme }} />
                    </label>
                    <label className="grid gap-1 text-sm">
                      <span className={secondaryTextClass}>Status</span>
                      <select value={editStatus} onChange={e => setEditStatus(e.target.value)}
                        className={fieldClass}>
                        <option value="DRAFT">Draft</option>
                        <option value="PUBLISHED">Published</option>
                      </select>
                    </label>
                    {editError && <p className={isDark ? 'col-span-full text-sm text-rose-300' : 'col-span-full text-sm text-rose-600'}>{editError}</p>}
                    <div className="col-span-full flex gap-2">
                      <button type="submit" disabled={isSaving}
                        className="rounded-lg bg-cyan-400 px-4 py-1.5 text-sm font-semibold text-slate-950 hover:bg-cyan-300 disabled:opacity-60 transition">
                        {isSaving ? 'Saving…' : 'Save changes'}
                      </button>
                      <button type="button" onClick={() => setEditId(null)}
                        className={isDark ? 'rounded-lg border border-slate-700 px-4 py-1.5 text-sm text-slate-300 hover:bg-slate-800 transition' : 'rounded-lg border border-slate-300 px-4 py-1.5 text-sm text-slate-700 hover:bg-slate-100 transition'}>
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : (
                  /* ── Read-only row ── */
                  <div className="flex flex-wrap items-start justify-between gap-3 px-5 py-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium truncate">{item.name}</span>
                        <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[item.status]}`}>
                          {STATUS_LABELS[item.status]}
                        </span>
                      </div>
                      {item.description && (
                        <p className="mt-1 text-sm text-slate-400 line-clamp-2">{item.description}</p>
                      )}
                      <div className="mt-1.5 flex flex-wrap gap-3 text-xs text-slate-500">
                        <span>Starts: {formatDateTime(item.startsAt)}</span>
                        <span>Ends: {formatDateTime(item.endsAt)}</span>
                        <span>Created {new Date(item.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <div className="flex flex-shrink-0 flex-wrap gap-2">
                      {item.status !== 'ARCHIVED' && (
                        <button type="button" onClick={() => openEdit(item)}
                          className="rounded-lg border border-slate-600 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-800 transition">
                          Edit
                        </button>
                      )}
                      <button type="button" onClick={() => router.push(`/o/${orgCode}/events/${item.id}/links`)}
                        className="rounded-lg border border-cyan-600 px-3 py-1.5 text-xs text-cyan-200 hover:bg-cyan-600/10 transition">
                        Links
                      </button>
                      {item.status !== 'ARCHIVED' && (
                        <button type="button" onClick={() => void onArchive(item.id)}
                          className="rounded-lg border border-amber-500/60 px-3 py-1.5 text-xs text-amber-200 hover:bg-amber-500/10 transition">
                          Archive
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}

