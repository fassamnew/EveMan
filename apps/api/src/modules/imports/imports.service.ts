import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ImportDuplicateStrategy } from '@prisma/client';
import { PrismaService } from '../../infra/db/prisma.service';
import { getSystemQueue } from '../../infra/queue/queue.provider';
import { PolicyService } from '../common/policy.service';
import type { RequestWithAuth } from '../common/request-with-auth';
import type { CreateImportJobDto } from './dto/create-import-job.dto';

@Injectable()
export class ImportsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(PolicyService) private readonly policy: PolicyService
  ) {}

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

    const job = await this.prisma.importJob.create({
      data: {
        organizationId: org.id,
        uploadedByUserId: input.req.auth?.userId || null,
        sourceFilename: input.dto.sourceFilename,
        sourceFileType: input.dto.sourceFileType,
        duplicateStrategy: input.dto.duplicateStrategy as ImportDuplicateStrategy,
        mappingProfileJson: input.dto.mappingProfile,
        status: 'QUEUED'
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
        rows: input.dto.rows || []
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
