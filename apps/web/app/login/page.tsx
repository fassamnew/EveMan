'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { saveSession } from '../../lib/session';

type LoginResponse = {
  accessToken: string;
  refreshToken: string;
  user: {
    email: string;
    roles: string[];
    organizationCode: string | null;
  };
};

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5001';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [orgCode, setOrgCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const body: Record<string, string> = {
        email,
        password
      };

      if (orgCode.trim()) {
        body.orgCode = orgCode.trim();
      }

      const response = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json'
        },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { message?: string };
        setError(payload.message || 'Login failed');
        return;
      }

      const payload = (await response.json()) as LoginResponse;
      saveSession({
        accessToken: payload.accessToken,
        refreshToken: payload.refreshToken,
        organizationCode: payload.user.organizationCode,
        roles: payload.user.roles,
        email: payload.user.email
      });

      if (payload.user.roles.includes('SUPER_ADMIN') && !payload.user.organizationCode) {
        router.push('/super-admin');
        return;
      }

      router.push(`/o/${payload.user.organizationCode}`);
    } catch {
      setError('Network error while attempting login');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="container">
      <h1>Sign in</h1>
      <p>Use Super Admin credentials with blank org code, or provide org code for organization portal access.</p>
      <form onSubmit={onSubmit} style={{ display: 'grid', gap: '0.75rem', maxWidth: '28rem' }}>
        <label>
          Email
          <input
            value={email}
            onChange={event => setEmail(event.target.value)}
            type="email"
            required
            style={{ width: '100%' }}
          />
        </label>
        <label>
          Password
          <input
            value={password}
            onChange={event => setPassword(event.target.value)}
            type="password"
            required
            style={{ width: '100%' }}
          />
        </label>
        <label>
          Organization code (optional for Super Admin)
          <input
            value={orgCode}
            onChange={event => setOrgCode(event.target.value)}
            placeholder="acme"
            style={{ width: '100%' }}
          />
        </label>
        <button disabled={isSubmitting} type="submit">
          {isSubmitting ? 'Signing in...' : 'Sign in'}
        </button>
        {error ? <p style={{ color: '#b91c1c' }}>{error}</p> : null}
      </form>
    </main>
  );
}
