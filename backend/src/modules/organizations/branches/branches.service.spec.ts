import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  BranchStatus,
  OrganizationRole,
  Prisma,
} from '../../../generated/prisma/client';
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
    status: BranchStatus.ACTIVE,
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
      count: jest.fn(),
    },
    $transaction: jest.fn((queries: Promise<unknown>[]) =>
      Promise.all(queries),
    ),
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

  it('returns a scoped, searchable page with summary and distinct merchant counts', async () => {
    const directoryBranch = {
      ...branch,
      _count: { merchants: 2 },
    };
    prisma.branch.count
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(0);
    prisma.branch.findMany.mockResolvedValueOnce([directoryBranch]);

    const result = await service.findDirectory(
      {
        organizationId,
        userId: 'user-id',
        role: OrganizationRole.OWNER,
        merchantId: null,
      },
      { page: 1, q: 'Makati' },
    );

    expect(result).toEqual({
      items: [{ ...branch, merchantCount: 2 }],
      page: 1,
      limit: 15,
      total: 1,
      totalPages: 1,
      hasNext: false,
      summary: { total: 2, active: 2, inactive: 0 },
    });
    expect(prisma.branch.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
        skip: 0,
        take: 15,
      }),
    );
  });

  it('uses assigned-branch scope and status filters for managers', async () => {
    prisma.branch.count.mockResolvedValue(0);
    prisma.branch.findMany.mockResolvedValue([]);

    await service.findDirectory(
      {
        organizationId,
        userId: 'manager-id',
        role: OrganizationRole.MANAGER,
        merchantId: null,
      },
      { page: 2, q: 'Makati', status: BranchStatus.INACTIVE },
    );

    type DirectoryFindManyArgs = {
      where: { AND: Array<Record<string, unknown>> };
      skip: number;
    };
    const [findManyArgs] = prisma.branch.findMany.mock.calls.at(
      -1,
    ) as unknown as [DirectoryFindManyArgs];
    expect(findManyArgs.where.AND).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ organizationId }),
        expect.objectContaining({ status: BranchStatus.INACTIVE }),
      ]),
    );
    expect(
      findManyArgs.where.AND.some(
        (entry) => 'OR' in entry && Array.isArray(entry.OR),
      ),
    ).toBe(true);
    expect(findManyArgs.skip).toBe(15);
  });

  it('changes status only inside the authorized branch scope', async () => {
    prisma.branch.findFirst.mockResolvedValue(branch);
    prisma.branch.update.mockResolvedValue({
      ...branch,
      status: BranchStatus.INACTIVE,
    });

    await expect(
      service.updateStatus(
        organizationId,
        branchId,
        {
          organizationId,
          userId: 'manager-id',
          role: OrganizationRole.MANAGER,
          merchantId: null,
        },
        { status: BranchStatus.INACTIVE },
      ),
    ).resolves.toMatchObject({ status: BranchStatus.INACTIVE });
    expect(prisma.branch.update).toHaveBeenCalledWith({
      where: { id: branchId, organizationId },
      data: { status: BranchStatus.INACTIVE },
    });
  });

  it('does not change status for an unassigned or foreign branch', async () => {
    prisma.branch.findFirst.mockResolvedValue(null);

    await expect(
      service.updateStatus(
        organizationId,
        branchId,
        {
          organizationId,
          userId: 'manager-id',
          role: OrganizationRole.MANAGER,
          merchantId: null,
        },
        { status: BranchStatus.INACTIVE },
      ),
    ).rejects.toThrow(new NotFoundException('Branch not found'));
    expect(prisma.branch.update).not.toHaveBeenCalled();
  });
});
