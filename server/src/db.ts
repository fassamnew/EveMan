import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import path from 'path';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

let db: Database;

function randomId(): string {
  return crypto.randomUUID().replace(/-/g, '');
}

async function getExistingColumns(database: Database, tableName: string): Promise<Set<string>> {
  const rows = await database.all<{ name: string }[]>(`PRAGMA table_info(${tableName})`);
  return new Set(rows.map(row => row.name));
}

async function ensureUserTableCompatibility(database: Database): Promise<void> {
  const columns = await getExistingColumns(database, 'users');

  if (!columns.has('username')) {
    await database.exec('ALTER TABLE users ADD COLUMN username TEXT');
  }
  if (!columns.has('email')) {
    await database.exec('ALTER TABLE users ADD COLUMN email TEXT');
  }
  if (!columns.has('passwordHash')) {
    await database.exec('ALTER TABLE users ADD COLUMN passwordHash TEXT');
  }
  if (!columns.has('role')) {
    await database.exec("ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'staff'");
  }
  if (!columns.has('isActive')) {
    await database.exec('ALTER TABLE users ADD COLUMN isActive INTEGER DEFAULT 1');
  }
  if (!columns.has('failedLoginCount')) {
    await database.exec('ALTER TABLE users ADD COLUMN failedLoginCount INTEGER DEFAULT 0');
  }
  if (!columns.has('lockedUntil')) {
    await database.exec('ALTER TABLE users ADD COLUMN lockedUntil TEXT');
  }
  if (!columns.has('lastLoginAt')) {
    await database.exec('ALTER TABLE users ADD COLUMN lastLoginAt TEXT');
  }
  if (!columns.has('createdAt')) {
    await database.exec('ALTER TABLE users ADD COLUMN createdAt TEXT');
  }
  if (!columns.has('updatedAt')) {
    await database.exec('ALTER TABLE users ADD COLUMN updatedAt TEXT');
  }

  await database.exec(`
    UPDATE users
    SET
      role = COALESCE(NULLIF(role, ''), 'staff'),
      isActive = COALESCE(isActive, 1),
      failedLoginCount = COALESCE(failedLoginCount, 0),
      createdAt = COALESCE(createdAt, CURRENT_TIMESTAMP),
      updatedAt = COALESCE(updatedAt, CURRENT_TIMESTAMP)
  `);

  await database.exec(`
    UPDATE users
    SET username = lower(COALESCE(NULLIF(username, ''), NULLIF(email, ''), 'user_' || substr(id, 1, 8)))
    WHERE username IS NULL OR trim(username) = ''
  `);

  await database.exec(`
    UPDATE users
    SET username = username || '_' || substr(id, 1, 6)
    WHERE rowid NOT IN (
      SELECT MIN(rowid)
      FROM users
      GROUP BY username
    )
  `);

  const initialAdminPassword = process.env.INITIAL_ADMIN_PASSWORD;
  if (initialAdminPassword) {
    const fallbackHash = await bcrypt.hash(initialAdminPassword, 12);
    await database.run(
      `UPDATE users
       SET passwordHash = ?
       WHERE passwordHash IS NULL OR trim(passwordHash) = ''`,
      [fallbackHash]
    );
  }

  await database.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username)');
  await database.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email) WHERE email IS NOT NULL');
}

async function seedInitialAdmin(database: Database): Promise<void> {
  const username = process.env.INITIAL_ADMIN_USERNAME?.trim();
  const password = process.env.INITIAL_ADMIN_PASSWORD;
  const email = process.env.INITIAL_ADMIN_EMAIL?.trim().toLowerCase() || null;

  if (!username || !password) {
    return;
  }

  const existingAdmin = await database.get('SELECT id FROM users WHERE lower(role) = ? LIMIT 1', ['admin']);
  if (existingAdmin) {
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const columns = await getExistingColumns(database, 'users');

  const insertColumns = ['id', 'username', 'email', 'passwordHash', 'role', 'isActive'];
  const values: Array<string | number | null> = [
    randomId(),
    username.toLowerCase(),
    email,
    passwordHash,
    'admin',
    1
  ];

  if (columns.has('organizerId')) {
    insertColumns.push('organizerId');
    values.push(randomId());
  }

  if (columns.has('fullName')) {
    insertColumns.push('fullName');
    values.push(username);
  }

  const placeholders = insertColumns.map(() => '?').join(', ');
  await database.run(
    `INSERT INTO users (${insertColumns.join(', ')}) VALUES (${placeholders})`,
    values
  );
}

export async function initDb() {
  db = await open({
    filename: path.join(__dirname, '../database.sqlite'),
    driver: sqlite3.Database
  });

  await db.exec(`
    CREATE TABLE IF NOT EXISTS attendees (
      id TEXT PRIMARY KEY,
      fullName TEXT NOT NULL,
      designation TEXT,
      company TEXT,
      email TEXT UNIQUE NOT NULL,
      phone TEXT,
      category TEXT CHECK(category IN ('Delegate', 'Media')) NOT NULL,
      qrCodePath TEXT,
      badgePath TEXT,
      checkedIn INTEGER DEFAULT 0,
      checkInTime TEXT,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE,
      passwordHash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('admin', 'staff')),
      isActive INTEGER NOT NULL DEFAULT 1,
      failedLoginCount INTEGER NOT NULL DEFAULT 0,
      lockedUntil TEXT,
      lastLoginAt TEXT,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
      updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await ensureUserTableCompatibility(db);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      tokenHash TEXT NOT NULL UNIQUE,
      expiresAt TEXT NOT NULL,
      revokedAt TEXT,
      ipAddress TEXT,
      userAgent TEXT,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(userId) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      actorUserId TEXT,
      action TEXT NOT NULL,
      metadata TEXT,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(actorUserId) REFERENCES users(id) ON DELETE SET NULL
    )
  `);

  await seedInitialAdmin(db);

  console.log('Database initialized');
  return db;
}

export function getDb() {
  if (!db) {
    throw new Error('Database not initialized');
  }
  return db;
}