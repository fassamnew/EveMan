import crypto from 'crypto';
import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { initDb } from './db';

type UserRole = 'admin' | 'staff';

type JwtUserPayload = {
  userId: string;
  username: string;
  role: UserRole;
};

type LoginResult = {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    username: string;
    role: UserRole;
  };
};

const JWT_SECRET = process.env.JWT_SECRET || 'change-me';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRATION || '15m';
const REFRESH_EXPIRES_DAYS = Number(process.env.REFRESH_TOKEN_EXPIRES_DAYS || 7);
const MAX_FAILED_LOGIN_ATTEMPTS = Number(process.env.MAX_FAILED_LOGIN_ATTEMPTS || 5);
const ACCOUNT_LOCK_MINUTES = Number(process.env.ACCOUNT_LOCK_MINUTES || 15);

function randomId(): string {
  return crypto.randomUUID();
}

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function signAccessToken(payload: JwtUserPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'] });
}

function readAccessToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.slice('Bearer '.length).trim();
}

async function writeAuditLog(userId: string | null, action: string, metadata?: unknown): Promise<void> {
  const db = await initDb();
  await db.run(
    `INSERT INTO audit_logs (id, actorUserId, action, metadata)
     VALUES (?, ?, ?, ?)`,
    [randomId(), userId, action, metadata ? JSON.stringify(metadata) : null]
  );
}

async function issueRefreshToken(userId: string, ipAddress?: string, userAgent?: string): Promise<string> {
  const db = await initDb();
  const refreshToken = crypto.randomBytes(48).toString('hex');
  const tokenHash = hashToken(refreshToken);
  const expiresAt = new Date(Date.now() + REFRESH_EXPIRES_DAYS * 24 * 60 * 60 * 1000).toISOString();

  await db.run(
    `INSERT INTO refresh_tokens (id, userId, tokenHash, expiresAt, ipAddress, userAgent)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [randomId(), userId, tokenHash, expiresAt, ipAddress || null, userAgent || null]
  );

  return refreshToken;
}

export async function loginWithPassword(
  usernameOrEmail: string,
  password: string,
  ipAddress?: string,
  userAgent?: string
): Promise<LoginResult | null> {
  const db = await initDb();
  const identity = usernameOrEmail.trim().toLowerCase();

  const user = await db.get<{
    id: string;
    username: string;
    role: UserRole;
    passwordHash: string;
    isActive: number;
    failedLoginCount: number;
    lockedUntil: string | null;
  }>(
    `SELECT id, username, role, passwordHash, isActive, failedLoginCount, lockedUntil
     FROM users
     WHERE lower(username) = ? OR lower(email) = ?
     LIMIT 1`,
    [identity, identity]
  );

  if (!user) {
    await writeAuditLog(null, 'auth_login_failed', { identity, reason: 'user_not_found' });
    return null;
  }

  if (!user.isActive) {
    await writeAuditLog(user.id, 'auth_login_failed', { identity, reason: 'inactive_user' });
    return null;
  }

  if (user.lockedUntil && new Date(user.lockedUntil).getTime() > Date.now()) {
    await writeAuditLog(user.id, 'auth_login_failed', { identity, reason: 'account_locked' });
    return null;
  }

  const passwordMatches = await bcrypt.compare(password, user.passwordHash);
  if (!passwordMatches) {
    const failedAttempts = user.failedLoginCount + 1;
    const shouldLock = failedAttempts >= MAX_FAILED_LOGIN_ATTEMPTS;
    const lockUntil = shouldLock
      ? new Date(Date.now() + ACCOUNT_LOCK_MINUTES * 60 * 1000).toISOString()
      : null;

    await db.run(
      'UPDATE users SET failedLoginCount = ?, lockedUntil = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?',
      [failedAttempts, lockUntil, user.id]
    );

    await writeAuditLog(user.id, 'auth_login_failed', {
      identity,
      reason: 'invalid_password',
      failedAttempts
    });
    return null;
  }

  await db.run(
    `UPDATE users
     SET failedLoginCount = 0, lockedUntil = NULL, lastLoginAt = CURRENT_TIMESTAMP, updatedAt = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [user.id]
  );

  const payload: JwtUserPayload = {
    userId: user.id,
    username: user.username,
    role: user.role
  };

  const accessToken = signAccessToken(payload);
  const refreshToken = await issueRefreshToken(user.id, ipAddress, userAgent);

  await writeAuditLog(user.id, 'auth_login_success', { identity });

  return {
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      username: user.username,
      role: user.role
    }
  };
}

export async function rotateRefreshToken(refreshToken: string, ipAddress?: string, userAgent?: string): Promise<LoginResult | null> {
  const db = await initDb();
  const tokenHash = hashToken(refreshToken);

  const existingToken = await db.get<{
    id: string;
    userId: string;
    expiresAt: string;
    revokedAt: string | null;
    username: string;
    role: UserRole;
    isActive: number;
  }>(
    `SELECT rt.id, rt.userId, rt.expiresAt, rt.revokedAt, u.username, u.role, u.isActive
     FROM refresh_tokens rt
     JOIN users u ON u.id = rt.userId
     WHERE rt.tokenHash = ?
     LIMIT 1`,
    [tokenHash]
  );

  if (!existingToken || existingToken.revokedAt || new Date(existingToken.expiresAt).getTime() <= Date.now() || !existingToken.isActive) {
    return null;
  }

  await db.run('UPDATE refresh_tokens SET revokedAt = CURRENT_TIMESTAMP WHERE id = ?', [existingToken.id]);

  const payload: JwtUserPayload = {
    userId: existingToken.userId,
    username: existingToken.username,
    role: existingToken.role
  };

  const newRefreshToken = await issueRefreshToken(existingToken.userId, ipAddress, userAgent);
  const accessToken = signAccessToken(payload);

  await writeAuditLog(existingToken.userId, 'auth_token_refreshed');

  return {
    accessToken,
    refreshToken: newRefreshToken,
    user: {
      id: existingToken.userId,
      username: existingToken.username,
      role: existingToken.role
    }
  };
}

export async function revokeRefreshToken(refreshToken: string): Promise<void> {
  const db = await initDb();
  const tokenHash = hashToken(refreshToken);
  await db.run(
    'UPDATE refresh_tokens SET revokedAt = CURRENT_TIMESTAMP WHERE tokenHash = ? AND revokedAt IS NULL',
    [tokenHash]
  );
}

export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const token = readAccessToken(req);
  if (!token) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (typeof decoded === 'string') {
      res.status(401).json({ error: 'Invalid token payload' });
      return;
    }

    res.locals.authUser = decoded as JwtUserPayload;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export function authorize(roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const authUser = res.locals.authUser as JwtUserPayload | undefined;
    if (!authUser || !roles.includes(authUser.role)) {
      res.status(403).json({ error: 'Permission denied' });
      return;
    }
    next();
  };
}
