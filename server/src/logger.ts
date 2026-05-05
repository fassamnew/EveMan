import type { NextFunction, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';

type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

const logPriority: Record<LogLevel, number> = {
  DEBUG: 10,
  INFO: 20,
  WARN: 30,
  ERROR: 40
};

const configuredLevel = (process.env.LOG_LEVEL || 'INFO').toUpperCase() as LogLevel;
const activeLevel: LogLevel = logPriority[configuredLevel] ? configuredLevel : 'INFO';

const logsDir = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

const logFilePath = path.join(logsDir, 'server.log');
const logStream = fs.createWriteStream(logFilePath, { flags: 'a' });

function shouldLog(level: LogLevel): boolean {
  return logPriority[level] >= logPriority[activeLevel];
}

function safeSerialize(metadata?: unknown): string {
  if (metadata === undefined) {
    return '';
  }

  try {
    return ` ${JSON.stringify(metadata)}`;
  } catch {
    return ' [unserializable-metadata]';
  }
}

function writeLog(level: LogLevel, message: string, metadata?: unknown): void {
  if (!shouldLog(level)) {
    return;
  }

  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] [${level}] ${message}${safeSerialize(metadata)}`;

  if (level === 'ERROR') {
    console.error(line);
  } else if (level === 'WARN') {
    console.warn(line);
  } else {
    console.log(line);
  }

  logStream.write(`${line}\n`);
}

export function logDebug(message: string, metadata?: unknown): void {
  writeLog('DEBUG', message, metadata);
}

export function logInfo(message: string, metadata?: unknown): void {
  writeLog('INFO', message, metadata);
}

export function logWarn(message: string, metadata?: unknown): void {
  writeLog('WARN', message, metadata);
}

export function logError(message: string, metadata?: unknown): void {
  writeLog('ERROR', message, metadata);
}

export function logErrorWithContext(error: unknown, context: string): void {
  if (error instanceof Error) {
    logError(context, { name: error.name, message: error.message, stack: error.stack });
    return;
  }

  logError(context, { error });
}

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = process.hrtime.bigint();

  logDebug('Incoming request', {
    method: req.method,
    path: req.originalUrl,
    ip: req.ip
  });

  res.on('finish', () => {
    const elapsedNs = process.hrtime.bigint() - start;
    const durationMs = Number(elapsedNs) / 1_000_000;

    const summary = {
      method: req.method,
      path: req.originalUrl,
      statusCode: res.statusCode,
      durationMs: Number(durationMs.toFixed(2))
    };

    if (res.statusCode >= 400) {
      logWarn('Request completed with error status', summary);
    } else {
      logInfo('Request completed', summary);
    }
  });

  next();
}