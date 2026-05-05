import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { AuthService } from './auth.service';

function createServiceHarness() {
  const prisma = {
    user: {
      findUnique: vi.fn(),
      update: vi.fn()
    },
    refreshToken: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn()
    }
  } as any;

  const passwordService = {
    verify: vi.fn()
  } as any;

  const tokenService = {
    signAccessToken: vi.fn(),
    createRefreshToken: vi.fn(),
    hashToken: vi.fn()
  } as any;

  const audit = {
    write: vi.fn()
  } as any;

  return {
    prisma,
    passwordService,
    tokenService,
    audit,
    service: new AuthService(prisma, passwordService, tokenService, audit)
  };
}

describe('AuthService.login', () => {
  it('logs in org user with valid orgId and returns tokens', async () => {
    const { service, prisma, passwordService, tokenService } = createServiceHarness();

    prisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      email: 'staff@example.com',
      passwordHash: 'hash',
      firstName: 'Org',
      lastName: 'Staff',
      isActive: true,
      lockedUntil: null,
      userRoles: [
        {
          role: { name: 'ORG_ADMIN' },
          organizationId: 'org-id',
          organization: { code: 'acme' }
        }
      ]
    });

    passwordService.verify.mockResolvedValue(true);
    tokenService.signAccessToken.mockReturnValue('access-token');
    tokenService.createRefreshToken.mockReturnValue({
      token: 'refresh-token',
      tokenHash: 'refresh-hash',
      expiresAt: new Date('2099-01-01T00:00:00.000Z')
    });

    const response = await service.login(
      {
        email: 'staff@example.com',
        password: 'StrongPass123',
        orgId: 'org-id'
      },
      { ip: '127.0.0.1' } as any
    );

    expect(response.accessToken).toBe('access-token');
    expect(response.refreshToken).toBe('refresh-token');
    expect(response.user.organizationCode).toBe('acme');
    expect(prisma.refreshToken.create).toHaveBeenCalledTimes(1);
  });

  it('requires orgId for non-super-admin login', async () => {
    const { service, prisma, passwordService } = createServiceHarness();

    prisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      email: 'staff@example.com',
      passwordHash: 'hash',
      firstName: null,
      lastName: null,
      isActive: true,
      lockedUntil: null,
      userRoles: [
        {
          role: { name: 'ORG_STAFF' },
          organizationId: 'org-id',
          organization: { code: 'acme' }
        }
      ]
    });

    passwordService.verify.mockResolvedValue(true);

    await expect(
      service.login(
        {
          email: 'staff@example.com',
          password: 'StrongPass123'
        },
        { ip: '127.0.0.1' } as any
      )
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('locks account path on repeated invalid password attempt', async () => {
    const { service, prisma, passwordService } = createServiceHarness();

    prisma.user.findUnique.mockImplementation((args: { select?: unknown }) => {
      if (args.select) {
        return Promise.resolve({ failedLoginCount: 4 });
      }

      return Promise.resolve({
        id: 'u1',
        email: 'staff@example.com',
        passwordHash: 'hash',
        firstName: null,
        lastName: null,
        isActive: true,
        lockedUntil: null,
        userRoles: [
          {
            role: { name: 'ORG_STAFF' },
            organizationId: 'org-id',
            organization: { code: 'acme' }
          }
        ]
      });
    });

    passwordService.verify.mockResolvedValue(false);

    await expect(
      service.login(
        {
          email: 'staff@example.com',
          password: 'WrongPass123',
          orgId: 'org-id'
        },
        { ip: '127.0.0.1' } as any
      )
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          failedLoginCount: 5,
          lockedUntil: expect.any(Date)
        })
      })
    );
  });
});

describe('AuthService.refreshToken + logout', () => {
  it('rotates refresh token and revokes prior token', async () => {
    const { service, prisma, tokenService } = createServiceHarness();

    tokenService.hashToken.mockReturnValue('hash-old');
    tokenService.createRefreshToken.mockReturnValue({
      token: 'refresh-new',
      tokenHash: 'hash-new',
      expiresAt: new Date('2099-01-01T00:00:00.000Z')
    });
    tokenService.signAccessToken.mockReturnValue('access-new');

    prisma.refreshToken.findUnique.mockResolvedValue({
      id: 'rt-old',
      userId: 'u1',
      organizationId: 'org-id',
      expiresAt: new Date('2099-01-01T00:00:00.000Z'),
      revokedAt: null,
      organization: { code: 'acme' },
      user: {
        id: 'u1',
        email: 'staff@example.com',
        userRoles: [
          {
            role: { name: 'ORG_ADMIN' },
            organizationId: 'org-id',
            organization: { code: 'acme' }
          }
        ]
      }
    });

    prisma.refreshToken.create.mockResolvedValue({ id: 'rt-new' });

    const response = await service.refreshToken('old-token', { ip: '127.0.0.1' } as any);

    expect(response.accessToken).toBe('access-new');
    expect(response.refreshToken).toBe('refresh-new');
    expect(prisma.refreshToken.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'rt-old' } })
    );
  });

  it('revokes refresh token on logout', async () => {
    const { service, prisma, tokenService } = createServiceHarness();

    tokenService.hashToken.mockReturnValue('hash-logout');
    prisma.refreshToken.updateMany.mockResolvedValue({ count: 1 });

    await service.logout('raw-token', {
      ip: '127.0.0.1',
      auth: { userId: 'u1', organizationId: 'org-id' }
    } as any);

    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          tokenHash: 'hash-logout',
          revokedAt: null
        }
      })
    );
  });
});
