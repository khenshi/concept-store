import { randomUUID } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { PrismaPg } from '@prisma/adapter-pg';
import { Client } from 'pg';
import { Prisma, PrismaClient } from '../src/generated/prisma/client';
import { PrismaService } from '../src/infrastructure/database/prisma.service';
import { CheckoutService } from '../src/modules/organizations/sales/checkout.service';
import { RefundsService } from '../src/modules/organizations/refunds/refunds.service';
import { RefundReadService } from '../src/modules/organizations/refunds/refund-read.service';
import { InventoryStockService } from '../src/modules/organizations/inventory/inventory-stock.service';
import { InventoryReconciliationService } from '../src/modules/organizations/inventory/inventory-reconciliation.service';
import type { CreateRefundDto } from '../src/modules/organizations/refunds/dto/create-refund.dto';
import type { OrganizationContext } from '../src/modules/organizations/authorization/organization-authorization.types';
const connectionString = process.env.TEST_DATABASE_URL;
if (!connectionString)
  throw new Error(
    'Set TEST_DATABASE_URL to an explicitly disposable PostgreSQL test database',
  );
const schema = `refunds_test_${randomUUID().replaceAll('-', '')}`;
const admin = new Client({ connectionString });
const prisma = new PrismaClient({
  adapter: new PrismaPg(
    { connectionString, options: `-c search_path=${schema}`, max: 20 },
    { schema },
  ),
});
const refunds = new RefundsService(prisma as unknown as PrismaService);
const reads = new RefundReadService(prisma as unknown as PrismaService);
const history = (context = owner(), page = 1, limit = 50) =>
  reads.findAll(context, branchId, saleId, { page, limit });
async function merchantActor(index = 0) {
  const userId = await actor('MERCHANT');
  const item = await prisma.saleItem.findUniqueOrThrow({
    where: { id: saleItems[index] },
  });
  await prisma.organizationMembership.update({
    where: { organizationId_userId: { organizationId, userId } },
    data: { merchantId: item.merchantId },
  });
  return {
    organizationId,
    userId,
    role: 'MERCHANT' as const,
    merchantId: item.merchantId,
  };
}
const checkout = new CheckoutService(prisma as unknown as PrismaService);
const stocks = new InventoryStockService(prisma as unknown as PrismaService);
const reconciliation = new InventoryReconciliationService(
  prisma as unknown as PrismaService,
);
let organizationId: string,
  branchId: string,
  otherBranchId: string,
  ownerId: string,
  saleId: string;
let inventories: string[], saleItems: string[];
const owner = (): OrganizationContext => ({
  organizationId,
  userId: ownerId,
  role: 'OWNER',
});
const command = (quantity = 2, restockQuantity = 1): CreateRefundDto => ({
  requestId: randomUUID(),
  items: [{ saleItemId: saleItems[0], quantity, restockQuantity }],
  reason: 'Returned goods',
  paymentMethod: 'CASH',
  refundConfirmed: true,
});
async function actor(role: OrganizationContext['role']) {
  const user = await prisma.user.create({
    data: {
      firstName: 'Test',
      lastName: role,
      email: `${randomUUID()}@example.test`,
      passwordHash: 'unused',
    },
  });
  await prisma.organizationMembership.create({
    data: { organizationId, userId: user.id, role },
  });
  return user.id;
}
const record = (dto = command(), context = owner()) =>
  refunds.complete(context, branchId, saleId, dto);
// Tests model explicit user retry of an unchanged command, never an API auto-write.
async function retry(dto: CreateRefundDto) {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      return await record(dto);
    } catch (error: unknown) {
      if (!(error instanceof Error) || !('getResponse' in error)) throw error;
      const response = (error as { getResponse(): unknown }).getResponse() as {
        code?: string;
      };
      if (response.code !== 'REFUND_RETRY') throw error;
    }
  }
  throw new Error('Explicit retry bound exhausted');
}
async function balance(index = 0) {
  return (
    await prisma.branchInventory.findUniqueOrThrow({
      where: { id: inventories[index] },
    })
  ).quantity;
}
async function ledger(index = 0) {
  const movements = await prisma.inventoryMovement.findMany({
    where: { organizationId, branchId, branchInventoryId: inventories[index] },
  });
  expect(movements.reduce((sum, entry) => sum + entry.quantityChange, 0)).toBe(
    await balance(index),
  );
}
describe('PostgreSQL refund commands and concurrency', () => {
  beforeAll(async () => {
    await admin.connect();
    await admin.query(`CREATE SCHEMA "${schema}"`);
    await admin.query(`SET search_path TO "${schema}"`);
    const migrations = join(__dirname, '../prisma/migrations');
    for (const directory of readdirSync(migrations)
      .filter((name) => /^\d/.test(name))
      .sort())
      await admin.query(
        readFileSync(
          join(migrations, directory, 'migration.sql'),
          'utf8',
        ).replace('CREATE SCHEMA IF NOT EXISTS "public";', ''),
      );
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
    ownerId = await actor('OWNER');
    const base = {
      organizationId,
      addressLine1: 'Test',
      city: 'Makati',
      province: 'Metro Manila',
      countryCode: 'PH',
    };
    branchId = (
      await prisma.branch.create({ data: { ...base, name: 'Original' } })
    ).id;
    otherBranchId = (
      await prisma.branch.create({ data: { ...base, name: 'Other' } })
    ).id;
    inventories = [];
    for (const price of ['12.50', '0.01']) {
      const merchant = await prisma.merchant.create({
        data: {
          organizationId,
          name: randomUUID(),
          contactName: 'Test',
          phone: '09171234567',
        },
      });
      const product = await prisma.product.create({
        data: {
          organizationId,
          merchantId: merchant.id,
          name: `Original ${price}`,
        },
      });
      const inventory = await prisma.branchInventory.create({
        data: {
          organizationId,
          branchId,
          productId: product.id,
          sellingPrice: price,
          quantity: 100,
        },
      });
      inventories.push(inventory.id);
      await prisma.inventoryMovement.create({
        data: {
          organizationId,
          branchId,
          branchInventoryId: inventory.id,
          type: 'RECEIPT',
          quantityChange: 100,
          quantityAfter: 100,
          reason: 'Initial stock',
          createdById: ownerId,
          requestId: randomUUID(),
        },
      });
    }
    const sale = await checkout.complete(owner(), branchId, {
      requestId: randomUUID(),
      items: inventories.map((branchInventoryId, index) => ({
        branchInventoryId,
        quantity: index ? 5 : 10,
        expectedUnitPrice: index ? '0.01' : '12.50',
      })),
      paymentMethod: 'CASH',
      cashTender: '125.05',
    });
    saleId = sale.id;
    saleItems = inventories.map(
      (id) => sale.items.find((item) => item.branchInventoryId === id)!.id,
    );
  });
  it('returns empty history and complete original remaining quantities without writes', async () => {
    const original = await prisma.sale.findUniqueOrThrow({
      where: { id: saleId },
      include: { items: true },
    });
    expect(await history()).toMatchObject({
      scope: 'STAFF',
      items: [],
      total: 0,
      totalPages: 0,
    });
    expect((await history()).remainingItems).toEqual(
      expect.arrayContaining([
        {
          saleItemId: saleItems[0],
          soldQuantity: 10,
          returnedQuantity: 0,
          restockedQuantity: 0,
          remainingQuantity: 10,
        },
        {
          saleItemId: saleItems[1],
          soldQuantity: 5,
          returnedQuantity: 0,
          restockedQuantity: 0,
          remainingQuantity: 5,
        },
      ]),
    );
    expect(
      await prisma.sale.findUniqueOrThrow({
        where: { id: saleId },
        include: { items: true },
      }),
    ).toEqual(original);
    expect(await balance()).toBe(90);
  });
  it('paginates beyond 50 refunds while remaining quantities cover every page', async () => {
    const sale = await checkout.complete(owner(), branchId, {
      requestId: randomUUID(),
      paymentMethod: 'CASH',
      cashTender: '750.00',
      items: [
        {
          branchInventoryId: inventories[0],
          quantity: 60,
          expectedUnitPrice: '12.50',
        },
      ],
    });
    const ids: string[] = [];
    for (let n = 0; n < 55; n++)
      ids.push(
        (
          await refunds.complete(owner(), branchId, sale.id, {
            ...command(1, 0),
            items: [
              { saleItemId: sale.items[0].id, quantity: 1, restockQuantity: 0 },
            ],
          })
        ).id,
      );
    const tied = new Date('2026-09-14T00:00:00Z');
    await prisma.refund.updateMany({
      where: { organizationId, saleId: sale.id },
      data: { completedAt: tied },
    });
    const first = await reads.findAll(owner(), branchId, sale.id, {
      page: 1,
      limit: 50,
    });
    const second = await reads.findAll(owner(), branchId, sale.id, {
      page: 2,
      limit: 50,
    });
    const past = await reads.findAll(owner(), branchId, sale.id, {
      page: 3,
      limit: 50,
    });
    expect(first).toMatchObject({
      total: 55,
      totalPages: 2,
      remainingItems: [
        {
          soldQuantity: 60,
          returnedQuantity: 55,
          restockedQuantity: 0,
          remainingQuantity: 5,
        },
      ],
    });
    expect(first.items).toHaveLength(50);
    expect(second.items).toHaveLength(5);
    expect(past.items).toEqual([]);
    expect(second.remainingItems).toEqual(first.remainingItems);
    expect(past.remainingItems).toEqual(first.remainingItems);
    expect([...first.items, ...second.items].map((row) => row.id)).toEqual(
      ids.sort().reverse(),
    );
    const merchant = await merchantActor();
    const ownPage = await reads.findAll(merchant, branchId, sale.id, {
      page: 2,
      limit: 50,
    });
    expect(ownPage).toMatchObject({
      scope: 'MERCHANT',
      total: 55,
      totalPages: 2,
    });
    expect(ownPage.items).toHaveLength(5);
    expect(ownPage.remainingItems).toEqual(first.remainingItems);
  });
  it('returns the exact saved staff result, never command/request/actor fields', async () => {
    const refund = await record({
      ...command(),
      paymentMethod: 'CARD',
      paymentReference: 'MANUAL-CARD',
    });
    const persisted = () =>
      Promise.all([
        prisma.sale.findMany({
          where: { organizationId },
          include: { items: true },
          orderBy: { id: 'asc' },
        }),
        prisma.refund.findMany({
          where: { organizationId },
          include: { items: true },
          orderBy: { id: 'asc' },
        }),
        prisma.branchInventory.findMany({
          where: { organizationId },
          orderBy: { id: 'asc' },
        }),
        prisma.inventoryMovement.findMany({
          where: { organizationId },
          orderBy: { id: 'asc' },
        }),
      ]);
    const before = await persisted();
    expect(await reads.findOne(owner(), branchId, saleId, refund.id)).toEqual(
      refund,
    );
    expect((await history()).items).toEqual([refund]);
    for (const key of ['refundCommand', 'requestId', 'createdById'])
      expect((await history()).items[0]).not.toHaveProperty(key);
    expect(await persisted()).toEqual(before);
  });
  it('selects only own mixed refund lines, counts and remaining quantities for merchants', async () => {
    const merchant = await merchantActor();
    const mixed = await record({
      ...command(),
      paymentMethod: 'GCASH',
      paymentReference: 'PRIVATE',
      reason: 'PRIVATE REASON',
      items: [
        { saleItemId: saleItems[0], quantity: 2, restockQuantity: 1 },
        { saleItemId: saleItems[1], quantity: 1, restockQuantity: 0 },
      ],
    });
    const other = await record({
      ...command(),
      items: [{ saleItemId: saleItems[1], quantity: 1, restockQuantity: 0 }],
    });
    const result = await history(merchant);
    expect(result).toMatchObject({
      scope: 'MERCHANT',
      total: 1,
      remainingItems: [
        {
          saleItemId: saleItems[0],
          soldQuantity: 10,
          returnedQuantity: 2,
          restockedQuantity: 1,
          remainingQuantity: 8,
        },
      ],
      items: [
        {
          ownItemsSubtotal: '25.00',
          items: [
            { saleItemId: saleItems[0], quantity: 2, restockQuantity: 1 },
          ],
        },
      ],
    });
    const detail = await reads.findOne(merchant, branchId, saleId, mixed.id);
    expect(detail).toEqual(result.items[0]);
    expect(Object.keys(detail).sort()).toEqual(
      [
        'scope',
        'id',
        'saleId',
        'receiptCode',
        'refundCode',
        'completedAt',
        'branchId',
        'branchName',
        'branchCode',
        'ownItemsSubtotal',
        'items',
      ].sort(),
    );
    expect(detail.items).toHaveLength(1);
    expect(Object.keys(detail.items[0]).sort()).toEqual(
      [
        'id',
        'saleItemId',
        'productId',
        'productName',
        'sku',
        'barcode',
        'merchantName',
        'quantity',
        'restockQuantity',
        'unitPrice',
        'lineTotal',
      ].sort(),
    );
    expect(JSON.stringify(result)).not.toMatch(
      /PRIVATE|paymentMethod|paymentReference|createdById|refundCommand|addressLine1|contactName/,
    );
    await expect(
      reads.findOne(merchant, branchId, saleId, other.id),
    ).rejects.toThrow('Refund not found');
  });
  it('allows an own original sale with no own refund yet without exposing other refunds', async () => {
    const merchant = await merchantActor(1);
    await record();
    expect(await history(merchant)).toMatchObject({
      scope: 'MERCHANT',
      total: 0,
      items: [],
      remainingItems: [
        {
          saleItemId: saleItems[1],
          soldQuantity: 5,
          returnedQuantity: 0,
          restockedQuantity: 0,
          remainingQuantity: 5,
        },
      ],
    });
  });
  it('preserves own historical reads without assignments after lifecycle and display edits', async () => {
    const merchant = await merchantActor();
    const refund = await record();
    const before = await reads.findOne(merchant, branchId, saleId, refund.id);
    const item = await prisma.saleItem.findUniqueOrThrow({
      where: { id: saleItems[0] },
    });
    await prisma.merchant.update({
      where: { id: item.merchantId },
      data: { status: 'ENDED', name: 'Renamed' },
    });
    await prisma.product.update({
      where: { id: item.productId },
      data: { status: 'INACTIVE', name: 'Renamed' },
    });
    await prisma.branch.update({
      where: { id: branchId },
      data: { name: 'Renamed' },
    });
    expect(await reads.findOne(merchant, branchId, saleId, refund.id)).toEqual(
      before,
    );
    expect((await history(merchant)).total).toBe(1);
    const shared = await merchantActor();
    expect(await history(shared)).toEqual(await history(merchant));
  });
  it('rechecks profile relinking/unlinking rather than stale request context', async () => {
    const merchant = await merchantActor();
    const refund = await record();
    const otherItem = await prisma.saleItem.findUniqueOrThrow({
      where: { id: saleItems[1] },
    });
    await prisma.organizationMembership.update({
      where: {
        organizationId_userId: { organizationId, userId: merchant.userId },
      },
      data: { merchantId: otherItem.merchantId },
    });
    expect(await history(merchant)).toMatchObject({
      scope: 'MERCHANT',
      total: 0,
      remainingItems: [{ saleItemId: saleItems[1] }],
    });
    await expect(
      reads.findOne(merchant, branchId, saleId, refund.id),
    ).rejects.toThrow('Refund not found');
    await prisma.organizationMembership.update({
      where: {
        organizationId_userId: { organizationId, userId: merchant.userId },
      },
      data: { merchantId: null },
    });
    await expect(history(merchant)).rejects.toThrow('Sale not found');
  });
  it('does not let an assigned unrelated merchant guess another sale or refund', async () => {
    const userId = await actor('MERCHANT');
    await prisma.branchMembership.create({
      data: { organizationId, branchId, userId },
    });
    const unrelated = await prisma.merchant.create({
      data: {
        organizationId,
        name: 'Unrelated',
        contactName: 'Test',
        phone: '09171234567',
      },
    });
    await prisma.organizationMembership.update({
      where: { organizationId_userId: { organizationId, userId } },
      data: { merchantId: unrelated.id },
    });
    const refund = await record();
    await expect(
      history({ organizationId, userId, role: 'MERCHANT' }),
    ).rejects.toThrow('Sale not found');
    await expect(
      reads.findOne(
        { organizationId, userId, role: 'MERCHANT' },
        branchId,
        saleId,
        refund.id,
      ),
    ).rejects.toThrow('Sale not found');
  });
  it('requires current manager assignment for both history and detail', async () => {
    const userId = await actor('MANAGER');
    const context = { organizationId, userId, role: 'OWNER' as const };
    const refund = await record();
    await expect(history(context)).rejects.toThrow('Branch not found');
    await prisma.branchMembership.create({
      data: { organizationId, branchId, userId },
    });
    expect((await history(context)).scope).toBe('STAFF');
    expect(await reads.findOne(context, branchId, saleId, refund.id)).toEqual(
      refund,
    );
    await prisma.branchMembership.deleteMany({
      where: { organizationId, branchId, userId },
    });
    await expect(
      reads.findOne(context, branchId, saleId, refund.id),
    ).rejects.toThrow('Branch not found');
  });
  it.each(['CASHIER', 'deleted', 'removed'])(
    'denies refund reads after current access becomes %s',
    async (change) => {
      const userId = await actor('OWNER');
      const context = { organizationId, userId, role: 'OWNER' as const };
      const refund = await record();
      if (change === 'CASHIER')
        await prisma.organizationMembership.update({
          where: { organizationId_userId: { organizationId, userId } },
          data: { role: 'CASHIER' },
        });
      if (change === 'deleted')
        await prisma.user.update({
          where: { id: userId },
          data: { deletedAt: new Date() },
        });
      if (change === 'removed')
        await prisma.organizationMembership.delete({
          where: { organizationId_userId: { organizationId, userId } },
        });
      await expect(history(context)).rejects.toThrow(
        change === 'CASHIER' ? 'cannot read refunds' : 'Organization not found',
      );
      await expect(
        reads.findOne(context, branchId, saleId, refund.id),
      ).rejects.toThrow(
        change === 'CASHIER' ? 'cannot read refunds' : 'Organization not found',
      );
    },
  );
  it('uses not-found for absent, wrong-sale, wrong-branch and foreign-tenant guesses', async () => {
    const refund = await record();
    await expect(
      reads.findOne(owner(), branchId, saleId, randomUUID()),
    ).rejects.toThrow('Refund not found');
    await expect(
      reads.findOne(owner(), otherBranchId, saleId, refund.id),
    ).rejects.toThrow('Sale not found');
    const another = await checkout.complete(owner(), branchId, {
      requestId: randomUUID(),
      paymentMethod: 'CASH',
      cashTender: '12.50',
      items: [
        {
          branchInventoryId: inventories[0],
          quantity: 1,
          expectedUnitPrice: '12.50',
        },
      ],
    });
    await expect(
      reads.findOne(owner(), branchId, another.id, refund.id),
    ).rejects.toThrow('Refund not found');
    const org = await prisma.organization.create({ data: { name: 'Foreign' } });
    await prisma.organizationMembership.create({
      data: { organizationId: org.id, userId: ownerId, role: 'OWNER' },
    });
    await expect(
      reads.findAll({ ...owner(), organizationId: org.id }, branchId, saleId, {
        page: 1,
        limit: 50,
      }),
    ).rejects.toThrow('Branch not found');
    await expect(
      reads.findOne(
        { ...owner(), organizationId: org.id },
        branchId,
        saleId,
        refund.id,
      ),
    ).rejects.toThrow('Branch not found');
  });
  it('keeps history count, rows and remaining quantities in one snapshot during another refund', async () => {
    const first = await record(command(2, 1));
    let captured!: () => void, release!: () => void;
    const ready = new Promise<void>((done) => {
      captured = done;
    });
    const resumed = new Promise<void>((done) => {
      release = done;
    });
    const facade = {
      $transaction: (
        callback: (tx: Prisma.TransactionClient) => Promise<unknown>,
        options: { isolationLevel: Prisma.TransactionIsolationLevel },
      ) =>
        prisma.$transaction(
          async (tx) => {
            const intercepted = {
              ...tx,
              refund: {
                ...tx.refund,
                count: async (args: Prisma.RefundCountArgs) => {
                  const result = await tx.refund.count(args);
                  captured();
                  await resumed;
                  return result;
                },
              },
            } as unknown as Prisma.TransactionClient;
            return callback(intercepted);
          },
          { ...options, timeout: 15000 },
        ),
    };
    const pending = new RefundReadService(
      facade as unknown as PrismaService,
    ).findAll(owner(), branchId, saleId, { page: 1, limit: 50 });
    try {
      await ready;
      await record(command(3, 2));
    } finally {
      release();
    }
    expect(await pending).toMatchObject({
      total: 1,
      items: [{ id: first.id }],
      remainingItems: expect.arrayContaining([
        expect.objectContaining({
          saleItemId: saleItems[0],
          returnedQuantity: 2,
          restockedQuantity: 1,
          remainingQuantity: 8,
        }),
      ]) as unknown,
    });
    expect(await history()).toMatchObject({
      total: 2,
      remainingItems: expect.arrayContaining([
        expect.objectContaining({
          saleItemId: saleItems[0],
          returnedQuantity: 5,
          restockedQuantity: 3,
          remainingQuantity: 5,
        }),
      ]) as unknown,
    });
    await ledger();
  });
  it.each(['CASH', 'GCASH', 'CARD'] as const)(
    'records exact %s refunds against a real mixed checkout without changing the original sale',
    async (paymentMethod) => {
      const original = await prisma.sale.findUniqueOrThrow({
        where: { id: saleId },
        include: { items: true },
      });
      const dto = {
        ...command(),
        paymentMethod,
        ...(paymentMethod === 'CASH' ? {} : { paymentReference: 'MANUAL-REF' }),
        items: [
          { saleItemId: saleItems[0], quantity: 2, restockQuantity: 1 },
          { saleItemId: saleItems[1], quantity: 1, restockQuantity: 0 },
        ],
      };
      const result = await record(dto);
      expect(result).toMatchObject({
        scope: 'STAFF',
        total: '25.01',
        paymentMethod,
      });
      expect(result.items.map((item) => item.lineTotal).sort()).toEqual([
        '0.01',
        '25.00',
      ]);
      for (const key of [
        'requestId',
        'refundCommand',
        'createdById',
        'cashTender',
        'cashChange',
      ])
        expect(result).not.toHaveProperty(key);
      expect(await balance()).toBe(91);
      expect(await balance(1)).toBe(95);
      await ledger();
      await ledger(1);
      expect(
        await prisma.sale.findUniqueOrThrow({
          where: { id: saleId },
          include: { items: true },
        }),
      ).toEqual(original);
    },
  );
  it('supports successive partial/full returns and denies cumulative excess with no extra writes', async () => {
    await record(command(4, 0));
    await record(command(6, 6));
    await expect(record(command(1, 0))).rejects.toMatchObject({
      response: { code: 'RETURN_QUANTITY_EXCEEDED' },
    });
    expect(await prisma.refund.count({ where: { organizationId } })).toBe(2);
    expect(await balance()).toBe(96);
    await ledger();
  });
  it('replays after exhaustion/price/lifecycle changes without another refund or stock delta', async () => {
    const dto = command(10, 10);
    const original = await record(dto);
    const inventory = await prisma.branchInventory.findUniqueOrThrow({
      where: { id: inventories[0] },
      include: { product: true },
    });
    await prisma.branchInventory.update({
      where: { id: inventory.id },
      data: { sellingPrice: '99.99' },
    });
    await prisma.product.update({
      where: { id: inventory.productId },
      data: { status: 'INACTIVE', name: 'Changed' },
    });
    await prisma.merchant.update({
      where: { id: inventory.product.merchantId },
      data: { status: 'ENDED' },
    });
    expect(
      await record({
        ...dto,
        requestId: dto.requestId.toUpperCase(),
        reason: ' Returned goods ',
      }),
    ).toEqual(original);
    expect(await balance()).toBe(100);
    expect(await prisma.refund.count({ where: { organizationId } })).toBe(1);
    await ledger();
  });
  it('returns original saved amounts and may restock inactive records without reactivating them', async () => {
    const inventory = await prisma.branchInventory.findUniqueOrThrow({
      where: { id: inventories[0] },
      include: { product: true },
    });
    await prisma.product.update({
      where: { id: inventory.productId },
      data: { status: 'INACTIVE' },
    });
    await prisma.merchant.update({
      where: { id: inventory.product.merchantId },
      data: { status: 'ENDED' },
    });
    const result = await record();
    expect(result.total).toBe('25.00');
    expect(await balance()).toBe(91);
    expect(
      (
        await prisma.product.findUniqueOrThrow({
          where: { id: inventory.productId },
        })
      ).status,
    ).toBe('INACTIVE');
    await ledger();
  });
  it('denies foreign sale/items, another branch and a same-branch item from another sale', async () => {
    await expect(
      refunds.complete(owner(), otherBranchId, saleId, command()),
    ).rejects.toThrow('Sale not found');
    await expect(
      refunds.complete(
        { ...owner(), organizationId: randomUUID() },
        branchId,
        saleId,
        command(),
      ),
    ).rejects.toThrow('Organization not found');
    await expect(
      refunds.complete(owner(), branchId, randomUUID(), command()),
    ).rejects.toThrow('Sale not found');
    await expect(
      record({
        ...command(),
        items: [{ saleItemId: randomUUID(), quantity: 1, restockQuantity: 0 }],
      }),
    ).rejects.toThrow('Sale item not found');
    const second = await checkout.complete(owner(), branchId, {
      requestId: randomUUID(),
      items: [
        {
          branchInventoryId: inventories[0],
          quantity: 1,
          expectedUnitPrice: '12.50',
        },
      ],
      paymentMethod: 'CASH',
      cashTender: '12.50',
    });
    await expect(
      record({
        ...command(),
        items: [
          { saleItemId: second.items[0].id, quantity: 1, restockQuantity: 0 },
        ],
      }),
    ).rejects.toThrow('Sale item not found');
    expect(await prisma.refund.count({ where: { organizationId } })).toBe(0);
  });
  it('checks current manager assignments and stale-role/deleted-user authorization on creation and replay', async () => {
    const managerId = await actor('MANAGER');
    const manager = { ...owner(), userId: managerId };
    const dto = command();
    await expect(record(dto, manager)).rejects.toThrow('Branch not found');
    await prisma.branchMembership.create({
      data: { organizationId, branchId, userId: managerId },
    });
    await record(dto, manager);
    await prisma.branchMembership.delete({
      where: {
        organizationId_branchId_userId: {
          organizationId,
          branchId,
          userId: managerId,
        },
      },
    });
    await expect(record(dto, manager)).rejects.toThrow('Branch not found');
    await prisma.organizationMembership.update({
      where: { organizationId_userId: { organizationId, userId: ownerId } },
      data: { role: 'CASHIER' },
    });
    await expect(record()).rejects.toThrow('cannot issue refunds');
    await prisma.organizationMembership.update({
      where: { organizationId_userId: { organizationId, userId: ownerId } },
      data: { role: 'OWNER' },
    });
    await prisma.user.update({
      where: { id: ownerId },
      data: { deletedAt: new Date() },
    });
    await expect(record()).rejects.toThrow('Organization not found');
  });
  it('rejects other actor/content/sale/branch reuse without exposing the original command', async () => {
    const dto = command();
    await record(dto);
    const colleague = await actor('OWNER');
    for (const changed of [
      { ...dto, reason: 'Different' },
      { ...dto, items: [{ ...dto.items[0], restockQuantity: 0 }] },
      {
        ...dto,
        paymentMethod: 'GCASH' as const,
        paymentReference: 'MANUAL-REF',
      },
    ])
      await expect(record(changed)).rejects.toMatchObject({
        response: { code: 'REQUEST_ID_CONFLICT' },
      });
    await expect(
      record(dto, { ...owner(), userId: colleague }),
    ).rejects.toMatchObject({ response: { code: 'REQUEST_ID_CONFLICT' } });
    await expect(
      refunds.complete(owner(), branchId, randomUUID(), dto),
    ).rejects.toMatchObject({ response: { code: 'REQUEST_ID_CONFLICT' } });
    await expect(
      refunds.complete(owner(), otherBranchId, saleId, dto),
    ).rejects.toMatchObject({ response: { code: 'REQUEST_ID_CONFLICT' } });
    expect(await prisma.refund.count({ where: { organizationId } })).toBe(1);
  });
  it('fully rolls back overflow on a later line, including an earlier successful restock', async () => {
    const ordered = [...inventories].sort();
    const later = ordered[1];
    const index = inventories.indexOf(later);
    const difference = 2147483647 - (await balance(index));
    await stocks.adjust(organizationId, branchId, later, ownerId, {
      requestId: randomUUID(),
      quantityChange: difference,
      reason: 'Capacity test',
    });
    const before = await Promise.all(inventories.map((_, i) => balance(i)));
    await expect(
      record({
        ...command(),
        items: saleItems.map((saleItemId) => ({
          saleItemId,
          quantity: 1,
          restockQuantity: 1,
        })),
      }),
    ).rejects.toMatchObject({ response: { code: 'STOCK_OVERFLOW' } });
    expect(await Promise.all(inventories.map((_, i) => balance(i)))).toEqual(
      before,
    );
    expect(await prisma.refund.count({ where: { organizationId } })).toBe(0);
    expect(await prisma.refundItem.count({ where: { organizationId } })).toBe(
      0,
    );
    await ledger();
    await ledger(1);
  });
  it.each(['Refund', 'RefundItem', 'InventoryMovement'])(
    'rolls back all writes when %s insertion fails',
    async (table) => {
      const predicate =
        table === 'InventoryMovement'
          ? `IF NEW."type"::text = 'RETURN' THEN RAISE EXCEPTION 'Injected failure'; END IF;`
          : `RAISE EXCEPTION 'Injected failure';`;
      await admin.query(
        `CREATE FUNCTION fail_refund() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN ${predicate} RETURN NEW; END $$; CREATE TRIGGER fail_refund BEFORE INSERT ON "${table}" FOR EACH ROW EXECUTE FUNCTION fail_refund();`,
      );
      try {
        await expect(record()).rejects.toThrow();
        expect(await prisma.refund.count({ where: { organizationId } })).toBe(
          0,
        );
        expect(
          await prisma.refundItem.count({ where: { organizationId } }),
        ).toBe(0);
        expect(await balance()).toBe(90);
        await ledger();
      } finally {
        await admin.query(
          `DROP TRIGGER fail_refund ON "${table}"; DROP FUNCTION fail_refund();`,
        );
      }
    },
  );
  it('serializes competing returns so their cumulative quantity never exceeds the sale', async () => {
    const commands = [command(6, 6), command(6, 6)];
    const results = await Promise.allSettled(commands.map(retry));
    expect(
      results.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1);
    expect(
      results.filter((result) => result.status === 'rejected'),
    ).toHaveLength(1);
    expect(
      (
        await prisma.refundItem.aggregate({
          where: { organizationId, saleItemId: saleItems[0] },
          _sum: { quantity: true },
        })
      )._sum.quantity,
    ).toBe(6);
    expect(await balance()).toBe(96);
    await ledger();
  });
  it('concurrent identical commands resolve one refund and one stock movement', async () => {
    const dto = command();
    const results = await Promise.all([retry(dto), retry(dto)]);
    expect(results[0]).toEqual(results[1]);
    expect(await prisma.refund.count({ where: { organizationId } })).toBe(1);
    expect(
      await prisma.inventoryMovement.count({
        where: { organizationId, type: 'RETURN' },
      }),
    ).toBe(1);
    expect(await balance()).toBe(91);
    await ledger();
  });
  it('concurrent conflicting commands sharing an ID cannot issue a second refund', async () => {
    const dto = command();
    const results = await Promise.allSettled([
      retry(dto),
      retry({ ...dto, reason: 'Another reason' }),
    ]);
    expect(
      results.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1);
    expect(await prisma.refund.count({ where: { organizationId } })).toBe(1);
    await ledger();
  });
  it('competing stock receipt/correction and refund increments keep exact balances and movement history', async () => {
    const result = await Promise.allSettled([
      retry(command(2, 2)),
      stocks.receive(organizationId, branchId, inventories[0], ownerId, {
        requestId: randomUUID(),
        quantity: 3,
        reason: 'New stock',
      }),
      stocks.adjust(organizationId, branchId, inventories[0], ownerId, {
        requestId: randomUUID(),
        quantityChange: -1,
        reason: 'Correction',
      }),
    ]);
    expect(result.every((entry) => entry.status === 'fulfilled')).toBe(true);
    expect(await balance()).toBe(94);
    await ledger();
  });
  it('keeps checkout deductions and concurrent return additions consistent', async () => {
    const checkoutCommand = {
      requestId: randomUUID(),
      items: [
        {
          branchInventoryId: inventories[0],
          quantity: 1,
          expectedUnitPrice: '12.50',
        },
      ],
      paymentMethod: 'CASH' as const,
      cashTender: '12.50',
    };
    const sell = async () => {
      for (let attempt = 0; attempt < 5; attempt++) {
        try {
          return await checkout.complete(owner(), branchId, checkoutCommand);
        } catch (error: unknown) {
          if (!(error instanceof Error) || !('getResponse' in error))
            throw error;
          const response = (
            error as { getResponse(): unknown }
          ).getResponse() as { code?: string };
          if (response.code !== 'CHECKOUT_RETRY') throw error;
        }
      }
      throw new Error('Explicit checkout retry bound exhausted');
    };
    const snapshots = Array.from({ length: 8 }, () =>
      reconciliation.reconcile(owner(), branchId, { limit: 25 }),
    );
    const results = await Promise.all([
      ...snapshots,
      retry(command(2, 2)),
      sell(),
    ]);
    expect(results.slice(0, snapshots.length)).toEqual(
      Array.from({ length: snapshots.length }, () => ({
        items: [],
        nextCursor: null,
      })),
    );
    expect(await balance()).toBe(91);
    await ledger();
    await stocks.adjust(organizationId, branchId, inventories[0], ownerId, {
      requestId: randomUUID(),
      quantityChange: -1,
      reason: 'Correction',
    });
    expect(
      await reconciliation.reconcile(owner(), branchId, { limit: 25 }),
    ).toEqual({ items: [], nextCursor: null });
    expect(
      new Set(
        (
          await prisma.inventoryMovement.findMany({
            where: {
              organizationId,
              branchId,
              branchInventoryId: inventories[0],
            },
            select: { type: true },
          })
        ).map((movement) => movement.type),
      ),
    ).toEqual(new Set(['RECEIPT', 'SALE', 'RETURN', 'ADJUSTMENT']));
  });
  it('refunds and restocks the maximum 100-line price/quantity capacity without rounding', async () => {
    const merchantId = (
      await prisma.product.findUniqueOrThrow({
        where: {
          id: (
            await prisma.branchInventory.findUniqueOrThrow({
              where: { id: inventories[0] },
            })
          ).productId,
        },
      })
    ).merchantId;
    const maximum: string[] = [];
    for (let index = 0; index < 100; index++) {
      const product = await prisma.product.create({
        data: { organizationId, merchantId, name: `Maximum ${index}` },
      });
      const inventory = await prisma.branchInventory.create({
        data: {
          organizationId,
          branchId,
          productId: product.id,
          sellingPrice: '9999999999.99',
          quantity: 2147483647,
        },
      });
      maximum.push(inventory.id);
      await prisma.inventoryMovement.create({
        data: {
          organizationId,
          branchId,
          branchInventoryId: inventory.id,
          type: 'RECEIPT',
          quantityChange: 2147483647,
          quantityAfter: 2147483647,
          reason: 'Maximum capacity',
          createdById: ownerId,
          requestId: randomUUID(),
        },
      });
    }
    const Exact = Prisma.Decimal.clone({ precision: 40 });
    const lineTotal = new Exact('9999999999.99').times(2147483647);
    const total = lineTotal.times(100).toFixed(2);
    const sale = await checkout.complete(owner(), branchId, {
      requestId: randomUUID(),
      items: maximum.map((branchInventoryId) => ({
        branchInventoryId,
        quantity: 2147483647,
        expectedUnitPrice: '9999999999.99',
      })),
      paymentMethod: 'CASH',
      cashTender: total,
    });
    const result = await refunds.complete(owner(), branchId, sale.id, {
      ...command(),
      items: sale.items.map((item) => ({
        saleItemId: item.id,
        quantity: 2147483647,
        restockQuantity: 2147483647,
      })),
    });
    expect(result.total).toBe(total);
    expect(result.items).toHaveLength(100);
    expect(
      result.items.every((item) => item.lineTotal === lineTotal.toFixed(2)),
    ).toBe(true);
    expect(
      await prisma.inventoryMovement.count({
        where: { organizationId, type: 'RETURN' },
      }),
    ).toBe(100);
    const restored = await prisma.branchInventory.findMany({
      where: { organizationId, branchId, id: { in: maximum } },
    });
    expect(restored.every((item) => item.quantity === 2147483647)).toBe(true);
    expect(await reads.findOne(owner(), branchId, sale.id, result.id)).toEqual(
      result,
    );
    const merchant = await merchantActor();
    const own = await reads.findOne(merchant, branchId, sale.id, result.id);
    expect(own).toMatchObject({ scope: 'MERCHANT', ownItemsSubtotal: total });
    expect(own.items).toHaveLength(100);
    const remaining = await reads.findAll(merchant, branchId, sale.id, {
      page: 1,
      limit: 50,
    });
    expect(remaining.remainingItems).toHaveLength(100);
    expect(
      remaining.remainingItems.every(
        (item) =>
          item.soldQuantity === 2147483647 &&
          item.returnedQuantity === 2147483647 &&
          item.restockedQuantity === 2147483647 &&
          item.remainingQuantity === 0,
      ),
    ).toBe(true);
  });
});
