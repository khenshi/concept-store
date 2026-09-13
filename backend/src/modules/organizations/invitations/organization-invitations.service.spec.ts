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
    merchantId: null,
    merchant: null,
    branches: [],
    expiresAt: new Date('2026-09-03T00:00:00.000Z'),
    acceptedAt: null,
    revokedAt: null,
    createdAt: new Date('2026-08-27T00:00:00.000Z'),
  };
  const transaction = {
    merchant: { findUnique: jest.fn() },
    branch: { count: jest.fn() },
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

  it('validates merchant and branch grants before persisting invitations', async () => {
    await expect(
      service.create(organizationId, user, {
        email: user.email,
        role: 'MERCHANT',
      }),
    ).rejects.toThrow('requires merchantId');
    await expect(
      service.create(organizationId, user, {
        email: user.email,
        role: 'MANAGER',
        merchantId: invitation.id,
      }),
    ).rejects.toThrow('only allowed');
    transaction.merchant.findUnique.mockResolvedValue(null);
    await expect(
      service.create(organizationId, user, {
        email: user.email,
        role: 'MERCHANT',
        merchantId: invitation.id,
      }),
    ).rejects.toThrow(NotFoundException);
    transaction.merchant.findUnique.mockResolvedValue({ id: invitation.id });
    transaction.branch.count.mockResolvedValue(0);
    await expect(
      service.create(organizationId, user, {
        email: user.email,
        role: 'MERCHANT',
        merchantId: invitation.id,
        branchIds: [invitation.id],
      }),
    ).rejects.toThrow(NotFoundException);
    transaction.branch.count.mockResolvedValue(1);
    transaction.organizationMembership.findFirst.mockResolvedValue(null);
    transaction.organizationInvitation.create.mockResolvedValue(invitation);
    await service.create(organizationId, user, {
      email: user.email,
      role: 'MERCHANT',
      merchantId: invitation.id,
      branchIds: [invitation.id],
    });
    expect(transaction.organizationInvitation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          merchantId: invitation.id,
          branches: { create: [{ branchId: invitation.id }] },
        }) as unknown,
      }),
    );
  });

  it('accepts configured merchant grants without exposing them in public previews', async () => {
    const linked = {
      ...invitation,
      role: 'MERCHANT',
      merchantId: invitation.id,
      branches: [{ branchId: invitation.id }],
      organization: { id: organizationId, name: 'Store' },
    };
    prisma.organizationInvitation.findFirst.mockResolvedValue(linked);
    expect(await service.preview('a'.repeat(43))).toEqual({
      organizationName: 'Store',
      email: user.email,
      role: 'MERCHANT',
      expiresAt: invitation.expiresAt,
    });
    transaction.organizationInvitation.findFirst.mockResolvedValue(linked);
    transaction.organizationMembership.findUnique.mockResolvedValue(null);
    transaction.organizationInvitation.updateMany.mockResolvedValue({
      count: 1,
    });
    await service.accept('a'.repeat(43), user);
    expect(transaction.organizationMembership.create).toHaveBeenCalledWith({
      data: {
        organizationId,
        userId: user.id,
        role: 'MERCHANT',
        merchantId: invitation.id,
        branches: { create: [{ branchId: invitation.id }] },
      },
    });
  });

  it('rejects legacy unlinked merchant invites before claiming them', async () => {
    transaction.organizationInvitation.findFirst.mockResolvedValue({
      ...invitation,
      role: 'MERCHANT',
      organization: { id: organizationId, name: 'Store' },
    });
    await expect(service.accept('a'.repeat(43), user)).rejects.toThrow(
      'send a new invitation',
    );
    expect(
      transaction.organizationInvitation.updateMany,
    ).not.toHaveBeenCalled();
  });

  it('conceals invalid invitation tokens', async () => {
    await expect(service.preview('not-a-token')).rejects.toThrow(
      new NotFoundException('Invitation is invalid, expired, or unavailable'),
    );
    expect(prisma.organizationInvitation.findFirst).not.toHaveBeenCalled();
  });

  it('rejects expired, revoked, or accepted tokens without creating a membership', async () => {
    transaction.organizationInvitation.findFirst.mockResolvedValue(null);
    await expect(service.accept('a'.repeat(43), user)).rejects.toThrow(
      NotFoundException,
    );
    expect(transaction.organizationMembership.create).not.toHaveBeenCalled();
    expect(transaction.organizationInvitation.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          acceptedAt: null,
          revokedAt: null,
          expiresAt: { gt: new Date() },
        }) as unknown,
      }),
    );
  });

  it('does not overwrite an existing membership or accept a lost claim', async () => {
    transaction.organizationInvitation.findFirst.mockResolvedValue({
      ...invitation,
      organization: { id: organizationId, name: 'Store' },
    });
    transaction.organizationMembership.findUnique.mockResolvedValue({
      userId: user.id,
    });
    await expect(service.accept('a'.repeat(43), user)).rejects.toThrow(
      ConflictException,
    );
    expect(
      transaction.organizationInvitation.updateMany,
    ).not.toHaveBeenCalled();
    transaction.organizationMembership.findUnique.mockResolvedValue(null);
    transaction.organizationInvitation.updateMany.mockResolvedValue({
      count: 0,
    });
    await expect(service.accept('a'.repeat(43), user)).rejects.toThrow(
      NotFoundException,
    );
    expect(transaction.organizationMembership.create).not.toHaveBeenCalled();
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
        merchantId: null,
        branches: { create: [] },
      },
    });
  });
});
