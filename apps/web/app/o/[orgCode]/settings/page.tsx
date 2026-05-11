'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { authFetch, loadSession } from '../../../../lib/session';
import { useTheme } from '../../../../lib/theme-provider';

type LinkType = {
  id: string;
  name: string;
  color: string;
  isActive: boolean;
};

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5001';

const PRESET_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444',
  '#f97316', '#eab308', '#22c55e', '#14b8a6',
  '#0ea5e9', '#3b82f6', '#64748b', '#1e293b',
];

export default function OrgSettingsPage() {
  const router = useRouter();
  const params = useParams<{ orgCode: string }>();
  const { theme } = useTheme();
  const orgCode = typeof params.orgCode === 'string' ? params.orgCode : '';

  const [linkTypes, setLinkTypes] = useState<LinkType[]>([]);
  const [pageError, setPageError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Create form
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('#6366f1');
  const [createError, setCreateError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // Edit state
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('');
  const [editError, setEditError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const onSessionExpired = useCallback(() => router.replace(`/o/${orgCode}`), [orgCode, router]);

  const fetchLinkTypes = useCallback(async () => {
    const session = loadSession();
    if (!session) { router.replace(`/o/${orgCode}`); return; }
    setIsLoading(true);
    setPageError(null);
    try {
      const res = await authFetch(`${API_BASE}/org/${orgCode}/settings/link-types`, {}, onSessionExpired);
      if (!res.ok) throw new Error('Failed to load');
      setLinkTypes(await res.json() as LinkType[]);
    } catch {
      setPageError('Unable to load link types');
    } finally {
      setIsLoading(false);
    }
  }, [orgCode, router, onSessionExpired]);

  useEffect(() => { if (orgCode) void fetchLinkTypes(); }, [orgCode, fetchLinkTypes]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setCreateError(null);
    setIsCreating(true);
    try {
      const res = await authFetch(`${API_BASE}/org/${orgCode}/settings/link-types`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: newName.trim(), color: newColor })
      }, onSessionExpired);
      if (!res.ok) {
        const p = (await res.json().catch(() => ({}))) as { message?: string | string[] };
        setCreateError(Array.isArray(p.message) ? p.message.join(', ') : (p.message || 'Failed to create'));
        return;
      }
      setNewName(''); setNewColor('#6366f1');
      await fetchLinkTypes();
    } catch { setCreateError('Network error'); }
    finally { setIsCreating(false); }
  }

  function openEdit(lt: LinkType) {
    setEditId(lt.id); setEditName(lt.name); setEditColor(lt.color); setEditError(null);
  }

  async function onSaveEdit(e: FormEvent) {
    e.preventDefault();
    if (!editId) return;
    setEditError(null); setIsSaving(true);
    try {
      const res = await authFetch(`${API_BASE}/org/${orgCode}/settings/link-types/${editId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: editName.trim(), color: editColor })
      }, onSessionExpired);
      if (!res.ok) {
        const p = (await res.json().catch(() => ({}))) as { message?: string | string[] };
        setEditError(Array.isArray(p.message) ? p.message.join(', ') : (p.message || 'Failed to save'));
        return;
      }
      setEditId(null);
      await fetchLinkTypes();
    } catch { setEditError('Network error'); }
    finally { setIsSaving(false); }
  }

  async function onDelete(id: string) {
    try {
      const res = await authFetch(`${API_BASE}/org/${orgCode}/settings/link-types/${id}`, {
        method: 'DELETE'
      }, onSessionExpired);
      if (!res.ok) { setPageError('Failed to delete link type'); return; }
      await fetchLinkTypes();
    } catch { setPageError('Network error'); }
  }

  const bgColor = theme === 'dark' ? 'bg-slate-950' : 'bg-white';
  const textColor = theme === 'dark' ? 'text-slate-100' : 'text-slate-950';
  const borderColor = theme === 'dark' ? 'border-slate-800' : 'border-slate-200';
  const sectionBg = theme === 'dark' ? 'bg-slate-900/60' : 'bg-slate-50';
  const inputBg = theme === 'dark' ? 'bg-slate-950' : 'bg-white';
  const inputBorder = theme === 'dark' ? 'border-slate-700' : 'border-slate-300';
  const textSecondary = theme === 'dark' ? 'text-slate-400' : 'text-slate-600';
  const hoverBg = theme === 'dark' ? 'hover:bg-slate-800' : 'hover:bg-slate-100';
  const editBg = theme === 'dark' ? 'bg-slate-800/40' : 'bg-slate-100/50';

  return (
    <main className={`min-h-screen px-6 py-8 ${bgColor} ${textColor}`}>
      <div className="mx-auto max-w-3xl">
        {/* Header */}
        <header className="mb-6">
          <button
            type="button"
            onClick={() => router.push(`/o/${orgCode}`)}
            className={`mb-1 text-xs ${textSecondary} ${theme === 'dark' ? 'hover:text-slate-200' : 'hover:text-slate-700'}`}
          >
            ← Back to portal
          </button>
          <h1 className="text-2xl font-semibold tracking-tight">Org Settings</h1>
          <p className={`mt-1 text-sm ${textSecondary}`}>Configure link types, colors, and other org-wide settings.</p>
        </header>

        {pageError && (
          <p className={`mb-4 rounded-lg border px-4 py-3 text-sm ${
            theme === 'dark'
              ? 'border-rose-500/40 bg-rose-950/40 text-rose-300'
              : 'border-rose-300 bg-rose-100 text-rose-700'
          }`}>{pageError}</p>
        )}

        {/* Link Types section */}
        <section className={`rounded-2xl border ${borderColor} ${sectionBg}`}>
          <div className={`border-b ${borderColor} px-5 py-4`}>
            <h2 className={`font-semibold ${textColor}`}>Link Types</h2>
            <p className={`mt-0.5 text-xs ${textSecondary}`}>
              Define named types with colors. When creating a registration link, staff must choose one of these types.
              The color is also used on badges.
            </p>
          </div>

          {/* Create form */}
          <form onSubmit={onCreate} className={`flex flex-wrap items-end gap-3 border-b ${borderColor} px-5 py-4`}>
            <label className="grid gap-1 text-sm flex-1 min-w-[160px]">
              <span className={textSecondary}>Type name</span>
              <input
                value={newName}
                onChange={e => setNewName(e.target.value)}
                required maxLength={80}
                placeholder="e.g. VIP, General, Staff"
                className={`rounded-lg border ${inputBorder} ${inputBg} px-3 py-2 outline-none ${
                  theme === 'dark' ? 'ring-cyan-300 focus:ring' : 'ring-blue-300 focus:ring'
                }`}
              />
            </label>
            <label className="grid gap-1 text-sm">
              <span className={textSecondary}>Color</span>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={newColor}
                  onChange={e => setNewColor(e.target.value)}
                  className={`h-9 w-12 cursor-pointer rounded-lg border ${inputBorder} ${inputBg} p-1 [color-scheme:${theme}]`}
                />
                <div className="flex flex-wrap gap-1">
                  {PRESET_COLORS.map(c => (
                    <button
                      key={c}
                      type="button"
                      title={c}
                      onClick={() => setNewColor(c)}
                      className="h-5 w-5 rounded-full border-2 transition hover:scale-110"
                      style={{
                        backgroundColor: c,
                        borderColor: newColor === c ? (theme === 'dark' ? 'white' : 'black') : 'transparent'
                      }}
                    />
                  ))}
                </div>
              </div>
            </label>
            {createError && <p className={`w-full text-sm ${theme === 'dark' ? 'text-rose-300' : 'text-rose-600'}`}>{createError}</p>}
            <button
              type="submit"
              disabled={isCreating}
              className={`rounded-lg px-4 py-2 text-sm font-semibold transition disabled:opacity-60 ${
                theme === 'dark'
                  ? 'bg-cyan-400 text-slate-950 hover:bg-cyan-300'
                  : 'bg-blue-500 text-white hover:bg-blue-600'
              }`}
            >
              {isCreating ? 'Adding…' : 'Add type'}
            </button>
          </form>

          {/* List */}
          {isLoading && <p className={`px-5 py-6 text-sm ${textSecondary}`}>Loading…</p>}
          {!isLoading && linkTypes.length === 0 && (
            <p className={`px-5 py-6 text-sm ${textSecondary}`}>No link types defined yet.</p>
          )}
          <ul>
            {linkTypes.map(lt => (
              <li key={lt.id} className={`border-t ${borderColor}`}>
                {editId === lt.id ? (
                  <form onSubmit={onSaveEdit} className={`flex flex-wrap items-end gap-3 px-5 py-4 ${editBg}`}>
                    <label className="grid gap-1 text-sm flex-1 min-w-[160px]">
                      <span className={textSecondary}>Name</span>
                      <input
                        value={editName}
                        onChange={e => setEditName(e.target.value)}
                        required maxLength={80}
                        className={`rounded-lg border ${inputBorder} ${inputBg} px-3 py-2 outline-none ${
                          theme === 'dark' ? 'ring-cyan-300 focus:ring' : 'ring-blue-300 focus:ring'
                        }`}
                      />
                    </label>
                    <label className="grid gap-1 text-sm">
                      <span className={textSecondary}>Color</span>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={editColor}
                          onChange={e => setEditColor(e.target.value)}
                          className={`h-9 w-12 cursor-pointer rounded-lg border ${inputBorder} ${inputBg} p-1 [color-scheme:${theme}]`}
                        />
                        <div className="flex flex-wrap gap-1">
                          {PRESET_COLORS.map(c => (
                            <button
                              key={c}
                              type="button"
                              onClick={() => setEditColor(c)}
                              className="h-5 w-5 rounded-full border-2 transition hover:scale-110"
                              style={{
                                backgroundColor: c,
                                borderColor: editColor === c ? (theme === 'dark' ? 'white' : 'black') : 'transparent'
                              }}
                            />
                          ))}
                        </div>
                      </div>
                    </label>
                    {editError && <p className={`w-full text-sm ${theme === 'dark' ? 'text-rose-300' : 'text-rose-600'}`}>{editError}</p>}
                    <div className="flex gap-2">
                      <button type="submit" disabled={isSaving}
                        className={`rounded-lg px-4 py-2 text-sm font-semibold transition disabled:opacity-60 ${
                          theme === 'dark'
                            ? 'bg-cyan-400 text-slate-950 hover:bg-cyan-300'
                            : 'bg-blue-500 text-white hover:bg-blue-600'
                        }`}>
                        {isSaving ? 'Saving…' : 'Save'}
                      </button>
                      <button type="button" onClick={() => setEditId(null)}
                        className={`rounded-lg border px-3 py-2 text-sm transition ${
                          theme === 'dark'
                            ? `border-slate-700 text-slate-300 ${hoverBg}`
                            : `border-slate-300 text-slate-700 ${hoverBg}`
                        }`}>
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="flex items-center justify-between gap-3 px-5 py-3">
                    <div className="flex items-center gap-3">
                      <span
                        className={`h-5 w-5 flex-shrink-0 rounded-full border ${
                          theme === 'dark' ? 'border-white/10' : 'border-black/10'
                        }`}
                        style={{ backgroundColor: lt.color }}
                      />
                      <span className="font-medium">{lt.name}</span>
                      <span className={`text-xs font-mono ${theme === 'dark' ? 'text-slate-500' : 'text-slate-500'}`}>{lt.color}</span>
                    </div>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => openEdit(lt)}
                        className={`rounded-lg border px-3 py-1.5 text-xs transition ${
                          theme === 'dark'
                            ? `border-slate-600 text-slate-200 ${hoverBg}`
                            : `border-slate-300 text-slate-700 ${hoverBg}`
                        }`}>
                        Edit
                      </button>
                      <button type="button" onClick={() => void onDelete(lt.id)}
                        className={`rounded-lg border px-3 py-1.5 text-xs transition ${
                          theme === 'dark'
                            ? 'border-rose-500/50 text-rose-200 hover:bg-rose-500/10'
                            : 'border-rose-300 text-rose-700 hover:bg-rose-100'
                        }`}>
                        Remove
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
