import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  MerchantStatus,
  Prisma,
  ProductStatus,
} from '../../generated/prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { PosProductsService } from './pos-products.service';

describe('PosProductsService', () => {
  const organizationId = '580c75b7-1050-4a08-a2c2-585171d84dc8';
  const branchId = '2f671678-91d3-4d04-a8f9-787a2e9f3c1a';
  const merchantId = '84f45f0b-b07b-430d-9a62-5c96030c762a';
  const inventory = {
    organizationId,
    branchId,
    productId: '3380e77a-3287-42f4-9126-bf94c02370bb',
    quantity: 4,
    createdAt: new Date('2026-08-26T00:00:00.000Z'),
    updatedAt: new Date('2026-08-26T00:00:00.000Z'),
    product: {
      id: '3380e77a-3287-42f4-9126-bf94c02370bb',
      organizationId,
      merchantId,
      name: 'Handwoven pouch',
      sku: 'AMH-01',
      barcode: '4801234567890',
      sellingPrice: new Prisma.Decimal('450.00'),
      status: ProductStatus.ACTIVE,
      createdAt: new Date('2026-08-26T00:00:00.000Z'),
      updatedAt: new Date('2026-08-26T00:00:00.000Z'),
      merchant: { id: merchantId, name: 'Amihan Goods', code: 'AMH' },
    },
  };
  const expected = {
    id: inventory.product.id,
    branchId,
    merchantId,
    name: inventory.product.name,
    sku: inventory.product.sku,
    barcode: inventory.product.barcode,
    sellingPrice: '450.00',
    quantity: 4,
    available: true,
    merchant: inventory.product.merchant,
  };
  const prisma = {
    $transaction: jest.fn(),
    branch: { findFirst: jest.fn() },
    inventory: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      count: jest.fn(),
    },
  };
  let service: PosProductsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation((operations: Promise<unknown>[]) =>
      Promise.all(operations),
    );
    prisma.branch.findFirst.mockResolvedValue({ id: branchId });
    const moduleRef = await Test.createTestingModule({
      providers: [
        PosProductsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = moduleRef.get(PosProductsService);
  });

  it('lists only active tenant and branch products with current participation', async () => {
    prisma.inventory.findMany.mockResolvedValue([inventory]);
    prisma.inventory.count.mockResolvedValue(1);

    await expect(
      service.findAll(organizationId, branchId, {
        search: 'pouch',
        merchantId,
        offset: 0,
        limit: 30,
      }),
    ).resolves.toEqual({ items: [expected], total: 1, offset: 0, limit: 30 });

    const expectedWhere = {
      organizationId,
      branchId,
      product: {
        status: ProductStatus.ACTIVE,
        merchantId,
        merchant: {
          status: MerchantStatus.ACTIVE,
          branches: { some: { organizationId, branchId } },
        },
        OR: [
          { name: { contains: 'pouch', mode: 'insensitive' } },
          { sku: { contains: 'pouch', mode: 'insensitive' } },
          { barcode: { contains: 'pouch', mode: 'insensitive' } },
        ],
      },
    };
    expect(prisma.inventory.findMany).toHaveBeenCalledWith({
      where: expectedWhere,
      include: {
        product: {
          include: {
            merchant: { select: { id: true, name: true, code: true } },
          },
        },
      },
      orderBy: [{ product: { name: 'asc' } }, { productId: 'asc' }],
      skip: 0,
      take: 30,
    });
    expect(prisma.inventory.count).toHaveBeenCalledWith({
      where: expectedWhere,
    });
  });

  it('looks up an exact active branch product by SKU or barcode', async () => {
    prisma.inventory.findFirst.mockResolvedValue(inventory);

    await expect(
      service.findByCode(organizationId, branchId, 'amh-01'),
    ).resolves.toEqual(expected);
    expect(prisma.inventory.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizationId,
          branchId,
          product: expect.objectContaining({
            status: ProductStatus.ACTIVE,
            OR: [
              { sku: { equals: 'amh-01', mode: 'insensitive' } },
              { barcode: 'amh-01' },
            ],
          }) as unknown,
        }) as unknown,
      }),
    );
  });

  it('returns zero or negative quantity as unavailable instead of hiding it', async () => {
    prisma.inventory.findFirst.mockResolvedValue({
      ...inventory,
      quantity: 0,
    });

    await expect(
      service.findByCode(organizationId, branchId, inventory.product.sku),
    ).resolves.toMatchObject({ quantity: 0, available: false });
  });

  it('rejects a branch outside the organization before querying products', async () => {
    prisma.branch.findFirst.mockResolvedValue(null);

    await expect(
      service.findAll(organizationId, branchId, { offset: 0, limit: 30 }),
    ).rejects.toThrow(new NotFoundException('Branch not found'));
    expect(prisma.inventory.findMany).not.toHaveBeenCalled();
  });

  it('does not return inactive or unavailable branch products', async () => {
    prisma.inventory.findFirst.mockResolvedValue(null);

    await expect(
      service.findByCode(organizationId, branchId, 'missing-code'),
    ).rejects.toThrow(new NotFoundException('Sellable product not found'));
  });
});
