import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import path from 'path';
import bcrypt from 'bcryptjs';

let db: Database;

async function seedInitialAdmin(database: Database): Promise<void> {
  const username = process.env.INITIAL_ADMIN_USERNAME?.trim();
  const password = process.env.INITIAL_ADMIN_PASSWORD;
  const email = process.env.INITIAL_ADMIN_EMAIL?.trim().toLowerCase() || null;

  if (!username || !password) {
    return;
  }

  const existingAdmin = await database.get('SELECT id FROM users WHERE role = ? LIMIT 1', ['admin']);
  if (existingAdmin) {
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await database.run(
    `INSERT INTO users (id, username, email, passwordHash, role, isActive)
     VALUES (lower(hex(randomblob(16))), ?, ?, ?, 'admin', 1)`,
    [username.toLowerCase(), email, passwordHash]
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