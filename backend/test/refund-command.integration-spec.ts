import { randomUUID } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { PrismaPg } from '@prisma/adapter-pg';
import { Client } from 'pg';
import { Prisma, PrismaClient } from '../src/generated/prisma/client';
import { PrismaService } from '../src/infrastructure/database/prisma.service';
import { CheckoutService } from '../src/modules/organizations/sales/checkout.service';
import { RefundsService } from '../src/modules/organizations/refunds/refunds.service';
import { InventoryStockService } from '../src/modules/organizations/inventory/inventory-stock.service';
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
const checkout = new CheckoutService(prisma as unknown as PrismaService);
const stocks = new InventoryStockService(prisma as unknown as PrismaService);
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
    await Promise.all([retry(command(2, 2)), sell()]);
    expect(await balance()).toBe(91);
    await ledger();
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
  });
});
