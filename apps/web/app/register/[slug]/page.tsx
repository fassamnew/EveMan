'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

type Field = {
  key: string;
  label: string;
  type: 'TEXT' | 'TEXTAREA' | 'EMAIL' | 'NUMBER' | 'SELECT' | 'CHECKBOX';
  required: boolean;
  placeholder?: string | null;
  options?: string[];
};

type LinkInfo = {
  slug: string;
  title: string;
  event: {
    id: string;
    name: string;
  };
  organization: {
    code: string;
    name: string;
  };
};

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5001';

export default function PublicRegistrationPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const [linkInfo, setLinkInfo] = useState<LinkInfo | null>(null);
  const [fields, setFields] = useState<Field[]>([]);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [consent, setConsent] = useState(false);
  const [captchaToken, setCaptchaToken] = useState('dev-token-123');
  const [responses, setResponses] = useState<Record<string, string | number | boolean>>({});
  const [referenceCode, setReferenceCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!slug) {
      return;
    }

    async function load() {
      setError(null);

      const [linkRes, schemaRes] = await Promise.all([
        fetch(`${API_BASE}/public/register/${slug}`),
        fetch(`${API_BASE}/public/register/${slug}/schema`)
      ]);

      if (!linkRes.ok || !schemaRes.ok) {
        setError('This registration link is unavailable.');
        return;
      }

      const linkPayload = (await linkRes.json()) as LinkInfo;
      const schemaPayload = (await schemaRes.json()) as { fields: Field[] };
      setLinkInfo(linkPayload);
      setFields(schemaPayload.fields || []);
    }

    void load();
  }, [slug]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsLoading(true);

    const payload = {
      fullName,
      email,
      consentAccepted: consent,
      consentPolicyVersion: 'v1',
      captchaToken,
      responses: fields.map(field => ({
        key: field.key,
        value: responses[field.key] ?? (field.type === 'CHECKBOX' ? false : '')
      }))
    };

    const response = await fetch(`${API_BASE}/public/register/${slug}/submissions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const body = (await response.json().catch(() => ({}))) as {
      message?: string;
      referenceCode?: string;
      existingReferenceCode?: string;
    };

    if (!response.ok) {
      if (response.status === 409 && body.existingReferenceCode) {
        setError(`This email is already registered. Reference code: ${body.existingReferenceCode}`);
      } else {
        setError(body.message || 'Registration failed.');
      }
      setIsLoading(false);
      return;
    }

    setReferenceCode(body.referenceCode || null);
    setIsLoading(false);
  }

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10 text-slate-100">
      <div className="mx-auto max-w-3xl rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
        {linkInfo ? (
          <>
            <p className="text-xs uppercase tracking-[0.18em] text-cyan-300">{linkInfo.organization.name}</p>
            <h1 className="mt-2 text-3xl font-semibold">{linkInfo.title}</h1>
            <p className="mt-1 text-sm text-slate-300">Event: {linkInfo.event.name}</p>
          </>
        ) : (
          <h1 className="text-2xl font-semibold">Loading registration...</h1>
        )}

        {error ? <p className="mt-4 rounded border border-rose-500/60 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">{error}</p> : null}

        {referenceCode ? (
          <div className="mt-6 rounded-xl border border-emerald-500/50 bg-emerald-500/10 p-4">
            <p className="text-sm text-emerald-200">Registration confirmed.</p>
            <p className="mt-1 text-xl font-semibold text-emerald-100">Reference: {referenceCode}</p>
            <Link href={`/register/retrieve?referenceCode=${referenceCode}&email=${encodeURIComponent(email)}`} className="mt-3 inline-block text-sm text-cyan-300 underline">
              Open re-download page
            </Link>
          </div>
        ) : null}

        <form onSubmit={onSubmit} className="mt-6 grid gap-3">
          <input
            required
            value={fullName}
            onChange={event => setFullName(event.target.value)}
            placeholder="Full name"
            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
          />
          <input
            required
            type="email"
            value={email}
            onChange={event => setEmail(event.target.value)}
            placeholder="Email"
            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
          />

          {fields.map(field => (
            <div key={field.key}>
              <label className="mb-1 block text-sm text-slate-300">{field.label}</label>
              {field.type === 'TEXTAREA' ? (
                <textarea
                  required={field.required}
                  onChange={event => setResponses(current => ({ ...current, [field.key]: event.target.value }))}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
                  placeholder={field.placeholder || ''}
                />
              ) : null}
              {field.type === 'SELECT' ? (
                <select
                  required={field.required}
                  onChange={event => setResponses(current => ({ ...current, [field.key]: event.target.value }))}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
                >
                  <option value="">Select...</option>
                  {(field.options || []).map(option => (
                    <option value={option} key={option}>
                      {option}
                    </option>
                  ))}
                </select>
              ) : null}
              {field.type === 'CHECKBOX' ? (
                <label className="inline-flex items-center gap-2 text-sm text-slate-300">
                  <input
                    type="checkbox"
                    onChange={event => setResponses(current => ({ ...current, [field.key]: event.target.checked }))}
                  />
                  {field.label}
                </label>
              ) : null}
              {field.type !== 'TEXTAREA' && field.type !== 'SELECT' && field.type !== 'CHECKBOX' ? (
                <input
                  required={field.required}
                  type={field.type === 'NUMBER' ? 'number' : field.type === 'EMAIL' ? 'email' : 'text'}
                  onChange={event => setResponses(current => ({ ...current, [field.key]: event.target.value }))}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
                  placeholder={field.placeholder || ''}
                />
              ) : null}
            </div>
          ))}

          <input
            value={captchaToken}
            onChange={event => setCaptchaToken(event.target.value)}
            placeholder="Captcha token"
            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
          />

          <label className="inline-flex items-center gap-2 text-sm text-slate-300">
            <input type="checkbox" checked={consent} onChange={event => setConsent(event.target.checked)} />
            I agree to the registration consent policy (v1)
          </label>

          <button
            type="submit"
            disabled={isLoading}
            className="rounded-lg bg-cyan-400 px-4 py-2 font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoading ? 'Submitting...' : 'Submit registration'}
          </button>
        </form>
      </div>
    </main>
  );
}
