'use client';

import { CSSProperties, FormEvent, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

type FieldType =
  | 'TEXT'
  | 'TEXTAREA'
  | 'EMAIL'
  | 'NUMBER'
  | 'SELECT'
  | 'CHECKBOX'
  | 'DATE'
  | 'RADIO_BUTTON'
  | 'FILE_UPLOAD'
  | 'PHOTO_UPLOAD';

type PageTemplate =
  | 'CONFERENCE'
  | 'EXHIBITION'
  | 'VIP_INVITATION'
  | 'MEDIA_ACCREDITATION'
  | 'SPEAKER_REGISTRATION'
  | 'WORKSHOP_TRAINING';

type PageDesign = {
  template: PageTemplate | null;
  logoUrl: string | null;
  bannerImageUrl: string | null;
  backgroundColor: string | null;
  buttonColor: string | null;
  fontFamily: string | null;
  sponsorLogoUrls: string[];
  formLayout: 'SINGLE_COLUMN' | 'TWO_COLUMN' | null;
  footerText: string | null;
  privacyNotice: string | null;
  termsAndConditions: string | null;
  confirmationMessage: string | null;
};

type Field = {
  key: string;
  label: string;
  type: FieldType;
  required: boolean;
  placeholder?: string | null;
  options?: string[];
  minDate?: string | null;
  maxDate?: string | null;
};

type LinkInfo = {
  slug: string;
  title: string;
  event: {
    id: string;
    name: string;
    description?: string | null;
  };
  organization: {
    code: string;
    name: string;
  };
  registrationInstructions?: string | null;
  pageDesign?: PageDesign;
};

type SchemaPayload = {
  fields: Field[];
  pageDesign?: PageDesign;
  registrationInstructions?: string | null;
};

const TEMPLATE_PRESETS: Record<PageTemplate, { accent: string; panel: string; halo: string; font: string; eyebrow: string }> = {
  CONFERENCE: {
    accent: '#f4c95d',
    panel: 'rgba(9, 17, 34, 0.84)',
    halo: 'radial-gradient(circle at top left, rgba(244, 201, 93, 0.28), transparent 42%)',
    font: 'Georgia, "Times New Roman", serif',
    eyebrow: 'Summit Registration'
  },
  EXHIBITION: {
    accent: '#ff7a59',
    panel: 'rgba(34, 15, 10, 0.84)',
    halo: 'radial-gradient(circle at top left, rgba(255, 122, 89, 0.28), transparent 42%)',
    font: '"Avenir Next", "Trebuchet MS", sans-serif',
    eyebrow: 'Exhibit Access'
  },
  VIP_INVITATION: {
    accent: '#d4af37',
    panel: 'rgba(23, 18, 8, 0.88)',
    halo: 'radial-gradient(circle at top left, rgba(212, 175, 55, 0.24), transparent 40%)',
    font: '"Baskerville", "Palatino Linotype", serif',
    eyebrow: 'Invitation Only'
  },
  MEDIA_ACCREDITATION: {
    accent: '#7dd3fc',
    panel: 'rgba(10, 22, 34, 0.86)',
    halo: 'radial-gradient(circle at top left, rgba(125, 211, 252, 0.24), transparent 42%)',
    font: '"Gill Sans", "Trebuchet MS", sans-serif',
    eyebrow: 'Press Accreditation'
  },
  SPEAKER_REGISTRATION: {
    accent: '#fb7185',
    panel: 'rgba(38, 13, 23, 0.86)',
    halo: 'radial-gradient(circle at top left, rgba(251, 113, 133, 0.24), transparent 42%)',
    font: '"Hoefler Text", Georgia, serif',
    eyebrow: 'Speaker Intake'
  },
  WORKSHOP_TRAINING: {
    accent: '#34d399',
    panel: 'rgba(9, 29, 22, 0.86)',
    halo: 'radial-gradient(circle at top left, rgba(52, 211, 153, 0.24), transparent 42%)',
    font: '"Optima", "Avenir Next", sans-serif',
    eyebrow: 'Workshop Enrollment'
  }
};

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || '/api';

export default function PublicRegistrationPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const [linkInfo, setLinkInfo] = useState<LinkInfo | null>(null);
  const [fields, setFields] = useState<Field[]>([]);
  const [pageDesign, setPageDesign] = useState<PageDesign | null>(null);
  const [registrationInstructions, setRegistrationInstructions] = useState<string | null>(null);
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
      const schemaPayload = (await schemaRes.json()) as SchemaPayload;
      setLinkInfo(linkPayload);
      setFields(schemaPayload.fields || []);
      setPageDesign(schemaPayload.pageDesign || linkPayload.pageDesign || null);
      setRegistrationInstructions(schemaPayload.registrationInstructions || linkPayload.registrationInstructions || null);
    }

    void load();
  }, [slug]);

  const activePreset = pageDesign?.template ? TEMPLATE_PRESETS[pageDesign.template] : null;
  const accentColor = pageDesign?.buttonColor || activePreset?.accent || '#22d3ee';
  const pageFont = pageDesign?.fontFamily || activePreset?.font || '"Avenir Next", sans-serif';
  const pageBackgroundColor = pageDesign?.backgroundColor || '#0f172a';
  const panelColor = activePreset?.panel || 'rgba(15, 23, 42, 0.8)';

  const pageStyle = useMemo<CSSProperties>(
    () => ({
      backgroundColor: pageBackgroundColor,
      fontFamily: pageFont
    }),
    [pageBackgroundColor, pageFont]
  );

  const heroStyle = useMemo<CSSProperties>(
    () => ({
      backgroundImage: `${activePreset?.halo || 'radial-gradient(circle at top left, rgba(34, 211, 238, 0.18), transparent 42%)'}${pageDesign?.bannerImageUrl ? `, linear-gradient(rgba(2, 6, 23, 0.45), rgba(2, 6, 23, 0.78)), url(${pageDesign.bannerImageUrl})` : ''}`,
      backgroundSize: pageDesign?.bannerImageUrl ? 'cover' : 'auto',
      backgroundPosition: 'center'
    }),
    [activePreset?.halo, pageDesign?.bannerImageUrl]
  );

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

  function renderField(field: Field) {
    const baseInputClass = 'w-full rounded-2xl border border-white/15 bg-slate-950/70 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-white/35 focus:outline-none';

    if (field.type === 'TEXTAREA') {
      return (
        <textarea
          required={field.required}
          onChange={event => setResponses(current => ({ ...current, [field.key]: event.target.value }))}
          className={`${baseInputClass} min-h-28`}
          placeholder={field.placeholder || ''}
        />
      );
    }

    if (field.type === 'SELECT') {
      return (
        <select
          required={field.required}
          onChange={event => setResponses(current => ({ ...current, [field.key]: event.target.value }))}
          className={baseInputClass}
          defaultValue=""
        >
          <option value="">Select...</option>
          {(field.options || []).map(option => (
            <option value={option} key={option}>
              {option}
            </option>
          ))}
        </select>
      );
    }

    if (field.type === 'RADIO_BUTTON') {
      return (
        <div className="grid gap-2 rounded-2xl border border-white/10 bg-black/15 p-3">
          {(field.options || []).map(option => (
            <label key={option} className="flex items-center gap-3 text-sm text-slate-100">
              <input
                type="radio"
                name={field.key}
                value={option}
                required={field.required}
                onChange={event => setResponses(current => ({ ...current, [field.key]: event.target.value }))}
              />
              <span>{option}</span>
            </label>
          ))}
        </div>
      );
    }

    if (field.type === 'CHECKBOX') {
      return (
        <label className="inline-flex items-center gap-3 rounded-2xl border border-white/10 bg-black/15 px-4 py-3 text-sm text-slate-100">
          <input
            type="checkbox"
            onChange={event => setResponses(current => ({ ...current, [field.key]: event.target.checked }))}
          />
          <span>{field.label}</span>
        </label>
      );
    }

    const inputType =
      field.type === 'NUMBER'
        ? 'number'
        : field.type === 'EMAIL'
          ? 'email'
          : field.type === 'DATE'
            ? 'date'
            : field.type === 'FILE_UPLOAD' || field.type === 'PHOTO_UPLOAD'
              ? 'url'
              : 'text';

    return (
      <input
        required={field.required}
        type={inputType}
        min={field.type === 'DATE' ? field.minDate?.slice(0, 10) : undefined}
        max={field.type === 'DATE' ? field.maxDate?.slice(0, 10) : undefined}
        onChange={event => setResponses(current => ({ ...current, [field.key]: event.target.value }))}
        className={baseInputClass}
        placeholder={
          field.placeholder ||
          (field.type === 'PHOTO_UPLOAD'
            ? 'https://cdn.example.com/photo.jpg'
            : field.type === 'FILE_UPLOAD'
              ? 'https://cdn.example.com/file.pdf'
              : '')
        }
      />
    );
  }

  return (
    <main className="min-h-screen px-6 py-10 text-slate-100" style={pageStyle}>
      <div className="mx-auto max-w-6xl">
        <section className="overflow-hidden rounded-[2rem] border border-white/10 shadow-2xl shadow-black/40" style={heroStyle}>
          <div className="grid gap-8 bg-black/35 px-6 py-8 backdrop-blur-sm md:grid-cols-[1.2fr_0.8fr] md:px-10 md:py-10">
            <div>
              {pageDesign?.logoUrl ? (
                <img src={pageDesign.logoUrl} alt="Registration page logo" className="h-14 w-auto rounded-xl bg-white/90 p-2" />
              ) : null}
              <p className="mt-5 text-xs uppercase tracking-[0.28em] text-white/65">
                {activePreset?.eyebrow || linkInfo?.organization.name || 'Event Registration'}
              </p>
              {linkInfo ? (
                <>
                  <h1 className="mt-3 max-w-3xl text-4xl font-semibold leading-tight md:text-5xl">{linkInfo.title}</h1>
                  <p className="mt-4 max-w-2xl text-base leading-7 text-slate-200/90">
                    {linkInfo.event.description || `Register for ${linkInfo.event.name} by completing the form below.`}
                  </p>
                </>
              ) : (
                <h1 className="text-2xl font-semibold">Loading registration...</h1>
              )}
            </div>
            <div className="rounded-[1.5rem] border border-white/12 p-5" style={{ background: panelColor }}>
              <p className="text-xs uppercase tracking-[0.24em] text-white/55">Event Details</p>
              <div className="mt-4 space-y-4 text-sm text-slate-200">
                <div>
                  <p className="text-white/55">Organizer</p>
                  <p className="mt-1 text-lg font-medium text-white">{linkInfo?.organization.name || 'Loading…'}</p>
                </div>
                <div>
                  <p className="text-white/55">Event</p>
                  <p className="mt-1 text-lg font-medium text-white">{linkInfo?.event.name || 'Loading…'}</p>
                </div>
                {registrationInstructions ? (
                  <div>
                    <p className="text-white/55">Instructions</p>
                    <p className="mt-1 leading-6 text-slate-100">{registrationInstructions}</p>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </section>

        {pageDesign?.sponsorLogoUrls?.length ? (
          <section className="mt-6 rounded-[1.5rem] border border-white/10 bg-white/5 px-5 py-4 backdrop-blur-sm">
            <p className="text-xs uppercase tracking-[0.22em] text-white/50">Presented With</p>
            <div className="mt-4 flex flex-wrap items-center gap-4">
              {pageDesign.sponsorLogoUrls.map(url => (
                <img key={url} src={url} alt="Sponsor logo" className="h-12 rounded-xl bg-white/90 px-3 py-2" />
              ))}
            </div>
          </section>
        ) : null}

        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <section className="rounded-[2rem] border border-white/10 p-6 md:p-8" style={{ background: panelColor }}>
            {error ? <p className="rounded-2xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{error}</p> : null}

            {referenceCode ? (
              <div className="mb-6 rounded-[1.5rem] border border-emerald-400/35 bg-emerald-500/10 p-5">
                <p className="text-sm text-emerald-100">{pageDesign?.confirmationMessage || 'Registration confirmed.'}</p>
                <p className="mt-2 text-2xl font-semibold text-white">Reference: {referenceCode}</p>
                <Link
                  href={`/register/retrieve?referenceCode=${referenceCode}&email=${encodeURIComponent(email)}`}
                  className="mt-4 inline-flex items-center rounded-full border border-white/15 px-4 py-2 text-sm text-white transition hover:bg-white/10"
                >
                  Open re-download page
                </Link>
              </div>
            ) : null}

            <form onSubmit={onSubmit} className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm text-slate-300">Full name</label>
                  <input
                    required
                    value={fullName}
                    onChange={event => setFullName(event.target.value)}
                    placeholder="Full name"
                    className="w-full rounded-2xl border border-white/15 bg-slate-950/70 px-4 py-3 text-sm text-white placeholder:text-slate-500"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm text-slate-300">Email</label>
                  <input
                    required
                    type="email"
                    value={email}
                    onChange={event => setEmail(event.target.value)}
                    placeholder="Email"
                    className="w-full rounded-2xl border border-white/15 bg-slate-950/70 px-4 py-3 text-sm text-white placeholder:text-slate-500"
                  />
                </div>
              </div>

              <div className={`grid gap-4 ${pageDesign?.formLayout === 'TWO_COLUMN' ? 'md:grid-cols-2' : 'grid-cols-1'}`}>
                {fields.map(field => (
                  <div key={field.key} className={field.type === 'TEXTAREA' ? 'md:col-span-2' : ''}>
                    {field.type !== 'CHECKBOX' ? <label className="mb-2 block text-sm text-slate-300">{field.label}</label> : null}
                    {renderField(field)}
                  </div>
                ))}
              </div>

              <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
                <div>
                  <label className="mb-2 block text-sm text-slate-300">Captcha token</label>
                  <input
                    value={captchaToken}
                    onChange={event => setCaptchaToken(event.target.value)}
                    placeholder="Captcha token"
                    className="w-full rounded-2xl border border-white/15 bg-slate-950/70 px-4 py-3 text-sm text-white placeholder:text-slate-500"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="rounded-full px-6 py-3 text-sm font-semibold text-slate-950 transition disabled:cursor-not-allowed disabled:opacity-60"
                  style={{ backgroundColor: accentColor }}
                >
                  {isLoading ? 'Submitting...' : 'Submit registration'}
                </button>
              </div>

              <label className="inline-flex items-start gap-3 text-sm text-slate-300">
                <input type="checkbox" checked={consent} onChange={event => setConsent(event.target.checked)} className="mt-1" />
                <span>I agree to the registration consent policy (v1)</span>
              </label>
            </form>
          </section>

          <aside className="space-y-4">
            {pageDesign?.privacyNotice ? (
              <section className="rounded-[1.5rem] border border-white/10 bg-white/5 p-5 backdrop-blur-sm">
                <p className="text-xs uppercase tracking-[0.22em] text-white/50">Privacy Notice</p>
                <p className="mt-3 text-sm leading-6 text-slate-200">{pageDesign.privacyNotice}</p>
              </section>
            ) : null}

            {pageDesign?.termsAndConditions ? (
              <section className="rounded-[1.5rem] border border-white/10 bg-white/5 p-5 backdrop-blur-sm">
                <p className="text-xs uppercase tracking-[0.22em] text-white/50">Terms & Conditions</p>
                <p className="mt-3 text-sm leading-6 text-slate-200">{pageDesign.termsAndConditions}</p>
              </section>
            ) : null}

            {pageDesign?.footerText ? (
              <section className="rounded-[1.5rem] border border-white/10 bg-white/5 p-5 backdrop-blur-sm">
                <p className="text-xs uppercase tracking-[0.22em] text-white/50">Support</p>
                <p className="mt-3 text-sm leading-6 text-slate-200">{pageDesign.footerText}</p>
              </section>
            ) : null}
          </aside>
        </div>
      </div>
    </main>
  );
}
