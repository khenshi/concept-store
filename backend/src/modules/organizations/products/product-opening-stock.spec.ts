import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { ProductsService } from './products.service';
import { productSelect } from './products.types';

describe('Product opening stock transactions', () => {
  const tx = {
    organizationMembership: { findUnique: jest.fn() },
    branch: { findUnique: jest.fn() },
    merchant: { findUnique: jest.fn() },
    product: {
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      create: jest.fn(),
    },
    branchInventory: { create: jest.fn() },
    inventoryMovement: { create: jest.fn() },
  };
  const prisma = { $transaction: jest.fn() };
  const service = new ProductsService(prisma as unknown as PrismaService);
  const dto = {
    merchantId: 'MERCHANT',
    name: ' Vase ',
    requestId: 'REQUEST',
    initialInventory: { branchId: 'BRANCH', sellingPrice: '12.5', quantity: 3 },
  };
  const command = {
    merchantId: 'merchant',
    name: 'Vase',
    sku: null,
    barcode: null,
    initialInventory: {
      branchId: 'branch',
      sellingPrice: '12.50',
      quantity: 3,
      lowStockThreshold: 5,
    },
  };
  const error = (code: string) =>
    new Prisma.PrismaClientKnownRequestError('test', {
      code,
      clientVersion: 'test',
    });
  beforeEach(() => {
    jest.resetAllMocks();
    prisma.$transaction.mockImplementation(
      (callback: (client: typeof tx) => unknown) => callback(tx),
    );
    tx.organizationMembership.findUnique.mockResolvedValue({
      role: 'OWNER',
      user: { deletedAt: null },
    });
    tx.branch.findUnique.mockResolvedValue({ id: 'branch' });
    tx.merchant.findUnique.mockResolvedValue({ status: 'ACTIVE' });
    tx.product.findUnique.mockResolvedValue(null);
    tx.product.create.mockResolvedValue({ id: 'product' });
    tx.product.findUniqueOrThrow.mockResolvedValue({
      id: 'product',
      name: 'Later edited',
    });
    tx.branchInventory.create.mockResolvedValue({ id: 'placement' });
  });

  it('creates a public product, branch balance and owner-attributed receipt in one serializable transaction', async () => {
    await expect(service.create('org', dto, 'owner')).resolves.toEqual({
      id: 'product',
    });
    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: 'Serializable',
    });
    expect(tx.organizationMembership.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          organizationId_userId: { organizationId: 'org', userId: 'owner' },
        },
      }),
    );
    expect(tx.branch.findUnique).toHaveBeenCalledWith({
      where: { id: 'branch', organizationId: 'org' },
      select: { id: true },
    });
    expect(tx.product.create).toHaveBeenCalledWith({
      select: productSelect,
      data: {
        organizationId: 'org',
        merchantId: 'merchant',
        name: 'Vase',
        sku: null,
        barcode: null,
        creationRequestId: 'request',
        creationActorId: 'owner',
        creationCommand: command,
      },
    });
    expect(tx.branchInventory.create).toHaveBeenCalledWith({
      select: { id: true },
      data: {
        organizationId: 'org',
        branchId: 'branch',
        productId: 'product',
        sellingPrice: new Prisma.Decimal('12.50'),
        quantity: 3,
        lowStockThreshold: 5,
      },
    });
    expect(tx.inventoryMovement.create).toHaveBeenCalledWith({
      data: {
        organizationId: 'org',
        branchId: 'branch',
        branchInventoryId: 'placement',
        type: 'RECEIPT',
        quantityChange: 3,
        quantityAfter: 3,
        reason: 'Initial stock on product creation',
        createdById: 'owner',
        requestId: expect.any(String) as unknown,
      },
    });
  });

  it('replays original content independent of JSON property order and subsequent edits', async () => {
    tx.product.findUnique.mockResolvedValue({
      id: 'product',
      creationActorId: 'owner',
      creationCommand: {
        initialInventory: {
          quantity: 3,
          lowStockThreshold: 5,
          sellingPrice: '12.50',
          branchId: 'branch',
        },
        barcode: null,
        sku: null,
        name: 'Vase',
        merchantId: 'merchant',
      },
    });
    await expect(service.create('org', dto, 'owner')).resolves.toEqual({
      id: 'product',
      name: 'Later edited',
    });
    expect(tx.product.findUniqueOrThrow).toHaveBeenCalledWith({
      where: { id: 'product', organizationId: 'org' },
      select: productSelect,
    });
    expect(tx.merchant.findUnique).not.toHaveBeenCalled();
    expect(tx.product.create).not.toHaveBeenCalled();
    expect(tx.branchInventory.create).not.toHaveBeenCalled();
    expect(tx.inventoryMovement.create).not.toHaveBeenCalled();
  });

  it.each(['MANAGER', 'CASHIER', 'MERCHANT'])(
    'rechecks current role %s before replay or writes',
    async (role) => {
      tx.organizationMembership.findUnique.mockResolvedValue({
        role,
        user: { deletedAt: null },
      });
      await expect(service.create('org', dto, 'owner')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(tx.product.findUnique).not.toHaveBeenCalled();
    },
  );
  it.each([null, { role: 'OWNER', user: { deletedAt: new Date() } }])(
    'rejects removed/deleted owners %j',
    async (membership) => {
      tx.organizationMembership.findUnique.mockResolvedValue(membership);
      await expect(service.create('org', dto, 'owner')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    },
  );
  it('treats an inaccessible branch as absent before looking up a command', async () => {
    tx.branch.findUnique.mockResolvedValue(null);
    await expect(service.create('org', dto, 'owner')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(tx.product.findUnique).not.toHaveBeenCalled();
  });
  it.each([
    null,
    { status: 'INACTIVE' },
    { status: 'ENDED' },
    { status: 'SUSPENDED' },
  ])(
    'requires an active tenant merchant for new commands %j',
    async (merchant) => {
      tx.merchant.findUnique.mockResolvedValue(merchant);
      await expect(service.create('org', dto, 'owner')).rejects.toThrow();
      expect(tx.product.create).not.toHaveBeenCalled();
    },
  );
  it.each([
    { creationActorId: 'other', creationCommand: command },
    {
      creationActorId: 'owner',
      creationCommand: { ...command, name: 'Changed' },
    },
  ])(
    'rejects conflicting reuse without disclosing previous input %j',
    async (existing) => {
      tx.product.findUnique.mockResolvedValue({ id: 'product', ...existing });
      await expect(service.create('org', dto, 'owner')).rejects.toMatchObject({
        response: { code: 'PRODUCT_CREATE_REQUEST_CONFLICT' },
      });
      expect(tx.product.findUniqueOrThrow).not.toHaveBeenCalled();
      expect(tx.product.create).not.toHaveBeenCalled();
    },
  );
  it('recovers a committed concurrent request using a read-only transaction', async () => {
    prisma.$transaction.mockRejectedValueOnce(error('P2002'));
    tx.product.findUnique.mockResolvedValue({
      id: 'product',
      creationActorId: 'owner',
      creationCommand: command,
    });
    await expect(service.create('org', dto, 'owner')).resolves.toMatchObject({
      id: 'product',
    });
    expect(prisma.$transaction).toHaveBeenLastCalledWith(expect.any(Function), {
      isolationLevel: 'RepeatableRead',
    });
    expect(tx.product.create).not.toHaveBeenCalled();
  });
  it('reports unique identifiers when no committed matching command exists', async () => {
    prisma.$transaction.mockRejectedValueOnce(error('P2002'));
    await expect(service.create('org', dto, 'owner')).rejects.toBeInstanceOf(
      ConflictException,
    );
  });
  it('reports serialization rollback without automatic write retries', async () => {
    prisma.$transaction.mockRejectedValueOnce(error('P2034'));
    await expect(service.create('org', dto, 'owner')).rejects.toMatchObject({
      response: { code: 'PRODUCT_CREATE_RETRY' },
    });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });
  it.each(['product', 'branchInventory', 'inventoryMovement'] as const)(
    'propagates failure at the %s write',
    async (target) => {
      tx[target].create.mockRejectedValue(new Error('Write failed'));
      await expect(service.create('org', dto, 'owner')).rejects.toThrow(
        'Write failed',
      );
    },
  );
});
