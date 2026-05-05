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
    -- Organizers Table
    CREATE TABLE IF NOT EXISTS organizers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      logoUrl TEXT,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- Users Table (Organizers/Staff)
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      organizerId TEXT NOT NULL,
      fullName TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      passwordHash TEXT NOT NULL,
      role TEXT CHECK(role IN ('Admin', 'Staff', 'Usher')) NOT NULL,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (organizerId) REFERENCES organizers(id)
    );

    -- Events Table
    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      organizerId TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      location TEXT,
      startDate TEXT,
      endDate TEXT,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (organizerId) REFERENCES organizers(id)
    );

    -- Registration Links Table
    CREATE TABLE IF NOT EXISTS registration_links (
      id TEXT PRIMARY KEY,
      eventId TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      label TEXT NOT NULL,
      category TEXT NOT NULL,
      requiresApproval INTEGER DEFAULT 0,
      capacity INTEGER,
      formFields TEXT, -- JSON string for custom fields
      themeColor TEXT DEFAULT '#003366',
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (eventId) REFERENCES events(id)
    );

    -- Attendees Table (Refactored)
    CREATE TABLE IF NOT EXISTS attendees (
      id TEXT PRIMARY KEY,
      eventId TEXT NOT NULL,
      registrationLinkId TEXT NOT NULL,
      fullName TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT,
      designation TEXT,
      company TEXT,
      status TEXT CHECK(status IN ('Pending', 'Approved', 'Rejected')) DEFAULT 'Pending',
      qrCodePath TEXT,
      badgePath TEXT,
      checkedIn INTEGER DEFAULT 0,
      checkInTime TEXT,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (eventId) REFERENCES events(id),
      FOREIGN KEY (registrationLinkId) REFERENCES registration_links(id),
      UNIQUE(eventId, email) -- Email must be unique per event
    );

    -- Assets Table (Logos, Templates)
    CREATE TABLE IF NOT EXISTS assets (
      id TEXT PRIMARY KEY,
      eventId TEXT NOT NULL,
      type TEXT CHECK(type IN ('Logo', 'BadgeTemplate')) NOT NULL,
      filePath TEXT NOT NULL,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (eventId) REFERENCES events(id)
    );
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