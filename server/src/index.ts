import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { initDb } from './db';
import { v4 as uuidv4 } from 'uuid';
import QRCode from 'qrcode';
import path from 'path';
import fs from 'fs';
import { generateBadge } from './badgeGenerator';
import { sendBadgeEmail, sendBulkReminder } from './emailService';
import multer from 'multer';
import { parse } from 'csv-parse';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;

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

// Registration endpoint
app.post('/api/register', async (req, res) => {
  try {
    const { fullName, designation, company, email, phone, category } = req.body;
    const db = await initDb();

    const attendeeId = uuidv4();
    const qrCodePath = `uploads/qrcodes/${attendeeId}.png`;
    const fullQrPath = path.join(__dirname, '..', qrCodePath);

    // Generate QR Code
    await QRCode.toFile(fullQrPath, attendeeId);

    // Generate Badge
    const badgePath = await generateBadge({
      fullName,
      designation,
      company,
      category,
      qrCodePath
    });

    await db.run(
      `INSERT INTO attendees (id, fullName, designation, company, email, phone, category, qrCodePath, badgePath) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [attendeeId, fullName, designation, company, email, phone, category, qrCodePath, badgePath]
    );

    // Send Confirmation Email with Badge
    try {
      await sendBadgeEmail({
        to: email,
        subject: 'Your NH Event 2026 Registration Badge',
        fullName,
        badgePath
      });
    } catch (emailError) {
      console.error('Email delivery failed:', emailError);
      // We don't fail the registration if email fails, but log it
    }

    res.status(201).json({ 
      message: 'Registration successful', 
      attendeeId,
      category,
      badgeUrl: `http://localhost:${PORT}/uploads/badges/${path.basename(badgePath)}`
    });
  } catch (error: any) {
    console.error(error);
    if (error.code === 'SQLITE_CONSTRAINT') {
      return res.status(400).json({ error: 'This email is already registered.' });
    }
    res.status(500).json({ error: 'An unexpected error occurred. Please try again later.' });
  }
});

// Bulk Reminder endpoint
app.post('/api/bulk-email', async (req, res) => {
  try {
    const { subject, message } = req.body;
    const db = await initDb();
    const attendees = await db.all('SELECT email, fullName FROM attendees');

    const results = await sendBulkReminder(attendees, subject, message);
    res.json({ message: 'Bulk email process completed', results });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Verify & Check-in endpoint
app.post('/api/verify/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const db = await initDb();
    
    const attendee = await db.get('SELECT * FROM attendees WHERE id = ?', [id]);
    
    if (!attendee) {
      return res.status(404).json({ error: 'Attendee not found' });
    }

    if (attendee.checkedIn) {
      return res.status(400).json({ error: 'Already checked in', attendee });
    }

    await db.run(
      'UPDATE attendees SET checkedIn = 1, checkInTime = ? WHERE id = ?',
      [new Date().toISOString(), id]
    );

    res.json({ message: 'Check-in successful', ...attendee });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// CSV Import endpoint
app.post('/api/import-csv', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const results: any[] = [];
  const db = await initDb();

  fs.createReadStream(req.file.path)
    .pipe(parse({ columns: true, skip_empty_lines: true }))
    .on('data', (data) => results.push(data))
    .on('end', async () => {
      let successCount = 0;
      let errorCount = 0;

      for (const row of results) {
        try {
          const { fullName, designation, company, email, phone, category } = row;
          const attendeeId = uuidv4();
          const qrCodePath = `uploads/qrcodes/${attendeeId}.png`;
          const fullQrPath = path.join(__dirname, '..', qrCodePath);

          await QRCode.toFile(fullQrPath, attendeeId);
          const badgePath = await generateBadge({ fullName, designation, company, category, qrCodePath });

          await db.run(
            `INSERT INTO attendees (id, fullName, designation, company, email, phone, category, qrCodePath, badgePath) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [attendeeId, fullName, designation, company, email, phone, category, qrCodePath, badgePath]
          );
          successCount++;
        } catch (err) {
          console.error('Import row error:', err);
          errorCount++;
        }
      }

      fs.unlinkSync(req.file!.path); // Clean up temp file
      res.json({ message: 'Import completed', successCount, errorCount });
    });
});

// Stats endpoint for Dashboard
app.get('/api/stats', async (req, res) => {
  try {
    const db = await initDb();
    const stats = await db.all(`
      SELECT 
        category, 
        COUNT(*) as total,
        SUM(CASE WHEN checkedIn = 1 THEN 1 ELSE 0 END) as checkedIn
      FROM attendees 
      GROUP BY category
    `);
    res.json(stats);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, async () => {
  await initDb();
  console.log(`Server running on port ${PORT}`);
});