import { Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';
import { PrismaClient } from '@prisma/client';
import type { Prisma } from '@prisma/client';
import { createBadgeSignedDownloadUrl, putBadgeArtifact } from '../storage/badge-storage.util';
import {
  getBadgeRenderAlertThreshold,
  getBadgeRenderMetricsSnapshot,
  recordBadgeRenderAlert,
  recordBadgeRenderFailure,
  recordBadgeRenderStart,
  recordBadgeRenderSuccess
} from './badge-render.metrics';

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
  eventId: string;
  fullName: string;
  email: string;
  eventName: string;
  templateName: string;
  qrCodeId: string | null;
}): Promise<string> {
  const content = [
    'EveMange Badge',
    `Badge ID: ${input.badgeId}`,
    `Template: ${input.templateName}`,
    `Name: ${input.fullName}`,
    `Email: ${input.email}`,
    `Event: ${input.eventName}`,
    `QR Code ID: ${input.qrCodeId || 'N/A'}`
  ].join('\n');

  return putBadgeArtifact({
    badgeId: input.badgeId,
    eventId: input.eventId,
    body: content
  });
}

async function sendBadgeRenderAlert(input: {
  badgeId: string;
  reason: string;
  attemptsMade: number;
  attemptsAllowed: number;
  consecutiveFailures: number;
}): Promise<void> {
  const event = recordBadgeRenderAlert(input);
  const message =
    `badge-render alert: badge=${event.badgeId} attempts=${event.attemptsMade}/${event.attemptsAllowed}` +
    ` consecutiveFailures=${event.consecutiveFailures} reason=${event.reason}`;

  console.error(message);

  const webhook = process.env.BADGE_RENDER_ALERT_WEBHOOK_URL;
  if (!webhook) {
    return;
  }

  try {
    await fetch(webhook, {
      method: 'POST',
      headers: {
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        source: 'evemange.badge-render',
        severity: 'error',
        ...event
      })
    });
  } catch (error) {
    const webhookError = error instanceof Error ? error.message : 'Unknown webhook error';
    console.error(`badge-render alert webhook failed: ${webhookError}`);
  }
}

function getDeliveryLinkTtlSeconds(): number {
  const value = Number(process.env.BADGE_DELIVERY_LINK_TTL_SECONDS || 86400);
  if (!Number.isFinite(value) || value < 300 || value > 604800) {
    return 86400;
  }

  return Math.floor(value);
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

async function nextReferenceCode(prisma: PrismaClient): Promise<string> {
  for (let i = 0; i < 8; i += 1) {
    const value = Math.random().toString(36).slice(2, 10).toUpperCase();
    const existing = await prisma.registrant.findUnique({ where: { referenceCode: value } });
    if (!existing) {
      return value;
    }
  }

  throw new Error('Unable to generate unique reference code');
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

      if (job.name === 'import.process') {
        const payload = job.data as {
          importJobId: string;
          organizationId: string;
          eventId: string;
          registrationLinkId: string;
          rows: Array<{ data: Record<string, unknown> }>;
        };

        const prisma = getWorkerPrisma();
        const importJob = await prisma.importJob.findUnique({
          where: { id: payload.importJobId }
        });

        if (!importJob) {
          throw new Error('Import job not found');
        }

        const mapping = (importJob.mappingProfileJson || {}) as {
          fullName?: string;
          email?: string;
        };

        if (!mapping.fullName || !mapping.email) {
          throw new Error('Invalid mapping profile');
        }

        await prisma.importJob.update({
          where: { id: importJob.id },
          data: {
            status: 'PROCESSING',
            startedAt: new Date()
          }
        });

        let successfulRows = 0;
        let failedRows = 0;

        for (let i = 0; i < payload.rows.length; i += 1) {
          const row = payload.rows[i];
          const rowNumber = i + 1;
          const fullName = String(row.data[mapping.fullName] || '').trim();
          const email = String(row.data[mapping.email] || '')
            .trim()
            .toLowerCase();

          if (!fullName || !email || !email.includes('@')) {
            failedRows += 1;
            await prisma.importError.create({
              data: {
                importJobId: importJob.id,
                rowNumber,
                message: 'Missing or invalid fullName/email mapped values',
                rawDataJson: row.data as Prisma.InputJsonValue
              }
            });
            continue;
          }

          const existing = await prisma.registrant.findFirst({
            where: {
              registrationLinkId: payload.registrationLinkId,
              email
            }
          });

          if (existing) {
            if (importJob.duplicateStrategy === 'SKIP') {
              continue;
            }

            if (importJob.duplicateStrategy === 'FLAG') {
              failedRows += 1;
              await prisma.importError.create({
                data: {
                  importJobId: importJob.id,
                  rowNumber,
                  message: 'Duplicate attendee detected',
                  rawDataJson: row.data as Prisma.InputJsonValue
                }
              });
              continue;
            }

            await prisma.registrant.update({
              where: {
                id: existing.id
              },
              data: {
                fullName,
                lifecycleUpdatedAt: new Date()
              }
            });
            successfulRows += 1;
            continue;
          }

          const referenceCode = await nextReferenceCode(prisma);
          await prisma.registrant.create({
            data: {
              organizationId: payload.organizationId,
              eventId: payload.eventId,
              registrationLinkId: payload.registrationLinkId,
              referenceCode,
              email,
              fullName,
              lifecycleStatus: 'APPROVED',
              lifecycleUpdatedAt: new Date(),
              consentAccepted: true,
              consentPolicyVersion: 'import-v1',
              consentCapturedAt: new Date(),
              confirmationSentAt: null,
              ipAddress: null,
              userAgent: null
            }
          });
          successfulRows += 1;
        }

        await prisma.importJob.update({
          where: { id: importJob.id },
          data: {
            status: failedRows > 0 ? 'FAILED' : 'COMPLETED',
            totalRows: payload.rows.length,
            successfulRows,
            failedRows,
            completedAt: new Date()
          }
        });

        return;
      }

      if (job.name === 'communication.send') {
        const payload = job.data as { communicationLogId: string };
        const prisma = getWorkerPrisma();

        const communication = await prisma.communicationLog.findUnique({
          where: {
            id: payload.communicationLogId
          },
          include: {
            template: true
          }
        });

        if (!communication) {
          throw new Error('Communication log not found');
        }

        const shouldFail = communication.recipientAddress.includes('fail');

        if (shouldFail) {
          await prisma.communicationLog.update({
            where: {
              id: communication.id
            },
            data: {
              status: 'FAILED',
              errorMessage: 'Simulated provider failure'
            }
          });
          throw new Error('Simulated provider failure');
        }

        await prisma.communicationLog.update({
          where: {
            id: communication.id
          },
          data: {
            status: 'SENT',
            sentAt: new Date(),
            providerMessageId: `msg_${communication.id.slice(0, 8)}`,
            errorMessage: null
          }
        });

        console.log(`communication sent to ${communication.recipientAddress}`);
        return;
      }

      if (job.name === 'badge.render.dead-letter') {
        const payload = job.data as {
          badgeId: string;
          organizationId: string;
          reason: string;
          attemptsMade: number;
          attemptsAllowed: number;
        };

        const prisma = getWorkerPrisma();
        await prisma.auditLog.create({
          data: {
            actorUserId: null,
            organizationId: payload.organizationId,
            action: 'BADGE_RENDER_DEAD_LETTER',
            targetType: 'BADGE',
            targetId: payload.badgeId,
            outcome: 'FAILURE',
            ipAddress: null,
            metadataJson: {
              reason: payload.reason,
              attemptsMade: payload.attemptsMade,
              attemptsAllowed: payload.attemptsAllowed
            }
          }
        });

        console.error(
          `badge-render dead-letter: badge=${payload.badgeId} attempts=${payload.attemptsMade}/${payload.attemptsAllowed} reason=${payload.reason}`
        );
        return;
      }

      if (job.name === 'badge.delivery-link-email') {
        const payload = job.data as { badgeId: string };
        const prisma = getWorkerPrisma();

        const badge = await prisma.badge.findUnique({
          where: { id: payload.badgeId },
          include: {
            registrant: {
              select: {
                email: true,
                fullName: true
              }
            },
            event: {
              select: {
                name: true
              }
            }
          }
        });

        if (!badge || badge.status !== 'READY' || !badge.storagePath) {
          throw new Error('Badge not ready for delivery link');
        }

        const expiresInSeconds = getDeliveryLinkTtlSeconds();
        const downloadUrl = await createBadgeSignedDownloadUrl({
          storagePath: badge.storagePath,
          expiresInSeconds
        });

        console.log(
          `badge-delivery-link queued for ${badge.registrant.email} (${badge.registrant.fullName}) on ${badge.event.name}: ${downloadUrl}`
        );

        await prisma.badge.update({
          where: { id: badge.id },
          data: {
            deliveredAt: new Date()
          }
        });

        await prisma.auditLog.create({
          data: {
            actorUserId: null,
            organizationId: badge.organizationId,
            action: 'BADGE_DELIVERY_LINK_CREATE',
            targetType: 'BADGE',
            targetId: badge.id,
            outcome: 'SUCCESS',
            ipAddress: null,
            metadataJson: {
              expiresInSeconds
            }
          }
        });

        return;
      }

      if (job.name === 'badge.render') {
        const startedAtMs = Date.now();
        recordBadgeRenderStart({ attemptsMade: job.attemptsMade });

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
            eventId: badge.eventId,
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
              deliveredAt: null,
              failureReason: null
            }
          });

          const queue = getSystemQueue();
          await queue.add(
            'badge.delivery-link-email',
            { badgeId: badge.id },
            {
              attempts: 3,
              backoff: {
                type: 'exponential',
                delay: 1000
              },
              removeOnComplete: 100,
              removeOnFail: 100
            }
          );

          recordBadgeRenderSuccess({
            durationMs: Date.now() - startedAtMs
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

          recordBadgeRenderFailure({
            durationMs: Date.now() - startedAtMs,
            reason: message
          });

          const attemptsAllowed =
            typeof job.opts.attempts === 'number' && Number.isFinite(job.opts.attempts)
              ? Math.max(1, Math.floor(job.opts.attempts))
              : 1;
          const attemptsMade = job.attemptsMade + 1;
          const isFinalFailure = attemptsMade >= attemptsAllowed;
          const snapshot = getBadgeRenderMetricsSnapshot();
          const failureThresholdReached =
            getBadgeRenderAlertThreshold() <= snapshot.consecutiveFailures;

          if (isFinalFailure || failureThresholdReached) {
            await sendBadgeRenderAlert({
              badgeId: badge.id,
              reason: message,
              attemptsMade,
              attemptsAllowed,
              consecutiveFailures: snapshot.consecutiveFailures
            });
          }

          if (isFinalFailure) {
            const queue = getSystemQueue();
            await queue.add(
              'badge.render.dead-letter',
              {
                badgeId: badge.id,
                organizationId: badge.organizationId,
                reason: message,
                attemptsMade,
                attemptsAllowed
              },
              {
                removeOnComplete: 100,
                removeOnFail: 100
              }
            );
          }

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
