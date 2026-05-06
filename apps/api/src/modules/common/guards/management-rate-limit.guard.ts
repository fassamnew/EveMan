import { CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import type { Request } from 'express';

type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();

@Injectable()
export class ManagementRateLimitGuard implements CanActivate {
  private readonly limit = 60;
  private readonly windowMs = 60_000;

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request & { params?: Record<string, string> }>();
    const orgCode = typeof req.params?.orgCode === 'string' ? req.params.orgCode : 'global';
    const key = `${req.ip}:${orgCode}:management`;
    const now = Date.now();

    const existing = buckets.get(key);
    if (!existing || existing.resetAt < now) {
      buckets.set(key, {
        count: 1,
        resetAt: now + this.windowMs
      });
      return true;
    }

    if (existing.count >= this.limit) {
      throw new HttpException('Too many management requests', HttpStatus.TOO_MANY_REQUESTS);
    }

    existing.count += 1;
    return true;
  }
}
