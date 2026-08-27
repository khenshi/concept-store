import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { createHash } from 'node:crypto';
import { OrganizationRole } from '../../../generated/prisma/client';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { OrganizationInvitationsService } from './organization-invitations.service';

describe('OrganizationInvitationsService', () => {
  const organizationId = '580c75b7-1050-4a08-a2c2-585171d84dc8';
  const user = { id: 'user-id', email: 'manager@example.com' };
  const invitation = {
    id: 'cad19536-c64f-4595-9529-40e1f6b0523e',
    organizationId,
    email: user.email,
    role: OrganizationRole.MANAGER,
    expiresAt: new Date('2026-09-03T00:00:00.000Z'),
    acceptedAt: null,
    revokedAt: null,
    createdAt: new Date('2026-08-27T00:00:00.000Z'),
  };
  const transaction = {
    organizationMembership: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    organizationInvitation: {
      updateMany: jest.fn(),
      create: jest.fn(),
      findFirst: jest.fn(),
    },
  };
  const prisma = {
    $transaction: jest.fn(),
    organizationInvitation: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      updateMany: jest.fn(),
      findFirstOrThrow: jest.fn(),
    },
  };
  let service: OrganizationInvitationsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date('2026-08-27T00:00:00.000Z'));
    prisma.$transaction.mockImplementation(
      (operation: (client: typeof transaction) => unknown) =>
        operation(transaction),
    );
    const moduleRef = await Test.createTestingModule({
      providers: [
        OrganizationInvitationsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = moduleRef.get(OrganizationInvitationsService);
  });

  afterEach(() => jest.useRealTimers());

  it('creates a seven-day invitation while storing only a token hash', async () => {
    transaction.organizationMembership.findFirst.mockResolvedValue(null);
    transaction.organizationInvitation.updateMany.mockResolvedValue({
      count: 0,
    });
    transaction.organizationInvitation.create.mockResolvedValue(invitation);

    const created = await service.create(organizationId, user, {
      email: user.email,
      role: OrganizationRole.MANAGER,
    });

    expect(created.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(transaction.organizationInvitation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organizationId,
          email: user.email,
          invitedById: user.id,
          expiresAt: new Date('2026-09-03T00:00:00.000Z'),
          tokenHash: createHash('sha256').update(created.token).digest('hex'),
        }) as unknown,
      }),
    );
    expect(
      JSON.stringify(transaction.organizationInvitation.create.mock.calls),
    ).not.toContain(created.token);
  });

  it('rejects inviting an existing member', async () => {
    transaction.organizationMembership.findFirst.mockResolvedValue({
      userId: user.id,
    });

    await expect(
      service.create(organizationId, user, {
        email: user.email,
        role: OrganizationRole.MANAGER,
      }),
    ).rejects.toThrow(
      new ConflictException(
        'This email already belongs to an organization member',
      ),
    );
    expect(transaction.organizationInvitation.create).not.toHaveBeenCalled();
  });

  it('conceals invalid invitation tokens', async () => {
    await expect(service.preview('not-a-token')).rejects.toThrow(
      new NotFoundException('Invitation is invalid, expired, or unavailable'),
    );
    expect(prisma.organizationInvitation.findFirst).not.toHaveBeenCalled();
  });

  it('requires the signed-in email to match the invitation', async () => {
    transaction.organizationInvitation.findFirst.mockResolvedValue({
      ...invitation,
      tokenHash: 'hash',
      organization: { id: organizationId, name: 'Concept Store' },
    });

    await expect(
      service.accept('a'.repeat(43), {
        id: 'other-user',
        email: 'other@example.com',
      }),
    ).rejects.toThrow(
      new ForbiddenException(
        'Sign in with the email address that received this invitation',
      ),
    );
    expect(transaction.organizationMembership.create).not.toHaveBeenCalled();
  });

  it('claims an invitation and creates the trusted membership atomically', async () => {
    transaction.organizationInvitation.findFirst.mockResolvedValue({
      ...invitation,
      tokenHash: 'hash',
      organization: { id: organizationId, name: 'Concept Store' },
    });
    transaction.organizationMembership.findUnique.mockResolvedValue(null);
    transaction.organizationInvitation.updateMany.mockResolvedValue({
      count: 1,
    });
    transaction.organizationMembership.create.mockResolvedValue({});

    await expect(service.accept('a'.repeat(43), user)).resolves.toEqual({
      organizationId,
      organizationName: 'Concept Store',
      role: OrganizationRole.MANAGER,
    });
    expect(transaction.organizationMembership.create).toHaveBeenCalledWith({
      data: {
        organizationId,
        userId: user.id,
        role: OrganizationRole.MANAGER,
      },
    });
  });
});
