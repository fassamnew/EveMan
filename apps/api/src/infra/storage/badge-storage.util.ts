import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { createHmac } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const LOCAL_PREFIX = 'local://';
const S3_PREFIX = 's3://';

type S3Config = {
  endpoint?: string;
  region: string;
  bucket: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  forcePathStyle: boolean;
};

function getLocalRoot(): string {
  return process.env.BADGE_STORAGE_ROOT || join(process.cwd(), 'tmp', 'badges');
}

function getApiBaseUrl(): string {
  return process.env.API_PUBLIC_BASE_URL || `http://localhost:${process.env.API_PORT || 5001}`;
}

function getLocalSigningSecret(): string {
  return process.env.BADGE_LOCAL_SIGNING_SECRET || process.env.JWT_ACCESS_SECRET || 'dev-badge-local-secret';
}

function getS3Config(): S3Config | null {
  const bucket = process.env.S3_BUCKET;
  if (!bucket) {
    return null;
  }

  return {
    endpoint: process.env.S3_ENDPOINT,
    region: process.env.S3_REGION || 'us-east-1',
    bucket,
    accessKeyId: process.env.S3_ACCESS_KEY,
    secretAccessKey: process.env.S3_SECRET_KEY,
    forcePathStyle: String(process.env.S3_FORCE_PATH_STYLE || 'true') === 'true'
  };
}

function createS3Client(config: S3Config): S3Client {
  return new S3Client({
    endpoint: config.endpoint,
    region: config.region,
    forcePathStyle: config.forcePathStyle,
    credentials:
      config.accessKeyId && config.secretAccessKey
        ? {
            accessKeyId: config.accessKeyId,
            secretAccessKey: config.secretAccessKey
          }
        : undefined
  });
}

function signLocalPath(storagePath: string, expiresAt: number): string {
  return createHmac('sha256', getLocalSigningSecret())
    .update(`${storagePath}:${expiresAt}`)
    .digest('hex');
}

export async function putBadgeArtifact(input: {
  badgeId: string;
  eventId: string;
  body: string;
}): Promise<string> {
  const key = `badges/${input.eventId}/${input.badgeId}.txt`;
  const s3 = getS3Config();

  if (s3) {
    const client = createS3Client(s3);
    await client.send(
      new PutObjectCommand({
        Bucket: s3.bucket,
        Key: key,
        Body: input.body,
        ContentType: 'text/plain; charset=utf-8'
      })
    );

    return `${S3_PREFIX}${s3.bucket}/${key}`;
  }

  const root = getLocalRoot();
  const fullPath = join(root, key);
  await mkdir(join(root, `badges/${input.eventId}`), { recursive: true });
  await writeFile(fullPath, input.body, 'utf8');

  return `${LOCAL_PREFIX}${key}`;
}

export async function createBadgeSignedDownloadUrl(input: {
  storagePath: string;
  expiresInSeconds: number;
}): Promise<string> {
  if (input.storagePath.startsWith(S3_PREFIX)) {
    const s3 = getS3Config();
    if (!s3) {
      throw new Error('S3 not configured for s3 storage path');
    }

    const withoutPrefix = input.storagePath.slice(S3_PREFIX.length);
    const slash = withoutPrefix.indexOf('/');
    const bucket = slash > -1 ? withoutPrefix.slice(0, slash) : s3.bucket;
    const key = slash > -1 ? withoutPrefix.slice(slash + 1) : '';

    const client = createS3Client(s3);
    return getSignedUrl(
      client,
      new GetObjectCommand({
        Bucket: bucket,
        Key: key
      }),
      {
        expiresIn: input.expiresInSeconds
      }
    );
  }

  if (!input.storagePath.startsWith(LOCAL_PREFIX)) {
    throw new Error('Unsupported storage path format');
  }

  const normalized = input.storagePath.slice(LOCAL_PREFIX.length);
  const expiresAt = Date.now() + input.expiresInSeconds * 1000;
  const sig = signLocalPath(normalized, expiresAt);
  const url = new URL('/public/badges/download', getApiBaseUrl());
  url.searchParams.set('path', normalized);
  url.searchParams.set('expires', String(expiresAt));
  url.searchParams.set('sig', sig);
  return url.toString();
}

export function isValidLocalBadgeSignature(input: {
  storagePath: string;
  expiresAtMs: number;
  signature: string;
}): boolean {
  if (Date.now() > input.expiresAtMs) {
    return false;
  }

  const expected = signLocalPath(input.storagePath, input.expiresAtMs);
  return expected === input.signature;
}

export async function readLocalBadgeArtifact(storagePath: string): Promise<string> {
  const fullPath = join(getLocalRoot(), storagePath);
  const content = await readFile(fullPath, 'utf8');
  return content;
}
