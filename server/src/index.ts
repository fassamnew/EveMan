import express, { type NextFunction, type Request, type Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { initDb } from './db';
import { v4 as uuidv4 } from 'uuid';
import QRCode from 'qrcode';
import path from 'path';
import fs from 'fs';
import { generateBadge } from './badgeGenerator';
import { sendBadgeEmail, sendBulkReminder } from './emailService';
import multer from 'multer';
import { parse } from 'csv-parse';
import { logErrorWithContext, logInfo, logWarn, requestLogger } from './logger';
import { authenticate, authorize, loginWithPassword, revokeRefreshToken, rotateRefreshToken } from './auth';

dotenv.config();

export const app = express();
const PORT = process.env.PORT || 5001;
const RATE_LIMIT_WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000);
const RATE_LIMIT_MAX = Number(process.env.RATE_LIMIT_MAX || 300);
const MAX_CSV_FILE_SIZE_BYTES = Number(process.env.MAX_CSV_FILE_SIZE_BYTES || 2 * 1024 * 1024);
const LOGIN_RATE_LIMIT_WINDOW_MS = Number(process.env.LOGIN_RATE_LIMIT_WINDOW_MS || 10 * 60 * 1000);
const LOGIN_RATE_LIMIT_MAX = Number(process.env.LOGIN_RATE_LIMIT_MAX || 10);
const JWT_SECRET = process.env.JWT_SECRET;

const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);

if (allowedOrigins.length === 0) {
  logWarn('ALLOWED_ORIGINS is not configured; CORS is currently open to all origins');
}

if (!JWT_SECRET || JWT_SECRET.length < 32) {
  logWarn('JWT_SECRET is missing or too short; use a strong secret with at least 32 characters');
}

const globalRateLimiter = rateLimit({
  windowMs: RATE_LIMIT_WINDOW_MS,
  max: RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' }
});

const loginRateLimiter = rateLimit({
  windowMs: LOGIN_RATE_LIMIT_WINDOW_MS,
  max: LOGIN_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts, please try again later.' }
});

app.use(helmet());
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) {
      callback(null, true);
      return;
    }

    if (allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error('Not allowed by CORS'));
  }
}));
app.use(express.json());
app.use(requestLogger);
app.use('/api', globalRateLimiter);

function validateRegistrationPayload(req: Request, res: Response, next: NextFunction): void {
  const { fullName, designation, company, email, phone, category } = req.body;
  const errors: string[] = [];

  if (typeof fullName !== 'string' || fullName.trim().length < 2 || fullName.trim().length > 120) {
    errors.push('fullName must be 2-120 characters');
  }

  if (designation && (typeof designation !== 'string' || designation.length > 120)) {
    errors.push('designation must be <= 120 characters');
  }

  if (company && (typeof company !== 'string' || company.length > 120)) {
    errors.push('company must be <= 120 characters');
  }

  if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.push('email must be valid');
  }

  if (phone && (typeof phone !== 'string' || phone.length > 30)) {
    errors.push('phone must be <= 30 characters');
  }

  if (category !== 'Delegate' && category !== 'Media') {
    errors.push("category must be either 'Delegate' or 'Media'");
  }

  if (errors.length > 0) {
    res.status(400).json({ error: 'Validation failed', details: errors });
    return;
  }

  req.body = {
    fullName: fullName.trim(),
    designation: typeof designation === 'string' ? designation.trim() : '',
    company: typeof company === 'string' ? company.trim() : '',
    email: email.trim().toLowerCase(),
    phone: typeof phone === 'string' ? phone.trim() : '',
    category
  };

  next();
}

function validateBulkEmailPayload(req: Request, res: Response, next: NextFunction): void {
  const { subject, message } = req.body;

  if (typeof subject !== 'string' || subject.trim().length < 3 || subject.trim().length > 160) {
    res.status(400).json({ error: 'subject must be 3-160 characters' });
    return;
  }

  if (typeof message !== 'string' || message.trim().length < 3 || message.trim().length > 5000) {
    res.status(400).json({ error: 'message must be 3-5000 characters' });
    return;
  }

  req.body = {
    subject: subject.trim(),
    message: message.trim()
  };

  next();
}

// Setup Multer for file uploads
const upload = multer({
  dest: 'uploads/temp/',
  limits: {
    fileSize: MAX_CSV_FILE_SIZE_BYTES
  },
  fileFilter: (_req, file, callback) => {
    const isCsvMimeType = file.mimetype === 'text/csv' || file.mimetype === 'application/vnd.ms-excel';
    const isCsvFileName = file.originalname.toLowerCase().endsWith('.csv');

    if (!isCsvMimeType && !isCsvFileName) {
      callback(new Error('Only CSV files are allowed'));
      return;
    }

    callback(null, true);
  }
});

// Ensure directories exist
const uploadsDir = path.join(__dirname, '../uploads');
const qrcodesDir = path.join(uploadsDir, 'qrcodes');
const tempDir = path.join(uploadsDir, 'temp');
[uploadsDir, qrcodesDir, tempDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.post('/api/auth/login', loginRateLimiter, async (req, res) => {
  try {
    const { username, email, password } = req.body || {};
    const identity = typeof username === 'string' ? username : email;

    if (typeof identity !== 'string' || identity.trim().length < 3 || typeof password !== 'string' || password.length < 8) {
      res.status(400).json({ error: 'Valid identity and password are required' });
      return;
    }

    const result = await loginWithPassword(identity, password, req.ip, req.get('user-agent') || undefined);
    if (!result) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    res.json(result);
  } catch (error) {
    logErrorWithContext(error, 'Auth login endpoint failed');
    res.status(500).json({ error: 'Authentication failed' });
  }
});

app.post('/api/auth/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body || {};
    if (typeof refreshToken !== 'string' || refreshToken.length < 20) {
      res.status(400).json({ error: 'refreshToken is required' });
      return;
    }

    const result = await rotateRefreshToken(refreshToken, req.ip, req.get('user-agent') || undefined);
    if (!result) {
      res.status(401).json({ error: 'Invalid refresh token' });
      return;
    }

    res.json(result);
  } catch (error) {
    logErrorWithContext(error, 'Auth refresh endpoint failed');
    res.status(500).json({ error: 'Token refresh failed' });
  }
});

app.post('/api/auth/logout', authenticate, async (req, res) => {
  try {
    const { refreshToken } = req.body || {};
    if (typeof refreshToken !== 'string' || refreshToken.length < 20) {
      res.status(400).json({ error: 'refreshToken is required' });
      return;
    }

    await revokeRefreshToken(refreshToken);
    res.json({ message: 'Logged out' });
  } catch (error) {
    logErrorWithContext(error, 'Auth logout endpoint failed');
    res.status(500).json({ error: 'Logout failed' });
  }
});

// Registration endpoint
app.post('/api/register', validateRegistrationPayload, async (req, res) => {
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
      logErrorWithContext(emailError, 'Email delivery failed during registration');
      // We don't fail the registration if email fails, but log it
    }

    res.status(201).json({ 
      message: 'Registration successful', 
      attendeeId,
      category 
    });
  } catch (error: any) {
    logErrorWithContext(error, 'Registration endpoint failed');
    res.status(500).json({ error: error.message });
  }
});

// Bulk Reminder endpoint
app.post('/api/bulk-email', authenticate, authorize(['admin']), validateBulkEmailPayload, async (req, res) => {
  try {
    const { subject, message } = req.body;
    const db = await initDb();
    const attendees = await db.all('SELECT email, fullName FROM attendees');

    const results = await sendBulkReminder(attendees, subject, message);
    res.json({ message: 'Bulk email process completed', results });
  } catch (error: any) {
    logErrorWithContext(error, 'Bulk email endpoint failed');
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
    logErrorWithContext(error, 'Verify endpoint failed');
    res.status(500).json({ error: error.message });
  }
});

// CSV Import endpoint
app.post('/api/import-csv', authenticate, authorize(['admin']), upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const results: any[] = [];
  const db = await initDb();

  fs.createReadStream(req.file.path)
    .pipe(parse({ columns: true, skip_empty_lines: true }))
    .on('data', (data) => results.push(data))
    .on('error', parseError => {
      logErrorWithContext(parseError, 'CSV parsing failed');
      try {
        fs.unlinkSync(req.file!.path);
      } catch (cleanupError) {
        logErrorWithContext(cleanupError, 'Failed to clean up temp CSV after parse error');
      }

      if (!res.headersSent) {
        res.status(400).json({ error: 'Invalid CSV format' });
      }
    })
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
          logErrorWithContext(err, 'CSV import row processing failed');
          errorCount++;
        }
      }

      fs.unlinkSync(req.file!.path); // Clean up temp file
      res.json({ message: 'Import completed', successCount, errorCount });
    });
});

app.use((error: Error, _req: Request, res: Response, _next: NextFunction) => {
  logErrorWithContext(error, 'Unhandled application error');
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, async () => {
  try {
    await initDb();
    logInfo('Server started', { port: PORT });
  } catch (error) {
    logErrorWithContext(error, 'Server startup failed');
    process.exit(1);
  }
});

process.on('unhandledRejection', reason => {
  logErrorWithContext(reason, 'Unhandled promise rejection');
});

process.on('uncaughtException', error => {
  logErrorWithContext(error, 'Uncaught exception');
  process.exit(1);
});