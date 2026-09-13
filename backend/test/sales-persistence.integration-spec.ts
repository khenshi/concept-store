import { randomUUID } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { PrismaPg } from '@prisma/adapter-pg';
import { Client } from 'pg';
import { Prisma, PrismaClient } from '../src/generated/prisma/client';
import { PrismaService } from '../src/infrastructure/database/prisma.service';
import { BranchInventoryService } from '../src/modules/organizations/inventory/branch-inventory.service';

const connectionString = process.env.TEST_DATABASE_URL;
if (!connectionString)
  throw new Error(
    'Set TEST_DATABASE_URL to an explicitly disposable PostgreSQL test database',
  );
const schema = `sales_test_${randomUUID().replaceAll('-', '')}`;
const admin = new Client({ connectionString });
const prisma = new PrismaClient({
  adapter: new PrismaPg(
    { connectionString, options: `-c search_path=${schema}` },
    { schema },
  ),
});
let organizationId: string;
let branchId: string;
let otherBranchId: string;
let merchantId: string;
let otherMerchantId: string;
let productId: string;
let inventoryId: string;
let userId: string;

const saleData = (
  extra: Partial<Prisma.SaleUncheckedCreateInput> = {},
): Prisma.SaleUncheckedCreateInput => ({
  organizationId,
  branchId,
  receiptCode: randomUUID(),
  requestId: randomUUID(),
  createdById: userId,
  paymentMethod: 'CASH',
  cashTender: '30.00',
  cashChange: '5.00',
  total: '25.00',
  organizationName: 'Original store',
  branchName: 'Original branch',
  branchCode: 'ONE',
  cashierName: 'Original actor',
  checkoutCommand: {
    items: [
      {
        branchInventoryId: inventoryId,
        quantity: 2,
        expectedUnitPrice: '12.50',
      },
    ],
    paymentMethod: 'CASH',
    cashTender: '30.00',
  },
  ...extra,
});
const itemData = (
  saleId: string,
  extra: Partial<Prisma.SaleItemUncheckedCreateInput> = {},
): Prisma.SaleItemUncheckedCreateInput => ({
  organizationId,
  branchId,
  saleId,
  branchInventoryId: inventoryId,
  productId,
  merchantId,
  quantity: 2,
  productName: 'Original product',
  sku: 'ORIGINAL',
  barcode: '001Ab',
  merchantName: 'Original merchant',
  unitPrice: '12.50',
  lineTotal: '25.00',
  ...extra,
});
const movementData = (
  saleItemId: string,
  extra: Partial<Prisma.InventoryMovementUncheckedCreateInput> = {},
): Prisma.InventoryMovementUncheckedCreateInput => ({
  organizationId,
  branchId,
  branchInventoryId: inventoryId,
  saleItemId,
  type: 'SALE',
  quantityChange: -2,
  quantityAfter: 3,
  reason: 'Point-of-sale checkout',
  createdById: userId,
  requestId: randomUUID(),
  ...extra,
});

describe('PostgreSQL sale persistence integrity', () => {
  beforeAll(async () => {
    await admin.connect();
    await admin.query(`CREATE SCHEMA "${schema}"`);
    await admin.query(`SET search_path TO "${schema}"`);
    const migrations = join(__dirname, '../prisma/migrations');
    for (const directory of readdirSync(migrations)
      .filter((name) => /^\d/.test(name))
      .sort()) {
      await admin.query(
        readFileSync(
          join(migrations, directory, 'migration.sql'),
          'utf8',
        ).replace('CREATE SCHEMA IF NOT EXISTS "public";', ''),
      );
    }
  });
  afterAll(async () => {
    await prisma.$disconnect();
    await admin.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await admin.end();
  });
  beforeEach(async () => {
    organizationId = (
      await prisma.organization.create({ data: { name: randomUUID() } })
    ).id;
    userId = (
      await prisma.user.create({
        data: {
          firstName: 'Original',
          lastName: 'actor',
          email: `${randomUUID()}@example.test`,
          passwordHash: 'unused',
        },
      })
    ).id;
    const branch = {
      organizationId,
      addressLine1: 'Test',
      city: 'Makati',
      province: 'Metro Manila',
      countryCode: 'PH',
    };
    branchId = (
      await prisma.branch.create({
        data: { ...branch, name: 'Original branch', code: 'ONE' },
      })
    ).id;
    otherBranchId = (
      await prisma.branch.create({ data: { ...branch, name: 'Second' } })
    ).id;
    const merchant = {
      organizationId,
      contactName: 'Test',
      phone: '09171234567',
    };
    merchantId = (
      await prisma.merchant.create({
        data: { ...merchant, name: 'Original merchant' },
      })
    ).id;
    otherMerchantId = (
      await prisma.merchant.create({
        data: { ...merchant, name: 'Other merchant' },
      })
    ).id;
    productId = (
      await prisma.product.create({
        data: {
          organizationId,
          merchantId,
          name: 'Original product',
          sku: 'ORIGINAL',
          barcode: '001Ab',
        },
      })
    ).id;
    inventoryId = (
      await prisma.branchInventory.create({
        data: {
          organizationId,
          branchId,
          productId,
          sellingPrice: '12.50',
          quantity: 5,
        },
      })
    ).id;
    await prisma.inventoryMovement.create({
      data: {
        organizationId,
        branchId,
        branchInventoryId: inventoryId,
        type: 'RECEIPT',
        quantityChange: 5,
        quantityAfter: 5,
        reason: 'Initial stock',
        createdById: userId,
        requestId: randomUUID(),
      },
    });
  });

  it.each(['CASH', 'GCASH', 'CARD'] as const)(
    'persists valid %s payments with exact decimal values',
    async (paymentMethod) => {
      const sale = await prisma.sale.create({
        data: saleData(
          paymentMethod === 'CASH'
            ? {}
            : {
                paymentMethod,
                cashTender: null,
                cashChange: null,
                paymentReference: 'TEST-REFERENCE',
              },
        ),
      });
      const item = await prisma.saleItem.create({ data: itemData(sale.id) });
      expect(sale.total.toFixed(2)).toBe('25.00');
      expect(item.lineTotal.toFixed(2)).toBe('25.00');
      expect(sale.paymentMethod).toBe(paymentMethod);
    },
  );
  it.each([
    { total: '0' },
    { total: '-1' },
    { total: 'NaN' },
    { cashTender: '24.99' },
    { cashTender: null },
    { cashChange: null },
    { cashChange: '4.99' },
    { cashTender: 'NaN' },
    { paymentReference: 'NOT-ALLOWED' },
    { checkoutCommand: [] },
    { receiptCode: ' ' },
    {
      paymentMethod: 'GCASH' as const,
      cashTender: null,
      cashChange: null,
      paymentReference: null,
    },
    {
      paymentMethod: 'CARD' as const,
      cashTender: null,
      cashChange: null,
      paymentReference: 'x',
    },
    {
      paymentMethod: 'CARD' as const,
      cashTender: null,
      cashChange: null,
      paymentReference: 'x'.repeat(101),
    },
    {
      paymentMethod: 'GCASH' as const,
      cashTender: null,
      cashChange: null,
      paymentReference: ' REF ',
    },
    { paymentMethod: 'GCASH' as const, paymentReference: 'REF' },
  ])('rejects invalid payment/amount/command fields %j', async (extra) => {
    await expect(
      prisma.sale.create({ data: saleData(extra) }),
    ).rejects.toThrow();
  });
  it.each([
    { quantity: 0 },
    { quantity: -1 },
    { unitPrice: '0' },
    { unitPrice: 'NaN' },
    { lineTotal: '24.99' },
  ])('rejects invalid item amounts %j', async (extra) => {
    const sale = await prisma.sale.create({ data: saleData() });
    await expect(
      prisma.saleItem.create({ data: itemData(sale.id, extra) }),
    ).rejects.toThrow();
  });
  it('supports maximum approved unit/quantity capacity and a 100-line total capacity', async () => {
    const ExactDecimal = Prisma.Decimal.clone({ precision: 40 });
    const lineTotal = new ExactDecimal('9999999999.99').times(2147483647);
    const total = lineTotal.times(100);
    const sale = await prisma.sale.create({
      data: saleData({
        total,
        cashTender: total.plus('0.01'),
        cashChange: '0.01',
      }),
    });
    const item = await prisma.saleItem.create({
      data: itemData(sale.id, {
        unitPrice: '9999999999.99',
        quantity: 2147483647,
        lineTotal,
      }),
    });
    expect(sale.total.toFixed(2)).toBe(total.toFixed(2));
    expect(item.lineTotal.toFixed(2)).toBe(lineTotal.toFixed(2));
  });
  it('enforces receipt/request and sale-placement uniqueness while allowing reused manual references', async () => {
    const sale = await prisma.sale.create({ data: saleData() });
    await expect(
      prisma.sale.create({ data: saleData({ receiptCode: sale.receiptCode }) }),
    ).rejects.toThrow();
    await expect(
      prisma.sale.create({ data: saleData({ requestId: sale.requestId }) }),
    ).rejects.toThrow();
    await prisma.saleItem.create({ data: itemData(sale.id) });
    await expect(
      prisma.saleItem.create({ data: itemData(sale.id) }),
    ).rejects.toThrow();
    for (let i = 0; i < 2; i++)
      await prisma.sale.create({
        data: saleData({
          paymentMethod: 'GCASH',
          cashTender: null,
          cashChange: null,
          paymentReference: 'REUSED-REF',
        }),
      });
  });
  it('rejects foreign-tenant branches and mismatched item branch/product/merchant relationships', async () => {
    const foreignOrg = await prisma.organization.create({
      data: { name: 'Foreign' },
    });
    const foreignBranch = await prisma.branch.create({
      data: {
        organizationId: foreignOrg.id,
        name: 'Foreign',
        addressLine1: 'Test',
        city: 'Test',
        province: 'Test',
        countryCode: 'PH',
      },
    });
    await expect(
      prisma.sale.create({ data: saleData({ branchId: foreignBranch.id }) }),
    ).rejects.toThrow();
    const sale = await prisma.sale.create({ data: saleData() });
    const otherProduct = await prisma.product.create({
      data: { organizationId, merchantId, name: 'Different' },
    });
    const foreignMerchant = await prisma.merchant.create({
      data: {
        organizationId: foreignOrg.id,
        name: 'Foreign',
        contactName: 'Test',
        phone: '09171234567',
      },
    });
    for (const extra of [
      { branchId: otherBranchId },
      { organizationId: foreignOrg.id },
      { productId: otherProduct.id },
      { merchantId: otherMerchantId },
      { merchantId: foreignMerchant.id },
    ]) {
      await expect(
        prisma.saleItem.create({ data: itemData(sale.id, extra) }),
      ).rejects.toThrow();
    }
  });
  it('enforces negative SALE linkage, exactly one movement per item and matching placement/branch', async () => {
    const sale = await prisma.sale.create({ data: saleData() });
    const item = await prisma.saleItem.create({ data: itemData(sale.id) });
    for (const extra of [
      { saleItemId: null },
      { quantityChange: 2 },
      { type: 'ADJUSTMENT' as const },
      { type: 'RECEIPT' as const, quantityChange: 2 },
      { saleItemId: randomUUID() },
      { branchId: otherBranchId },
    ]) {
      await expect(
        prisma.inventoryMovement.create({ data: movementData(item.id, extra) }),
      ).rejects.toThrow();
    }
    const secondPlacement = await prisma.branchInventory.create({
      data: {
        organizationId,
        branchId: otherBranchId,
        productId,
        sellingPrice: '15.00',
      },
    });
    await expect(
      prisma.inventoryMovement.create({
        data: movementData(item.id, {
          branchId: otherBranchId,
          branchInventoryId: secondPlacement.id,
        }),
      }),
    ).rejects.toThrow();
    await prisma.inventoryMovement.create({ data: movementData(item.id) });
    await expect(
      prisma.inventoryMovement.create({ data: movementData(item.id) }),
    ).rejects.toThrow();
  });
  it('rolls back sale/items/deduction when linked movement insertion fails', async () => {
    await expect(
      prisma.$transaction(async (tx) => {
        const sale = await tx.sale.create({ data: saleData() });
        const item = await tx.saleItem.create({ data: itemData(sale.id) });
        await tx.branchInventory.update({
          where: { id: inventoryId },
          data: { quantity: { decrement: 2 } },
        });
        await tx.inventoryMovement.create({
          data: movementData(item.id, { quantityChange: 2 }),
        });
      }),
    ).rejects.toThrow();
    expect(await prisma.sale.count({ where: { organizationId } })).toBe(0);
    expect(await prisma.saleItem.count({ where: { organizationId } })).toBe(0);
    expect(
      (
        await prisma.branchInventory.findUniqueOrThrow({
          where: { id: inventoryId },
        })
      ).quantity,
    ).toBe(5);
  });
  it('preserves snapshots/history after identity changes and membership removal', async () => {
    const sale = await prisma.sale.create({ data: saleData() });
    const item = await prisma.saleItem.create({ data: itemData(sale.id) });
    await prisma.inventoryMovement.create({ data: movementData(item.id) });
    await prisma.organizationMembership.create({
      data: { organizationId, userId, role: 'CASHIER' },
    });
    await prisma.organizationMembership.delete({
      where: { organizationId_userId: { organizationId, userId } },
    });
    await prisma.product.update({
      where: { id: productId },
      data: {
        name: 'Changed product',
        sku: 'CHANGED',
        barcode: 'New',
        status: 'INACTIVE',
      },
    });
    await prisma.merchant.update({
      where: { id: merchantId },
      data: { name: 'Changed merchant', status: 'ENDED' },
    });
    await prisma.branch.update({
      where: { id: branchId },
      data: { name: 'Changed branch' },
    });
    await prisma.organization.update({
      where: { id: organizationId },
      data: { name: 'Changed store' },
    });
    await prisma.user.update({
      where: { id: userId },
      data: { firstName: 'Changed', deletedAt: new Date() },
    });
    expect(
      await prisma.sale.findUniqueOrThrow({ where: { id: sale.id } }),
    ).toMatchObject({
      organizationName: 'Original store',
      branchName: 'Original branch',
      cashierName: 'Original actor',
    });
    expect(
      await prisma.saleItem.findUniqueOrThrow({ where: { id: item.id } }),
    ).toMatchObject({
      productName: 'Original product',
      merchantName: 'Original merchant',
      sku: 'ORIGINAL',
      barcode: '001Ab',
    });
    for (const deletion of [
      () => prisma.sale.delete({ where: { id: sale.id } }),
      () => prisma.saleItem.delete({ where: { id: item.id } }),
      () => prisma.branchInventory.delete({ where: { id: inventoryId } }),
      () => prisma.product.delete({ where: { id: productId } }),
      () => prisma.merchant.delete({ where: { id: merchantId } }),
      () => prisma.branch.delete({ where: { id: branchId } }),
      () => prisma.user.delete({ where: { id: userId } }),
    ])
      await expect(deletion()).rejects.toThrow();
  });
  it('keeps internal sale links out of existing owner and merchant history contracts', async () => {
    const sale = await prisma.sale.create({ data: saleData() });
    const item = await prisma.saleItem.create({ data: itemData(sale.id) });
    await prisma.inventoryMovement.create({ data: movementData(item.id) });
    const inventory = new BranchInventoryService(
      prisma as unknown as PrismaService,
    );
    const ownerHistory = await inventory.findMovements(
      organizationId,
      branchId,
      inventoryId,
    );
    const merchantHistory = await inventory.findMovements(
      organizationId,
      branchId,
      inventoryId,
      { organizationId, userId, role: 'MERCHANT', merchantId },
    );
    expect(ownerHistory.some((entry) => entry.type === 'SALE')).toBe(true);
    for (const entry of ownerHistory)
      expect(entry).not.toHaveProperty('saleItemId');
    for (const entry of merchantHistory) {
      expect(entry).not.toHaveProperty('saleItemId');
      expect(entry).not.toHaveProperty('createdById');
    }
  });
});
