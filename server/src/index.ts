import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { initDb, getDb } from './db';
import { v4 as uuidv4 } from 'uuid';
import QRCode from 'qrcode';
import path from 'path';
import fs from 'fs';
import { generateBadge } from './badgeGenerator';
import { sendBadgeEmail, sendBulkReminder } from './emailService';
import multer from 'multer';
import { parse } from 'csv-parse';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { authenticate, authorize, AuthRequest } from './auth';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;
const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key';

function toCsvValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes('"') || str.includes(',') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function toCsv(rows: Array<Record<string, unknown>>, headers: string[]): string {
  const headerLine = headers.join(',');
  const body = rows
    .map((row) => headers.map((header) => toCsvValue(row[header])).join(','))
    .join('\n');
  return `${headerLine}\n${body}`;
}

app.use(cors());
app.use(express.json());

// Ensure directories exist
const uploadsDir = path.join(__dirname, '../uploads');
const qrcodesDir = path.join(uploadsDir, 'qrcodes');
const tempDir = path.join(uploadsDir, 'temp');
[uploadsDir, qrcodesDir, tempDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Serve static files from uploads directory
app.use('/uploads', express.static(uploadsDir));

// Setup Multer for file uploads
const upload = multer({ dest: 'uploads/temp/' });

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// --- AUTH ROUTES ---

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const db = getDb();
    const user = await db.get('SELECT * FROM users WHERE email = ?', [email]);

    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: user.id, organizerId: user.organizerId, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({ token, user: { id: user.id, fullName: user.fullName, role: user.role, organizerId: user.organizerId } });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// --- EVENT MANAGEMENT ROUTES ---

// Create an Event
app.post('/api/events', authenticate, authorize(['Admin']), async (req: AuthRequest, res) => {
  try {
    const { name, description, location, startDate, endDate } = req.body;
    const db = getDb();
    const eventId = uuidv4();

    await db.run(
      'INSERT INTO events (id, organizerId, name, description, location, startDate, endDate) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [eventId, req.user!.organizerId, name, description, location, startDate, endDate]
    );

    res.status(201).json({ message: 'Event created', eventId });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get Organizers Events
app.get('/api/events', authenticate, async (req: AuthRequest, res) => {
  try {
    const db = getDb();
    const events = await db.all('SELECT * FROM events WHERE organizerId = ?', [req.user!.organizerId]);
    res.json(events);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Create a Registration Link for an Event
app.post('/api/events/:eventId/links', authenticate, authorize(['Admin']), async (req: AuthRequest, res) => {
  try {
    const { eventId } = req.params;
    const { label, category, slug, requiresApproval, capacity } = req.body;
    const db = getDb();

    if (!label || !category || !slug) {
      return res.status(400).json({ error: 'Label, Category, and Slug are required.' });
    }

    // Verify event belongs to organizer
    const event = await db.get('SELECT id FROM events WHERE id = ? AND organizerId = ?', [eventId, req.user!.organizerId]);
    if (!event) return res.status(404).json({ error: 'Event not found' });

    const linkId = uuidv4();
    await db.run(
      'INSERT INTO registration_links (id, eventId, slug, label, category, requiresApproval, capacity) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [linkId, eventId, slug, label, category, requiresApproval ? 1 : 0, capacity]
    );

    res.status(201).json({ message: 'Registration link created', slug });
  } catch (error: any) {
    if (error.code === 'SQLITE_CONSTRAINT') {
      return res.status(400).json({ error: 'Slug already exists' });
    }
    res.status(500).json({ error: error.message });
  }
});

// List Registration Links for an Event
app.get('/api/events/:eventId/links', authenticate, async (req: AuthRequest, res) => {
  try {
    const { eventId } = req.params;
    const db = getDb();

    // Verify ownership
    const event = await db.get('SELECT id FROM events WHERE id = ? AND organizerId = ?', [eventId, req.user!.organizerId]);
    if (!event) return res.status(404).json({ error: 'Event not found' });

    const links = await db.all('SELECT * FROM registration_links WHERE eventId = ?', [eventId]);
    res.json(links);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// --- REFACTORED REGISTRATION ---

// Public endpoint to get link details (for frontend rendering)
app.get('/api/pub/link/:slug', async (req, res) => {
  try {
    const { slug } = req.params;
    const db = getDb();
    const link = await db.get(`
      SELECT rl.*, e.name as eventName, e.description as eventDescription 
      FROM registration_links rl
      JOIN events e ON rl.eventId = e.id
      WHERE rl.slug = ?`, [slug]);

    if (!link) return res.status(404).json({ error: 'Link not found' });
    res.json(link);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Register Attendee via specific Link
app.post('/api/pub/register/:slug', async (req, res) => {
  try {
    const { slug } = req.params;
    const { fullName, email, phone, designation, company, customFields } = req.body;
    const db = getDb();

    const link = await db.get('SELECT * FROM registration_links WHERE slug = ?', [slug]);
    if (!link) return res.status(404).json({ error: 'Invalid registration link' });

    // Validate Custom Fields if defined
    if (link.formFields) {
      const schema = JSON.parse(link.formFields);
      // Basic validation logic would go here in Phase 6
    }

    const attendeeId = uuidv4();
    const status = link.requiresApproval ? 'Pending' : 'Approved';
    
    // Logic for QR/Badge generation only if 'Approved'
    let qrCodePath = null;
    let badgePath = null;

    if (status === 'Approved') {
      qrCodePath = `uploads/qrcodes/${attendeeId}.png`;
      await QRCode.toFile(path.join(__dirname, '..', qrCodePath), attendeeId);
      
      // Get Event & Asset details for badge branding
      const event = await db.get('SELECT * FROM events WHERE id = ?', [link.eventId]);
      const logo = await db.get("SELECT filePath FROM assets WHERE eventId = ? AND type = 'Logo'", [link.eventId]);
      const template = await db.get("SELECT filePath FROM assets WHERE eventId = ? AND type = 'BadgeTemplate'", [link.eventId]);

      badgePath = await generateBadge({
        fullName,
        designation,
        company,
        category: link.category,
        qrCodePath,
        eventName: event?.name,
        logoPath: logo?.filePath,
        themeColor: link.themeColor // We should add this column to registration_links
      });
    }

    await db.run(
      `INSERT INTO attendees (id, eventId, registrationLinkId, fullName, email, phone, designation, company, status, qrCodePath, badgePath) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [attendeeId, link.eventId, link.id, fullName, email, phone, designation, company, status, qrCodePath, badgePath]
    );

    // Save custom fields to a separate table or JSON column in Phase 6: Expansion
    // For now, we are capturing the core multi-tenant registration flow.

    res.status(201).json({ 
      message: status === 'Approved' ? 'Registration successful' : 'Registration submitted for approval',
      status,
      attendeeId 
    });
  } catch (error: any) {
    if (error.code === 'SQLITE_CONSTRAINT') {
      return res.status(400).json({ error: 'You are already registered for this event.' });
    }
    res.status(500).json({ error: error.message });
  }
});

// --- ORGANIZER DASHBOARD & ANALYTICS ---

// Get Stats for a specific Event
app.get('/api/events/:eventId/stats', authenticate, async (req: AuthRequest, res) => {
  try {
    const { eventId } = req.params;
    const db = getDb();

    // Verify ownership
    const event = await db.get('SELECT id FROM events WHERE id = ? AND organizerId = ?', [eventId, req.user!.organizerId]);
    if (!event) return res.status(404).json({ error: 'Event not found' });

    // Aggregate Stats
    const stats = await db.all(`
      SELECT 
        rl.label as linkLabel,
        rl.category,
        COUNT(a.id) as totalRegistrations,
        SUM(CASE WHEN a.status = 'Approved' THEN 1 ELSE 0 END) as approved,
        SUM(CASE WHEN a.status = 'Pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN a.status = 'Rejected' THEN 1 ELSE 0 END) as rejected,
        SUM(CASE WHEN a.checkedIn = 1 THEN 1 ELSE 0 END) as checkedIn
      FROM registration_links rl
      LEFT JOIN attendees a ON rl.id = a.registrationLinkId
      WHERE rl.eventId = ?
      GROUP BY rl.id
    `, [eventId]);

    // Live arrival rate (last 10 minutes)
    const recentCheckins = await db.get(`
      SELECT COUNT(*) as count 
      FROM attendees 
      WHERE eventId = ? AND checkedIn = 1 
      AND checkInTime > datetime('now', '-10 minutes')
    `, [eventId]);

    res.json({
      linkStats: stats,
      summary: {
        total: stats.reduce((acc, s) => acc + s.totalRegistrations, 0),
        approved: stats.reduce((acc, s) => acc + s.approved, 0),
        checkedIn: stats.reduce((acc, s) => acc + s.checkedIn, 0),
        recentCheckins: recentCheckins.count
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// List Attendees for an Event (with filters)
app.get('/api/events/:eventId/attendees', authenticate, async (req: AuthRequest, res) => {
  try {
    const { eventId } = req.params;
    const { status, category, search } = req.query;
    const db = getDb();

    // Verify ownership
    const event = await db.get('SELECT id FROM events WHERE id = ? AND organizerId = ?', [eventId, req.user!.organizerId]);
    if (!event) return res.status(404).json({ error: 'Event not found' });

    let query = 'SELECT * FROM attendees WHERE eventId = ?';
    const params: any[] = [eventId];

    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }
    if (category) {
      query += ' AND registrationLinkId IN (SELECT id FROM registration_links WHERE category = ?)';
      params.push(category);
    }
    if (search) {
      query += ' AND (fullName LIKE ? OR email LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    query += ' ORDER BY createdAt DESC';
    
    const attendees = await db.all(query, params);
    res.json(attendees);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Import Attendees via CSV
app.post('/api/import-csv', authenticate, authorize(['Admin']), upload.single('file'), async (req: AuthRequest, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  try {
    const { eventId, defaultCategory } = req.body;
    if (!eventId) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: 'eventId is required' });
    }

    const db = getDb();

    const event = await db.get(
      'SELECT id, name FROM events WHERE id = ? AND organizerId = ?',
      [eventId, req.user!.organizerId]
    );
    if (!event) {
      fs.unlinkSync(req.file.path);
      return res.status(404).json({ error: 'Event not found' });
    }

    const rows: any[] = [];
    await new Promise<void>((resolve, reject) => {
      fs.createReadStream(req.file!.path)
        .pipe(parse({ columns: true, skip_empty_lines: true, trim: true }))
        .on('data', (data) => rows.push(data))
        .on('end', () => resolve())
        .on('error', (err) => reject(err));
    });

    const results = {
      successCount: 0,
      duplicateCount: 0,
      errorCount: 0,
      details: [] as Array<{ row: number; status: 'imported' | 'duplicate' | 'failed'; message?: string }>
    };

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        const fullName = row.fullName?.trim();
        const email = row.email?.trim();
        const designation = row.designation?.trim() || null;
        const company = row.company?.trim() || null;
        const phone = row.phone?.trim() || null;
        const category = row.category?.trim() || defaultCategory || null;

        if (!fullName || !email) {
          results.errorCount += 1;
          results.details.push({ row: i + 1, status: 'failed', message: 'fullName and email are required' });
          continue;
        }

        const link = category
          ? await db.get(
              'SELECT id, category, requiresApproval FROM registration_links WHERE eventId = ? AND category = ? ORDER BY createdAt ASC LIMIT 1',
              [eventId, category]
            )
          : await db.get(
              'SELECT id, category, requiresApproval FROM registration_links WHERE eventId = ? ORDER BY createdAt ASC LIMIT 1',
              [eventId]
            );

        if (!link) {
          results.errorCount += 1;
          results.details.push({
            row: i + 1,
            status: 'failed',
            message: category
              ? `No registration link for category: ${category}`
              : 'No registration link configured for event'
          });
          continue;
        }

        const attendeeId = uuidv4();
        const status = link.requiresApproval ? 'Pending' : 'Approved';

        let qrCodePath: string | null = null;
        let badgePath: string | null = null;

        if (status === 'Approved') {
          qrCodePath = `uploads/qrcodes/${attendeeId}.png`;
          await QRCode.toFile(path.join(__dirname, '..', qrCodePath), attendeeId);

          badgePath = await generateBadge({
            fullName,
            designation,
            company,
            category: link.category,
            qrCodePath,
            eventName: event.name
          });
        }

        await db.run(
          `INSERT INTO attendees (id, eventId, registrationLinkId, fullName, email, phone, designation, company, status, qrCodePath, badgePath)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [attendeeId, eventId, link.id, fullName, email, phone, designation, company, status, qrCodePath, badgePath]
        );

        results.successCount += 1;
        results.details.push({ row: i + 1, status: 'imported' });
      } catch (error: any) {
        if (error?.code === 'SQLITE_CONSTRAINT') {
          results.duplicateCount += 1;
          results.details.push({ row: i + 1, status: 'duplicate', message: 'Duplicate email for event' });
          continue;
        }

        results.errorCount += 1;
        results.details.push({ row: i + 1, status: 'failed', message: error?.message || 'Unknown import error' });
      }
    }

    fs.unlinkSync(req.file.path);
    return res.json({ message: 'Import completed', ...results });
  } catch (error: any) {
    try {
      if (req.file?.path && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
    } catch {
      // Ignore cleanup errors
    }
    return res.status(500).json({ error: error.message });
  }
});

// Export Attendees as CSV
app.get('/api/events/:eventId/export/:reportType', authenticate, async (req: AuthRequest, res) => {
  try {
    const { eventId, reportType } = req.params;
    const db = getDb();

    const event = await db.get('SELECT id, name FROM events WHERE id = ? AND organizerId = ?', [eventId, req.user!.organizerId]);
    if (!event) return res.status(404).json({ error: 'Event not found' });

    let query = `
      SELECT
        a.id,
        a.fullName,
        a.email,
        a.phone,
        a.company,
        a.designation,
        a.status,
        a.checkedIn,
        a.checkInTime,
        rl.label AS linkLabel,
        rl.category,
        a.createdAt
      FROM attendees a
      JOIN registration_links rl ON a.registrationLinkId = rl.id
      WHERE a.eventId = ?
    `;
    const params: any[] = [eventId];

    if (reportType === 'approved') {
      query += ' AND a.status = ?';
      params.push('Approved');
    } else if (reportType === 'pending') {
      query += ' AND a.status = ?';
      params.push('Pending');
    } else if (reportType === 'checked-in') {
      query += ' AND a.checkedIn = 1';
    } else if (reportType === 'no-show') {
      query += ' AND a.status = ? AND a.checkedIn = 0';
      params.push('Approved');
    } else if (reportType !== 'full') {
      return res.status(400).json({ error: 'Invalid report type. Use full|approved|pending|checked-in|no-show' });
    }

    query += ' ORDER BY a.createdAt DESC';

    const attendees = await db.all(query, params);
    const normalized = attendees.map((a: any) => ({
      ...a,
      checkedIn: a.checkedIn ? 'Yes' : 'No'
    }));

    const headers = [
      'id',
      'fullName',
      'email',
      'phone',
      'company',
      'designation',
      'status',
      'checkedIn',
      'checkInTime',
      'linkLabel',
      'category',
      'createdAt'
    ];
    const csv = toCsv(normalized, headers);

    const safeEventName = String(event.name).replace(/[^a-zA-Z0-9-_]+/g, '_');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${safeEventName}-${reportType}.csv"`);
    res.status(200).send(csv);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// --- REGISTRATION LINK MANAGEMENT ---

// Update a Registration Link
app.patch('/api/events/:eventId/links/:linkId', authenticate, authorize(['Admin']), async (req: AuthRequest, res) => {
  try {
    const { eventId, linkId } = req.params;
    const { label, category, slug, requiresApproval, capacity } = req.body;
    const db = getDb();

    // Verify event ownership
    const event = await db.get('SELECT id FROM events WHERE id = ? AND organizerId = ?', [eventId, req.user!.organizerId]);
    if (!event) return res.status(404).json({ error: 'Event not found' });

    await db.run(
      `UPDATE registration_links 
       SET label = COALESCE(?, label), 
           category = COALESCE(?, category), 
           slug = COALESCE(?, slug), 
           requiresApproval = COALESCE(?, requiresApproval), 
           capacity = COALESCE(?, capacity)
       WHERE id = ? AND eventId = ?`,
      [label, category, slug, requiresApproval !== undefined ? (requiresApproval ? 1 : 0) : null, capacity, linkId, eventId]
    );

    res.json({ message: 'Registration link updated' });
  } catch (error: any) {
    if (error.code === 'SQLITE_CONSTRAINT') {
      return res.status(400).json({ error: 'Slug already exists' });
    }
    res.status(500).json({ error: error.message });
  }
});

// Delete a Registration Link
app.delete('/api/events/:eventId/links/:linkId', authenticate, authorize(['Admin']), async (req: AuthRequest, res) => {
  try {
    const { eventId, linkId } = req.params;
    const db = getDb();

    const event = await db.get('SELECT id FROM events WHERE id = ? AND organizerId = ?', [eventId, req.user!.organizerId]);
    if (!event) return res.status(404).json({ error: 'Event not found' });

    // Check if link has attendees before deleting
    const attendees = await db.get('SELECT id FROM attendees WHERE registrationLinkId = ? LIMIT 1', [linkId]);
    if (attendees) {
      return res.status(400).json({ error: 'Cannot delete link with registered attendees. Disable it instead.' });
    }

    await db.run('DELETE FROM registration_links WHERE id = ? AND eventId = ?', [linkId, eventId]);
    res.json({ message: 'Registration link deleted' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// --- USHER & CHECK-IN API ---

// List Events Assigned to Usher/Staff
app.get('/api/usher/events', authenticate, authorize(['Admin', 'Staff', 'Usher']), async (req: AuthRequest, res) => {
  try {
    const db = getDb();
    // For now, ushers can see all events in their organization. 
    // In future, we can add a mapping table for specific event assignments.
    const events = await db.all('SELECT * FROM events WHERE organizerId = ?', [req.user!.organizerId]);
    res.json(events);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Verify & Check-in (Enhanced for Multi-Tenancy)
app.post('/api/events/:eventId/verify/:attendeeId', authenticate, authorize(['Admin', 'Staff', 'Usher']), async (req: AuthRequest, res) => {
  try {
    const { eventId, attendeeId } = req.params;
    const db = getDb();
    
    // 1. Verify attendee exists for THIS event and THIS organizer
    const attendee = await db.get(`
      SELECT a.*, rl.label as linkLabel, e.name as eventName
      FROM attendees a
      JOIN events e ON a.eventId = e.id
      JOIN registration_links rl ON a.registrationLinkId = rl.id
      WHERE a.id = ? AND a.eventId = ? AND e.organizerId = ?`, 
      [attendeeId, eventId, req.user!.organizerId]
    );
    
    if (!attendee) {
      return res.status(404).json({ error: 'Invalid badge or mismatching event' });
    }

    if (attendee.status !== 'Approved') {
      return res.status(400).json({ error: `Registration status: ${attendee.status}. Access Denied.` });
    }

    if (attendee.checkedIn) {
      return res.status(400).json({ 
        error: 'Already checked in', 
        attendee: {
          fullName: attendee.fullName,
          checkInTime: attendee.checkInTime,
          linkLabel: attendee.linkLabel
        }
      });
    }

    // 2. Perform Check-in
    await db.run(
      'UPDATE attendees SET checkedIn = 1, checkInTime = ? WHERE id = ?',
      [new Date().toISOString(), attendeeId]
    );

    res.json({ 
      message: 'Check-in successful', 
      attendee: {
        fullName: attendee.fullName,
        company: attendee.company,
        designation: attendee.designation,
        linkLabel: attendee.linkLabel,
        eventName: attendee.eventName
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Seed Initial Admin (For testing/first run)
app.post('/api/auth/seed', async (req, res) => {
  try {
    const db = getDb();
    const orgId = uuidv4();
    const userId = uuidv4();
    const passwordHash = await bcrypt.hash('admin123', 10);

    await db.run('INSERT INTO organizers (id, name) VALUES (?, ?)', [orgId, 'Default Organization']);
    await db.run(
      'INSERT INTO users (id, organizerId, fullName, email, passwordHash, role) VALUES (?, ?, ?, ?, ?, ?)',
      [userId, orgId, 'Admin User', 'admin@example.com', passwordHash, 'Admin']
    );

    res.json({ message: 'Seeding successful', email: 'admin@example.com', password: 'admin123' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Export app for testing
export { app };

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, async () => {
    await initDb();
    console.log(`Server running on http://localhost:${PORT}`);
  });
}