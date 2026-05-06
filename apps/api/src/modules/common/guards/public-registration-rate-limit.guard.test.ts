import { HttpException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import type { ExecutionContext } from '@nestjs/common';
import { PublicRegistrationRateLimitGuard } from './public-registration-rate-limit.guard';

function makeContext(input: { ip: string; slug: string }): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        ip: input.ip,
        params: {
          slug: input.slug
        }
      })
    })
  } as ExecutionContext;
}

describe('PublicRegistrationRateLimitGuard', () => {
  it('allows first request', () => {
    const guard = new PublicRegistrationRateLimitGuard();
    expect(guard.canActivate(makeContext({ ip: '127.0.0.1', slug: 'vip' }))).toBe(true);
  });

  it('blocks when limit is exceeded', () => {
    const guard = new PublicRegistrationRateLimitGuard();
    const context = makeContext({ ip: '10.0.0.2', slug: 'expo' });

    for (let i = 0; i < 20; i += 1) {
      guard.canActivate(context);
    }

    expect(() => guard.canActivate(context)).toThrow(HttpException);
  });
});
