'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { loadSession } from '../../../../../lib/session';
import { useTheme } from '../../../../../lib/theme-provider';

type BadgeTemplate = {
  id: string;
  name: string;
  version: number;
  configJson: Record<string, unknown>;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || '/api';

export default function BadgeTemplatesPage() {
  const router = useRouter();
  const params = useParams<{ orgCode: string }>();
  const { theme } = useTheme();
  const orgCode = params.orgCode;

  const [templates, setTemplates] = useState<BadgeTemplate[]>([]);
  const [name, setName] = useState('');
  const [version, setVersion] = useState('1');
  const [configJsonText, setConfigJsonText] = useState('{"layout":"classic"}');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [metricsJson, setMetricsJson] = useState<string>('');

  const isDark = theme === 'dark';
  const pageClass = isDark
    ? 'min-h-screen bg-slate-950 px-6 py-10 text-slate-100'
    : 'min-h-screen bg-slate-50 px-6 py-10 text-slate-950';
  const cardClass = isDark
    ? 'rounded-xl border border-slate-800 bg-slate-900/60'
    : 'rounded-xl border border-slate-200 bg-white';
  const fieldClass = isDark
    ? 'rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100'
    : 'rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-950';
  const subtleTextClass = isDark ? 'text-slate-400' : 'text-slate-600';
  const secondaryTextClass = isDark ? 'text-slate-300' : 'text-slate-700';

  function parseConfigJson(raw: string): Record<string, unknown> {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('Template config JSON must be an object');
    }

    return parsed as Record<string, unknown>;
  }

  async function fetchTemplates(): Promise<void> {
    const session = loadSession();
    if (!session) {
      router.replace(`/o/${orgCode}`);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const [templatesResponse, metricsResponse] = await Promise.all([
        fetch(`${API_BASE}/org/${orgCode}/templates/badges`, {
          headers: {
            Authorization: `Bearer ${session.accessToken}`
          }
        }),
        fetch(`${API_BASE}/org/${orgCode}/badges/renderer/metrics`, {
          headers: {
            Authorization: `Bearer ${session.accessToken}`
          }
        })
      ]);

      if (!templatesResponse.ok) {
        throw new Error('Failed to load templates');
      }

      const list = (await templatesResponse.json()) as BadgeTemplate[];
      setTemplates(list);

      if (metricsResponse.ok) {
        const metricsPayload = (await metricsResponse.json()) as { metrics?: Record<string, unknown> };
        setMetricsJson(JSON.stringify(metricsPayload.metrics || {}, null, 2));
      } else {
        setMetricsJson('');
      }
    } catch {
      setError('Unable to load badge templates');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    if (!orgCode) {
      return;
    }

    void fetchTemplates();
  }, [orgCode]);

  async function onCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const session = loadSession();
    if (!session) {
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/org/${orgCode}/templates/badges`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          Authorization: `Bearer ${session.accessToken}`
        },
        body: JSON.stringify({
          name,
          version: Number(version),
          configJson: parseConfigJson(configJsonText)
        })
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { message?: string };
        setError(payload.message || 'Failed to create template');
        return;
      }

      setName('');
      setVersion('1');
      setConfigJsonText('{"layout":"classic"}');
      await fetchTemplates();
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Failed to create template';
      setError(message);
    }
  }

  async function saveTemplate(templateId: string): Promise<void> {
    const session = loadSession();
    if (!session) {
      return;
    }

    const nameInput = document.getElementById(`name-${templateId}`) as HTMLInputElement | null;
    const versionInput = document.getElementById(`version-${templateId}`) as HTMLInputElement | null;
    const activeInput = document.getElementById(`active-${templateId}`) as HTMLInputElement | null;
    const configInput = document.getElementById(`config-${templateId}`) as HTMLTextAreaElement | null;

    try {
      const response = await fetch(`${API_BASE}/org/${orgCode}/templates/badges/${templateId}`, {
        method: 'PATCH',
        headers: {
          'content-type': 'application/json',
          Authorization: `Bearer ${session.accessToken}`
        },
        body: JSON.stringify({
          name: nameInput?.value || undefined,
          version: versionInput?.value ? Number(versionInput.value) : undefined,
          isActive: Boolean(activeInput?.checked),
          configJson: configInput?.value ? parseConfigJson(configInput.value) : undefined
        })
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { message?: string };
        setError(payload.message || 'Failed to update template');
        return;
      }

      await fetchTemplates();
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Failed to update template';
      setError(message);
    }
  }

  async function disableTemplate(templateId: string): Promise<void> {
    const session = loadSession();
    if (!session) {
      return;
    }

    const response = await fetch(`${API_BASE}/org/${orgCode}/templates/badges/${templateId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${session.accessToken}`
      }
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as { message?: string };
      setError(payload.message || 'Failed to disable template');
      return;
    }

    await fetchTemplates();
  }

  return (
    <main className={pageClass}>
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-3xl font-semibold tracking-tight">Badge Templates</h1>
          <button
            type="button"
            onClick={() => router.push(`/o/${orgCode}`)}
            className={isDark ? 'rounded-lg border border-slate-700 px-3 py-1 text-sm' : 'rounded-lg border border-slate-300 px-3 py-1 text-sm'}
          >
            Back to portal
          </button>
        </div>

        {error ? <p className={isDark ? 'mb-4 text-sm text-red-300' : 'mb-4 text-sm text-red-600'}>{error}</p> : null}

        <section className={`mb-6 p-4 ${cardClass}`}>
          <h2 className={isDark ? 'mb-3 text-sm font-semibold uppercase tracking-wide text-cyan-300' : 'mb-3 text-sm font-semibold uppercase tracking-wide text-blue-700'}>Create Template</h2>
          <form onSubmit={onCreate} className="grid gap-3 md:grid-cols-[1.2fr_120px_2fr_auto]">
            <input
              value={name}
              onChange={event => setName(event.target.value)}
              placeholder="Template name"
              required
              className={fieldClass}
            />
            <input
              value={version}
              onChange={event => setVersion(event.target.value)}
              type="number"
              min={1}
              required
              className={fieldClass}
            />
            <textarea
              value={configJsonText}
              onChange={event => setConfigJsonText(event.target.value)}
              rows={3}
              className={`${fieldClass} font-mono text-xs`}
            />
            <button type="submit" className="rounded-lg bg-cyan-400 px-4 py-2 font-semibold text-slate-950">
              Create
            </button>
          </form>
        </section>

        <section className={`mb-6 p-4 ${cardClass}`}>
          <h2 className={isDark ? 'mb-3 text-sm font-semibold uppercase tracking-wide text-emerald-300' : 'mb-3 text-sm font-semibold uppercase tracking-wide text-emerald-700'}>Renderer Metrics</h2>
          {metricsJson ? (
            <pre className={isDark ? 'overflow-x-auto rounded-lg border border-slate-800 bg-slate-950 p-3 text-xs text-slate-200' : 'overflow-x-auto rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-800'}>
              {metricsJson}
            </pre>
          ) : (
            <p className={`text-sm ${secondaryTextClass}`}>Metrics are unavailable.</p>
          )}
        </section>

        <section className={cardClass}>
          <div className={isDark ? 'border-b border-slate-800 px-4 py-3 text-sm font-semibold' : 'border-b border-slate-200 px-4 py-3 text-sm font-semibold'}>Templates</div>
          {isLoading ? <p className={`px-4 py-4 text-sm ${secondaryTextClass}`}>Loading...</p> : null}
          {!isLoading && templates.length === 0 ? (
            <p className={`px-4 py-4 text-sm ${secondaryTextClass}`}>No templates created yet.</p>
          ) : null}
          {!isLoading && templates.length > 0 ? (
            <ul>
              {templates.map(item => (
                <li key={item.id} className={isDark ? 'border-t border-slate-800 px-4 py-4 text-sm' : 'border-t border-slate-200 px-4 py-4 text-sm'}>
                  <div className="grid gap-3 md:grid-cols-[1fr_120px_100px_1fr_auto_auto] md:items-start">
                    <input
                      id={`name-${item.id}`}
                      defaultValue={item.name}
                      className={isDark ? 'rounded border border-slate-700 bg-slate-950 px-2 py-1 text-slate-100' : 'rounded border border-slate-300 bg-white px-2 py-1 text-slate-950'}
                    />
                    <input
                      id={`version-${item.id}`}
                      type="number"
                      min={1}
                      defaultValue={item.version}
                      className={isDark ? 'rounded border border-slate-700 bg-slate-950 px-2 py-1 text-slate-100' : 'rounded border border-slate-300 bg-white px-2 py-1 text-slate-950'}
                    />
                    <label className={`mt-1 inline-flex items-center gap-2 text-xs ${secondaryTextClass}`}>
                      <input id={`active-${item.id}`} type="checkbox" defaultChecked={item.isActive} />
                      Active
                    </label>
                    <textarea
                      id={`config-${item.id}`}
                      defaultValue={JSON.stringify(item.configJson, null, 2)}
                      rows={4}
                      className={isDark ? 'rounded border border-slate-700 bg-slate-950 px-2 py-1 font-mono text-xs text-slate-100' : 'rounded border border-slate-300 bg-white px-2 py-1 font-mono text-xs text-slate-950'}
                    />
                    <button
                      type="button"
                      onClick={() => void saveTemplate(item.id)}
                      className="rounded-md border border-cyan-500 px-3 py-1 text-cyan-200"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => router.push(`/o/${orgCode}/templates/badges/${item.id}`)}
                      className="rounded-md border border-amber-500 px-3 py-1 text-amber-200"
                    >
                      Designer
                    </button>
                    <button
                      type="button"
                      onClick={() => void disableTemplate(item.id)}
                      disabled={!item.isActive}
                      className="rounded-md border border-amber-500 px-3 py-1 text-amber-200 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Disable
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      </div>
    </main>
  );
}
