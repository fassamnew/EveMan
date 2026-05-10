import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { AuditOutcome, ImportDuplicateStrategy, Prisma } from '@prisma/client';
import { parse as parseCsv } from 'csv-parse/sync';
import { PrismaService } from '../../infra/db/prisma.service';
import { getSystemQueue } from '../../infra/queue/queue.provider';
import { AuditService } from '../common/audit.service';
import { PolicyService } from '../common/policy.service';
import type { RequestWithAuth } from '../common/request-with-auth';
import type { CreateImportJobDto } from './dto/create-import-job.dto';

@Injectable()
export class ImportsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(PolicyService) private readonly policy: PolicyService
  ) {}

  private getIp(req: RequestWithAuth): string | null {
    return req.ip || null;
  }

  private decodeFileContent(base64: string): Buffer {
    try {
      return Buffer.from(base64, 'base64');
    } catch {
      throw new BadRequestException('Invalid fileContentBase64 payload');
    }
  }

  private scanForMalware(buffer: Buffer): void {
    const body = buffer.toString('utf8');
    // Baseline hook: this can be replaced by external AV scanning integration in production.
    if (body.includes('EICAR-STANDARD-ANTIVIRUS-TEST-FILE')) {
      throw new BadRequestException('Malware signature detected in upload');
    }
  }

  private parseRowsFromFile(dto: CreateImportJobDto): Array<{ data: Record<string, unknown> }> {
    if (!dto.fileContentBase64) {
      return [];
    }

    const buffer = this.decodeFileContent(dto.fileContentBase64);
    this.scanForMalware(buffer);

    if (dto.sourceFileType === 'CSV') {
      const records = parseCsv(buffer, {
        columns: true,
        skip_empty_lines: true,
        trim: true
      }) as Array<Record<string, unknown>>;

      return records.map(item => ({ data: item }));
    }

    throw new BadRequestException('Only CSV sourceFileType is supported in current hardening mode');
  }

  private resolveRows(dto: CreateImportJobDto): Array<{ data: Record<string, unknown> }> {
    if (dto.rows && dto.rows.length > 0) {
      return dto.rows as Array<{ data: Record<string, unknown> }>;
    }

    const fileRows = this.parseRowsFromFile(dto);
    if (fileRows.length > 0) {
      return fileRows;
    }

    throw new BadRequestException('Provide either rows or fileContentBase64 with parsable CSV data');
  }

  private validateMapping(rows: Array<{ data: Record<string, unknown> }>, dto: CreateImportJobDto): void {
    if (rows.length === 0) {
      return;
    }

    const first = rows[0]?.data || {};
    if (!(dto.mappingProfile.fullName in first) || !(dto.mappingProfile.email in first)) {
      throw new BadRequestException('Mapping profile columns are missing in import data');
    }
  }

  private assertReadAccess(orgCode: string, req: RequestWithAuth): void {
    if (!req.auth || !this.policy.canAccessTenant(req.auth, orgCode)) {
      throw new ForbiddenException('Missing tenant access');
    }
  }

  private assertWriteAccess(orgCode: string, req: RequestWithAuth): void {
    if (!req.auth || !this.policy.canManageEventSettings(req.auth, orgCode)) {
      throw new ForbiddenException('ORG_ADMIN role required for imports');
    }
  }

  private async getOrg(orgCode: string): Promise<{ id: string }> {
    const org = await this.prisma.organization.findUnique({
      where: { code: orgCode },
      select: { id: true }
    });

    if (!org) {
      throw new NotFoundException('Organization not found');
    }

    return org;
  }

  async createJob(input: { orgCode: string; dto: CreateImportJobDto; req: RequestWithAuth }) {
    this.assertWriteAccess(input.orgCode, input.req);
    const org = await this.getOrg(input.orgCode);
    const rows = this.resolveRows(input.dto);
    this.validateMapping(rows, input.dto);

    const job = await this.prisma.importJob.create({
      data: {
        organizationId: org.id,
        uploadedByUserId: input.req.auth?.userId || null,
        sourceFilename: input.dto.sourceFilename,
        sourceFileType: input.dto.sourceFileType,
        duplicateStrategy: input.dto.duplicateStrategy as ImportDuplicateStrategy,
        mappingProfileJson: input.dto.mappingProfile as Prisma.InputJsonValue,
        totalRows: rows.length,
        status: 'QUEUED'
      }
    });

    await this.audit.write({
      actorUserId: input.req.auth?.userId || null,
      organizationId: org.id,
      action: 'IMPORT_JOB_CREATE',
      targetType: 'IMPORT_JOB',
      targetId: job.id,
      outcome: AuditOutcome.SUCCESS,
      ipAddress: this.getIp(input.req),
      metadataJson: {
        sourceFilename: input.dto.sourceFilename,
        sourceFileType: input.dto.sourceFileType,
        duplicateStrategy: input.dto.duplicateStrategy,
        totalRows: rows.length
      }
    });

    const queue = getSystemQueue();
    await queue.add(
      'import.process',
      {
        importJobId: job.id,
        organizationId: org.id,
        eventId: input.dto.eventId,
        registrationLinkId: input.dto.registrationLinkId,
        rows
      },
      {
        attempts: 2,
        backoff: {
          type: 'exponential',
          delay: 1000
        },
        removeOnComplete: 100,
        removeOnFail: 100
      }
    );

    return {
      jobId: job.id,
      status: job.status
    };
  }

  async listJobs(input: { orgCode: string; req: RequestWithAuth }) {
    this.assertReadAccess(input.orgCode, input.req);
    const org = await this.getOrg(input.orgCode);

    return this.prisma.importJob.findMany({
      where: {
        organizationId: org.id
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
  }

  async listErrors(input: { orgCode: string; jobId: string; req: RequestWithAuth }) {
    this.assertReadAccess(input.orgCode, input.req);
    const org = await this.getOrg(input.orgCode);

    const job = await this.prisma.importJob.findFirst({
      where: {
        id: input.jobId,
        organizationId: org.id
      },
      select: {
        id: true
      }
    });

    if (!job) {
      throw new NotFoundException('Import job not found');
    }

    return this.prisma.importError.findMany({
      where: {
        importJobId: job.id
      },
      orderBy: {
        rowNumber: 'asc'
      }
    });
  }
}
