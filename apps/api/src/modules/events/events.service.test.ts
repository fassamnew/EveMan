import { ForbiddenException, BadRequestException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { EventsService } from './events.service';

function createHarness() {
  const prisma = {
    organization: {
      findUnique: vi.fn()
    },
    event: {
      create: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn()
    },
    registrationLink: {
      create: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn()
    }
  } as any;

  const audit = {
    write: vi.fn()
  } as any;

  const policy = {
    canManageEventSettings: vi.fn(),
    canAccessTenant: vi.fn()
  } as any;

  return {
    prisma,
    audit,
    policy,
    service: new EventsService(prisma, audit, policy)
  };
}

describe('EventsService permissions and validation', () => {
  it('blocks event creation for staff-level auth', async () => {
    const { service, policy } = createHarness();

    policy.canManageEventSettings.mockReturnValue(false);

    await expect(
      service.createEvent(
        'acme',
        { name: 'Acme Summit' },
        {
          auth: {
            userId: 'u1',
            email: 'staff@acme.com',
            roles: ['ORG_STAFF'],
            organizationId: 'org-id',
            organizationCode: 'acme'
          },
          ip: '127.0.0.1'
        } as any
      )
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects invalid event windows', async () => {
    const { service, policy } = createHarness();

    policy.canManageEventSettings.mockReturnValue(true);

    await expect(
      service.createEvent(
        'acme',
        {
          name: 'Acme Summit',
          startsAt: '2026-05-10T10:00:00.000Z',
          endsAt: '2026-05-09T10:00:00.000Z'
        },
        {
          auth: {
            userId: 'u1',
            email: 'admin@acme.com',
            roles: ['ORG_ADMIN'],
            organizationId: 'org-id',
            organizationCode: 'acme'
          },
          ip: '127.0.0.1'
        } as any
      )
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects invalid link windows', async () => {
    const { service, policy } = createHarness();

    policy.canManageEventSettings.mockReturnValue(true);

    await expect(
      service.createLink(
        'acme',
        'event-id',
        {
          title: 'VIP',
          slug: 'vip',
          opensAt: '2026-05-10T10:00:00.000Z',
          closesAt: '2026-05-09T10:00:00.000Z'
        },
        {
          auth: {
            userId: 'u1',
            email: 'admin@acme.com',
            roles: ['ORG_ADMIN'],
            organizationId: 'org-id',
            organizationCode: 'acme'
          },
          ip: '127.0.0.1'
        } as any
      )
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
