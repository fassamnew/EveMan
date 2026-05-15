import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import { AuditOutcome, Prisma, RoleName } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { getSystemQueue } from '../../infra/queue/queue.provider';
import {
  createReportSignedDownloadUrl,
  isValidLocalReportSignature,
  readLocalReportArtifact
} from '../../infra/storage/report-storage.util';
import { PrismaService } from '../../infra/db/prisma.service';
import { AuditService } from '../common/audit.service';
import { PolicyService } from '../common/policy.service';
import type { RequestWithAuth } from '../common/request-with-auth';

type CacheEntry = {
  expiresAt: number;
  payload: Record<string, unknown>;
};

const CACHE_TTL_MS = 30_000;
const TREND_DAYS = 7;
const REPORT_LINK_TTL_SECONDS = 15 * 60;
const REPORT_DATASETS = [
  'EVENT_SUMMARY',
  'FULL_REGISTRATION_LIST',
  'APPROVED_LIST',
  'PENDING_LIST',
  'CHECKED_IN_LIST',
  'NO_SHOW_LIST',
  'CATEGORY_REPORT',
  'USHER_SCAN_REPORT',
  'COMMUNICATION_REPORT'
] as const;

type ReportDataset = (typeof REPORT_DATASETS)[number];

@Injectable()
export class AnalyticsService {
  private readonly cache = new Map<string, CacheEntry>();

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(PolicyService) private readonly policy: PolicyService,
    @Inject(AuditService) private readonly audit: AuditService
  ) {}

  private assertReadAccess(orgCode: string, req: RequestWithAuth): void {
    if (!req.auth || !this.policy.canAccessTenant(req.auth, orgCode)) {
      throw new ForbiddenException('Missing tenant access');
    }
  }

  private startOfDay(date: Date): Date {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  }

  private dayKey(date: Date): string {
    return this.startOfDay(date).toISOString().slice(0, 10);
  }

  private buildTrendSkeleton(days: number): Array<{ day: string; registrations: number; checkins: number }> {
    const today = this.startOfDay(new Date());
    const rows: Array<{ day: string; registrations: number; checkins: number }> = [];

    for (let i = days - 1; i >= 0; i -= 1) {
      const day = new Date(today);
      day.setUTCDate(day.getUTCDate() - i);
      rows.push({
        day: this.dayKey(day),
        registrations: 0,
        checkins: 0
      });
    }

    return rows;
  }

  private getIp(req: RequestWithAuth): string | null {
    const forwarded = req.headers?.['x-forwarded-for'];
    if (typeof forwarded === 'string' && forwarded.trim().length > 0) {
      return forwarded.split(',')[0].trim();
    }

    return req.ip || null;
  }

  private assertExportAccess(orgCode: string, req: RequestWithAuth): void {
    this.assertReadAccess(orgCode, req);

    const hasElevatedRole =
      (req.auth?.roles || []).includes('SUPER_ADMIN' as RoleName) ||
      (req.auth?.roles || []).includes('ORG_ADMIN' as RoleName);

    if (!hasElevatedRole) {
      throw new ForbiddenException('ORG_ADMIN or SUPER_ADMIN role required for report export');
    }
  }

  private async getOrg(orgCode: string): Promise<{ id: string; code: string; name: string }> {
    const org = await this.prisma.organization.findUnique({
      where: { code: orgCode },
      select: { id: true, code: true, name: true }
    });

    if (!org) {
      throw new NotFoundException('Organization not found');
    }

    return org;
  }

  private toFormat(value?: string): 'csv' | 'json' {
    if (value === 'json') {
      return 'json';
    }
    return 'csv';
  }

  private parseReportTtlSeconds(value?: string): number {
    const parsed = value ? Number(value) : REPORT_LINK_TTL_SECONDS;
    if (!Number.isFinite(parsed) || parsed < 300 || parsed > 3600) {
      return REPORT_LINK_TTL_SECONDS;
    }

    return Math.floor(parsed);
  }

  private toReportDataset(value?: string): ReportDataset {
    if (!value) {
      return 'EVENT_SUMMARY';
    }

    const normalized = value.toUpperCase();
    return REPORT_DATASETS.includes(normalized as ReportDataset)
      ? (normalized as ReportDataset)
      : 'EVENT_SUMMARY';
  }

  async queueDashboardReport(input: {
    orgCode: string;
    eventId?: string;
    format?: string;
    dataset?: string;
    req: RequestWithAuth;
  }) {
    this.assertExportAccess(input.orgCode, input.req);
    const org = await this.getOrg(input.orgCode);
    const reportId = randomUUID();
    const format = this.toFormat(input.format);
    const dataset = this.toReportDataset(input.dataset);

    if (input.eventId) {
      const event = await this.prisma.event.findFirst({
        where: {
          id: input.eventId,
          organizationId: org.id
        },
        select: { id: true }
      });

      if (!event) {
        throw new NotFoundException('Event not found');
      }
    }

    const queue = getSystemQueue();
    await queue.add(
      'analytics.report.generate',
      {
        reportId,
        organizationId: org.id,
        requestedByUserId: input.req.auth?.userId || null,
        format,
        eventId: input.eventId,
        dataset
      },
      {
        jobId: reportId,
        attempts: 2,
        backoff: {
          type: 'exponential',
          delay: 1000
        },
        removeOnComplete: 100,
        removeOnFail: 100
      }
    );

    await this.audit.write({
      actorUserId: input.req.auth?.userId || null,
      organizationId: org.id,
      action: 'REPORT_EXPORT_QUEUED',
      targetType: 'ANALYTICS_REPORT',
      targetId: reportId,
      outcome: AuditOutcome.SUCCESS,
      ipAddress: this.getIp(input.req),
      metadataJson: {
        format,
        eventId: input.eventId || null,
        dataset
      }
    });

    return {
      reportId,
      status: 'QUEUED',
      format,
      eventId: input.eventId || null,
      dataset
    };
  }

  async listDashboardReports(input: { orgCode: string; req: RequestWithAuth }) {
    this.assertReadAccess(input.orgCode, input.req);
    const org = await this.getOrg(input.orgCode);

    const queue = getSystemQueue();
    const jobs = await queue.getJobs(['waiting', 'active', 'completed', 'failed', 'delayed'], 0, 100);
    const matching = jobs.filter(
      job =>
        job.name === 'analytics.report.generate' &&
        (job.data as { organizationId?: string }).organizationId === org.id
    );

    const items = await Promise.all(
      matching.map(async job => {
        const state = await job.getState();
        const returnValue = (job.returnvalue || {}) as {
          rowCount?: number;
          storagePath?: string;
          generatedAt?: string;
          contentType?: string;
        };

        const data = job.data as {
          reportId: string;
          format: 'csv' | 'json';
          eventId?: string;
          dataset?: ReportDataset;
        };

        return {
          reportId: data.reportId,
          status: state.toUpperCase(),
          format: data.format,
          dataset: data.dataset || 'EVENT_SUMMARY',
          eventId: data.eventId || null,
          createdAt: job.timestamp ? new Date(job.timestamp).toISOString() : null,
          completedAt: job.finishedOn ? new Date(job.finishedOn).toISOString() : null,
          rowCount: returnValue.rowCount || null,
          downloadReady: state === 'completed' && Boolean(returnValue.storagePath),
          failureReason: job.failedReason || null
        };
      })
    );

    return {
      organization: {
        id: org.id,
        code: org.code,
        name: org.name
      },
      reports: items.sort((a, b) => (a.createdAt && b.createdAt ? b.createdAt.localeCompare(a.createdAt) : 0))
    };
  }

  async createDashboardReportDownloadUrl(input: {
    orgCode: string;
    reportId: string;
    expiresInSeconds?: string;
    req: RequestWithAuth;
  }) {
    this.assertExportAccess(input.orgCode, input.req);
    const org = await this.getOrg(input.orgCode);

    const queue = getSystemQueue();
    const job = await queue.getJob(input.reportId);
    if (!job || job.name !== 'analytics.report.generate') {
      throw new NotFoundException('Report job not found');
    }

    const data = job.data as { organizationId?: string; format?: string };
    if (data.organizationId !== org.id) {
      throw new NotFoundException('Report job not found');
    }

    const state = await job.getState();
    if (state !== 'completed') {
      throw new BadRequestException('Report is not ready for download');
    }

    const returnValue = (job.returnvalue || {}) as {
      storagePath?: string;
      contentType?: string;
      generatedAt?: string;
    };

    if (!returnValue.storagePath) {
      throw new BadRequestException('Report artifact is missing');
    }

    const expiresInSeconds = this.parseReportTtlSeconds(input.expiresInSeconds);
    const downloadUrl = await createReportSignedDownloadUrl({
      reportId: input.reportId,
      organizationId: org.id,
      storagePath: returnValue.storagePath,
      expiresInSeconds
    });

    await this.audit.write({
      actorUserId: input.req.auth?.userId || null,
      organizationId: org.id,
      action: 'REPORT_EXPORT_DOWNLOAD_LINK_ISSUED',
      targetType: 'ANALYTICS_REPORT',
      targetId: input.reportId,
      outcome: AuditOutcome.SUCCESS,
      ipAddress: this.getIp(input.req),
      metadataJson: {
        expiresInSeconds,
        format: data.format || null,
        dataset: (job.data as { dataset?: ReportDataset }).dataset || 'EVENT_SUMMARY'
      }
    });

    return {
      reportId: input.reportId,
      expiresInSeconds,
      downloadUrl,
      generatedAt: returnValue.generatedAt || null,
      contentType: returnValue.contentType || null
    };
  }

  async getPublicReportDownload(input: {
    path: string;
    reportId: string;
    orgId: string;
    expires: string;
    sig: string;
  }) {
    const expiresAtMs = Number(input.expires);
    if (!Number.isFinite(expiresAtMs)) {
      throw new BadRequestException('Invalid expires value');
    }

    const valid = isValidLocalReportSignature({
      storagePath: input.path,
      reportId: input.reportId,
      organizationId: input.orgId,
      expiresAtMs,
      signature: input.sig
    });

    if (!valid) {
      throw new BadRequestException('Invalid or expired report download signature');
    }

    const content = await readLocalReportArtifact(input.path);
    const filename = input.path.split('/').pop() || `${input.reportId}.csv`;

    await this.audit.write({
      actorUserId: null,
      organizationId: input.orgId,
      action: 'REPORT_EXPORT_DOWNLOADED',
      targetType: 'ANALYTICS_REPORT',
      targetId: input.reportId,
      outcome: AuditOutcome.SUCCESS,
      ipAddress: null,
      metadataJson: {
        filename
      }
    });

    return {
      filename,
      content,
      contentType: filename.endsWith('.json')
        ? 'application/json; charset=utf-8'
        : 'text/csv; charset=utf-8'
    };
  }

  async getDashboardOverview(orgCode: string, req: RequestWithAuth) {
    this.assertReadAccess(orgCode, req);

    const cacheKey = `overview:${orgCode}`;
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return {
        ...cached.payload,
        cached: true
      };
    }

    const org = await this.getOrg(orgCode);

    const [
      totalEvents,
      publishedEvents,
      totalRegistrants,
      approvedRegistrants,
      totalCheckins,
      commTotal,
      commSent,
      commFailed,
      events,
      usherGroup,
      users,
      recentRegistrants,
      recentCheckins
    ] = await Promise.all([
      this.prisma.event.count({ where: { organizationId: org.id } }),
      this.prisma.event.count({ where: { organizationId: org.id, status: 'PUBLISHED' } }),
      this.prisma.registrant.count({ where: { organizationId: org.id } }),
      this.prisma.registrant.count({
        where: { organizationId: org.id, lifecycleStatus: 'APPROVED' }
      }),
      this.prisma.checkin.count({ where: { organizationId: org.id } }),
      this.prisma.communicationLog.count({ where: { organizationId: org.id } }),
      this.prisma.communicationLog.count({ where: { organizationId: org.id, status: 'SENT' } }),
      this.prisma.communicationLog.count({ where: { organizationId: org.id, status: 'FAILED' } }),
      this.prisma.event.findMany({
        where: { organizationId: org.id },
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
      }),
      this.prisma.checkin.groupBy({
        by: ['usherUserId'],
        where: { organizationId: org.id },
        _count: {
          usherUserId: true
        }
      }),
      this.prisma.user.findMany({
        where: {
          userRoles: {
            some: {
              organizationId: org.id
            }
          }
        },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true
        }
      }),
      this.prisma.registrant.findMany({
        where: {
          organizationId: org.id,
          createdAt: {
            gte: new Date(Date.now() - TREND_DAYS * 24 * 60 * 60 * 1000)
          }
        },
        select: {
          createdAt: true
        }
      }),
      this.prisma.checkin.findMany({
        where: {
          organizationId: org.id,
          createdAt: {
            gte: new Date(Date.now() - TREND_DAYS * 24 * 60 * 60 * 1000)
          }
        },
        select: {
          createdAt: true
        }
      })
    ]);

    const trends = this.buildTrendSkeleton(TREND_DAYS);
    const trendByDay = new Map(trends.map(item => [item.day, item]));

    for (const row of recentRegistrants) {
      const key = this.dayKey(row.createdAt);
      const target = trendByDay.get(key);
      if (target) {
        target.registrations += 1;
      }
    }

    for (const row of recentCheckins) {
      const key = this.dayKey(row.createdAt);
      const target = trendByDay.get(key);
      if (target) {
        target.checkins += 1;
      }
    }

    const eventIds = events.map(event => event.id);
    const commByEvent = eventIds.length
      ? await this.prisma.communicationLog.groupBy({
          by: ['status', 'registrantId'],
          where: {
            organizationId: org.id,
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

    const registrantEventById = eventIds.length
      ? await this.prisma.registrant.findMany({
          where: {
            organizationId: org.id,
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

    const eventByRegistrant = new Map(registrantEventById.map(row => [row.id, row.eventId]));
    const commByEventStatus = new Map<string, { sent: number; failed: number }>();

    for (const row of commByEvent) {
      const eventId = row.registrantId ? eventByRegistrant.get(row.registrantId) : undefined;
      if (!eventId) {
        continue;
      }

      const prev = commByEventStatus.get(eventId) || { sent: 0, failed: 0 };
      if (row.status === 'SENT') {
        prev.sent += row._count.id;
      }
      if (row.status === 'FAILED') {
        prev.failed += row._count.id;
      }
      commByEventStatus.set(eventId, prev);
    }

    const eventPerformance = events.map(event => {
      const comm = commByEventStatus.get(event.id) || { sent: 0, failed: 0 };
      const checkinRate = event._count.registrants
        ? Number(((event._count.checkins / event._count.registrants) * 100).toFixed(2))
        : 0;

      return {
        eventId: event.id,
        eventName: event.name,
        startsAt: event.startsAt,
        registrations: event._count.registrants,
        checkins: event._count.checkins,
        checkinRate,
        qrIssued: event._count.qrCodes,
        communicationsSent: comm.sent,
        communicationsFailed: comm.failed
      };
    });

    const userById = new Map(users.map(user => [user.id, user]));
    const usherPerformance = usherGroup
      .filter(row => row.usherUserId)
      .map(row => {
        const user = userById.get(row.usherUserId as string);
        const name = [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim();

        return {
          usherUserId: row.usherUserId,
          usherName: name || user?.email || 'Unknown Usher',
          scans: row._count.usherUserId
        };
      })
      .sort((a, b) => b.scans - a.scans);

    const payload = {
      organization: {
        id: org.id,
        code: org.code,
        name: org.name
      },
      kpis: {
        totalEvents,
        publishedEvents,
        totalRegistrants,
        approvedRegistrants,
        totalCheckins,
        checkinRate: approvedRegistrants
          ? Number(((totalCheckins / approvedRegistrants) * 100).toFixed(2))
          : 0,
        communicationTotal: commTotal,
        communicationSent: commSent,
        communicationFailed: commFailed
      },
      trends,
      eventPerformance,
      usherPerformance,
      generatedAt: new Date().toISOString()
    };

    this.cache.set(cacheKey, {
      payload,
      expiresAt: Date.now() + CACHE_TTL_MS
    });

    return {
      ...payload,
      cached: false
    };
  }
  async getCategoryBreakdown(orgCode: string, req: RequestWithAuth) {
    this.assertReadAccess(orgCode, req);
    const org = await this.getOrg(orgCode);

    const data = await this.prisma.registrant.groupBy({
      by: ['registrationLinkId'],
      where: {
        organizationId: org.id
      },
      _count: {
        id: true
      }
    });

    const linkIds = data.map(row => row.registrationLinkId).filter(Boolean);
    const links = linkIds.length
      ? await this.prisma.registrationLink.findMany({
          where: {
            id: {
              in: linkIds
            }
          },
          select: {
            id: true,
            title: true
          }
        })
      : [];

    const linkById = new Map(links.map(link => [link.id, link.title]));

    return {
      organization: {
        id: org.id,
        code: org.code,
        name: org.name
      },
      breakdown: data.map(row => ({
        category: linkById.get(row.registrationLinkId) || 'Unknown',
        count: row._count.id
      }))
    };
  }

  async getLinkBreakdown(orgCode: string, req: RequestWithAuth) {
    this.assertReadAccess(orgCode, req);
    const org = await this.getOrg(orgCode);

    const links = await this.prisma.registrationLink.findMany({
      where: {
        organizationId: org.id
      },
      select: {
        id: true,
        slug: true,
        title: true,
        eventId: true,
        _count: {
          select: {
            registrants: true
          }
        }
      },
      orderBy: {
        createdAt: 'asc'
      }
    });

    const linkIds = links.map(link => link.id);
    const acceptedCheckins =
      linkIds.length > 0
        ? await this.prisma.checkin.findMany({
            where: {
              organizationId: org.id,
              syncState: 'ACCEPTED',
              registrant: {
                registrationLinkId: {
                  in: linkIds
                }
              }
            },
            select: {
              registrant: {
                select: {
                  registrationLinkId: true
                }
              }
            }
          })
        : [];

    const checkinsByLink = new Map<string, number>();
    for (const row of acceptedCheckins) {
      const linkId = row.registrant.registrationLinkId;
      checkinsByLink.set(linkId, (checkinsByLink.get(linkId) || 0) + 1);
    }

    return {
      organization: {
        id: org.id,
        code: org.code,
        name: org.name
      },
      breakdown: links.map(link => ({
        linkId: link.id,
        slug: link.slug,
        title: link.title,
        eventId: link.eventId,
        registrations: link._count.registrants,
        checkins: checkinsByLink.get(link.id) || 0
      }))
    };
  }

  async getScanAttemptMetrics(orgCode: string, eventId?: string, req?: RequestWithAuth) {
    if (req) {
      this.assertReadAccess(orgCode, req);
    }
    const org = await this.getOrg(orgCode);

    const where: Prisma.CheckinWhereInput = {
      organizationId: org.id
    };

    if (eventId) {
      where.eventId = eventId;
    }

    const bySyncState = await this.prisma.checkin.groupBy({
      by: ['syncState'],
      where,
      _count: {
        id: true
      }
    });

    const byEntrance = await this.prisma.checkin.groupBy({
      by: ['entrance'],
      where: {
        ...where,
        entrance: {
          not: null
        }
      },
      _count: {
        id: true
      }
    });

    const duplicateAuditRows = await this.prisma.auditLog.findMany({
      where: {
        organizationId: org.id,
        action: 'USHER_CHECKIN_DUPLICATE'
      },
      select: {
        metadataJson: true
      }
    });

    const invalidAuditRows = await this.prisma.auditLog.findMany({
      where: {
        organizationId: org.id,
        action: 'USHER_CHECKIN_INVALID'
      },
      select: {
        metadataJson: true
      }
    });

    const getEventIdFromMetadata = (value: Prisma.JsonValue | null): string | null => {
      if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return null;
      }
      const eventIdValue = (value as Record<string, unknown>).eventId;
      return typeof eventIdValue === 'string' ? eventIdValue : null;
    };

    const duplicateAttempts = eventId
      ? duplicateAuditRows.filter(row => getEventIdFromMetadata(row.metadataJson) === eventId).length
      : duplicateAuditRows.length;

    const invalidAttempts = eventId
      ? invalidAuditRows.filter(row => getEventIdFromMetadata(row.metadataJson) === eventId).length
      : invalidAuditRows.length;

    const acceptedCheckinsWithCategory = await this.prisma.checkin.findMany({
      where: {
        ...where,
        syncState: 'ACCEPTED'
      },
      select: {
        registrant: {
          select: {
            registrationLink: {
              select: {
                title: true
              }
            }
          }
        }
      }
    });

    const byCategory: Record<string, number> = {};
    for (const row of acceptedCheckinsWithCategory) {
      const category = row.registrant.registrationLink.title || 'Unknown';
      byCategory[category] = (byCategory[category] || 0) + 1;
    }

    const metrics = {
      accepted: 0,
      duplicate: 0,
      invalid: 0,
      conflict: 0,
      byEntrance: {} as Record<string, number>,
      byCategory
    };

    for (const row of bySyncState) {
      if (row.syncState === 'ACCEPTED') {
        metrics.accepted = row._count.id;
      } else if (row.syncState === 'CONFLICT') {
        metrics.conflict = row._count.id;
      }
    }

    metrics.duplicate = duplicateAttempts;
    metrics.invalid = invalidAttempts;

    for (const row of byEntrance) {
      const entrance = row.entrance || 'Unknown';
      metrics.byEntrance[entrance] = row._count.id;
    }

    return {
      organization: {
        id: org.id,
        code: org.code,
        name: org.name
      },
      metrics,
      eventId: eventId || null
    };
  }

  async getLastScannedAttendees(orgCode: string, eventId?: string, limit: number = 20, req?: RequestWithAuth) {
    if (req) {
      this.assertReadAccess(orgCode, req);
    }
    const org = await this.getOrg(orgCode);

    const where: Prisma.CheckinWhereInput = {
      organizationId: org.id,
      syncState: 'ACCEPTED'
    };

    if (eventId) {
      where.eventId = eventId;
    }

    const checkins = await this.prisma.checkin.findMany({
      where,
      include: {
        registrant: {
          select: {
            id: true,
            fullName: true,
            email: true,
            referenceCode: true
          }
        },
        usherUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        }
      },
      orderBy: {
        scannedAt: 'desc'
      },
      take: limit
    });

    return {
      organization: {
        id: org.id,
        code: org.code,
        name: org.name
      },
      attendees: checkins.map(checkin => ({
        attendeeId: checkin.registrant.id,
        fullName: checkin.registrant.fullName,
        email: checkin.registrant.email,
        referenceCode: checkin.registrant.referenceCode,
        checkinId: checkin.id,
        scannedAt: checkin.scannedAt.toISOString(),
        entrance: checkin.entrance || null,
        usher: checkin.usherUser
          ? {
              id: checkin.usherUser.id,
              name: [checkin.usherUser.firstName, checkin.usherUser.lastName].filter(Boolean).join(' ').trim()
            }
          : null
      }))
    };
  }

  async getNoShowAnalysis(orgCode: string, eventId?: string, req?: RequestWithAuth) {
    if (req) {
      this.assertReadAccess(orgCode, req);
    }
    const org = await this.getOrg(orgCode);

    const where: Prisma.RegistrantWhereInput = {
      organizationId: org.id,
      lifecycleStatus: 'APPROVED'
    };

    if (eventId) {
      where.eventId = eventId;
    }

    const approved = await this.prisma.registrant.count({ where });

    const checkedInIds = await this.prisma.checkin.findMany({
      where: {
        organizationId: org.id,
        syncState: 'ACCEPTED',
        ...(eventId ? { eventId } : {})
      },
      select: {
        registrantId: true
      },
      distinct: ['registrantId']
    });

    const checkedInSet = new Set(checkedInIds.map(row => row.registrantId));
    const noShowCount = approved - checkedInSet.size;

    return {
      organization: {
        id: org.id,
        code: org.code,
        name: org.name
      },
      analysis: {
        approvedCount: approved,
        checkedInCount: checkedInSet.size,
        noShowCount: Math.max(0, noShowCount),
        noShowRate: approved > 0 ? Number(((Math.max(0, noShowCount) / approved) * 100).toFixed(2)) : 0
      },
      eventId: eventId || null
    };
  }
}
