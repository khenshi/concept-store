import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  MerchantStatus,
  PaymentMethod,
  Prisma,
  ProductStatus,
} from '../../generated/prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { SalesService } from './sales.service';

describe('SalesService', () => {
  const organizationId = '580c75b7-1050-4a08-a2c2-585171d84dc8';
  const branchId = '2f671678-91d3-4d04-a8f9-787a2e9f3c1a';
  const cashierId = '84f45f0b-b07b-430d-9a62-5c96030c762a';
  const productId = '3380e77a-3287-42f4-9126-bf94c02370bb';
  const merchantId = '9ec877c5-d000-4d3f-99b1-a6e528ce706a';
  const clientTransactionId = '70987f2b-2f95-4a42-8853-479cf43c183a';
  const inventory = {
    organizationId,
    branchId,
    productId,
    quantity: 5,
    product: {
      id: productId,
      organizationId,
      merchantId,
      name: 'Handwoven pouch',
      sku: 'AMH-01',
      barcode: '4801234567890',
      sellingPrice: new Prisma.Decimal('450.00'),
      status: ProductStatus.ACTIVE,
      merchant: {
        id: merchantId,
        organizationId,
        name: 'Amihan Goods',
        status: MerchantStatus.ACTIVE,
        branches: [{ branchId }],
      },
    },
  };
  const saleRow = {
    id: '8da60d50-e551-4352-a602-37c544cd6b36',
    organizationId,
    branchId,
    cashierId,
    saleNumber: 'S-8DA60D50E5514352A60237C544CD6B36',
    clientTransactionId,
    subtotal: new Prisma.Decimal('900.00'),
    discountTotal: new Prisma.Decimal('0.00'),
    total: new Prisma.Decimal('900.00'),
    completedAt: new Date('2026-08-29T00:00:00.000Z'),
    createdAt: new Date('2026-08-29T00:00:00.000Z'),
    branch: { id: branchId, name: 'Makati Main', code: 'MKT' },
    cashier: {
      id: cashierId,
      firstName: 'Maria',
      lastName: 'Santos',
      email: 'cashier@example.com',
    },
    items: [
      {
        id: '89dca754-70ce-48bc-9b81-7785fad39091',
        organizationId,
        saleId: '8da60d50-e551-4352-a602-37c544cd6b36',
        productId,
        merchantId,
        productName: inventory.product.name,
        productSku: inventory.product.sku,
        productBarcode: inventory.product.barcode,
        merchantName: inventory.product.merchant.name,
        quantity: 2,
        unitPrice: new Prisma.Decimal('450.00'),
        subtotal: new Prisma.Decimal('900.00'),
        discountAmount: new Prisma.Decimal('0.00'),
        total: new Prisma.Decimal('900.00'),
      },
    ],
    payments: [
      {
        id: '559ae996-ed7b-41b7-b4b5-d4e282f71191',
        organizationId,
        saleId: '8da60d50-e551-4352-a602-37c544cd6b36',
        method: PaymentMethod.CASH,
        amount: new Prisma.Decimal('900.00'),
        referenceNumber: null,
        confirmedById: cashierId,
        paidAt: new Date('2026-08-29T00:00:00.000Z'),
        createdAt: new Date('2026-08-29T00:00:00.000Z'),
      },
    ],
  };
  const transaction = {
    organizationMembership: { findUnique: jest.fn() },
    branch: { findFirst: jest.fn() },
    inventory: { findMany: jest.fn(), updateMany: jest.fn() },
    inventoryMovement: { create: jest.fn() },
    sale: { create: jest.fn(), findUniqueOrThrow: jest.fn() },
  };
  const prisma = {
    $transaction: jest.fn(),
    sale: { findFirst: jest.fn() },
  };
  let service: SalesService;

  beforeEach(async () => {
    jest.clearAllMocks();
    prisma.sale.findFirst.mockResolvedValue(null);
    prisma.$transaction.mockImplementation(
      (operation: (client: typeof transaction) => unknown) =>
        operation(transaction),
    );
    transaction.branch.findFirst.mockResolvedValue({ id: branchId });
    transaction.organizationMembership.findUnique.mockResolvedValue({
      role: 'CASHIER',
    });
    transaction.inventory.findMany.mockResolvedValue([inventory]);
    transaction.inventory.updateMany.mockResolvedValue({ count: 1 });
    transaction.inventoryMovement.create.mockResolvedValue({});
    transaction.sale.create.mockResolvedValue({});
    transaction.sale.findUniqueOrThrow.mockResolvedValue(saleRow);
    const moduleRef = await Test.createTestingModule({
      providers: [SalesService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = moduleRef.get(SalesService);
  });

  it('calculates trusted totals and writes the sale, deduction, and movement atomically', async () => {
    const result = await service.checkout(organizationId, branchId, cashierId, {
      clientTransactionId,
      items: [
        { productId, quantity: 1 },
        { productId, quantity: 1 },
      ],
      payments: [{ method: PaymentMethod.CASH, amount: '900.00' }],
    });

    expect(result).toMatchObject({
      subtotal: '900.00',
      discountTotal: '0.00',
      total: '900.00',
      items: [{ quantity: 2, unitPrice: '450.00', total: '900.00' }],
      payments: [{ amount: '900.00' }],
    });
    expect(transaction.sale.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organizationId,
        branchId,
        cashierId,
        clientTransactionId,
        subtotal: new Prisma.Decimal('900.00'),
        total: new Prisma.Decimal('900.00'),
        items: {
          create: [
            expect.objectContaining({
              productId,
              merchantId,
              quantity: 2,
              unitPrice: new Prisma.Decimal('450.00'),
              merchantName: 'Amihan Goods',
            }),
          ],
        },
      }) as unknown,
    });
    expect(transaction.inventory.updateMany).toHaveBeenCalledWith({
      where: {
        organizationId,
        branchId,
        productId,
        quantity: { gte: 2 },
      },
      data: { quantity: { decrement: 2 } },
    });
    expect(transaction.inventoryMovement.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organizationId,
        branchId,
        productId,
        quantityChange: -2,
        type: 'SALE',
        createdById: cashierId,
      }) as unknown,
    });
    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
  });

  it('returns an existing completed sale for the same client transaction', async () => {
    prisma.sale.findFirst.mockResolvedValue(saleRow);

    await expect(
      service.checkout(organizationId, branchId, cashierId, {
        clientTransactionId,
        items: [{ productId, quantity: 2 }],
        payments: [{ method: PaymentMethod.CASH, amount: '900.00' }],
      }),
    ).resolves.toMatchObject({ id: saleRow.id, total: '900.00' });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects a payment total that differs from server pricing', async () => {
    await expect(
      service.checkout(organizationId, branchId, cashierId, {
        clientTransactionId,
        items: [{ productId, quantity: 2 }],
        payments: [{ method: PaymentMethod.CASH, amount: '800.00' }],
      }),
    ).rejects.toThrow(
      new ConflictException(
        'Payment total must equal the server-calculated sale total',
      ),
    );
    expect(transaction.sale.create).not.toHaveBeenCalled();
  });

  it('requires a reference for non-cash manual payments', async () => {
    await expect(
      service.checkout(organizationId, branchId, cashierId, {
        clientTransactionId,
        items: [{ productId, quantity: 2 }],
        payments: [{ method: PaymentMethod.GCASH, amount: '900.00' }],
      }),
    ).rejects.toThrow(
      new BadRequestException('GCASH payments require a reference number'),
    );
  });

  it('rejects insufficient inventory before persisting a sale', async () => {
    transaction.inventory.findMany.mockResolvedValue([
      { ...inventory, quantity: 1 },
    ]);

    await expect(
      service.checkout(organizationId, branchId, cashierId, {
        clientTransactionId,
        items: [{ productId, quantity: 2 }],
        payments: [{ method: PaymentMethod.CASH, amount: '900.00' }],
      }),
    ).rejects.toThrow(
      new ConflictException('Insufficient inventory for Handwoven pouch'),
    );
    expect(transaction.sale.create).not.toHaveBeenCalled();
  });

  it('revalidates the cashier role inside the financial transaction', async () => {
    transaction.organizationMembership.findUnique.mockResolvedValue({
      role: 'MERCHANT',
    });

    await expect(
      service.checkout(organizationId, branchId, cashierId, {
        clientTransactionId,
        items: [{ productId, quantity: 2 }],
        payments: [{ method: PaymentMethod.CASH, amount: '900.00' }],
      }),
    ).rejects.toThrow(
      new ForbiddenException('Your organization role cannot complete sales'),
    );
    expect(transaction.branch.findFirst).not.toHaveBeenCalled();
  });

  it('recovers a completed idempotent sale after a concurrency conflict', async () => {
    prisma.$transaction.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('write conflict', {
        code: 'P2034',
        clientVersion: '7.9.1',
      }),
    );
    prisma.sale.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(saleRow);

    await expect(
      service.checkout(organizationId, branchId, cashierId, {
        clientTransactionId,
        items: [{ productId, quantity: 2 }],
        payments: [{ method: PaymentMethod.CASH, amount: '900.00' }],
      }),
    ).resolves.toMatchObject({ id: saleRow.id });
  });
});
