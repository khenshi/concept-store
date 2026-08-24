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
  };
  const createInput = {
    name: merchant.name,
    code: merchant.code,
    contactName: merchant.contactName,
    email: merchant.email,
    phone: merchant.phone,
  };
  const prisma = {
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
    const moduleRef = await Test.createTestingModule({
      providers: [
        MerchantsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = moduleRef.get(MerchantsService);
  });

  it('creates a merchant inside the trusted organization', async () => {
    prisma.merchant.create.mockResolvedValue(merchant);

    await expect(service.create(organizationId, createInput)).resolves.toEqual(
      merchant,
    );
    expect(prisma.merchant.create).toHaveBeenCalledWith({
      data: { organizationId, ...createInput },
    });
  });

  it('lists merchants using tenant, status, and case-insensitive search filters', async () => {
    prisma.merchant.findMany.mockResolvedValue([merchant]);

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
    });
  });

  it('does not reveal a merchant outside the organization', async () => {
    prisma.merchant.findFirst.mockResolvedValue(null);

    await expect(service.findOne(organizationId, merchantId)).rejects.toThrow(
      new NotFoundException('Merchant not found'),
    );
    expect(prisma.merchant.findFirst).toHaveBeenCalledWith({
      where: { id: merchantId, organizationId },
    });
  });

  it('updates a merchant using both tenant and merchant identifiers', async () => {
    prisma.merchant.findFirst.mockResolvedValue(merchant);
    prisma.merchant.update.mockResolvedValue({
      ...merchant,
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
    prisma.merchant.findFirst.mockResolvedValue(merchant);
    prisma.merchant.update.mockResolvedValue({
      ...merchant,
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
    });
  });

  it('maps tenant-scoped code uniqueness violations to conflict', async () => {
    prisma.merchant.create.mockRejectedValue(
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
