import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { MerchantStatus, Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { MerchantsService } from './merchants.service';

describe('MerchantsService', () => {
  const organizationId = '580c75b7-1050-4a08-a2c2-585171d84dc8';
  const merchantId = '2f671678-91d3-4d04-a8f9-787a2e9f3c1a';
  const merchant = {
    id: merchantId,
    organizationId,
    name: 'Amihan Home Studio',
    code: 'AMIHAN-HOME',
    contactName: 'Mara Santos',
    email: 'mara@amihan.example.com',
    phone: '+63 917 555 0101',
    status: MerchantStatus.ACTIVE,
    createdAt: new Date('2026-09-12T00:00:00.000Z'),
    updatedAt: new Date('2026-09-12T00:00:00.000Z'),
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
      findUnique: jest.fn(),
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

  it('creates an active merchant inside the trusted organization', async () => {
    prisma.merchant.create.mockResolvedValue(merchant);

    await expect(service.create(organizationId, createInput)).resolves.toEqual(
      merchant,
    );
    expect(prisma.merchant.create).toHaveBeenCalledWith({
      data: { organizationId, ...createInput },
    });
  });

  it('lists deterministically with tenant, status, and case-insensitive search filters', async () => {
    prisma.merchant.findMany.mockResolvedValue([merchant]);

    await expect(
      service.findAll(organizationId, {
        q: 'amihan',
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

  it('lists all tenant merchants when filters are absent', async () => {
    prisma.merchant.findMany.mockResolvedValue([merchant]);

    await service.findAll(organizationId, {});

    expect(prisma.merchant.findMany).toHaveBeenCalledWith({
      where: { organizationId },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    });
  });

  it('does not reveal a missing or foreign-organization merchant', async () => {
    prisma.merchant.findUnique.mockResolvedValue(null);

    await expect(service.findOne(organizationId, merchantId)).rejects.toThrow(
      new NotFoundException('Merchant not found'),
    );
    expect(prisma.merchant.findUnique).toHaveBeenCalledWith({
      where: { id: merchantId, organizationId },
    });
  });

  it('updates a profile using both merchant and organization IDs', async () => {
    prisma.merchant.findUnique.mockResolvedValue(merchant);
    prisma.merchant.update.mockResolvedValue({
      ...merchant,
      name: 'Amihan Studio',
    });

    await expect(
      service.update(organizationId, merchantId, { name: 'Amihan Studio' }),
    ).resolves.toMatchObject({ name: 'Amihan Studio' });
    expect(prisma.merchant.update).toHaveBeenCalledWith({
      where: { id: merchantId, organizationId },
      data: { name: 'Amihan Studio' },
    });
  });

  it('rejects an empty profile update before querying', async () => {
    await expect(
      service.update(organizationId, merchantId, {}),
    ).rejects.toThrow(
      new BadRequestException(
        'At least one merchant profile field is required',
      ),
    );
    expect(prisma.merchant.findUnique).not.toHaveBeenCalled();
  });

  it('changes status separately using both merchant and organization IDs', async () => {
    prisma.merchant.findUnique.mockResolvedValue(merchant);
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

  it('maps organization-scoped duplicate codes to conflict', async () => {
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
