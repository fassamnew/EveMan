import { CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import type { Request } from 'express';

type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();

@Injectable()
export class PublicRegistrationRateLimitGuard implements CanActivate {
  private readonly limit = 20;
  private readonly windowMs = 60_000;

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request & { params?: Record<string, string> }>();
    const slug = typeof req.params?.slug === 'string' ? req.params.slug : 'unknown';
    const key = `${req.ip}:${slug}:public-register`;
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
      throw new HttpException('Too many registration attempts', HttpStatus.TOO_MANY_REQUESTS);
    }

    existing.count += 1;
    return true;
  }
}
