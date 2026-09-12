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
    $queryRaw: jest.fn(),
    branchMembership: { deleteMany: jest.fn(), upsert: jest.fn() },
    branch: { findUnique: jest.fn(), findMany: jest.fn() },
    merchant: { findUnique: jest.fn() },
    organizationMembership: {
      findUnique: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };
  const prisma = {
    $transaction: jest.fn(),
    organizationMembership: {
      findMany: jest.fn(),
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
        merchantId: true,
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

  it('grants and revokes only tenant-local branches after locking the membership', async () => {
    transaction.organizationMembership.findUnique.mockResolvedValue({
      user,
      role: 'MANAGER',
      createdAt: joinedAt,
    });
    transaction.branch.findUnique.mockResolvedValue({ id: user.id });
    await service.setBranch(organizationId, user.id, user.id, true);
    expect(transaction.$queryRaw).toHaveBeenCalled();
    expect(transaction.branchMembership.upsert).toHaveBeenCalledWith({
      where: {
        organizationId_branchId_userId: {
          organizationId,
          userId: user.id,
          branchId: user.id,
        },
      },
      create: { organizationId, userId: user.id, branchId: user.id },
      update: {},
    });
    await service.setBranch(organizationId, user.id, user.id, false);
    expect(transaction.branchMembership.deleteMany).toHaveBeenCalledWith({
      where: { organizationId, userId: user.id, branchId: user.id },
    });
    transaction.branch.findUnique.mockResolvedValue(null);
    await expect(
      service.setBranch(organizationId, user.id, user.id, true),
    ).rejects.toThrow(NotFoundException);
  });

  it('rejects explicit owner assignments and nonmerchant links', async () => {
    transaction.organizationMembership.findUnique.mockResolvedValue({
      user,
      role: 'OWNER',
      createdAt: joinedAt,
    });
    await expect(
      service.setBranch(organizationId, user.id, user.id, true),
    ).rejects.toThrow(ConflictException);
    await expect(
      service.setMerchant(organizationId, user.id, user.id),
    ).rejects.toThrow(ConflictException);
  });

  it('validates merchant role commands and clears assignments on role change', async () => {
    transaction.organizationMembership.findUnique.mockResolvedValue({
      user,
      role: 'MANAGER',
      createdAt: joinedAt,
    });
    transaction.merchant.findUnique.mockResolvedValue({ id: user.id });
    transaction.organizationMembership.update.mockResolvedValue({
      role: 'MERCHANT',
      merchantId: user.id,
      createdAt: joinedAt,
    });
    await expect(
      service.updateRole(organizationId, user.id, { role: 'MERCHANT' }),
    ).rejects.toThrow('requires merchantId');
    await expect(
      service.updateRole(organizationId, user.id, {
        role: 'MANAGER',
        merchantId: user.id,
      }),
    ).rejects.toThrow('only allowed');
    await service.updateRole(organizationId, user.id, {
      role: 'MERCHANT',
      merchantId: user.id,
    });
    expect(transaction.branchMembership.deleteMany).toHaveBeenCalledWith({
      where: { organizationId, userId: user.id },
    });
    expect(transaction.organizationMembership.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { role: 'MERCHANT', merchantId: user.id },
      }),
    );
  });

  it('relinks only a same-tenant merchant and maps serialization failures to conflict', async () => {
    transaction.organizationMembership.findUnique.mockResolvedValue({
      user,
      role: 'MERCHANT',
      createdAt: joinedAt,
    });
    transaction.merchant.findUnique.mockResolvedValue(null);
    await expect(
      service.setMerchant(organizationId, user.id, user.id),
    ).rejects.toThrow(NotFoundException);
    transaction.merchant.findUnique.mockResolvedValue({ id: user.id });
    await expect(
      service.setMerchant(organizationId, user.id, user.id),
    ).resolves.toEqual({ merchantId: user.id });
    prisma.$transaction.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError('conflict', {
        code: 'P2034',
        clientVersion: 'test',
      }),
    );
    await expect(service.remove(organizationId, user.id)).rejects.toThrow(
      ConflictException,
    );
  });
});
