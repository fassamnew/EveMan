'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { authFetch, loadSession } from '../../../../../../../../lib/session';

type FieldType = 'TEXT' | 'TEXTAREA' | 'EMAIL' | 'NUMBER' | 'SELECT' | 'CHECKBOX';

type FormField = {
  id?: string;
  key: string;
  label: string;
  type: FieldType;
  required: boolean;
  placeholder?: string | null;
  optionsJson?: string[] | null;
  minLength?: number | null;
  maxLength?: number | null;
  minValue?: number | null;
  maxValue?: number | null;
  pattern?: string | null;
};

type EditableField = {
  clientId: string;
  key: string;
  label: string;
  type: FieldType;
  required: boolean;
  placeholder: string;
  options: string;
  minLength: string;
  maxLength: string;
  minValue: string;
  maxValue: string;
  pattern: string;
};

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || '/api';

const FIELD_TYPE_OPTIONS: Array<{ value: FieldType; label: string }> = [
  { value: 'TEXT', label: 'Short text' },
  { value: 'TEXTAREA', label: 'Long text' },
  { value: 'EMAIL', label: 'Email' },
  { value: 'NUMBER', label: 'Number' },
  { value: 'SELECT', label: 'Select' },
  { value: 'CHECKBOX', label: 'Checkbox group' }
];

function toEditableField(field?: FormField): EditableField {
  return {
    clientId: typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
    key: field?.key ?? '',
    label: field?.label ?? '',
    type: field?.type ?? 'TEXT',
    required: field?.required ?? false,
    placeholder: field?.placeholder ?? '',
    options: Array.isArray(field?.optionsJson) ? field!.optionsJson!.join('\n') : '',
    minLength: field?.minLength != null ? String(field.minLength) : '',
    maxLength: field?.maxLength != null ? String(field.maxLength) : '',
    minValue: field?.minValue != null ? String(field.minValue) : '',
    maxValue: field?.maxValue != null ? String(field.maxValue) : '',
    pattern: field?.pattern ?? ''
  };
}

function parseNumber(value: string): number | undefined {
  if (!value.trim()) return undefined;
  const n = Number(value);
  return Number.isNaN(n) ? undefined : n;
}

function isChoiceType(type: FieldType): boolean {
  return type === 'SELECT' || type === 'CHECKBOX';
}

export default function LinkFormBuilderPage() {
  const router = useRouter();
  const params = useParams<{ orgCode: string; eventId: string; linkId: string }>();
  const { orgCode, eventId, linkId } = params;

  const [fields, setFields] = useState<EditableField[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const onSessionExpired = useCallback(() => router.replace(`/o/${orgCode}`), [orgCode, router]);

  const fetchFields = useCallback(async () => {
    const session = loadSession();
    if (!session) {
      router.replace(`/o/${orgCode}`);
      return;
    }

    setIsLoading(true);
    setPageError(null);
    try {
      const res = await authFetch(
        `${API_BASE}/org/${orgCode}/events/${eventId}/links/${linkId}/form-fields`,
        {},
        onSessionExpired
      );
      if (!res.ok) {
        throw new Error('Failed to load form fields');
      }

      const data = (await res.json()) as FormField[];
      setFields(data.map(field => toEditableField(field)));
    } catch {
      setPageError('Unable to load form fields');
    } finally {
      setIsLoading(false);
    }
  }, [orgCode, eventId, linkId, router, onSessionExpired]);

  useEffect(() => {
    if (!orgCode || !eventId || !linkId) return;
    void fetchFields();
  }, [orgCode, eventId, linkId, fetchFields]);

  const hasFields = fields.length > 0;

  const keySet = useMemo(() => {
    const map = new Map<string, number>();
    fields.forEach((field, index) => {
      const key = field.key.trim();
      if (!key) return;
      map.set(key, (map.get(key) ?? 0) + 1);
    });
    return map;
  }, [fields]);

  function updateField(clientId: string, patch: Partial<EditableField>) {
    setFields(prev => prev.map(field => (field.clientId === clientId ? { ...field, ...patch } : field)));
    setSaveMessage(null);
  }

  function addField() {
    setFields(prev => [...prev, toEditableField()]);
    setSaveMessage(null);
  }

  function removeField(clientId: string) {
    setFields(prev => prev.filter(field => field.clientId !== clientId));
    setSaveMessage(null);
  }

  function moveField(clientId: string, direction: -1 | 1) {
    setFields(prev => {
      const index = prev.findIndex(field => field.clientId === clientId);
      if (index < 0) return prev;
      const targetIndex = index + direction;
      if (targetIndex < 0 || targetIndex >= prev.length) return prev;
      const next = [...prev];
      const [item] = next.splice(index, 1);
      next.splice(targetIndex, 0, item);
      return next;
    });
    setSaveMessage(null);
  }

  function readError(payload: unknown, fallback: string): string {
    if (!payload || typeof payload !== 'object') return fallback;
    const p = payload as { message?: string | string[] };
    if (!p.message) return fallback;
    return Array.isArray(p.message) ? p.message.join(', ') : p.message;
  }

  async function onSave(e: FormEvent) {
    e.preventDefault();
    setPageError(null);
    setSaveMessage(null);

    const duplicateKeys = Array.from(keySet.entries()).filter(([, count]) => count > 1).map(([key]) => key);
    if (duplicateKeys.length > 0) {
      setPageError(`Duplicate keys found: ${duplicateKeys.join(', ')}`);
      return;
    }

    const payload = fields.map(field => {
      const options = field.options
        .split('\n')
        .map(option => option.trim())
        .filter(Boolean);

      return {
        key: field.key.trim(),
        label: field.label.trim(),
        type: field.type,
        required: field.required,
        placeholder: field.placeholder.trim() || undefined,
        options: options.length > 0 ? options : undefined,
        minLength: parseNumber(field.minLength),
        maxLength: parseNumber(field.maxLength),
        minValue: parseNumber(field.minValue),
        maxValue: parseNumber(field.maxValue),
        pattern: field.pattern.trim() || undefined
      };
    });

    if (payload.some(field => !field.key || !field.label)) {
      setPageError('Each field must have a key and label');
      return;
    }

    const missingChoiceOptions = payload.find(
      field => (field.type === 'SELECT' || field.type === 'CHECKBOX') && (!field.options || field.options.length === 0)
    );
    if (missingChoiceOptions) {
      setPageError(`Field ${missingChoiceOptions.key} needs at least one option`);
      return;
    }

    setIsSaving(true);
    try {
      const res = await authFetch(
        `${API_BASE}/org/${orgCode}/events/${eventId}/links/${linkId}/form-fields`,
        {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ fields: payload })
        },
        onSessionExpired
      );

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setPageError(readError(err, 'Unable to save form fields'));
        return;
      }

      const updated = (await res.json()) as FormField[];
      setFields(updated.map(field => toEditableField(field)));
      setSaveMessage('Form fields saved');
    } catch {
      setPageError('Network error while saving');
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
            <h1 className="text-2xl font-semibold tracking-tight">Registration Form Builder</h1>
            <p className="mt-1 text-sm text-slate-400">Configure what registrants must fill in for this link.</p>
          </div>
          <button
            type="button"
            onClick={addField}
            className="rounded-xl bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-300 transition"
          >
            + Add field
          </button>
        </header>

        {pageError && (
          <p className="mb-4 rounded-lg border border-rose-500/40 bg-rose-950/40 px-4 py-3 text-sm text-rose-300">{pageError}</p>
        )}
        {saveMessage && (
          <p className="mb-4 rounded-lg border border-emerald-500/40 bg-emerald-950/40 px-4 py-3 text-sm text-emerald-300">{saveMessage}</p>
        )}

        {isLoading ? (
          <p className="rounded-2xl border border-slate-800 bg-slate-900/60 px-5 py-8 text-sm text-slate-400">Loading form fields…</p>
        ) : (
          <form onSubmit={onSave} className="space-y-4">
            {!hasFields && (
              <div className="rounded-2xl border border-slate-800 bg-slate-900/60 px-5 py-8 text-sm text-slate-400">
                No fields yet. Add your first field to build this registration form.
              </div>
            )}

            {fields.map((field, index) => {
              const key = field.key.trim();
              const isDuplicateKey = key !== '' && (keySet.get(key) ?? 0) > 1;
              const showTextRules = field.type === 'TEXT' || field.type === 'TEXTAREA' || field.type === 'EMAIL';
              const showNumberRules = field.type === 'NUMBER';
              const showChoiceRules = isChoiceType(field.type);

              return (
                <section key={field.clientId} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <h2 className="text-sm font-semibold text-cyan-200">Field {index + 1}</h2>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => moveField(field.clientId, -1)}
                        disabled={index === 0}
                        className="rounded-lg border border-slate-700 px-2.5 py-1 text-xs text-slate-300 hover:bg-slate-800 disabled:opacity-40"
                      >
                        Move up
                      </button>
                      <button
                        type="button"
                        onClick={() => moveField(field.clientId, 1)}
                        disabled={index === fields.length - 1}
                        className="rounded-lg border border-slate-700 px-2.5 py-1 text-xs text-slate-300 hover:bg-slate-800 disabled:opacity-40"
                      >
                        Move down
                      </button>
                      <button
                        type="button"
                        onClick={() => removeField(field.clientId)}
                        className="rounded-lg border border-rose-500/50 px-2.5 py-1 text-xs text-rose-200 hover:bg-rose-500/10"
                      >
                        Remove
                      </button>
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="grid gap-1 text-sm">
                      <span className="text-slate-300">Field key</span>
                      <input
                        value={field.key}
                        onChange={e => updateField(field.clientId, { key: e.target.value })}
                        maxLength={64}
                        placeholder="e.g. company_name"
                        className={`rounded-lg border bg-slate-950 px-3 py-2 font-mono outline-none ring-cyan-300 focus:ring ${isDuplicateKey ? 'border-rose-500/70' : 'border-slate-700'}`}
                      />
                      {isDuplicateKey && <span className="text-xs text-rose-300">Key must be unique</span>}
                    </label>
                    <label className="grid gap-1 text-sm">
                      <span className="text-slate-300">Label</span>
                      <input
                        value={field.label}
                        onChange={e => updateField(field.clientId, { label: e.target.value })}
                        maxLength={120}
                        placeholder="e.g. Company Name"
                        className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 outline-none ring-cyan-300 focus:ring"
                      />
                    </label>
                    <label className="grid gap-1 text-sm">
                      <span className="text-slate-300">Field type</span>
                      <select
                        value={field.type}
                        onChange={e => updateField(field.clientId, { type: e.target.value as FieldType })}
                        className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 outline-none ring-cyan-300 focus:ring"
                      >
                        {FIELD_TYPE_OPTIONS.map(option => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="grid gap-1 text-sm">
                      <span className="text-slate-300">Placeholder (optional)</span>
                      <input
                        value={field.placeholder}
                        onChange={e => updateField(field.clientId, { placeholder: e.target.value })}
                        maxLength={160}
                        className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 outline-none ring-cyan-300 focus:ring"
                      />
                    </label>

                    {showTextRules && (
                      <>
                        <label className="grid gap-1 text-sm">
                          <span className="text-slate-300">Minimum length</span>
                          <input
                            type="number"
                            min={0}
                            value={field.minLength}
                            onChange={e => updateField(field.clientId, { minLength: e.target.value })}
                            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 outline-none ring-cyan-300 focus:ring"
                          />
                        </label>
                        <label className="grid gap-1 text-sm">
                          <span className="text-slate-300">Maximum length</span>
                          <input
                            type="number"
                            min={1}
                            value={field.maxLength}
                            onChange={e => updateField(field.clientId, { maxLength: e.target.value })}
                            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 outline-none ring-cyan-300 focus:ring"
                          />
                        </label>
                        <label className="sm:col-span-2 grid gap-1 text-sm">
                          <span className="text-slate-300">Pattern (regex)</span>
                          <input
                            value={field.pattern}
                            onChange={e => updateField(field.clientId, { pattern: e.target.value })}
                            maxLength={255}
                            placeholder="Optional custom validation regex"
                            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 font-mono outline-none ring-cyan-300 focus:ring"
                          />
                        </label>
                      </>
                    )}

                    {showNumberRules && (
                      <>
                        <label className="grid gap-1 text-sm">
                          <span className="text-slate-300">Minimum value</span>
                          <input
                            type="number"
                            value={field.minValue}
                            onChange={e => updateField(field.clientId, { minValue: e.target.value })}
                            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 outline-none ring-cyan-300 focus:ring"
                          />
                        </label>
                        <label className="grid gap-1 text-sm">
                          <span className="text-slate-300">Maximum value</span>
                          <input
                            type="number"
                            value={field.maxValue}
                            onChange={e => updateField(field.clientId, { maxValue: e.target.value })}
                            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 outline-none ring-cyan-300 focus:ring"
                          />
                        </label>
                      </>
                    )}

                    {showChoiceRules && (
                      <label className="sm:col-span-2 grid gap-1 text-sm">
                        <span className="text-slate-300">Options (one per line)</span>
                        <textarea
                          rows={4}
                          value={field.options}
                          onChange={e => updateField(field.clientId, { options: e.target.value })}
                          placeholder="Standard\nVIP\nStudent"
                          className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 outline-none ring-cyan-300 focus:ring resize-y"
                        />
                      </label>
                    )}

                    <label className="sm:col-span-2 inline-flex items-center gap-2 text-sm text-slate-300">
                      <input
                        type="checkbox"
                        checked={field.required}
                        onChange={e => updateField(field.clientId, { required: e.target.checked })}
                        className="rounded"
                      />
                      Required field
                    </label>
                  </div>
                </section>
              );
            })}

            <div className="flex gap-2 pt-1">
              <button
                type="submit"
                disabled={isSaving}
                className="rounded-lg bg-cyan-400 px-5 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-300 disabled:opacity-60"
              >
                {isSaving ? 'Saving…' : 'Save form'}
              </button>
              <button
                type="button"
                onClick={() => void fetchFields()}
                disabled={isSaving}
                className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800 disabled:opacity-60"
              >
                Reset
              </button>
            </div>
          </form>
        )}
      </div>
    </main>
  );
}
