export type Session = {
  accessToken: string;
  refreshToken: string;
  organizationId: string | null;
  organizationCode: string | null;
  roles: string[];
  email: string;
};

const SESSION_KEY = 'evemange.session';
const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5001';

export function saveSession(session: Session): void {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function loadSession(): Session | null {
  const raw = localStorage.getItem(SESSION_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as Session;
  } catch {
    return null;
  }
}

export function clearSession(): void {
  localStorage.removeItem(SESSION_KEY);
}

/**
 * Attempts to exchange the stored refresh token for a new access token.
 * Updates localStorage and returns the new session, or null if it fails.
 */
export async function refreshSession(): Promise<Session | null> {
  const current = loadSession();
  if (!current) return null;

  try {
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ refreshToken: current.refreshToken })
    });

    if (!res.ok) {
      clearSession();
      return null;
    }

    const data = (await res.json()) as {
      accessToken: string;
      refreshToken: string;
    };

    const next: Session = {
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      organizationId: current.organizationId,
      organizationCode: current.organizationCode,
      roles: current.roles,
      email: current.email
    };

    saveSession(next);
    return next;
  } catch {
    return null;
  }
}

/**
 * Makes an authenticated fetch. If the response is 401, attempts a token
 * refresh once and retries. Calls onSessionExpired if refresh also fails.
 */
export async function authFetch(
  url: string,
  options: RequestInit,
  onSessionExpired: () => void
): Promise<Response> {
  const session = loadSession();
  if (!session) {
    onSessionExpired();
    return new Response(null, { status: 401 });
  }

  const headers = { ...(options.headers as Record<string, string>), Authorization: `Bearer ${session.accessToken}` };
  const res = await fetch(url, { ...options, headers });

  if (res.status !== 401) return res;

  // Try refresh
  const next = await refreshSession();
  if (!next) {
    onSessionExpired();
    return res;
  }

  const retryHeaders = { ...(options.headers as Record<string, string>), Authorization: `Bearer ${next.accessToken}` };
  return fetch(url, { ...options, headers: retryHeaders });
}
