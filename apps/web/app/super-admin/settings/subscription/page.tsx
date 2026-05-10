'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { authFetch } from '../../../../lib/session';
import { JsonSettingEditor } from '../../_components/json-setting-editor';
import { API_BASE } from '../../_lib/constants';
import { JsonSettingValue } from '../../_lib/types';
import { useSuperAdminSession } from '../../_lib/use-super-admin-session';

export default function SuperAdminSubscriptionSettingsPage() {
  const router = useRouter();
  const { ready } = useSuperAdminSession();
  const [value, setValue] = useState('{}');
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ready) {
      return;
    }

    authFetch(`${API_BASE}/super-admin/settings/subscription`, {}, () => router.replace('/sa'))
      .then(r => (r.ok ? r.json() : {}))
      .then((data: JsonSettingValue) => setValue(JSON.stringify(data, null, 2)))
      .catch(() => {
        // non-fatal
      });
  }, [ready, router]);

  async function save() {
    setStatus(null);
    setError(null);

    try {
      const parsed = JSON.parse(value) as JsonSettingValue;
      const response = await authFetch(`${API_BASE}/super-admin/settings/subscription`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ value: parsed })
      }, () => router.replace('/sa'));

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { message?: string | string[] };
        const message = Array.isArray(payload.message) ? payload.message.join(', ') : payload.message;
        setError(message || 'Failed to save subscription config');
        return;
      }

      const next = (await response.json()) as JsonSettingValue;
      setValue(JSON.stringify(next, null, 2));
      setStatus('Subscription configuration saved.');
    } catch {
      setError('Subscription configuration must be valid JSON.');
    }
  }

  return (
    <div className="space-y-4">
      <header className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
        <h1 className="text-2xl font-semibold">Subscription Settings</h1>
      </header>

      {status ? <p className="text-sm text-emerald-300">{status}</p> : null}
      {error ? <p className="text-sm text-rose-300">{error}</p> : null}

      <JsonSettingEditor
        title="Subscription and Licensing"
        description="Define platform-level plan and licensing configuration."
        value={value}
        onChange={setValue}
        onSave={save}
        saveLabel="Save subscription config"
      />
    </div>
  );
}
