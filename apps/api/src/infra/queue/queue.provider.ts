import { Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';
import { PrismaClient } from '@prisma/client';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

let redisConnection: IORedis | null = null;
let systemQueue: Queue | null = null;
let systemWorker: Worker | null = null;
let workerPrisma: PrismaClient | null = null;

function getWorkerPrisma(): PrismaClient {
  if (workerPrisma) {
    return workerPrisma;
  }

  workerPrisma = new PrismaClient();
  return workerPrisma;
}

async function renderBadgeArtifact(input: {
  badgeId: string;
  fullName: string;
  email: string;
  eventName: string;
  templateName: string;
  qrCodeId: string | null;
}): Promise<string> {
  const root = process.env.BADGE_STORAGE_ROOT || join(process.cwd(), 'tmp', 'badges');
  await mkdir(root, { recursive: true });

  const filePath = join(root, `${input.badgeId}.txt`);
  const content = [
    'EveMange Badge',
    `Badge ID: ${input.badgeId}`,
    `Template: ${input.templateName}`,
    `Name: ${input.fullName}`,
    `Email: ${input.email}`,
    `Event: ${input.eventName}`,
    `QR Code ID: ${input.qrCodeId || 'N/A'}`
  ].join('\n');

  await writeFile(filePath, content, 'utf8');
  return filePath;
}

function getRedisConnection(): IORedis {
  if (redisConnection) {
    return redisConnection;
  }

  redisConnection = new IORedis({
    host: process.env.REDIS_HOST || 'localhost',
    port: Number(process.env.REDIS_PORT || 6379),
    maxRetriesPerRequest: null
  });

  return redisConnection;
}

export function getSystemQueue(): Queue {
  if (systemQueue) {
    return systemQueue;
  }

  systemQueue = new Queue('system', {
    connection: getRedisConnection()
  });

  return systemQueue;
}

export function startSystemWorker(): Worker {
  if (systemWorker) {
    return systemWorker;
  }

  systemWorker = new Worker(
    'system',
    async job => {
      if (job.name === 'registration.confirmation-email') {
        const payload = job.data as {
          registrantId: string;
          referenceCode: string;
          email: string;
          fullName: string;
          eventName: string;
          linkTitle: string;
        };

        // Phase 3 worker baseline: in Phase 5 this is replaced with real email delivery.
        console.log(
          `confirmation-email queued for ${payload.email} (${payload.referenceCode}) on ${payload.eventName}`
        );
        return;
      }

      if (job.name === 'badge.render') {
        const payload = job.data as { badgeId: string };
        const prisma = getWorkerPrisma();

        const badge = await prisma.badge.findUnique({
          where: { id: payload.badgeId },
          include: {
            registrant: {
              select: {
                fullName: true,
                email: true
              }
            },
            event: {
              select: {
                name: true
              }
            },
            badgeTemplate: {
              select: {
                name: true
              }
            }
          }
        });

        if (!badge) {
          throw new Error('Badge not found');
        }

        await prisma.badge.update({
          where: { id: badge.id },
          data: {
            status: 'RENDERING',
            failureReason: null
          }
        });

        try {
          const storagePath = await renderBadgeArtifact({
            badgeId: badge.id,
            fullName: badge.registrant.fullName,
            email: badge.registrant.email,
            eventName: badge.event.name,
            templateName: badge.badgeTemplate?.name || 'default',
            qrCodeId: badge.qrCodeId
          });

          await prisma.badge.update({
            where: { id: badge.id },
            data: {
              status: 'READY',
              storagePath,
              renderedAt: new Date(),
              deliveredAt: new Date(),
              failureReason: null
            }
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unknown render failure';
          await prisma.badge.update({
            where: { id: badge.id },
            data: {
              status: 'FAILED',
              failureReason: message
            }
          });
          throw error;
        }
      }
    },
    {
      connection: getRedisConnection()
    }
  );

  return systemWorker;
}

export async function closeQueueResources(): Promise<void> {
  if (systemWorker) {
    await systemWorker.close();
    systemWorker = null;
  }

  if (systemQueue) {
    await systemQueue.close();
    systemQueue = null;
  }

  if (redisConnection) {
    await redisConnection.quit();
    redisConnection = null;
  }

  if (workerPrisma) {
    await workerPrisma.$disconnect();
    workerPrisma = null;
  }
}
