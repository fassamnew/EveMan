import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import path from 'path';

let db: Database;

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

  console.log('Database initialized');
  return db;
}

export function getDb() {
  if (!db) {
    throw new Error('Database not initialized');
  }
  return db;
}