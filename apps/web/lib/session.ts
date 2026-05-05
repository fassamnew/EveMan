export type Session = {
  accessToken: string;
  refreshToken: string;
  organizationId: string | null;
  organizationCode: string | null;
  roles: string[];
  email: string;
};

const SESSION_KEY = 'evemange.session';

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
