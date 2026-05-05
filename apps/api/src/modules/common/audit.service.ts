import { Injectable } from '@nestjs/common';
import { AuditOutcome, Prisma } from '@prisma/client';
import { PrismaService } from '../../infra/db/prisma.service';

type AuditInput = {
  actorUserId?: string | null;
  organizationId?: string | null;
  action: string;
  targetType: string;
  targetId?: string | null;
  outcome: AuditOutcome;
  ipAddress?: string | null;
  metadataJson?: Prisma.InputJsonValue;
};

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async write(input: AuditInput): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        actorUserId: input.actorUserId ?? null,
        organizationId: input.organizationId ?? null,
        action: input.action,
        targetType: input.targetType,
        targetId: input.targetId ?? null,
        outcome: input.outcome,
        ipAddress: input.ipAddress ?? null,
        metadataJson: input.metadataJson
      }
    });
  }
}
