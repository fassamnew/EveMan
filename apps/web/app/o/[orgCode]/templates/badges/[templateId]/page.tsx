'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { authFetch, loadSession } from '../../../../../../lib/session';

type BadgeTemplate = {
  id: string;
  name: string;
  version: number;
  configJson: Record<string, unknown>;
  isActive: boolean;
};

type BadgeDesign = {
  layout: string;
  badgeSize: 'STANDARD_4X6' | 'SMALL_3X4' | 'LANDSCAPE_4X3' | 'CUSTOM';
  orientation: 'PORTRAIT' | 'LANDSCAPE';
  backgroundColor: string;
  accentColor: string;
  textColor: string;
  eventLogoUrl: string;
  backgroundImageUrl: string;
  sponsorLogoUrls: string[];
  showQrPlaceholder: boolean;
  showPhotoPlaceholder: boolean;
  showCategoryLabel: boolean;
  showAccessZoneIndicator: boolean;
  sampleFullName: string;
  sampleOrganization: string;
  sampleDesignation: string;
  sampleCategory: string;
  sampleAccessZone: string;
  sampleEventName: string;
  sampleEventDate: string;
  extraConfigJson: string;
};

type BadgeDesignPreset = {
  label: string;
  description: string;
  values: Partial<Pick<BadgeDesign, 'layout' | 'badgeSize' | 'orientation' | 'backgroundColor' | 'accentColor' | 'textColor' | 'showQrPlaceholder' | 'showPhotoPlaceholder' | 'showCategoryLabel' | 'showAccessZoneIndicator'>>;
};

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || '/api';

const DEFAULT_DESIGN: BadgeDesign = {
  layout: 'classic',
  badgeSize: 'STANDARD_4X6',
  orientation: 'PORTRAIT',
  backgroundColor: '#0f172a',
  accentColor: '#22d3ee',
  textColor: '#f8fafc',
  eventLogoUrl: '',
  backgroundImageUrl: '',
  sponsorLogoUrls: [],
  showQrPlaceholder: true,
  showPhotoPlaceholder: true,
  showCategoryLabel: true,
  showAccessZoneIndicator: true,
  sampleFullName: 'Aster Mekonnen',
  sampleOrganization: 'Nova Org',
  sampleDesignation: 'Speaker',
  sampleCategory: 'VIP',
  sampleAccessZone: 'Main Hall',
  sampleEventName: 'Nova Summit',
  sampleEventDate: '2026-11-14',
    extraConfigJson: '',
};

const DESIGN_PRESETS: BadgeDesignPreset[] = [
  {
    label: 'Classic',
    description: 'Balanced, high-contrast layout',
    values: {
      layout: 'classic',
      badgeSize: 'STANDARD_4X6',
      orientation: 'PORTRAIT',
      backgroundColor: '#0f172a',
      accentColor: '#22d3ee',
      textColor: '#f8fafc',
      showQrPlaceholder: true,
      showPhotoPlaceholder: true,
      showCategoryLabel: true,
      showAccessZoneIndicator: true
    }
  },
  {
    label: 'Bright',
    description: 'Light background for clean printouts',
    values: {
      layout: 'bright',
      badgeSize: 'STANDARD_4X6',
      orientation: 'PORTRAIT',
      backgroundColor: '#f8fafc',
      accentColor: '#0f766e',
      textColor: '#0f172a',
      showQrPlaceholder: true,
      showPhotoPlaceholder: true,
      showCategoryLabel: true,
      showAccessZoneIndicator: true
    }
  },
  {
    label: 'Wide stage',
    description: 'Landscape-friendly for large events',
    values: {
      layout: 'wide-stage',
      badgeSize: 'LANDSCAPE_4X3',
      orientation: 'LANDSCAPE',
      backgroundColor: '#111827',
      accentColor: '#f59e0b',
      textColor: '#fff7ed',
      showQrPlaceholder: true,
      showPhotoPlaceholder: false,
      showCategoryLabel: true,
      showAccessZoneIndicator: true
    }
  }
];

function parseJson(raw: string): Record<string, unknown> {
  if (!raw.trim()) {
    return {};
  }

  const parsed = JSON.parse(raw) as unknown;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Template config JSON must be an object');
  }

  return parsed as Record<string, unknown>;
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function asBoolean(value: unknown, fallback = false): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter(item => typeof item === 'string') : [];
}

function deriveDesign(configJson: Record<string, unknown>): BadgeDesign {
  return {
    ...DEFAULT_DESIGN,
    layout: asString(configJson.layout, DEFAULT_DESIGN.layout),
    badgeSize: asString(configJson.badgeSize, DEFAULT_DESIGN.badgeSize) as BadgeDesign['badgeSize'],
    orientation: asString(configJson.orientation, DEFAULT_DESIGN.orientation) as BadgeDesign['orientation'],
    backgroundColor: asString(configJson.backgroundColor, DEFAULT_DESIGN.backgroundColor),
    accentColor: asString(configJson.accentColor, DEFAULT_DESIGN.accentColor),
    textColor: asString(configJson.textColor, DEFAULT_DESIGN.textColor),
    eventLogoUrl: asString(configJson.eventLogoUrl),
    backgroundImageUrl: asString(configJson.backgroundImageUrl),
    sponsorLogoUrls: asStringArray(configJson.sponsorLogoUrls),
    showQrPlaceholder: asBoolean(configJson.showQrPlaceholder, DEFAULT_DESIGN.showQrPlaceholder),
    showPhotoPlaceholder: asBoolean(configJson.showPhotoPlaceholder, DEFAULT_DESIGN.showPhotoPlaceholder),
    showCategoryLabel: asBoolean(configJson.showCategoryLabel, DEFAULT_DESIGN.showCategoryLabel),
    showAccessZoneIndicator: asBoolean(configJson.showAccessZoneIndicator, DEFAULT_DESIGN.showAccessZoneIndicator),
    sampleFullName: asString(configJson.sampleFullName, DEFAULT_DESIGN.sampleFullName),
    sampleOrganization: asString(configJson.sampleOrganization, DEFAULT_DESIGN.sampleOrganization),
    sampleDesignation: asString(configJson.sampleDesignation, DEFAULT_DESIGN.sampleDesignation),
    sampleCategory: asString(configJson.sampleCategory, DEFAULT_DESIGN.sampleCategory),
    sampleAccessZone: asString(configJson.sampleAccessZone, DEFAULT_DESIGN.sampleAccessZone),
    sampleEventName: asString(configJson.sampleEventName, DEFAULT_DESIGN.sampleEventName),
    sampleEventDate: asString(configJson.sampleEventDate, DEFAULT_DESIGN.sampleEventDate),
    extraConfigJson: Object.keys(configJson).length > 0 ? JSON.stringify(configJson, null, 2) : ''
  };
}

function buildConfig(design: BadgeDesign): Record<string, unknown> {
  const merged = {
    layout: design.layout,
    badgeSize: design.badgeSize,
    orientation: design.orientation,
    backgroundColor: design.backgroundColor,
    accentColor: design.accentColor,
    textColor: design.textColor,
    eventLogoUrl: design.eventLogoUrl || undefined,
    backgroundImageUrl: design.backgroundImageUrl || undefined,
    sponsorLogoUrls: design.sponsorLogoUrls.length > 0 ? design.sponsorLogoUrls : undefined,
    showQrPlaceholder: design.showQrPlaceholder,
    showPhotoPlaceholder: design.showPhotoPlaceholder,
    showCategoryLabel: design.showCategoryLabel,
    showAccessZoneIndicator: design.showAccessZoneIndicator,
    sampleFullName: design.sampleFullName,
    sampleOrganization: design.sampleOrganization,
    sampleDesignation: design.sampleDesignation,
    sampleCategory: design.sampleCategory,
    sampleAccessZone: design.sampleAccessZone,
    sampleEventName: design.sampleEventName,
    sampleEventDate: design.sampleEventDate,
    ...parseJson(design.extraConfigJson)
  };

  return merged;
}

function mergeTemplate(template?: BadgeTemplate): BadgeDesign {
  if (!template) {
    return DEFAULT_DESIGN;
  }

  return deriveDesign(template.configJson);
}

export default function BadgeTemplateDesignerPage() {
  const router = useRouter();
  const params = useParams<{ orgCode: string; templateId: string }>();
  const { orgCode, templateId } = params;

  const [templates, setTemplates] = useState<BadgeTemplate[]>([]);
  const [design, setDesign] = useState<BadgeDesign>(DEFAULT_DESIGN);
  const [templateName, setTemplateName] = useState('');
  const [templateVersion, setTemplateVersion] = useState('1');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [assignLinkId, setAssignLinkId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const selectedTemplate = useMemo(() => templates.find(item => item.id === templateId), [templateId, templates]);

  const fetchTemplates = useCallback(async () => {
    const session = loadSession();
    if (!session) {
      router.replace(`/o/${orgCode}/templates/badges`);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await authFetch(`${API_BASE}/org/${orgCode}/templates/badges`, {}, () => router.replace(`/o/${orgCode}`));
      if (!response.ok) {
        throw new Error('Failed to load templates');
      }

      const list = (await response.json()) as BadgeTemplate[];
      setTemplates(list);
      const template = list.find(item => item.id === templateId);
      if (template) {
        setTemplateName(template.name);
        setTemplateVersion(String(template.version));
        setDesign(mergeTemplate(template));
      }
    } catch {
      setError('Unable to load badge template');
    } finally {
      setIsLoading(false);
    }
  }, [orgCode, router, templateId]);

  useEffect(() => {
    if (!orgCode || !templateId) {
      return;
    }

    void fetchTemplates();
  }, [fetchTemplates, orgCode, templateId]);

  function setField<K extends keyof BadgeDesign>(key: K, value: BadgeDesign[K]) {
    setDesign(current => ({ ...current, [key]: value }));
    setStatus(null);
  }

  function applyPreset(preset: BadgeDesignPreset) {
    setDesign(current => ({
      ...current,
      ...preset.values
    }));
    setStatus(null);
  }

  async function saveTemplate(event: FormEvent) {
    event.preventDefault();
    const session = loadSession();
    if (!session) {
      return;
    }

    setIsSaving(true);
    setError(null);
    setStatus(null);

    try {
      const response = await authFetch(
        `${API_BASE}/org/${orgCode}/templates/badges/${templateId}`,
        {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            name: templateName.trim(),
            version: Number(templateVersion),
            configJson: buildConfig(design)
          })
        },
        () => router.replace(`/o/${orgCode}`)
      );

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { message?: string };
        setError(payload.message || 'Failed to save template');
        return;
      }

      setStatus('Badge template saved');
      await fetchTemplates();
    } catch {
      setError('Network error while saving template');
    } finally {
      setIsSaving(false);
    }
  }

  async function duplicateTemplate() {
    const session = loadSession();
    if (!session) {
      return;
    }

    setIsSaving(true);
    setError(null);
    setStatus(null);

    try {
      const response = await authFetch(
        `${API_BASE}/org/${orgCode}/templates/badges`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            name: `${templateName.trim() || 'Badge Template'} Copy`,
            version: Number(templateVersion) + 1,
            configJson: buildConfig(design)
          })
        },
        () => router.replace(`/o/${orgCode}`)
      );

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { message?: string };
        setError(payload.message || 'Failed to duplicate template');
        return;
      }

      setStatus('Template duplicated');
      await fetchTemplates();
    } catch {
      setError('Network error while duplicating template');
    } finally {
      setIsSaving(false);
    }
  }

  async function assignTemplate() {
    const session = loadSession();
    if (!session || !assignLinkId.trim()) {
      return;
    }

    setIsSaving(true);
    setError(null);
    setStatus(null);

    try {
      const response = await authFetch(
        `${API_BASE}/org/${orgCode}/templates/badges/${templateId}/assign/${assignLinkId.trim()}`,
        { method: 'POST' },
        () => router.replace(`/o/${orgCode}`)
      );

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { message?: string };
        setError(payload.message || 'Failed to assign template');
        return;
      }

      setStatus('Template assigned to link');
    } catch {
      setError('Network error while assigning template');
    } finally {
      setIsSaving(false);
    }
  }

  const previewBackground = design.backgroundImageUrl
    ? `linear-gradient(rgba(2, 6, 23, 0.38), rgba(2, 6, 23, 0.78)), url(${design.backgroundImageUrl})`
    : design.backgroundColor;

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-8 text-slate-100">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <button
              type="button"
              onClick={() => router.push(`/o/${orgCode}/templates/badges`)}
              className="mb-1 text-xs text-slate-400 hover:text-slate-200"
            >
              ← Back to templates
            </button>
            <h1 className="text-3xl font-semibold tracking-tight">Badge Template Designer</h1>
            <p className="mt-1 text-sm text-slate-400">Design, preview, duplicate, and assign the current badge template.</p>
          </div>
          <button
            type="button"
            onClick={() => void duplicateTemplate()}
            className="rounded-xl border border-amber-500 px-4 py-2 text-sm text-amber-200 hover:bg-amber-500/10"
          >
            Duplicate template
          </button>
        </header>

        {error ? <p className="rounded-lg border border-rose-500/40 bg-rose-950/40 px-4 py-3 text-sm text-rose-300">{error}</p> : null}
        {status ? <p className="rounded-lg border border-emerald-500/40 bg-emerald-950/40 px-4 py-3 text-sm text-emerald-300">{status}</p> : null}
        {isLoading ? <p className="rounded-lg border border-slate-800 bg-slate-900/60 px-4 py-3 text-sm text-slate-300">Loading template designer…</p> : null}

        <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <form onSubmit={saveTemplate} className="space-y-5 rounded-3xl border border-slate-800 bg-slate-900/60 p-5">
            <section className="space-y-3 rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-cyan-300">Quick start</h2>
                  <p className="text-xs text-slate-400">Pick a starter style, then fine-tune the details below.</p>
                </div>
                <span className="text-xs text-slate-500">Preview updates live</span>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                {DESIGN_PRESETS.map(preset => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => applyPreset(preset)}
                    className="rounded-2xl border border-slate-700 bg-slate-950/60 p-3 text-left transition hover:border-cyan-500/60 hover:bg-slate-900"
                  >
                    <p className="text-sm font-semibold text-slate-100">{preset.label}</p>
                    <p className="mt-1 text-xs text-slate-400">{preset.description}</p>
                  </button>
                ))}
              </div>
            </section>

            <section className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-1 text-sm">
                <span className="text-slate-300">Template name</span>
                <input value={templateName} onChange={event => setTemplateName(event.target.value)} required className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2" />
              </label>
              <label className="grid gap-1 text-sm">
                <span className="text-slate-300">Version</span>
                <input value={templateVersion} onChange={event => setTemplateVersion(event.target.value)} type="number" min={1} required className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2" />
              </label>
              <label className="grid gap-1 text-sm">
                <span className="text-slate-300">Layout</span>
                <input value={design.layout} onChange={event => setField('layout', event.target.value)} className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2" />
              </label>
              <label className="grid gap-1 text-sm">
                <span className="text-slate-300">Badge size</span>
                <select value={design.badgeSize} onChange={event => setField('badgeSize', event.target.value as BadgeDesign['badgeSize'])} className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2">
                  <option value="STANDARD_4X6">Standard 4 x 6</option>
                  <option value="SMALL_3X4">Small 3 x 4</option>
                  <option value="LANDSCAPE_4X3">Landscape 4 x 3</option>
                  <option value="CUSTOM">Custom</option>
                </select>
              </label>
              <label className="grid gap-1 text-sm">
                <span className="text-slate-300">Orientation</span>
                <select value={design.orientation} onChange={event => setField('orientation', event.target.value as BadgeDesign['orientation'])} className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2">
                  <option value="PORTRAIT">Portrait</option>
                  <option value="LANDSCAPE">Landscape</option>
                </select>
              </label>
              <label className="grid gap-1 text-sm">
                <span className="text-slate-300">Background color</span>
                <input value={design.backgroundColor} onChange={event => setField('backgroundColor', event.target.value)} className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2" />
              </label>
              <label className="grid gap-1 text-sm">
                <span className="text-slate-300">Accent color</span>
                <input value={design.accentColor} onChange={event => setField('accentColor', event.target.value)} className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2" />
              </label>
              <label className="grid gap-1 text-sm">
                <span className="text-slate-300">Text color</span>
                <input value={design.textColor} onChange={event => setField('textColor', event.target.value)} className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2" />
              </label>
            </section>

            <section className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-1 text-sm md:col-span-2">
                <span className="text-slate-300">Event logo URL</span>
                <input value={design.eventLogoUrl} onChange={event => setField('eventLogoUrl', event.target.value)} className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2" />
              </label>
              <label className="grid gap-1 text-sm md:col-span-2">
                <span className="text-slate-300">Background image URL</span>
                <input value={design.backgroundImageUrl} onChange={event => setField('backgroundImageUrl', event.target.value)} className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2" />
              </label>
              <label className="grid gap-1 text-sm md:col-span-2">
                <span className="text-slate-300">Sponsor logos</span>
                <textarea
                  value={design.sponsorLogoUrls.join('\n')}
                  onChange={event => setField('sponsorLogoUrls', event.target.value.split('\n').map(item => item.trim()).filter(Boolean))}
                  rows={3}
                  placeholder="One URL per line"
                  className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2"
                />
              </label>
            </section>

            <section className="grid gap-3 md:grid-cols-2">
              <label className="inline-flex items-center gap-2 text-sm"><input type="checkbox" checked={design.showQrPlaceholder} onChange={event => setField('showQrPlaceholder', event.target.checked)} /> QR placeholder</label>
              <label className="inline-flex items-center gap-2 text-sm"><input type="checkbox" checked={design.showPhotoPlaceholder} onChange={event => setField('showPhotoPlaceholder', event.target.checked)} /> Photo placeholder</label>
              <label className="inline-flex items-center gap-2 text-sm"><input type="checkbox" checked={design.showCategoryLabel} onChange={event => setField('showCategoryLabel', event.target.checked)} /> Category label</label>
              <label className="inline-flex items-center gap-2 text-sm"><input type="checkbox" checked={design.showAccessZoneIndicator} onChange={event => setField('showAccessZoneIndicator', event.target.checked)} /> Access zone</label>
            </section>

            <section className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-1 text-sm">
                <span className="text-slate-300">Sample full name</span>
                <input value={design.sampleFullName} onChange={event => setField('sampleFullName', event.target.value)} className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2" />
              </label>
              <label className="grid gap-1 text-sm">
                <span className="text-slate-300">Sample organization</span>
                <input value={design.sampleOrganization} onChange={event => setField('sampleOrganization', event.target.value)} className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2" />
              </label>
              <label className="grid gap-1 text-sm">
                <span className="text-slate-300">Sample designation</span>
                <input value={design.sampleDesignation} onChange={event => setField('sampleDesignation', event.target.value)} className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2" />
              </label>
              <label className="grid gap-1 text-sm">
                <span className="text-slate-300">Sample category</span>
                <input value={design.sampleCategory} onChange={event => setField('sampleCategory', event.target.value)} className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2" />
              </label>
              <label className="grid gap-1 text-sm">
                <span className="text-slate-300">Sample access zone</span>
                <input value={design.sampleAccessZone} onChange={event => setField('sampleAccessZone', event.target.value)} className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2" />
              </label>
              <label className="grid gap-1 text-sm">
                <span className="text-slate-300">Sample event name</span>
                <input value={design.sampleEventName} onChange={event => setField('sampleEventName', event.target.value)} className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2" />
              </label>
              <label className="grid gap-1 text-sm">
                <span className="text-slate-300">Sample event date</span>
                <input value={design.sampleEventDate} onChange={event => setField('sampleEventDate', event.target.value)} className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2" />
              </label>
            </section>

            <section className="grid gap-3">
              <label className="grid gap-1 text-sm">
                <span className="text-slate-300">Advanced JSON</span>
                <textarea
                  value={design.extraConfigJson}
                  onChange={event => setField('extraConfigJson', event.target.value)}
                  rows={6}
                  className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-xs"
                />
              </label>
            </section>

            <div className="flex flex-wrap gap-3">
              <button type="submit" disabled={isSaving} className="rounded-xl bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-60">
                {isSaving ? 'Saving…' : 'Save template'}
              </button>
              <button type="button" onClick={() => void duplicateTemplate()} disabled={isSaving} className="rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-200 disabled:opacity-60">
                Duplicate
              </button>
              <button type="button" onClick={() => router.push(`/o/${orgCode}/templates/badges`)} className="rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-200">
                Back to list
              </button>
            </div>
          </form>

          <aside className="space-y-5 rounded-3xl border border-slate-800 bg-slate-900/60 p-5">
            <section>
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-emerald-300">Live Preview</h2>
                  <p className="text-xs text-slate-400">Rendered with sample data and the current template settings</p>
                </div>
                <span className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-300">{selectedTemplate?.isActive ? 'Active' : 'Inactive'}</span>
              </div>
              <div className="mb-3 flex flex-wrap gap-2 text-[11px] text-slate-300">
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">{design.badgeSize.replaceAll('_', ' ')}</span>
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">{design.orientation}</span>
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">Layout: {design.layout}</span>
              </div>
              <div
                className="overflow-hidden rounded-3xl border border-white/10 p-5"
                style={{
                  background: previewBackground,
                  color: design.textColor,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center'
                }}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-[0.3em] opacity-80">{design.layout}</p>
                    <h3 className="mt-1 text-2xl font-semibold">{design.sampleFullName}</h3>
                    <p className="text-sm opacity-90">{design.sampleDesignation} · {design.sampleOrganization}</p>
                  </div>
                  <div className="rounded-2xl border border-white/20 px-3 py-2 text-right text-xs">
                    <p className="opacity-75">Badge</p>
                    <p className="font-semibold">{design.badgeSize.replace('_', ' ')}</p>
                  </div>
                </div>

                <div className="mt-5 grid gap-3 md:grid-cols-[1fr_110px]">
                  <div className="rounded-2xl border border-white/15 bg-black/25 p-4">
                    {design.showPhotoPlaceholder ? <div className="mb-3 h-20 w-20 rounded-2xl border border-dashed border-white/35 bg-white/10" /> : null}
                    <div className="space-y-1 text-sm">
                      <p><span className="opacity-70">Category:</span> {design.showCategoryLabel ? design.sampleCategory : 'Hidden'}</p>
                      <p><span className="opacity-70">Access:</span> {design.showAccessZoneIndicator ? design.sampleAccessZone : 'Hidden'}</p>
                      <p><span className="opacity-70">Event:</span> {design.sampleEventName}</p>
                      <p><span className="opacity-70">Date:</span> {design.sampleEventDate}</p>
                    </div>
                  </div>

                  <div className="flex flex-col items-center justify-between gap-3 rounded-2xl border border-white/15 bg-black/25 p-4 text-center">
                    {design.showQrPlaceholder ? <div className="h-24 w-24 rounded-2xl border border-dashed border-white/35 bg-white/10" /> : <div className="h-24 w-24 rounded-2xl border border-white/10 bg-white/5" />}
                    <p className="text-[11px] uppercase tracking-[0.28em] opacity-75">QR</p>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {design.sponsorLogoUrls.length > 0 ? design.sponsorLogoUrls.map(url => (
                    <span key={url} className="flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-2 py-1 text-[11px]">
                      <span className="flex h-5 w-5 items-center justify-center overflow-hidden rounded-full bg-white/90">
                        <img src={url} alt="Sponsor logo" className="h-full w-full object-contain" />
                      </span>
                      Sponsor
                    </span>
                  )) : <span className="rounded-full border border-dashed border-white/15 bg-white/5 px-3 py-1 text-[11px] opacity-70">No sponsor logos yet</span>}
                </div>
              </div>
            </section>

            <section className="space-y-3 rounded-2xl border border-slate-800 bg-slate-950/50 p-4">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-cyan-300">Assign To Link</h2>
              <p className="text-xs text-slate-400">Paste a registration link ID to assign this badge template.</p>
              <input
                value={assignLinkId}
                onChange={event => setAssignLinkId(event.target.value)}
                placeholder="Registration link ID"
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
              />
              <button type="button" onClick={() => void assignTemplate()} className="rounded-xl border border-cyan-500 px-4 py-2 text-sm text-cyan-200 disabled:opacity-60" disabled={isSaving || !assignLinkId.trim()}>
                Assign template
              </button>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}