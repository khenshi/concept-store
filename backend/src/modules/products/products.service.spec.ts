import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Prisma, ProductStatus } from '../../generated/prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { ProductsService } from './products.service';

describe('ProductsService', () => {
  const organizationId = '580c75b7-1050-4a08-a2c2-585171d84dc8';
  const merchantId = '2f671678-91d3-4d04-a8f9-787a2e9f3c1a';
  const productId = '84f45f0b-b07b-430d-9a62-5c96030c762a';
  const merchant = { id: merchantId, name: 'Amihan Goods', code: 'AMH' };
  const product = {
    id: productId,
    organizationId,
    merchantId,
    name: 'Handwoven pouch',
    sku: 'AMH-01',
    barcode: '4801234567890',
    sellingPrice: new Prisma.Decimal('450.00'),
    status: ProductStatus.ACTIVE,
    createdAt: new Date('2026-08-26T00:00:00.000Z'),
    updatedAt: new Date('2026-08-26T00:00:00.000Z'),
    merchant,
  };
  const expected = { ...product, sellingPrice: '450.00' };
  const prisma = {
    merchant: { findFirst: jest.fn() },
    product: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
  };
  let service: ProductsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        ProductsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = moduleRef.get(ProductsService);
  });

  it('creates a product for a merchant in the organization', async () => {
    prisma.merchant.findFirst.mockResolvedValue({ id: merchantId });
    prisma.product.create.mockResolvedValue(product);

    await expect(
      service.create(organizationId, {
        merchantId,
        name: product.name,
        sku: product.sku,
        barcode: product.barcode,
        sellingPrice: '450.00',
      }),
    ).resolves.toEqual(expected);
    expect(prisma.merchant.findFirst).toHaveBeenCalledWith({
      where: { id: merchantId, organizationId },
      select: { id: true },
    });
    expect(prisma.product.create).toHaveBeenCalledWith({
      data: {
        organizationId,
        merchantId,
        name: product.name,
        sku: product.sku,
        barcode: product.barcode,
        sellingPrice: '450.00',
      },
      include: {
        merchant: { select: { id: true, name: true, code: true } },
      },
    });
  });

  it('rejects merchant ownership from outside the organization', async () => {
    prisma.merchant.findFirst.mockResolvedValue(null);

    await expect(
      service.create(organizationId, {
        merchantId,
        name: product.name,
        sku: product.sku,
        sellingPrice: '450.00',
      }),
    ).rejects.toThrow(
      new BadRequestException(
        'Merchant must belong to the product organization',
      ),
    );
    expect(prisma.product.create).not.toHaveBeenCalled();
  });

  it('lists products with tenant, merchant, status, and search filters', async () => {
    prisma.product.findMany.mockResolvedValue([product]);

    await expect(
      service.findAll(organizationId, {
        search: 'amh',
        merchantId,
        status: ProductStatus.ACTIVE,
      }),
    ).resolves.toEqual([expected]);
    expect(prisma.product.findMany).toHaveBeenCalledWith({
      where: {
        organizationId,
        merchantId,
        status: ProductStatus.ACTIVE,
        OR: [
          { name: { contains: 'amh', mode: 'insensitive' } },
          { sku: { contains: 'amh', mode: 'insensitive' } },
          { barcode: { contains: 'amh', mode: 'insensitive' } },
        ],
      },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      include: {
        merchant: { select: { id: true, name: true, code: true } },
      },
    });
  });

  it('looks up an exact tenant-scoped SKU or barcode', async () => {
    prisma.product.findFirst.mockResolvedValue(product);

    await expect(service.findByCode(organizationId, 'amh-01')).resolves.toEqual(
      expected,
    );
    expect(prisma.product.findFirst).toHaveBeenCalledWith({
      where: {
        organizationId,
        OR: [
          { sku: { equals: 'amh-01', mode: 'insensitive' } },
          { barcode: 'amh-01' },
        ],
      },
      include: {
        merchant: { select: { id: true, name: true, code: true } },
      },
    });
  });

  it('does not reveal a product outside the organization', async () => {
    prisma.product.findFirst.mockResolvedValue(null);

    await expect(service.findOne(organizationId, productId)).rejects.toThrow(
      new NotFoundException('Product not found'),
    );
  });

  it('rejects an empty product update', async () => {
    await expect(service.update(organizationId, productId, {})).rejects.toThrow(
      new BadRequestException('At least one product field is required'),
    );
    expect(prisma.product.findFirst).not.toHaveBeenCalled();
  });

  it('updates product details without changing merchant ownership', async () => {
    prisma.product.findFirst.mockResolvedValue(product);
    prisma.product.update.mockResolvedValue({
      ...product,
      name: 'Woven pouch',
    });

    await expect(
      service.update(organizationId, productId, { name: 'Woven pouch' }),
    ).resolves.toMatchObject({ name: 'Woven pouch', merchantId });
    expect(prisma.product.update).toHaveBeenCalledWith({
      where: { id: productId, organizationId },
      data: { name: 'Woven pouch' },
      include: {
        merchant: { select: { id: true, name: true, code: true } },
      },
    });
  });

  it('maps duplicate SKU or barcode errors to conflict', async () => {
    prisma.merchant.findFirst.mockResolvedValue({ id: merchantId });
    prisma.product.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: '7.9.1',
      }),
    );

    await expect(
      service.create(organizationId, {
        merchantId,
        name: product.name,
        sku: product.sku,
        sellingPrice: '450.00',
      }),
    ).rejects.toThrow(
      new ConflictException(
        'Product SKU or barcode already exists in this organization',
      ),
    );
  });
});
