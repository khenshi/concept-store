import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { OrganizationRole } from '../../generated/prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { OrganizationsService } from './organizations.service';

describe('OrganizationsService', () => {
  const organization = {
    id: 'organization-id',
    name: 'Concept Collective',
    createdAt: new Date('2026-08-23T00:00:00.000Z'),
    updatedAt: new Date('2026-08-23T00:00:00.000Z'),
  };
  const prisma = {
    $transaction: jest.fn(),
    $queryRaw: jest.fn(),
    organization: { update: jest.fn() },
    organizationMembership: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
  };
  let service: OrganizationsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation(
      (operation: (client: typeof prisma) => unknown) => operation(prisma),
    );
    prisma.$queryRaw.mockResolvedValue([
      { id: organization.id, status: 'ACTIVE' },
    ]);
    const moduleRef = await Test.createTestingModule({
      providers: [
        OrganizationsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = moduleRef.get(OrganizationsService);
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
