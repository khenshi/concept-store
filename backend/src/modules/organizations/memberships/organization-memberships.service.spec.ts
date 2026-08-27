import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { OrganizationRole, Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { OrganizationMembershipsService } from './organization-memberships.service';

describe('OrganizationMembershipsService', () => {
  const organizationId = '580c75b7-1050-4a08-a2c2-585171d84dc8';
  const user = {
    id: '9bc85010-28e5-4c41-8320-8abcc30feede',
    email: 'member@example.com',
    firstName: 'Maria',
    lastName: 'Santos',
    phone: null,
  };
  const joinedAt = new Date('2026-08-23T00:00:00.000Z');
  const transaction = {
    organizationMembership: {
      findUnique: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };
  const prisma = {
    $transaction: jest.fn(),
    user: { findUnique: jest.fn() },
    organizationMembership: {
      findMany: jest.fn(),
      create: jest.fn(),
    },
  };
  let service: OrganizationMembershipsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation(
      (callback: (client: typeof transaction) => unknown) =>
        callback(transaction),
    );
    const moduleRef = await Test.createTestingModule({
      providers: [
        OrganizationMembershipsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = moduleRef.get(OrganizationMembershipsService);
  });

  it('lists organization members without password data', async () => {
    prisma.organizationMembership.findMany.mockResolvedValue([
      { user, role: OrganizationRole.MANAGER, createdAt: joinedAt },
    ]);

    await expect(service.findAll(organizationId)).resolves.toEqual([
      { ...user, role: OrganizationRole.MANAGER, joinedAt },
    ]);
    expect(prisma.organizationMembership.findMany).toHaveBeenCalledWith({
      where: { organizationId },
      select: {
        role: true,
        createdAt: true,
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            phone: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  });

  it('adds an existing user to the organization', async () => {
    prisma.user.findUnique.mockResolvedValue(user);
    prisma.organizationMembership.create.mockResolvedValue({
      role: OrganizationRole.CASHIER,
      createdAt: joinedAt,
    });

    await expect(
      service.add(organizationId, {
        email: user.email,
        role: OrganizationRole.CASHIER,
      }),
    ).resolves.toEqual({
      ...user,
      role: OrganizationRole.CASHIER,
      joinedAt,
    });
    expect(prisma.organizationMembership.create).toHaveBeenCalledWith({
      data: {
        organizationId,
        userId: user.id,
        role: OrganizationRole.CASHIER,
      },
      select: { role: true, createdAt: true },
    });
  });

  it('does not add an email without an existing user account', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(
      service.add(organizationId, {
        email: 'missing@example.com',
        role: OrganizationRole.MANAGER,
      }),
    ).rejects.toThrow(new NotFoundException('User not found'));
  });

  it('updates a member role in a serializable transaction', async () => {
    transaction.organizationMembership.findUnique.mockResolvedValue({
      user,
      role: OrganizationRole.MANAGER,
      createdAt: joinedAt,
    });
    transaction.organizationMembership.update.mockResolvedValue({
      role: OrganizationRole.CASHIER,
      createdAt: joinedAt,
    });

    await expect(
      service.updateRole(organizationId, user.id, {
        role: OrganizationRole.CASHIER,
      }),
    ).resolves.toEqual({
      ...user,
      role: OrganizationRole.CASHIER,
      joinedAt,
    });
    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
  });

  it('prevents demoting the last owner', async () => {
    transaction.organizationMembership.findUnique.mockResolvedValue({
      user,
      role: OrganizationRole.OWNER,
      createdAt: joinedAt,
    });
    transaction.organizationMembership.count.mockResolvedValue(1);

    await expect(
      service.updateRole(organizationId, user.id, {
        role: OrganizationRole.MANAGER,
      }),
    ).rejects.toThrow(
      new ConflictException('An organization must retain at least one owner'),
    );
    expect(transaction.organizationMembership.update).not.toHaveBeenCalled();
  });

  it('prevents removing the last owner', async () => {
    transaction.organizationMembership.findUnique.mockResolvedValue({
      user,
      role: OrganizationRole.OWNER,
      createdAt: joinedAt,
    });
    transaction.organizationMembership.count.mockResolvedValue(1);

    await expect(service.remove(organizationId, user.id)).rejects.toThrow(
      new ConflictException('An organization must retain at least one owner'),
    );
    expect(transaction.organizationMembership.delete).not.toHaveBeenCalled();
  });

  it('returns not found for a user outside the organization', async () => {
    transaction.organizationMembership.findUnique.mockResolvedValue(null);

    await expect(
      service.updateRole(organizationId, user.id, {
        role: OrganizationRole.MANAGER,
      }),
    ).rejects.toThrow(new NotFoundException('Organization member not found'));
  });
});
