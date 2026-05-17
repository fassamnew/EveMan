'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { authFetch, loadSession } from '../../../../../../lib/session';

type LinkType = {
  id: string;
  name: string;
  color: string;
};

type LinkItem = {
  id: string;
  slug: string;
  title: string;
  isActive: boolean;
  linkTypeId: string | null;
  badgeTemplateId?: string | null;
  linkType: LinkType | null;
  rule?: {
    visibility: 'PUBLIC' | 'UNLISTED' | 'PRIVATE';
    approvalMode: 'AUTO' | 'MANUAL';
    capacity: number | null;
    opensAt: string | null;
    closesAt: string | null;
  } | null;
};

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || '/api';

const VISIBILITY_LABELS: Record<string, string> = {
  PUBLIC: 'Public',
  UNLISTED: 'Unlisted',
  PRIVATE: 'Private'
};

function toDatetimeLocal(iso: string | null): string {
  if (!iso) return '';
  return iso.slice(0, 16);
}

export default function EventLinksPage() {
  const router = useRouter();
  const params = useParams<{ orgCode: string; eventId: string }>();
  const { orgCode, eventId } = params;

  const [links, setLinks] = useState<LinkItem[]>([]);
  const [linkTypes, setLinkTypes] = useState<LinkType[]>([]);
  const [pageError, setPageError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Create form
  const [showCreate, setShowCreate] = useState(false);
  const [cTitle, setCTitle] = useState('');
  const [cSlug, setCSlug] = useState('');
  const [cLinkTypeId, setCLinkTypeId] = useState('');
  const [cVisibility, setCVisibility] = useState<'PUBLIC' | 'UNLISTED' | 'PRIVATE'>('PUBLIC');
  const [cApproval, setCApproval] = useState<'AUTO' | 'MANUAL'>('AUTO');
  const [cCapacity, setCCapacity] = useState('');
  const [cOpensAt, setCOpensAt] = useState('');
  const [cClosesAt, setCClosesAt] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // Edit state
  const [editId, setEditId] = useState<string | null>(null);
  const [eTitle, setETitle] = useState('');
  const [eLinkTypeId, setELinkTypeId] = useState('');
  const [eVisibility, setEVisibility] = useState<'PUBLIC' | 'UNLISTED' | 'PRIVATE'>('PUBLIC');
  const [eApproval, setEApproval] = useState<'AUTO' | 'MANUAL'>('AUTO');
  const [eCapacity, setECapacity] = useState('');
  const [eOpensAt, setEOpensAt] = useState('');
  const [eClosesAt, setEClosesAt] = useState('');
  const [eActive, setEActive] = useState(true);
  const [editError, setEditError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const onSessionExpired = useCallback(() => router.replace(`/o/${orgCode}`), [orgCode, router]);

  const fetchLinkTypes = useCallback(async () => {
    try {
      const res = await authFetch(`${API_BASE}/org/${orgCode}/settings/link-types`, {}, onSessionExpired);
      if (res.ok) setLinkTypes(await res.json() as LinkType[]);
    } catch { /* non-fatal */ }
  }, [orgCode, onSessionExpired]);

  const fetchLinks = useCallback(async () => {
    const session = loadSession();
    if (!session) { router.replace(`/o/${orgCode}`); return; }
    setIsLoading(true);
    setPageError(null);
    try {
      const res = await authFetch(`${API_BASE}/org/${orgCode}/events/${eventId}/links`, {}, onSessionExpired);
      if (!res.ok) throw new Error('Failed to load links');
      setLinks(await res.json() as LinkItem[]);
    } catch {
      setPageError('Unable to load links');
    } finally {
      setIsLoading(false);
    }
  }, [orgCode, eventId, router, onSessionExpired]);

  useEffect(() => {
    if (!orgCode || !eventId) return;
    void fetchLinkTypes();
    void fetchLinks();
  }, [orgCode, eventId, fetchLinkTypes, fetchLinks]);

  function readMessage(payload: unknown, fallback: string): string {
    if (!payload || typeof payload !== 'object') return fallback;
    const r = payload as { message?: string | string[]; suggestions?: string[] };
    if (!r.message) return fallback;
    const msg = Array.isArray(r.message) ? r.message.join(', ') : r.message;
    if (Array.isArray(r.suggestions) && r.suggestions.length > 0) {
      return `${msg}. Try: ${r.suggestions.join(', ')}`;
    }
    return msg;
  }

  function slugify(s: string): string {
    return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  }

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    if (linkTypes.length > 0 && !cLinkTypeId) {
      setCreateError('Please select a link type');
      return;
    }
    setCreateError(null); setIsCreating(true);
    try {
      const res = await authFetch(`${API_BASE}/org/${orgCode}/events/${eventId}/links`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          title: cTitle.trim(),
          slug: cSlug.trim(),
          linkTypeId: cLinkTypeId || undefined,
          visibility: cVisibility,
          approvalMode: cApproval,
          capacity: cCapacity ? Number(cCapacity) : undefined,
          opensAt: cOpensAt || undefined,
          closesAt: cClosesAt || undefined
        })
      }, onSessionExpired);
      if (!res.ok) {
        const p = await res.json().catch(() => ({}));
        setCreateError(readMessage(p, 'Failed to create link'));
        return;
      }
      setShowCreate(false);
      setCTitle(''); setCSlug(''); setCLinkTypeId(''); setCVisibility('PUBLIC');
      setCApproval('AUTO'); setCCapacity(''); setCOpensAt(''); setCClosesAt('');
      await fetchLinks();
    } catch { setCreateError('Network error'); }
    finally { setIsCreating(false); }
  }

  function openEdit(item: LinkItem) {
    setEditId(item.id);
    setETitle(item.title);
    setELinkTypeId(item.linkTypeId ?? '');
    setEVisibility(item.rule?.visibility ?? 'PUBLIC');
    setEApproval(item.rule?.approvalMode ?? 'AUTO');
    setECapacity(item.rule?.capacity != null ? String(item.rule.capacity) : '');
    setEOpensAt(toDatetimeLocal(item.rule?.opensAt ?? null));
    setEClosesAt(toDatetimeLocal(item.rule?.closesAt ?? null));
    setEActive(item.isActive);
    setEditError(null);
  }

  async function onSaveEdit(e: FormEvent) {
    e.preventDefault();
    if (!editId) return;
    setEditError(null); setIsSaving(true);
    try {
      const res = await authFetch(`${API_BASE}/org/${orgCode}/events/${eventId}/links/${editId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          title: eTitle.trim(),
          linkTypeId: eLinkTypeId || null,
          visibility: eVisibility,
          approvalMode: eApproval,
          capacity: eCapacity ? Number(eCapacity) : null,
          opensAt: eOpensAt || undefined,
          closesAt: eClosesAt || undefined,
          isActive: eActive
        })
      }, onSessionExpired);
      if (!res.ok) {
        const p = await res.json().catch(() => ({}));
        setEditError(readMessage(p, 'Failed to save'));
        return;
      }
      setEditId(null);
      await fetchLinks();
    } catch { setEditError('Network error'); }
    finally { setIsSaving(false); }
  }

  async function onDelete(linkId: string) {
    try {
      const res = await authFetch(`${API_BASE}/org/${orgCode}/events/${eventId}/links/${linkId}`, {
        method: 'DELETE'
      }, onSessionExpired);
      if (!res.ok) {
        const p = await res.json().catch(() => ({}));
        setPageError(readMessage(p, 'Failed to delete link'));
        return;
      }
      await fetchLinks();
    } catch { setPageError('Network error'); }
  }

  const selectedCreateType = linkTypes.find(lt => lt.id === cLinkTypeId);

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-8 text-slate-100">
      <div className="mx-auto max-w-5xl">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <button
              type="button"
              onClick={() => router.push(`/o/${orgCode}/events`)}
              className="mb-1 text-xs text-slate-400 hover:text-slate-200"
            >
              ← Back to events
            </button>
            <h1 className="text-2xl font-semibold tracking-tight">Registration Links</h1>
          </div>
          <div className="flex gap-2">
            {linkTypes.length === 0 && (
              <button
                type="button"
                onClick={() => router.push(`/o/${orgCode}/settings`)}
                className="rounded-xl border border-amber-500/50 px-4 py-2 text-xs text-amber-200 hover:bg-amber-500/10 transition"
              >
                ⚙ Define link types first
              </button>
            )}
            <button
              type="button"
              onClick={() => { setShowCreate(v => !v); setCreateError(null); }}
              className="rounded-xl bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-300 transition"
            >
              {showCreate ? 'Cancel' : '+ New link'}
            </button>
          </div>
        </header>

        {pageError && (
          <p className="mb-4 rounded-lg border border-rose-500/40 bg-rose-950/40 px-4 py-3 text-sm text-rose-300">{pageError}</p>
        )}

        {showCreate && (
          <form onSubmit={onCreate} className="mb-6 rounded-2xl border border-cyan-500/30 bg-slate-900/70 p-5">
            <h2 className="mb-4 text-base font-semibold text-cyan-200">New registration link</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-1 text-sm">
                <span className="text-slate-300">Title <span className="text-rose-400">*</span></span>
                <input
                  value={cTitle}
                  onChange={e => { setCTitle(e.target.value); if (!cSlug) setCSlug(slugify(e.target.value)); }}
                  required maxLength={120}
                  placeholder="e.g. VIP Registration"
                  className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 outline-none ring-cyan-300 focus:ring"
                />
              </label>
              <label className="grid gap-1 text-sm">
                <span className="text-slate-300">Slug <span className="text-rose-400">*</span></span>
                <input
                  value={cSlug}
                  onChange={e => setCSlug(e.target.value)}
                  required maxLength={80}
                  placeholder="vip-registration"
                  className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 font-mono outline-none ring-cyan-300 focus:ring"
                />
              </label>
              <div className="col-span-full grid gap-1 text-sm">
                <span className="text-slate-300">
                  Link type{' '}
                  {linkTypes.length > 0
                    ? <span className="text-rose-400">*</span>
                    : <span className="text-slate-500">(no types — <button type="button" onClick={() => router.push(`/o/${orgCode}/settings`)} className="text-cyan-300 underline">add in settings</button>)</span>
                  }
                </span>
                <div className="flex flex-wrap gap-2 pt-1">
                  {linkTypes.map(lt => (
                    <button key={lt.id} type="button" onClick={() => setCLinkTypeId(lt.id)}
                      className="flex items-center gap-2 rounded-full border px-3 py-1 text-sm transition"
                      style={{
                        borderColor: cLinkTypeId === lt.id ? lt.color : 'rgba(100,116,139,0.4)',
                        backgroundColor: cLinkTypeId === lt.id ? `${lt.color}22` : 'transparent',
                        color: cLinkTypeId === lt.id ? lt.color : '#94a3b8'
                      }}>
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: lt.color }} />
                      {lt.name}
                    </button>
                  ))}
                  {selectedCreateType && (
                    <button type="button" onClick={() => setCLinkTypeId('')}
                      className="rounded-full border border-slate-600 px-3 py-1 text-xs text-slate-400 hover:text-slate-200">
                      Clear
                    </button>
                  )}
                </div>
              </div>
              <label className="grid gap-1 text-sm">
                <span className="text-slate-300">Visibility</span>
                <select value={cVisibility} onChange={e => setCVisibility(e.target.value as 'PUBLIC' | 'UNLISTED' | 'PRIVATE')}
                  className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 outline-none ring-cyan-300 focus:ring">
                  <option value="PUBLIC">Public</option>
                  <option value="UNLISTED">Unlisted</option>
                  <option value="PRIVATE">Private</option>
                </select>
              </label>
              <label className="grid gap-1 text-sm">
                <span className="text-slate-300">Approval mode</span>
                <select value={cApproval} onChange={e => setCApproval(e.target.value as 'AUTO' | 'MANUAL')}
                  className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 outline-none ring-cyan-300 focus:ring">
                  <option value="AUTO">Auto-approve</option>
                  <option value="MANUAL">Manual review</option>
                </select>
              </label>
              <label className="grid gap-1 text-sm">
                <span className="text-slate-300">Capacity (optional)</span>
                <input type="number" min={1} value={cCapacity} onChange={e => setCCapacity(e.target.value)} placeholder="Unlimited"
                  className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 outline-none ring-cyan-300 focus:ring" />
              </label>
              <label className="grid gap-1 text-sm">
                <span className="text-slate-300">Opens at</span>
                <input type="datetime-local" value={cOpensAt} onChange={e => setCOpensAt(e.target.value)}
                  className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 outline-none ring-cyan-300 focus:ring [color-scheme:dark]" />
              </label>
              <label className="grid gap-1 text-sm">
                <span className="text-slate-300">Closes at</span>
                <input type="datetime-local" value={cClosesAt} onChange={e => setCClosesAt(e.target.value)}
                  className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 outline-none ring-cyan-300 focus:ring [color-scheme:dark]" />
              </label>
            </div>
            {createError && <p className="mt-3 text-sm text-rose-300">{createError}</p>}
            <div className="mt-4 flex gap-2">
              <button type="submit" disabled={isCreating}
                className="rounded-lg bg-cyan-400 px-5 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-300 disabled:opacity-60 transition">
                {isCreating ? 'Creating…' : 'Create link'}
              </button>
              <button type="button" onClick={() => setShowCreate(false)}
                className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800 transition">
                Cancel
              </button>
            </div>
          </form>
        )}

        <section className="rounded-2xl border border-slate-800 bg-slate-900/60">
          <div className="border-b border-slate-800 px-5 py-3 text-sm font-semibold text-slate-300">
            {links.length} link{links.length !== 1 ? 's' : ''}
          </div>
          {isLoading && <p className="px-5 py-6 text-sm text-slate-400">Loading…</p>}
          {!isLoading && links.length === 0 && (
            <p className="px-5 py-6 text-sm text-slate-400">No links yet.</p>
          )}
          <ul>
            {links.map(item => (
              <li key={item.id} className="border-t border-slate-800">
                {editId === item.id ? (
                  <form onSubmit={onSaveEdit} className="grid gap-4 bg-slate-800/40 p-5 sm:grid-cols-2">
                    <label className="grid gap-1 text-sm">
                      <span className="text-slate-300">Title</span>
                      <input value={eTitle} onChange={e => setETitle(e.target.value)} required maxLength={120}
                        className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 outline-none ring-cyan-300 focus:ring" />
                    </label>
                    <div className="grid gap-1 text-sm">
                      <span className="text-slate-300">Link type</span>
                      <div className="flex flex-wrap gap-2 pt-1">
                        {linkTypes.map(lt => (
                          <button key={lt.id} type="button" onClick={() => setELinkTypeId(lt.id)}
                            className="flex items-center gap-2 rounded-full border px-3 py-1 text-sm transition"
                            style={{
                              borderColor: eLinkTypeId === lt.id ? lt.color : 'rgba(100,116,139,0.4)',
                              backgroundColor: eLinkTypeId === lt.id ? `${lt.color}22` : 'transparent',
                              color: eLinkTypeId === lt.id ? lt.color : '#94a3b8'
                            }}>
                            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: lt.color }} />
                            {lt.name}
                          </button>
                        ))}
                        {eLinkTypeId && (
                          <button type="button" onClick={() => setELinkTypeId('')}
                            className="rounded-full border border-slate-600 px-3 py-1 text-xs text-slate-400 hover:text-slate-200">
                            Clear
                          </button>
                        )}
                      </div>
                    </div>
                    <label className="grid gap-1 text-sm">
                      <span className="text-slate-300">Visibility</span>
                      <select value={eVisibility} onChange={e => setEVisibility(e.target.value as 'PUBLIC' | 'UNLISTED' | 'PRIVATE')}
                        className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 outline-none ring-cyan-300 focus:ring">
                        <option value="PUBLIC">Public</option>
                        <option value="UNLISTED">Unlisted</option>
                        <option value="PRIVATE">Private</option>
                      </select>
                    </label>
                    <label className="grid gap-1 text-sm">
                      <span className="text-slate-300">Approval mode</span>
                      <select value={eApproval} onChange={e => setEApproval(e.target.value as 'AUTO' | 'MANUAL')}
                        className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 outline-none ring-cyan-300 focus:ring">
                        <option value="AUTO">Auto-approve</option>
                        <option value="MANUAL">Manual review</option>
                      </select>
                    </label>
                    <label className="grid gap-1 text-sm">
                      <span className="text-slate-300">Capacity</span>
                      <input type="number" min={1} value={eCapacity} onChange={e => setECapacity(e.target.value)} placeholder="Unlimited"
                        className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 outline-none ring-cyan-300 focus:ring" />
                    </label>
                    <label className="grid gap-1 text-sm">
                      <span className="text-slate-300">Opens at</span>
                      <input type="datetime-local" value={eOpensAt} onChange={e => setEOpensAt(e.target.value)}
                        className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 outline-none ring-cyan-300 focus:ring [color-scheme:dark]" />
                    </label>
                    <label className="grid gap-1 text-sm">
                      <span className="text-slate-300">Closes at</span>
                      <input type="datetime-local" value={eClosesAt} onChange={e => setEClosesAt(e.target.value)}
                        className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 outline-none ring-cyan-300 focus:ring [color-scheme:dark]" />
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={eActive} onChange={e => setEActive(e.target.checked)} className="rounded" />
                      <span className="text-slate-300">Active</span>
                    </label>
                    {editError && <p className="col-span-full text-sm text-rose-300">{editError}</p>}
                    <div className="col-span-full flex gap-2">
                      <button type="submit" disabled={isSaving}
                        className="rounded-lg bg-cyan-400 px-4 py-1.5 text-sm font-semibold text-slate-950 hover:bg-cyan-300 disabled:opacity-60 transition">
                        {isSaving ? 'Saving…' : 'Save changes'}
                      </button>
                      <button type="button" onClick={() => setEditId(null)}
                        className="rounded-lg border border-slate-700 px-4 py-1.5 text-sm text-slate-300 hover:bg-slate-800 transition">
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="flex flex-wrap items-start justify-between gap-3 px-5 py-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {item.linkType ? (
                          <span className="flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium"
                            style={{
                              borderColor: `${item.linkType.color}60`,
                              backgroundColor: `${item.linkType.color}18`,
                              color: item.linkType.color
                            }}>
                            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.linkType.color }} />
                            {item.linkType.name}
                          </span>
                        ) : (
                          <span className="rounded-full border border-slate-600/40 bg-slate-700/20 px-2.5 py-0.5 text-xs text-slate-500">No type</span>
                        )}
                        <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${item.isActive ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' : 'border-slate-600/30 bg-slate-700/20 text-slate-400'}`}>
                          {item.isActive ? 'Active' : 'Inactive'}
                        </span>
                        <span className="rounded-full border border-slate-600/30 bg-slate-700/20 px-2 py-0.5 text-xs text-slate-400">
                          {VISIBILITY_LABELS[item.rule?.visibility ?? 'PUBLIC']}
                        </span>
                      </div>
                      <p className="mt-1.5 font-medium">{item.title}</p>
                      <p className="mt-0.5 font-mono text-xs text-slate-500">/{item.slug}</p>
                      <div className="mt-1 flex flex-wrap gap-3 text-xs text-slate-500">
                        {item.rule?.capacity != null && <span>Cap: {item.rule.capacity}</span>}
                        {item.rule?.opensAt && <span>Opens: {new Date(item.rule.opensAt).toLocaleString()}</span>}
                        {item.rule?.closesAt && <span>Closes: {new Date(item.rule.closesAt).toLocaleString()}</span>}
                        <span>{item.rule?.approvalMode === 'MANUAL' ? 'Manual approval' : 'Auto-approve'}</span>
                        {item.badgeTemplateId ? <span>Badge template assigned</span> : <span>No badge template</span>}
                      </div>
                    </div>
                    <div className="flex flex-shrink-0 flex-wrap gap-2">
                      <button type="button" onClick={() => openEdit(item)}
                        className="rounded-lg border border-slate-600 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-800 transition">
                        Edit
                      </button>
                      <button type="button" onClick={() => router.push(`/o/${orgCode}/events/${eventId}/links/${item.id}/form`)}
                        className="rounded-lg border border-cyan-600 px-3 py-1.5 text-xs text-cyan-200 hover:bg-cyan-600/10 transition">
                        Form Builder
                      </button>
                      <button type="button" onClick={() => router.push(`/o/${orgCode}/events/${eventId}/links/${item.id}/design`)}
                        className="rounded-lg border border-amber-500/60 px-3 py-1.5 text-xs text-amber-200 hover:bg-amber-500/10 transition">
                        Page Designer
                      </button>
                      <button type="button" onClick={() => void onDelete(item.id)}
                        className="rounded-lg border border-rose-500/50 px-3 py-1.5 text-xs text-rose-200 hover:bg-rose-500/10 transition">
                        Delete
                      </button>
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
