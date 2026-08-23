import { NotFoundException } from '@nestjs/common';
import { OrganizationRole } from '@prisma/client';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { OrganizationsService } from './organizations.service';

describe('OrganizationsService', () => {
  const organization = {
    id: 'organization-id',
    name: 'Concept Collective',
    createdAt: new Date('2026-08-23T00:00:00.000Z'),
    updatedAt: new Date('2026-08-23T00:00:00.000Z'),
  };
  const transaction = {
    organization: { create: jest.fn() },
    organizationMembership: { create: jest.fn() },
  };
  const prisma = {
    $transaction: jest.fn(),
    organizationMembership: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
  };
  let service: OrganizationsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation(
      (callback: (client: typeof transaction) => unknown) =>
        callback(transaction),
    );
    const moduleRef = await Test.createTestingModule({
      providers: [
        OrganizationsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = moduleRef.get(OrganizationsService);
  });

  it('creates the organization and owner membership atomically', async () => {
    transaction.organization.create.mockResolvedValue(organization);
    transaction.organizationMembership.create.mockResolvedValue({
      organizationId: organization.id,
      userId: 'user-id',
      role: OrganizationRole.OWNER,
    });

    await expect(
      service.create('user-id', { name: organization.name }),
    ).resolves.toEqual({ ...organization, role: OrganizationRole.OWNER });
    expect(transaction.organizationMembership.create).toHaveBeenCalledWith({
      data: {
        organizationId: organization.id,
        userId: 'user-id',
        role: OrganizationRole.OWNER,
      },
    });
  });

  it('lists only memberships for the authenticated user', async () => {
    prisma.organizationMembership.findMany.mockResolvedValue([
      { organization, role: OrganizationRole.OWNER },
    ]);

    await expect(service.findAllForUser('user-id')).resolves.toEqual([
      { ...organization, role: OrganizationRole.OWNER },
    ]);
    expect(prisma.organizationMembership.findMany).toHaveBeenCalledWith({
      where: { userId: 'user-id' },
      include: { organization: true },
      orderBy: { organization: { createdAt: 'asc' } },
    });
  });

  it('retrieves an organization through the user membership key', async () => {
    prisma.organizationMembership.findUnique.mockResolvedValue({
      organization,
      role: OrganizationRole.MANAGER,
    });

    await expect(
      service.findOneForUser('user-id', organization.id),
    ).resolves.toEqual({ ...organization, role: OrganizationRole.MANAGER });
    expect(prisma.organizationMembership.findUnique).toHaveBeenCalledWith({
      where: {
        organizationId_userId: {
          organizationId: organization.id,
          userId: 'user-id',
        },
      },
      include: { organization: true },
    });
  });

  it('does not reveal an organization without membership', async () => {
    prisma.organizationMembership.findUnique.mockResolvedValue(null);

    await expect(
      service.findOneForUser('user-id', organization.id),
    ).rejects.toThrow(new NotFoundException('Organization not found'));
  });
});
