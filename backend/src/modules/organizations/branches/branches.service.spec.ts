import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { BranchesService } from './branches.service';

describe('BranchesService', () => {
  const organizationId = '580c75b7-1050-4a08-a2c2-585171d84dc8';
  const branchId = '2f671678-91d3-4d04-a8f9-787a2e9f3c1a';
  const branch = {
    id: branchId,
    organizationId,
    name: 'Makati',
    code: 'MKT-01',
    addressLine1: '123 Retail Street',
    addressLine2: null,
    city: 'Makati',
    province: 'Metro Manila',
    postalCode: '1200',
    countryCode: 'PH',
    createdAt: new Date('2026-08-24T00:00:00.000Z'),
    updatedAt: new Date('2026-08-24T00:00:00.000Z'),
  };
  const createInput = {
    name: branch.name,
    code: branch.code,
    addressLine1: branch.addressLine1,
    city: branch.city,
    province: branch.province,
    postalCode: branch.postalCode ?? undefined,
    countryCode: branch.countryCode,
  };
  const prisma = {
    branch: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
  };
  let service: BranchesService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        BranchesService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = moduleRef.get(BranchesService);
  });

  it('creates a branch inside the trusted organization', async () => {
    prisma.branch.create.mockResolvedValue(branch);

    await expect(service.create(organizationId, createInput)).resolves.toEqual(
      branch,
    );
    expect(prisma.branch.create).toHaveBeenCalledWith({
      data: { organizationId, ...createInput },
    });
  });

  it('lists only branches in the trusted organization', async () => {
    prisma.branch.findMany.mockResolvedValue([branch]);

    await expect(service.findAll(organizationId)).resolves.toEqual([branch]);
    expect(prisma.branch.findMany).toHaveBeenCalledWith({
      where: { organizationId },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    });
  });

  it('does not reveal a branch outside the organization', async () => {
    prisma.branch.findFirst.mockResolvedValue(null);

    await expect(service.findOne(organizationId, branchId)).rejects.toThrow(
      new NotFoundException('Branch not found'),
    );
    expect(prisma.branch.findFirst).toHaveBeenCalledWith({
      where: { id: branchId, organizationId },
    });
  });

  it('updates using both the branch and organization IDs', async () => {
    prisma.branch.findFirst.mockResolvedValue(branch);
    prisma.branch.update.mockResolvedValue({ ...branch, name: 'Makati Main' });

    await expect(
      service.update(organizationId, branchId, { name: 'Makati Main' }),
    ).resolves.toMatchObject({ name: 'Makati Main' });
    expect(prisma.branch.update).toHaveBeenCalledWith({
      where: { id: branchId, organizationId },
      data: { name: 'Makati Main' },
    });
  });

  it('rejects an empty update', async () => {
    await expect(service.update(organizationId, branchId, {})).rejects.toThrow(
      new BadRequestException('At least one branch field is required'),
    );
    expect(prisma.branch.findFirst).not.toHaveBeenCalled();
  });

  it('maps scoped uniqueness violations to conflict', async () => {
    prisma.branch.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: '7.9.1',
      }),
    );

    await expect(service.create(organizationId, createInput)).rejects.toThrow(
      new ConflictException(
        'Branch name or code already exists in this organization',
      ),
    );
  });
});
