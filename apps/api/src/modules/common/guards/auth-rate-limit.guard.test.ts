import { HttpException, HttpStatus } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { AuthRateLimitGuard } from './auth-rate-limit.guard';

type GuardRequest = {
  ip: string;
  body?: Record<string, unknown>;
};

function createContext(request: GuardRequest) {
  return {
    switchToHttp: () => ({
      getRequest: () => request
    })
  };
}

describe('AuthRateLimitGuard', () => {
  it('allows attempts within threshold', () => {
    const guard = new AuthRateLimitGuard();
    const request = {
      ip: '127.0.0.1',
      body: { email: 'threshold@example.com' }
    };

    for (let i = 0; i < 10; i += 1) {
      const allowed = guard.canActivate(createContext(request) as never);
      expect(allowed).toBe(true);
    }
  });

  it('blocks attempts over threshold with 429', () => {
    const guard = new AuthRateLimitGuard();
    const request = {
      ip: '127.0.0.2',
      body: { email: 'blocked@example.com' }
    };

    for (let i = 0; i < 10; i += 1) {
      expect(guard.canActivate(createContext(request) as never)).toBe(true);
    }

    try {
      guard.canActivate(createContext(request) as never);
      throw new Error('Expected guard to throw on attempt above limit');
    } catch (error) {
      expect(error).toBeInstanceOf(HttpException);
      const httpError = error as HttpException;
      expect(httpError.getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
    }
  });

  it('isolates buckets by email value', () => {
    const guard = new AuthRateLimitGuard();
    const ip = '127.0.0.3';

    const requestA = {
      ip,
      body: { email: 'alpha@example.com' }
    };

    const requestB = {
      ip,
      body: { email: 'beta@example.com' }
    };

    for (let i = 0; i < 10; i += 1) {
      expect(guard.canActivate(createContext(requestA) as never)).toBe(true);
    }

    expect(guard.canActivate(createContext(requestB) as never)).toBe(true);
  });
});
