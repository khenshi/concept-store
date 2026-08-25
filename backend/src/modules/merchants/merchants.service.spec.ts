import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { MerchantStatus, Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { MerchantsService } from './merchants.service';

describe('MerchantsService', () => {
  const organizationId = '580c75b7-1050-4a08-a2c2-585171d84dc8';
  const merchantId = '2f671678-91d3-4d04-a8f9-787a2e9f3c1a';
  const branchId = '6b109a2f-142c-4af4-93d8-12941d0685ac';
  const branch = { id: branchId, name: 'Makati Main', code: 'MKT-01' };
  const merchant = {
    id: merchantId,
    organizationId,
    name: 'Amihan Goods',
    code: 'AMIHAN-01',
    contactName: 'Maria Santos',
    email: 'maria@amihan.example',
    phone: '+63 917 123 4567',
    status: MerchantStatus.ACTIVE,
    createdAt: new Date('2026-08-24T00:00:00.000Z'),
    updatedAt: new Date('2026-08-24T00:00:00.000Z'),
    branches: [branch],
  };
  const merchantRow = { ...merchant, branches: [{ branch }] };
  const createInput = {
    name: merchant.name,
    code: merchant.code,
    contactName: merchant.contactName,
    email: merchant.email,
    phone: merchant.phone,
    branchIds: [branchId],
  };
  const include = {
    branches: {
      select: { branch: { select: { id: true, name: true, code: true } } },
    },
  };
  const transaction = {
    branch: { count: jest.fn() },
    merchant: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findFirstOrThrow: jest.fn(),
    },
    merchantBranch: { deleteMany: jest.fn(), createMany: jest.fn() },
    spaceAssignment: { count: jest.fn() },
  };
  const prisma = {
    $transaction: jest.fn(),
    merchant: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
  };
  let service: MerchantsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation(
      (callback: (client: typeof transaction) => unknown) =>
        callback(transaction),
    );
    const moduleRef = await Test.createTestingModule({
      providers: [
        MerchantsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = moduleRef.get(MerchantsService);
  });

  it('creates a merchant inside the trusted organization', async () => {
    transaction.branch.count.mockResolvedValue(1);
    transaction.spaceAssignment.count.mockResolvedValue(0);
    transaction.merchant.create.mockResolvedValue(merchantRow);

    await expect(service.create(organizationId, createInput)).resolves.toEqual(
      merchant,
    );
    expect(transaction.branch.count).toHaveBeenCalledWith({
      where: { organizationId, id: { in: [branchId] } },
    });
    expect(transaction.merchant.create).toHaveBeenCalledWith({
      data: {
        organizationId,
        name: merchant.name,
        code: merchant.code,
        contactName: merchant.contactName,
        email: merchant.email,
        phone: merchant.phone,
        branches: { create: [{ organizationId, branchId }] },
      },
      include,
    });
  });

  it('rejects a branch that does not belong to the organization', async () => {
    transaction.branch.count.mockResolvedValue(0);

    await expect(service.create(organizationId, createInput)).rejects.toThrow(
      new BadRequestException(
        'Every branch must belong to the merchant organization',
      ),
    );
    expect(transaction.merchant.create).not.toHaveBeenCalled();
  });

  it('lists merchants using tenant, status, and case-insensitive search filters', async () => {
    prisma.merchant.findMany.mockResolvedValue([merchantRow]);

    await expect(
      service.findAll(organizationId, {
        search: 'amihan',
        status: MerchantStatus.ACTIVE,
      }),
    ).resolves.toEqual([merchant]);
    expect(prisma.merchant.findMany).toHaveBeenCalledWith({
      where: {
        organizationId,
        status: MerchantStatus.ACTIVE,
        OR: [
          { name: { contains: 'amihan', mode: 'insensitive' } },
          { code: { contains: 'amihan', mode: 'insensitive' } },
          { contactName: { contains: 'amihan', mode: 'insensitive' } },
          { email: { contains: 'amihan', mode: 'insensitive' } },
          { phone: { contains: 'amihan', mode: 'insensitive' } },
        ],
      },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      include,
    });
  });

  it('does not reveal a merchant outside the organization', async () => {
    prisma.merchant.findFirst.mockResolvedValue(null);

    await expect(service.findOne(organizationId, merchantId)).rejects.toThrow(
      new NotFoundException('Merchant not found'),
    );
    expect(prisma.merchant.findFirst).toHaveBeenCalledWith({
      where: { id: merchantId, organizationId },
      include,
    });
  });

  it('updates a merchant using both tenant and merchant identifiers', async () => {
    prisma.merchant.findFirst.mockResolvedValue(merchantRow);
    prisma.merchant.update.mockResolvedValue({
      ...merchantRow,
      contactName: 'Ana Santos',
    });

    await expect(
      service.update(organizationId, merchantId, {
        contactName: 'Ana Santos',
      }),
    ).resolves.toMatchObject({ contactName: 'Ana Santos' });
    expect(prisma.merchant.update).toHaveBeenCalledWith({
      where: { id: merchantId, organizationId },
      data: { contactName: 'Ana Santos' },
      include,
    });
  });

  it('rejects an empty profile update', async () => {
    await expect(
      service.update(organizationId, merchantId, {}),
    ).rejects.toThrow(
      new BadRequestException('At least one merchant field is required'),
    );
    expect(prisma.merchant.findFirst).not.toHaveBeenCalled();
  });

  it('updates status without accepting profile fields', async () => {
    prisma.merchant.findFirst.mockResolvedValue(merchantRow);
    prisma.merchant.update.mockResolvedValue({
      ...merchantRow,
      status: MerchantStatus.SUSPENDED,
    });

    await expect(
      service.updateStatus(organizationId, merchantId, {
        status: MerchantStatus.SUSPENDED,
      }),
    ).resolves.toMatchObject({ status: MerchantStatus.SUSPENDED });
    expect(prisma.merchant.update).toHaveBeenCalledWith({
      where: { id: merchantId, organizationId },
      data: { status: MerchantStatus.SUSPENDED },
      include,
    });
  });

  it('replaces branch assignments atomically within the organization', async () => {
    transaction.merchant.findFirst.mockResolvedValue({ id: merchantId });
    transaction.branch.count.mockResolvedValue(1);
    transaction.merchantBranch.deleteMany.mockResolvedValue({ count: 1 });
    transaction.merchantBranch.createMany.mockResolvedValue({ count: 1 });
    transaction.merchant.findFirstOrThrow.mockResolvedValue(merchantRow);

    await expect(
      service.updateBranches(organizationId, merchantId, {
        branchIds: [branchId],
      }),
    ).resolves.toEqual(merchant);
    expect(transaction.merchantBranch.deleteMany).toHaveBeenCalledWith({
      where: { organizationId, merchantId },
    });
    expect(transaction.merchantBranch.createMany).toHaveBeenCalledWith({
      data: [{ organizationId, merchantId, branchId }],
    });
  });

  it('blocks branch removal while a merchant has a current space assignment', async () => {
    transaction.merchant.findFirst.mockResolvedValue({ id: merchantId });
    transaction.branch.count.mockResolvedValue(1);
    transaction.spaceAssignment.count.mockResolvedValue(1);

    await expect(
      service.updateBranches(organizationId, merchantId, {
        branchIds: [branchId],
      }),
    ).rejects.toThrow(
      new ConflictException(
        'End current space assignments before removing their branches',
      ),
    );
    expect(transaction.spaceAssignment.count).toHaveBeenCalledWith({
      where: {
        organizationId,
        merchantId,
        branchId: { notIn: [branchId] },
        endDate: null,
      },
    });
    expect(transaction.merchantBranch.deleteMany).not.toHaveBeenCalled();
  });

  it('maps tenant-scoped code uniqueness violations to conflict', async () => {
    transaction.branch.count.mockResolvedValue(1);
    transaction.merchant.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: '7.9.1',
      }),
    );

    await expect(service.create(organizationId, createInput)).rejects.toThrow(
      new ConflictException(
        'Merchant code already exists in this organization',
      ),
    );
  });
});
