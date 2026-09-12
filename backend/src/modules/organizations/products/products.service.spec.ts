import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { ProductsService } from './products.service';

describe('ProductsService', () => {
  const prisma = {
    merchant: { findUnique: jest.fn() },
    product: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    branchInventory: { findMany: jest.fn() },
  };
  const service = new ProductsService(prisma as unknown as PrismaService);
  beforeEach(() => {
    jest.resetAllMocks();
    prisma.merchant.findUnique.mockResolvedValue({ status: 'ACTIVE' });
    prisma.product.findUnique.mockResolvedValue({
      id: 'product',
      status: 'INACTIVE',
    });
  });

  it('creates under trusted tenant with fixed merchant ownership', async () => {
    await service.create('org', { merchantId: 'merchant', name: 'Vase' });
    expect(prisma.merchant.findUnique).toHaveBeenCalledWith({
      where: { id: 'merchant', organizationId: 'org' },
      select: { status: true },
    });
    expect(prisma.product.create).toHaveBeenCalledWith({
      data: {
        organizationId: 'org',
        merchantId: 'merchant',
        name: 'Vase',
        sku: undefined,
        barcode: undefined,
      },
    });
  });

  it.each(['INACTIVE', 'SUSPENDED', 'ENDED'])(
    'rejects inactive merchant %s',
    async (status) => {
      prisma.merchant.findUnique.mockResolvedValue({ status });
      await expect(
        service.create('org', { merchantId: 'merchant', name: 'Vase' }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.product.create).not.toHaveBeenCalled();
    },
  );

  it('treats absent and foreign merchants alike', async () => {
    prisma.merchant.findUnique.mockResolvedValue(null);
    await expect(
      service.create('org', { merchantId: 'foreign', name: 'Vase' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      service.findAll('org', { merchantId: 'foreign' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.product.findMany).not.toHaveBeenCalled();
  });

  it('scopes search/filter queries and preserves barcode case sensitivity', async () => {
    await service.findAll('org', {
      q: 'Ab',
      merchantId: 'merchant',
      status: 'ACTIVE',
    });
    expect(prisma.product.findMany).toHaveBeenCalledWith({
      where: {
        organizationId: 'org',
        merchantId: 'merchant',
        status: 'ACTIVE',
        OR: [
          { name: { contains: 'Ab', mode: 'insensitive' } },
          { sku: { contains: 'Ab', mode: 'insensitive' } },
          { barcode: { contains: 'Ab' } },
        ],
      },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    });
  });

  it('rejects empty edits and guessed products before writes', async () => {
    await expect(service.update('org', 'product', {})).rejects.toBeInstanceOf(
      BadRequestException,
    );
    prisma.product.findUnique.mockResolvedValue(null);
    await expect(
      service.update('org', 'foreign', { name: 'New' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      service.findInventory('org', 'foreign'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.product.update).not.toHaveBeenCalled();
    expect(prisma.branchInventory.findMany).not.toHaveBeenCalled();
  });

  it('edits inactive profiles and clears identifiers without changing merchant or status', async () => {
    await service.update('org', 'product', { sku: null, barcode: null });
    expect(prisma.product.update).toHaveBeenCalledWith({
      where: { id: 'product', organizationId: 'org' },
      data: { name: undefined, sku: null, barcode: null },
    });
  });

  it('status updates write only lifecycle state', async () => {
    await service.updateStatus('org', 'product', { status: 'ACTIVE' });
    expect(prisma.product.update).toHaveBeenCalledWith({
      where: { id: 'product', organizationId: 'org' },
      data: { status: 'ACTIVE' },
    });
  });

  it('maps duplicate identifiers to a conflict', async () => {
    prisma.product.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('duplicate', {
        code: 'P2002',
        clientVersion: 'test',
      }),
    );
    await expect(
      service.create('org', { merchantId: 'merchant', name: 'Vase' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('returns exact independent placement prices', async () => {
    prisma.branchInventory.findMany.mockResolvedValue([
      { id: 'one', sellingPrice: new Prisma.Decimal('0.01') },
      { id: 'two', sellingPrice: new Prisma.Decimal('9999999999.99') },
    ]);
    await expect(service.findInventory('org', 'product')).resolves.toEqual([
      { id: 'one', sellingPrice: '0.01' },
      { id: 'two', sellingPrice: '9999999999.99' },
    ]);
    expect(prisma.branchInventory.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: 'org', productId: 'product' },
      }),
    );
  });
});
