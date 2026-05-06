import { HttpException, HttpStatus } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { ManagementRateLimitGuard } from './management-rate-limit.guard';

function createContext(input: { ip: string; orgCode?: string }) {
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        ip: input.ip,
        params: input.orgCode ? { orgCode: input.orgCode } : {}
      })
    })
  };
}

describe('ManagementRateLimitGuard', () => {
  it('allows requests within threshold', () => {
    const guard = new ManagementRateLimitGuard();

    for (let i = 0; i < 60; i += 1) {
      expect(guard.canActivate(createContext({ ip: '127.0.0.11', orgCode: 'acme' }) as never)).toBe(true);
    }
  });

  it('blocks requests over threshold with 429', () => {
    const guard = new ManagementRateLimitGuard();

    for (let i = 0; i < 60; i += 1) {
      expect(guard.canActivate(createContext({ ip: '127.0.0.12', orgCode: 'acme' }) as never)).toBe(true);
    }

    try {
      guard.canActivate(createContext({ ip: '127.0.0.12', orgCode: 'acme' }) as never);
      throw new Error('Expected rate limiter to block request');
    } catch (error) {
      expect(error).toBeInstanceOf(HttpException);
      expect((error as HttpException).getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
    }
  });

  it('isolates limits by organization scope', () => {
    const guard = new ManagementRateLimitGuard();

    for (let i = 0; i < 60; i += 1) {
      expect(guard.canActivate(createContext({ ip: '127.0.0.13', orgCode: 'acme' }) as never)).toBe(true);
    }

    expect(guard.canActivate(createContext({ ip: '127.0.0.13', orgCode: 'rocket' }) as never)).toBe(true);
  });
});
