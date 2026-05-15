import { Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';
import { createHash, createHmac } from 'node:crypto';
import { CommunicationChannel, CommunicationDeliveryStatus, PrismaClient } from '@prisma/client';
import type { Prisma } from '@prisma/client';
import jwt from 'jsonwebtoken';
import { createBadgeSignedDownloadUrl, putBadgeArtifact } from '../storage/badge-storage.util';
import { putReportArtifact } from '../storage/report-storage.util';
import { TEMPLATE_TYPE_KEY_PREFIX } from '../../modules/communications/communication-message-types';
import {
  decodeWebhookConfig,
  webhookKeyPrefix,
  type WebhookEventType
} from '../webhooks/webhook-config';
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

type WorkerQrPayload = {
  v: 1;
  jti: string;
  r: string;
  e: string;
  o: string;
  l: string;
  iat: number;
  exp: number;
};

function getWorkerPrisma(): PrismaClient {
  if (workerPrisma) {
    return workerPrisma;
  }

  workerPrisma = new PrismaClient();
  return workerPrisma;
}

function getWorkerQrSecret(): string {
  return process.env.QR_SIGNING_SECRET || process.env.JWT_ACCESS_SECRET || 'dev-qr-secret';
}

async function issueBadgeForRegistrantFromWorker(registrantId: string): Promise<void> {
  const prisma = getWorkerPrisma();

  const registrant = await prisma.registrant.findUnique({
    where: { id: registrantId },
    include: {
      registrationLink: {
        select: {
          id: true,
          badgeTemplateId: true
        }
      }
    }
  });

  if (!registrant) {
    throw new Error('Registrant not found while issuing badge');
  }

  const existingBadge = await prisma.badge.findFirst({
    where: {
      registrantId: registrant.id,
      organizationId: registrant.organizationId
    },
    select: {
      id: true
    }
  });

  if (existingBadge) {
    return;
  }

  const qrCode = await prisma.qrCode.create({
    data: {
      registrantId: registrant.id,
      organizationId: registrant.organizationId,
      eventId: registrant.eventId,
      status: 'ACTIVE'
    }
  });

  const nowSeconds = Math.floor(Date.now() / 1000);
  const payload: WorkerQrPayload = {
    v: 1,
    jti: qrCode.id,
    r: registrant.id,
    e: registrant.eventId,
    o: registrant.organizationId,
    l: registrant.registrationLinkId,
    iat: nowSeconds,
    exp: nowSeconds + 60 * 60 * 24 * 30
  };

  const token = jwt.sign(payload, getWorkerQrSecret());
  const tokenHash = createHash('sha256').update(token).digest('hex');

  await prisma.qrCode.update({
    where: { id: qrCode.id },
    data: {
      tokenHash,
      expiresAt: new Date(payload.exp * 1000)
    }
  });

  const badge = await prisma.badge.create({
    data: {
      registrantId: registrant.id,
      organizationId: registrant.organizationId,
      eventId: registrant.eventId,
      registrationLinkId: registrant.registrationLinkId,
      badgeTemplateId: registrant.registrationLink.badgeTemplateId,
      qrCodeId: qrCode.id,
      status: 'PENDING'
    }
  });

  const queue = getSystemQueue();
  await queue.add(
    'badge.render',
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

type CommunicationConfig = {
  emailProvider: string | null;
  smsProvider: string | null;
  whatsappProvider: string | null;
  senderName: string | null;
  senderEmail: string | null;
  emailWebhookUrl: string | null;
  smsWebhookUrl: string | null;
  whatsappWebhookUrl: string | null;
};

type CommunicationWithTemplate = Prisma.CommunicationLogGetPayload<{
  include: {
    template: true;
  };
}>;

async function getCommunicationConfig(prisma: PrismaClient): Promise<CommunicationConfig> {
  const row = await prisma.migrationMetadata.findUnique({
    where: {
      key: 'super-admin:communications-config'
    },
    select: {
      value: true
    }
  });

  let parsed: Record<string, unknown> = {};
  if (row?.value) {
    try {
      parsed = JSON.parse(row.value) as Record<string, unknown>;
    } catch {
      parsed = {};
    }
  }

  return {
    emailProvider: typeof parsed.emailProvider === 'string' ? parsed.emailProvider : null,
    smsProvider: typeof parsed.smsProvider === 'string' ? parsed.smsProvider : null,
    whatsappProvider: typeof parsed.whatsappProvider === 'string' ? parsed.whatsappProvider : null,
    senderName: typeof parsed.senderName === 'string' ? parsed.senderName : null,
    senderEmail: typeof parsed.senderEmail === 'string' ? parsed.senderEmail : null,
    emailWebhookUrl:
      (typeof parsed.emailWebhookUrl === 'string' ? parsed.emailWebhookUrl : null) ||
      process.env.COMM_EMAIL_WEBHOOK_URL ||
      null,
    smsWebhookUrl:
      (typeof parsed.smsWebhookUrl === 'string' ? parsed.smsWebhookUrl : null) ||
      process.env.COMM_SMS_WEBHOOK_URL ||
      null,
    whatsappWebhookUrl:
      (typeof parsed.whatsappWebhookUrl === 'string' ? parsed.whatsappWebhookUrl : null) ||
      process.env.COMM_WHATSAPP_WEBHOOK_URL ||
      null
  };
}

function getDefaultCommunicationBody(input: {
  messageType?: string;
  registrantName?: string;
  eventName?: string;
  referenceCode?: string;
  downloadUrl?: string;
}): string {
  const name = input.registrantName || 'Attendee';
  const eventName = input.eventName || 'your event';
  const reference = input.referenceCode ? ` Reference: ${input.referenceCode}.` : '';

  switch (input.messageType) {
    case 'REGISTRATION_CONFIRMATION':
      return `Hello ${name}, your registration for ${eventName} is confirmed.${reference}`;
    case 'BADGE_DELIVERY':
      return input.downloadUrl
        ? `Hello ${name}, your badge for ${eventName} is ready: ${input.downloadUrl}`
        : `Hello ${name}, your badge for ${eventName} is ready.`;
    case 'APPROVAL_CONFIRMATION':
      return `Hello ${name}, your registration for ${eventName} has been approved.${reference}`;
    case 'REJECTION_MESSAGE':
      return `Hello ${name}, your registration for ${eventName} was not approved.${reference}`;
    case 'REMINDER':
      return `Hello ${name}, this is a reminder for ${eventName}.${reference}`;
    case 'EVENT_UPDATE':
      return `Hello ${name}, there is an important update for ${eventName}.${reference}`;
    case 'VIP_INSTRUCTION':
      return `Hello ${name}, here are your VIP instructions for ${eventName}.${reference}`;
    case 'SPEAKER_INSTRUCTION':
      return `Hello ${name}, here are your speaker instructions for ${eventName}.${reference}`;
    case 'MEDIA_ACCREDITATION_NOTICE':
      return `Hello ${name}, your media accreditation notice for ${eventName}.${reference}`;
    case 'THANK_YOU_MESSAGE':
      return `Hello ${name}, thank you for participating in ${eventName}.`;
    default:
      return `Hello ${name}, this is an update from EveMange for ${eventName}.${reference}`;
  }
}

async function dispatchCommunication(input: {
  communication: CommunicationWithTemplate;
  config: CommunicationConfig;
}): Promise<{ providerMessageId: string }> {
  const metadata =
    input.communication.metadataJson && typeof input.communication.metadataJson === 'object'
      ? (input.communication.metadataJson as Record<string, unknown>)
      : {};

  const messageType = typeof metadata.messageType === 'string' ? metadata.messageType : undefined;
  const eventName = typeof metadata.eventName === 'string' ? metadata.eventName : undefined;
  const registrantName = typeof metadata.fullName === 'string' ? metadata.fullName : undefined;
  const referenceCode = typeof metadata.referenceCode === 'string' ? metadata.referenceCode : undefined;
  const subjectFromMetadata = typeof metadata.subject === 'string' ? metadata.subject : undefined;
  const downloadUrl = typeof metadata.downloadUrl === 'string' ? metadata.downloadUrl : undefined;

  const subject =
    input.communication.template?.subject ||
    subjectFromMetadata ||
    `EveMange update${eventName ? `: ${eventName}` : ''}`;

  const body =
    input.communication.template?.body ||
    getDefaultCommunicationBody({
      messageType,
      registrantName,
      eventName,
      referenceCode,
      downloadUrl
    });

  const webhookUrl =
    input.communication.channel === CommunicationChannel.EMAIL
      ? input.config.emailWebhookUrl
      : input.communication.channel === CommunicationChannel.SMS
        ? input.config.smsWebhookUrl
        : input.config.whatsappWebhookUrl;

  if (!webhookUrl) {
    console.log(
      `communication ${input.communication.channel} fallback to ${input.communication.recipientAddress}: ${subject}`
    );
    return {
      providerMessageId: `local_${input.communication.id.slice(0, 12)}`
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        channel: input.communication.channel,
        to: input.communication.recipientAddress,
        subject,
        text: body,
        senderName: input.config.senderName,
        senderEmail: input.config.senderEmail,
        providerHint:
          input.communication.channel === CommunicationChannel.EMAIL
            ? input.config.emailProvider
            : input.communication.channel === CommunicationChannel.SMS
              ? input.config.smsProvider
              : input.config.whatsappProvider,
        metadata,
        communicationLogId: input.communication.id
      }),
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`Provider returned ${response.status}`);
    }

    const payload = (await response.json().catch(() => null)) as { messageId?: string } | null;
    return {
      providerMessageId: payload?.messageId || `provider_${input.communication.id.slice(0, 12)}`
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function enqueueAutomatedCommunication(input: {
  prisma: PrismaClient;
  organizationId: string;
  registrantId: string;
  recipientAddress: string;
  channel: CommunicationChannel;
  messageType: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const mappingRows = await input.prisma.migrationMetadata.findMany({
    where: {
      key: {
        startsWith: TEMPLATE_TYPE_KEY_PREFIX
      },
      value: input.messageType
    },
    select: {
      key: true
    }
  });

  const templateIds = mappingRows.map(row => row.key.replace(TEMPLATE_TYPE_KEY_PREFIX, ''));
  const template =
    templateIds.length > 0
      ? await input.prisma.communicationTemplate.findFirst({
          where: {
            id: {
              in: templateIds
            },
            organizationId: input.organizationId,
            isActive: true,
            channel: input.channel
          },
          select: {
            id: true
          },
          orderBy: {
            updatedAt: 'desc'
          }
        })
      : null;

  const log = await input.prisma.communicationLog.create({
    data: {
      organizationId: input.organizationId,
      registrantId: input.registrantId,
      templateId: template?.id || null,
      channel: input.channel,
      status: CommunicationDeliveryStatus.QUEUED,
      senderUserId: null,
      recipientAddress: input.recipientAddress,
      metadataJson: {
        messageType: input.messageType,
        ...(input.metadata || {})
      }
    }
  });

  const queue = getSystemQueue();
  await queue.add(
    'communication.send',
    {
      communicationLogId: log.id
    },
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
}

function csvCell(value: string | number): string {
  const normalized = String(value).replace(/"/g, '""');
  return `"${normalized}"`;
}

async function renderAnalyticsReportArtifact(input: {
  reportId: string;
  organizationId: string;
  eventId?: string;
  format: 'csv' | 'json';
  dataset?:
    | 'EVENT_SUMMARY'
    | 'FULL_REGISTRATION_LIST'
    | 'APPROVED_LIST'
    | 'PENDING_LIST'
    | 'CHECKED_IN_LIST'
    | 'NO_SHOW_LIST'
    | 'CATEGORY_REPORT'
    | 'USHER_SCAN_REPORT'
    | 'COMMUNICATION_REPORT';
}): Promise<{ storagePath: string; contentType: string; rowCount: number }> {
  const prisma = getWorkerPrisma();
  const dataset = input.dataset || 'EVENT_SUMMARY';
  const reportRows: Array<Record<string, string | number | null>> = [];

  if (dataset === 'EVENT_SUMMARY') {
    const events = await prisma.event.findMany({
      where: {
        organizationId: input.organizationId,
        id: input.eventId || undefined
      },
      select: {
        id: true,
        name: true,
        startsAt: true,
        _count: {
          select: {
            registrants: true,
            checkins: true,
            qrCodes: true
          }
        }
      },
      orderBy: {
        startsAt: 'asc'
      }
    });

    const eventIds = events.map(event => event.id);
    const communicationSummary = eventIds.length
      ? await prisma.communicationLog.groupBy({
          by: ['status', 'registrantId'],
          where: {
            organizationId: input.organizationId,
            registrant: {
              eventId: {
                in: eventIds
              }
            }
          },
          _count: {
            id: true
          }
        })
      : [];

    const registrants = eventIds.length
      ? await prisma.registrant.findMany({
          where: {
            organizationId: input.organizationId,
            eventId: {
              in: eventIds
            }
          },
          select: {
            id: true,
            eventId: true
          }
        })
      : [];

    const eventByRegistrant = new Map(registrants.map(row => [row.id, row.eventId]));
    const commByEvent = new Map<string, { sent: number; failed: number }>();

    for (const row of communicationSummary) {
      const eventId = row.registrantId ? eventByRegistrant.get(row.registrantId) : undefined;
      if (!eventId) {
        continue;
      }

      const current = commByEvent.get(eventId) || { sent: 0, failed: 0 };
      if (row.status === 'SENT') {
        current.sent += row._count.id;
      }
      if (row.status === 'FAILED') {
        current.failed += row._count.id;
      }
      commByEvent.set(eventId, current);
    }

    for (const event of events) {
      const comm = commByEvent.get(event.id) || { sent: 0, failed: 0 };
      const checkinRate = event._count.registrants
        ? Number(((event._count.checkins / event._count.registrants) * 100).toFixed(2))
        : 0;
      reportRows.push({
        eventId: event.id,
        eventName: event.name,
        startsAt: event.startsAt ? event.startsAt.toISOString() : '',
        registrations: event._count.registrants,
        checkins: event._count.checkins,
        checkinRate,
        qrIssued: event._count.qrCodes,
        communicationsSent: comm.sent,
        communicationsFailed: comm.failed
      });
    }
  }

  if (
    dataset === 'FULL_REGISTRATION_LIST' ||
    dataset === 'APPROVED_LIST' ||
    dataset === 'PENDING_LIST' ||
    dataset === 'CHECKED_IN_LIST' ||
    dataset === 'NO_SHOW_LIST'
  ) {
    const registrantWhere: Prisma.RegistrantWhereInput = {
      organizationId: input.organizationId,
      eventId: input.eventId || undefined
    };

    if (dataset === 'APPROVED_LIST') {
      registrantWhere.lifecycleStatus = 'APPROVED';
    }
    if (dataset === 'PENDING_LIST') {
      registrantWhere.lifecycleStatus = 'PENDING';
    }

    if (dataset === 'CHECKED_IN_LIST') {
      registrantWhere.checkins = {
        some: {
          syncState: 'ACCEPTED'
        }
      };
    }

    if (dataset === 'NO_SHOW_LIST') {
      registrantWhere.lifecycleStatus = 'APPROVED';
      registrantWhere.checkins = {
        none: {
          syncState: 'ACCEPTED'
        }
      };
    }

    const registrants = await prisma.registrant.findMany({
      where: registrantWhere,
      select: {
        id: true,
        referenceCode: true,
        fullName: true,
        email: true,
        lifecycleStatus: true,
        createdAt: true,
        event: {
          select: {
            id: true,
            name: true
          }
        },
        registrationLink: {
          select: {
            id: true,
            title: true,
            slug: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    const acceptedCounts = await prisma.checkin.groupBy({
      by: ['registrantId'],
      where: {
        organizationId: input.organizationId,
        syncState: 'ACCEPTED',
        registrantId: {
          in: registrants.map(row => row.id)
        }
      },
      _count: {
        id: true
      }
    });
    const checkinCountByRegistrantId = new Map(acceptedCounts.map(row => [row.registrantId, row._count.id]));

    for (const registrant of registrants) {
      reportRows.push({
        registrantId: registrant.id,
        referenceCode: registrant.referenceCode,
        fullName: registrant.fullName,
        email: registrant.email,
        lifecycleStatus: registrant.lifecycleStatus,
        eventId: registrant.event.id,
        eventName: registrant.event.name,
        linkId: registrant.registrationLink.id,
        linkTitle: registrant.registrationLink.title,
        linkSlug: registrant.registrationLink.slug,
        acceptedCheckins: checkinCountByRegistrantId.get(registrant.id) || 0,
        createdAt: registrant.createdAt.toISOString()
      });
    }
  }

  if (dataset === 'CATEGORY_REPORT') {
    const links = await prisma.registrationLink.findMany({
      where: {
        organizationId: input.organizationId,
        eventId: input.eventId || undefined
      },
      select: {
        id: true,
        title: true,
        slug: true,
        _count: {
          select: {
            registrants: true
          }
        }
      }
    });

    const acceptedCheckins = await prisma.checkin.findMany({
      where: {
        organizationId: input.organizationId,
        syncState: 'ACCEPTED',
        ...(input.eventId ? { eventId: input.eventId } : {})
      },
      select: {
        registrant: {
          select: {
            registrationLinkId: true
          }
        }
      }
    });
    const checkinsByLinkId = new Map<string, number>();
    for (const row of acceptedCheckins) {
      const linkId = row.registrant.registrationLinkId;
      checkinsByLinkId.set(linkId, (checkinsByLinkId.get(linkId) || 0) + 1);
    }

    for (const link of links) {
      const checkins = checkinsByLinkId.get(link.id) || 0;
      reportRows.push({
        categoryLinkId: link.id,
        categoryTitle: link.title,
        categorySlug: link.slug,
        registrations: link._count.registrants,
        checkins,
        checkinRate: link._count.registrants > 0 ? Number(((checkins / link._count.registrants) * 100).toFixed(2)) : 0
      });
    }
  }

  if (dataset === 'USHER_SCAN_REPORT') {
    const rows = await prisma.checkin.groupBy({
      by: ['usherUserId', 'eventId', 'entrance'],
      where: {
        organizationId: input.organizationId,
        syncState: 'ACCEPTED',
        eventId: input.eventId || undefined
      },
      _count: {
        id: true
      }
    });

    const usherIds = rows.map(row => row.usherUserId).filter((value): value is string => Boolean(value));
    const users = usherIds.length
      ? await prisma.user.findMany({
          where: {
            id: {
              in: usherIds
            }
          },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        })
      : [];
    const userById = new Map(users.map(user => [user.id, user]));

    const events = await prisma.event.findMany({
      where: {
        id: {
          in: rows.map(row => row.eventId)
        }
      },
      select: {
        id: true,
        name: true
      }
    });
    const eventById = new Map(events.map(event => [event.id, event.name]));

    for (const row of rows) {
      const user = row.usherUserId ? userById.get(row.usherUserId) : undefined;
      const usherName = user
        ? [user.firstName, user.lastName].filter(Boolean).join(' ').trim() || user.email
        : 'Unknown Usher';
      reportRows.push({
        eventId: row.eventId,
        eventName: eventById.get(row.eventId) || 'Unknown Event',
        usherUserId: row.usherUserId,
        usherName,
        entrance: row.entrance || 'Unknown',
        scans: row._count.id
      });
    }
  }

  if (dataset === 'COMMUNICATION_REPORT') {
    const logs = await prisma.communicationLog.findMany({
      where: {
        organizationId: input.organizationId,
        registrant: {
          eventId: input.eventId || undefined
        }
      },
      select: {
        channel: true,
        status: true,
        registrant: {
          select: {
            event: {
              select: {
                id: true,
                name: true
              }
            }
          }
        }
      }
    });

    const aggregate = new Map<string, { eventId: string; eventName: string; channel: string; status: string; count: number }>();
    for (const log of logs) {
      if (!log.registrant) {
        continue;
      }
      const key = `${log.registrant.event.id}|${log.channel}|${log.status}`;
      const current =
        aggregate.get(key) || {
          eventId: log.registrant.event.id,
          eventName: log.registrant.event.name,
          channel: log.channel,
          status: log.status,
          count: 0
        };
      current.count += 1;
      aggregate.set(key, current);
    }

    for (const row of aggregate.values()) {
      reportRows.push({
        eventId: row.eventId,
        eventName: row.eventName,
        channel: row.channel,
        status: row.status,
        count: row.count
      });
    }
  }

  if (input.format === 'json') {
    const body = JSON.stringify(
      {
        reportId: input.reportId,
        organizationId: input.organizationId,
        dataset,
        generatedAt: new Date().toISOString(),
        totalRows: reportRows.length,
        rows: reportRows
      },
      null,
      2
    );

    const storagePath = await putReportArtifact({
      reportId: input.reportId,
      organizationId: input.organizationId,
      format: 'json',
      body,
      contentType: 'application/json; charset=utf-8'
    });

    return {
      storagePath,
      contentType: 'application/json; charset=utf-8',
      rowCount: reportRows.length
    };
  }

  const headerKeys = reportRows.length > 0 ? Object.keys(reportRows[0]) : ['message'];
  const header = headerKeys.join(',');

  const lines = reportRows.length
    ? reportRows.map(row =>
        headerKeys
          .map(key => {
            const value = row[key];
            if (typeof value === 'number') {
              return String(value);
            }
            return csvCell(value === null ? '' : String(value));
          })
          .join(',')
      )
    : [csvCell('No rows for selected export dataset')];

  const body = [header, ...lines].join('\n');
  const storagePath = await putReportArtifact({
    reportId: input.reportId,
    organizationId: input.organizationId,
    format: 'csv',
    body,
    contentType: 'text/csv; charset=utf-8'
  });

  return {
    storagePath,
    contentType: 'text/csv; charset=utf-8',
    rowCount: reportRows.length
  };
}

async function dispatchWebhookEvent(input: {
  organizationId: string;
  eventType: WebhookEventType;
  payload: Record<string, unknown>;
  occurredAt: string;
}): Promise<void> {
  const prisma = getWorkerPrisma();
  const configs = await prisma.migrationMetadata.findMany({
    where: {
      key: {
        startsWith: webhookKeyPrefix(input.organizationId)
      }
    }
  });

  for (const row of configs) {
    const webhookId = row.key.replace(webhookKeyPrefix(input.organizationId), '');
    const config = decodeWebhookConfig(row.value);
    if (!config || !config.isActive || !config.events.includes(input.eventType)) {
      continue;
    }

    const body = JSON.stringify({
      eventType: input.eventType,
      occurredAt: input.occurredAt,
      data: input.payload
    });

    const headers: Record<string, string> = {
      'content-type': 'application/json',
      'x-evemange-event': input.eventType
    };

    if (config.secret) {
      headers['x-evemange-signature'] = createHmac('sha256', config.secret).update(body).digest('hex');
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    try {
      const response = await fetch(config.targetUrl, {
        method: 'POST',
        headers,
        body,
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error(`Webhook returned ${response.status}`);
      }

      await prisma.auditLog.create({
        data: {
          actorUserId: null,
          organizationId: input.organizationId,
          action: 'WEBHOOK_DELIVERY_SUCCESS',
          targetType: 'WEBHOOK',
          targetId: webhookId,
          outcome: 'SUCCESS',
          ipAddress: null,
          metadataJson: {
            eventType: input.eventType,
            statusCode: response.status
          }
        }
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown webhook delivery error';
      await prisma.auditLog.create({
        data: {
          actorUserId: null,
          organizationId: input.organizationId,
          action: 'WEBHOOK_DELIVERY_FAILURE',
          targetType: 'WEBHOOK',
          targetId: webhookId,
          outcome: 'FAILURE',
          ipAddress: null,
          metadataJson: {
            eventType: input.eventType,
            reason: message
          }
        }
      });
    } finally {
      clearTimeout(timeout);
    }
  }
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
          organizationId: string;
          referenceCode: string;
          email: string;
          fullName: string;
          eventName: string;
          linkTitle: string;
          templateName: string;
          confirmationMessage: string | null;
        };

        const prisma = getWorkerPrisma();
        await enqueueAutomatedCommunication({
          prisma,
          organizationId: payload.organizationId,
          registrantId: payload.registrantId,
          recipientAddress: payload.email,
          channel: CommunicationChannel.EMAIL,
          messageType: 'REGISTRATION_CONFIRMATION',
          metadata: {
            referenceCode: payload.referenceCode,
            fullName: payload.fullName,
            eventName: payload.eventName,
            linkTitle: payload.linkTitle,
            templateName: payload.templateName,
            confirmationMessage: payload.confirmationMessage,
            subject: `Registration confirmation: ${payload.eventName}`
          }
        });
        return;
      }

      if (job.name === 'import.process') {
        const payload = job.data as {
          importJobId: string;
          organizationId: string;
          eventId: string;
          registrationLinkId?: string;
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
          phone?: string;
          category?: string;
        };

        if (!mapping.fullName || !mapping.email) {
          throw new Error('Invalid mapping profile');
        }

        if (!payload.registrationLinkId && !mapping.category) {
          throw new Error('Import requires default registrationLinkId or mapping.category');
        }

        const links = await prisma.registrationLink.findMany({
          where: {
            organizationId: payload.organizationId,
            eventId: payload.eventId
          },
          select: {
            id: true,
            slug: true,
            title: true
          }
        });

        const linkByNormalizedKey = new Map<string, string>();
        for (const link of links) {
          linkByNormalizedKey.set(link.id.toLowerCase(), link.id);
          linkByNormalizedKey.set(link.slug.toLowerCase(), link.id);
          linkByNormalizedKey.set(link.title.trim().toLowerCase(), link.id);
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
          const phone = mapping.phone ? String(row.data[mapping.phone] || '').trim() : '';

          let targetRegistrationLinkId = payload.registrationLinkId || null;
          if (mapping.category) {
            const categoryValue = String(row.data[mapping.category] || '').trim().toLowerCase();
            if (categoryValue) {
              targetRegistrationLinkId = linkByNormalizedKey.get(categoryValue) || null;
            }
          }

          if (!fullName || !email || !email.includes('@') || !targetRegistrationLinkId) {
            failedRows += 1;
            await prisma.importError.create({
              data: {
                importJobId: importJob.id,
                rowNumber,
                message: 'Missing or invalid fullName/email/category mapped values',
                rawDataJson: row.data as Prisma.InputJsonValue
              }
            });
            continue;
          }

          const existing = await prisma.registrant.findFirst({
            where: {
              registrationLinkId: targetRegistrationLinkId,
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

            if (phone) {
              await prisma.registrantResponse.upsert({
                where: {
                  registrantId_fieldKey: {
                    registrantId: existing.id,
                    fieldKey: 'phone'
                  }
                },
                update: {
                  valueText: phone
                },
                create: {
                  registrantId: existing.id,
                  fieldKey: 'phone',
                  valueText: phone
                }
              });
            }

            try {
              await issueBadgeForRegistrantFromWorker(existing.id);
            } catch {
              // Import processing should complete even if badge queueing fails for a row.
            }

            try {
              await enqueueAutomatedCommunication({
                prisma,
                organizationId: payload.organizationId,
                registrantId: existing.id,
                recipientAddress: email,
                channel: CommunicationChannel.EMAIL,
                messageType: 'REGISTRATION_CONFIRMATION',
                metadata: {
                  source: 'import.update',
                  fullName,
                  eventId: payload.eventId
                }
              });
            } catch {
              // Import processing should complete even if communication queueing fails for a row.
            }

            successfulRows += 1;
            continue;
          }

          const referenceCode = await nextReferenceCode(prisma);
          const createdRegistrant = await prisma.registrant.create({
            data: {
              organizationId: payload.organizationId,
              eventId: payload.eventId,
              registrationLinkId: targetRegistrationLinkId,
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

          if (phone) {
            await prisma.registrantResponse.create({
              data: {
                registrantId: createdRegistrant.id,
                fieldKey: 'phone',
                valueText: phone
              }
            });
          }

          try {
            await issueBadgeForRegistrantFromWorker(createdRegistrant.id);
          } catch {
            // Import processing should complete even if badge queueing fails for a row.
          }

          try {
            await enqueueAutomatedCommunication({
              prisma,
              organizationId: payload.organizationId,
              registrantId: createdRegistrant.id,
              recipientAddress: email,
              channel: CommunicationChannel.EMAIL,
              messageType: 'REGISTRATION_CONFIRMATION',
              metadata: {
                source: 'import.create',
                fullName,
                eventId: payload.eventId
              }
            });
          } catch {
            // Import processing should complete even if communication queueing fails for a row.
          }

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

      if (job.name === 'webhook.dispatch') {
        const payload = job.data as {
          organizationId: string;
          eventType: WebhookEventType;
          payload: Record<string, unknown>;
          occurredAt: string;
        };

        await dispatchWebhookEvent(payload);
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

        try {
          const config = await getCommunicationConfig(prisma);
          const delivery = await dispatchCommunication({
            communication,
            config
          });

          await prisma.communicationLog.update({
            where: {
              id: communication.id
            },
            data: {
              status: 'SENT',
              sentAt: new Date(),
              providerMessageId: delivery.providerMessageId,
              errorMessage: null
            }
          });

          console.log(`communication sent to ${communication.recipientAddress}`);
          return;
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unknown communication provider error';
          await prisma.communicationLog.update({
            where: {
              id: communication.id
            },
            data: {
              status: 'FAILED',
              errorMessage: message
            }
          });
          throw error;
        }
      }

      if (job.name === 'analytics.report.generate') {
        const payload = job.data as {
          reportId: string;
          organizationId: string;
          requestedByUserId: string | null;
          format: 'csv' | 'json';
          eventId?: string;
          dataset?:
            | 'EVENT_SUMMARY'
            | 'FULL_REGISTRATION_LIST'
            | 'APPROVED_LIST'
            | 'PENDING_LIST'
            | 'CHECKED_IN_LIST'
            | 'NO_SHOW_LIST'
            | 'CATEGORY_REPORT'
            | 'USHER_SCAN_REPORT'
            | 'COMMUNICATION_REPORT';
        };

        const prisma = getWorkerPrisma();
        await prisma.auditLog.create({
          data: {
            actorUserId: payload.requestedByUserId,
            organizationId: payload.organizationId,
            action: 'REPORT_EXPORT_STARTED',
            targetType: 'ANALYTICS_REPORT',
            targetId: payload.reportId,
            outcome: 'SUCCESS',
            ipAddress: null,
            metadataJson: {
              format: payload.format,
              eventId: payload.eventId || null,
              dataset: payload.dataset || 'EVENT_SUMMARY',
              queueJobId: job.id
            }
          }
        });

        try {
          const rendered = await renderAnalyticsReportArtifact({
            reportId: payload.reportId,
            organizationId: payload.organizationId,
            eventId: payload.eventId,
            format: payload.format,
            dataset: payload.dataset
          });

          await prisma.auditLog.create({
            data: {
              actorUserId: payload.requestedByUserId,
              organizationId: payload.organizationId,
              action: 'REPORT_EXPORT_COMPLETED',
              targetType: 'ANALYTICS_REPORT',
              targetId: payload.reportId,
              outcome: 'SUCCESS',
              ipAddress: null,
              metadataJson: {
                format: payload.format,
                eventId: payload.eventId || null,
                dataset: payload.dataset || 'EVENT_SUMMARY',
                rowCount: rendered.rowCount,
                storagePath: rendered.storagePath,
                contentType: rendered.contentType,
                queueJobId: job.id
              }
            }
          });

          return {
            reportId: payload.reportId,
            organizationId: payload.organizationId,
            format: payload.format,
            eventId: payload.eventId || null,
            dataset: payload.dataset || 'EVENT_SUMMARY',
            rowCount: rendered.rowCount,
            storagePath: rendered.storagePath,
            contentType: rendered.contentType,
            generatedAt: new Date().toISOString()
          };
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unknown report export failure';
          await prisma.auditLog.create({
            data: {
              actorUserId: payload.requestedByUserId,
              organizationId: payload.organizationId,
              action: 'REPORT_EXPORT_FAILED',
              targetType: 'ANALYTICS_REPORT',
              targetId: payload.reportId,
              outcome: 'FAILURE',
              ipAddress: null,
              metadataJson: {
                format: payload.format,
                eventId: payload.eventId || null,
                dataset: payload.dataset || 'EVENT_SUMMARY',
                queueJobId: job.id,
                reason: message
              }
            }
          });
          throw error;
        }
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

        await enqueueAutomatedCommunication({
          prisma,
          organizationId: badge.organizationId,
          registrantId: badge.registrantId,
          recipientAddress: badge.registrant.email,
          channel: CommunicationChannel.EMAIL,
          messageType: 'BADGE_DELIVERY',
          metadata: {
            fullName: badge.registrant.fullName,
            eventName: badge.event.name,
            downloadUrl,
            subject: `Badge ready: ${badge.event.name}`,
            badgeId: badge.id
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
