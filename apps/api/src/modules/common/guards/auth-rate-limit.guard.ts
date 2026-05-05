import { CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import type { Request } from 'express';

type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();

@Injectable()
export class AuthRateLimitGuard implements CanActivate {
  private readonly limit = 10;
  private readonly windowMs = 60_000;

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request & { body?: Record<string, unknown> }>();
    const email = typeof req.body?.email === 'string' ? req.body.email : 'unknown';
    const key = `${req.ip}:${email}`;
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
      throw new HttpException('Too many authentication attempts', HttpStatus.TOO_MANY_REQUESTS);
    }

    existing.count += 1;
    return true;
  }
}
