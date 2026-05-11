'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { authFetch, loadSession } from '../../../../../../../../lib/session';

type LinkPageSettings = {
  pageTemplate?:
    | 'CONFERENCE'
    | 'EXHIBITION'
    | 'VIP_INVITATION'
    | 'MEDIA_ACCREDITATION'
    | 'SPEAKER_REGISTRATION'
    | 'WORKSHOP_TRAINING'
    | null;
  pageLogoUrl?: string | null;
  pageBannerImageUrl?: string | null;
  pageBackgroundColor?: string | null;
  pageButtonColor?: string | null;
  pageFontFamily?: string | null;
  pageEventDescription?: string | null;
  sponsorLogoUrls?: string[];
  formLayout?: 'SINGLE_COLUMN' | 'TWO_COLUMN' | null;
  registrationInstructions?: string | null;
  confirmationMessage?: string | null;
  footerText?: string | null;
  privacyNotice?: string | null;
  termsAndConditions?: string | null;
};

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5001';

const TEMPLATE_OPTIONS: Array<{ value: NonNullable<LinkPageSettings['pageTemplate']>; label: string }> = [
  { value: 'CONFERENCE', label: 'Conference template' },
  { value: 'EXHIBITION', label: 'Exhibition template' },
  { value: 'VIP_INVITATION', label: 'VIP invitation template' },
  { value: 'MEDIA_ACCREDITATION', label: 'Media accreditation template' },
  { value: 'SPEAKER_REGISTRATION', label: 'Speaker registration template' },
  { value: 'WORKSHOP_TRAINING', label: 'Workshop / training template' }
];

function joinLines(values?: string[]): string {
  return Array.isArray(values) ? values.join('\n') : '';
}

function toUndefined(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

export default function LinkPageDesignerPage() {
  const router = useRouter();
  const params = useParams<{ orgCode: string; eventId: string; linkId: string }>();
  const { orgCode, eventId, linkId } = params;

  const [settings, setSettings] = useState<LinkPageSettings>({
    pageTemplate: 'CONFERENCE',
    formLayout: 'SINGLE_COLUMN'
  });
  const [sponsorLogoText, setSponsorLogoText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const onSessionExpired = useCallback(() => router.replace(`/o/${orgCode}`), [orgCode, router]);

  const fetchSettings = useCallback(async () => {
    const session = loadSession();
    if (!session) {
      router.replace(`/o/${orgCode}`);
      return;
    }

    setIsLoading(true);
    setPageError(null);
    try {
      const res = await authFetch(
        `${API_BASE}/org/${orgCode}/events/${eventId}/links/${linkId}/settings`,
        {},
        onSessionExpired
      );
      if (!res.ok) {
        throw new Error('Failed to load page settings');
      }

      const payload = (await res.json()) as LinkPageSettings;
      setSettings({
        pageTemplate: payload.pageTemplate || 'CONFERENCE',
        pageLogoUrl: payload.pageLogoUrl || '',
        pageBannerImageUrl: payload.pageBannerImageUrl || '',
        pageBackgroundColor: payload.pageBackgroundColor || '',
        pageButtonColor: payload.pageButtonColor || '',
        pageFontFamily: payload.pageFontFamily || '',
        pageEventDescription: payload.pageEventDescription || '',
        formLayout: payload.formLayout || 'SINGLE_COLUMN',
        registrationInstructions: payload.registrationInstructions || '',
        confirmationMessage: payload.confirmationMessage || '',
        footerText: payload.footerText || '',
        privacyNotice: payload.privacyNotice || '',
        termsAndConditions: payload.termsAndConditions || ''
      });
      setSponsorLogoText(joinLines(payload.sponsorLogoUrls));
    } catch {
      setPageError('Unable to load page designer settings');
    } finally {
      setIsLoading(false);
    }
  }, [orgCode, eventId, linkId, onSessionExpired, router]);

  useEffect(() => {
    if (!orgCode || !eventId || !linkId) {
      return;
    }
    void fetchSettings();
  }, [eventId, fetchSettings, linkId, orgCode]);

  function updateSetting<K extends keyof LinkPageSettings>(key: K, value: LinkPageSettings[K]) {
    setSettings(current => ({ ...current, [key]: value }));
    setSaveMessage(null);
  }

  function readError(payload: unknown, fallback: string): string {
    if (!payload || typeof payload !== 'object') return fallback;
    const p = payload as { message?: string | string[] };
    if (!p.message) return fallback;
    return Array.isArray(p.message) ? p.message.join(', ') : p.message;
  }

  async function onSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPageError(null);
    setSaveMessage(null);
    setIsSaving(true);

    const sponsorLogoUrls = sponsorLogoText
      .split('\n')
      .map(value => value.trim())
      .filter(Boolean);

    try {
      const res = await authFetch(
        `${API_BASE}/org/${orgCode}/events/${eventId}/links/${linkId}/settings`,
        {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            pageTemplate: settings.pageTemplate,
            pageLogoUrl: toUndefined(settings.pageLogoUrl || ''),
            pageBannerImageUrl: toUndefined(settings.pageBannerImageUrl || ''),
            pageBackgroundColor: toUndefined(settings.pageBackgroundColor || ''),
            pageButtonColor: toUndefined(settings.pageButtonColor || ''),
            pageFontFamily: toUndefined(settings.pageFontFamily || ''),
            pageEventDescription: toUndefined(settings.pageEventDescription || ''),
            sponsorLogoUrls: sponsorLogoUrls.length > 0 ? sponsorLogoUrls : undefined,
            formLayout: settings.formLayout,
            registrationInstructions: toUndefined(settings.registrationInstructions || ''),
            confirmationMessage: toUndefined(settings.confirmationMessage || ''),
            footerText: toUndefined(settings.footerText || ''),
            privacyNotice: toUndefined(settings.privacyNotice || ''),
            termsAndConditions: toUndefined(settings.termsAndConditions || '')
          })
        },
        onSessionExpired
      );

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setPageError(readError(err, 'Unable to save page designer settings'));
        return;
      }

      await fetchSettings();
      setSaveMessage('Page designer settings saved');
    } catch {
      setPageError('Network error while saving page designer settings');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-8 text-slate-100">
      <div className="mx-auto max-w-5xl">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <button
              type="button"
              onClick={() => router.push(`/o/${orgCode}/events/${eventId}/links`)}
              className="mb-1 text-xs text-slate-400 hover:text-slate-200"
            >
              ← Back to links
            </button>
            <h1 className="text-2xl font-semibold tracking-tight">Registration Page Designer</h1>
            <p className="mt-1 text-sm text-slate-400">Customize the public registration page for this link.</p>
          </div>
        </header>

        {pageError ? (
          <p className="mb-4 rounded-lg border border-rose-500/40 bg-rose-950/40 px-4 py-3 text-sm text-rose-300">{pageError}</p>
        ) : null}
        {saveMessage ? (
          <p className="mb-4 rounded-lg border border-emerald-500/40 bg-emerald-950/40 px-4 py-3 text-sm text-emerald-300">{saveMessage}</p>
        ) : null}

        {isLoading ? (
          <p className="rounded-2xl border border-slate-800 bg-slate-900/60 px-5 py-8 text-sm text-slate-400">Loading page designer…</p>
        ) : (
          <form onSubmit={onSave} className="space-y-5">
            <section className="grid gap-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-5 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm text-slate-300">Template</label>
                <select
                  value={settings.pageTemplate || 'CONFERENCE'}
                  onChange={event => updateSetting('pageTemplate', event.target.value as NonNullable<LinkPageSettings['pageTemplate']>)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                >
                  {TEMPLATE_OPTIONS.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-2 block text-sm text-slate-300">Form layout</label>
                <select
                  value={settings.formLayout || 'SINGLE_COLUMN'}
                  onChange={event => updateSetting('formLayout', event.target.value as NonNullable<LinkPageSettings['formLayout']>)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                >
                  <option value="SINGLE_COLUMN">Single column</option>
                  <option value="TWO_COLUMN">Two column</option>
                </select>
              </div>
            </section>

            <section className="grid gap-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-5 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm text-slate-300">Page logo URL</label>
                <input value={settings.pageLogoUrl || ''} onChange={event => updateSetting('pageLogoUrl', event.target.value)} className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="mb-2 block text-sm text-slate-300">Banner image URL</label>
                <input value={settings.pageBannerImageUrl || ''} onChange={event => updateSetting('pageBannerImageUrl', event.target.value)} className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="mb-2 block text-sm text-slate-300">Background color</label>
                <input value={settings.pageBackgroundColor || ''} onChange={event => updateSetting('pageBackgroundColor', event.target.value)} placeholder="#0f172a" className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="mb-2 block text-sm text-slate-300">Button color</label>
                <input value={settings.pageButtonColor || ''} onChange={event => updateSetting('pageButtonColor', event.target.value)} placeholder="#f4c95d" className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
              </div>
              <div className="md:col-span-2">
                <label className="mb-2 block text-sm text-slate-300">Font family</label>
                <input value={settings.pageFontFamily || ''} onChange={event => updateSetting('pageFontFamily', event.target.value)} placeholder='"Avenir Next", sans-serif' className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
              </div>
            </section>

            <section className="grid gap-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
              <div>
                <label className="mb-2 block text-sm text-slate-300">Event description override</label>
                <textarea value={settings.pageEventDescription || ''} onChange={event => updateSetting('pageEventDescription', event.target.value)} rows={4} className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="mb-2 block text-sm text-slate-300">Registration instructions</label>
                <textarea value={settings.registrationInstructions || ''} onChange={event => updateSetting('registrationInstructions', event.target.value)} rows={4} className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="mb-2 block text-sm text-slate-300">Confirmation message</label>
                <textarea value={settings.confirmationMessage || ''} onChange={event => updateSetting('confirmationMessage', event.target.value)} rows={3} className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="mb-2 block text-sm text-slate-300">Sponsor logos</label>
                <textarea value={sponsorLogoText} onChange={event => setSponsorLogoText(event.target.value)} rows={4} placeholder="One image URL per line" className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
              </div>
            </section>

            <section className="grid gap-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
              <div>
                <label className="mb-2 block text-sm text-slate-300">Footer text</label>
                <textarea value={settings.footerText || ''} onChange={event => updateSetting('footerText', event.target.value)} rows={3} className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="mb-2 block text-sm text-slate-300">Privacy notice</label>
                <textarea value={settings.privacyNotice || ''} onChange={event => updateSetting('privacyNotice', event.target.value)} rows={4} className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="mb-2 block text-sm text-slate-300">Terms and conditions</label>
                <textarea value={settings.termsAndConditions || ''} onChange={event => updateSetting('termsAndConditions', event.target.value)} rows={4} className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
              </div>
            </section>

            <div className="flex justify-end gap-3">
              <button type="button" onClick={() => router.push(`/o/${orgCode}/events/${eventId}/links`)} className="rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800">
                Cancel
              </button>
              <button type="submit" disabled={isSaving} className="rounded-xl bg-amber-400 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-amber-300 disabled:opacity-60">
                {isSaving ? 'Saving…' : 'Save page design'}
              </button>
            </div>
          </form>
        )}
      </div>
    </main>
  );
}