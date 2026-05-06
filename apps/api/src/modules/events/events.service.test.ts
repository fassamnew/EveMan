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

  it('returns slug suggestions for duplicate link slugs', async () => {
    const { service, policy, prisma } = createHarness();

    policy.canManageEventSettings.mockReturnValue(true);
    prisma.organization.findUnique.mockResolvedValue({ id: 'org-id', code: 'acme' });
    prisma.event.findFirst.mockResolvedValue({ id: 'event-id', organizationId: 'org-id' });
    prisma.registrationLink.create.mockRejectedValue({ code: 'P2002' });
    prisma.registrationLink.findMany.mockResolvedValue([
      { slug: 'vip-registration' },
      { slug: 'vip-registration-1' }
    ]);

    try {
      await service.createLink(
        'acme',
        'event-id',
        {
          title: 'VIP',
          slug: 'vip-registration'
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
      );

      throw new Error('Expected duplicate slug to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(BadRequestException);
      const response = (error as BadRequestException).getResponse() as {
        message: string;
        suggestions: string[];
      };
      expect(response.message).toBe('Link slug must be unique for the event');
      expect(response.suggestions).toEqual(['vip-registration-2', 'vip-registration-3', 'vip-registration-4']);
    }
  });
});
