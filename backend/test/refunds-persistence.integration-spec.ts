import {
  provisionPaymentFixtures,
  testAccountId,
  testAccountSnapshot,
} from './payment-account-fixtures';
import { fixtureInventory } from './merchant-branch-fixtures';
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
const schema = `refunds_test_${randomUUID().replaceAll('-', '')}`;
const admin = new Client({ connectionString });
const prisma = new PrismaClient({
  adapter: new PrismaPg(
    { connectionString, options: `-c search_path=${schema}` },
    { schema },
  ),
});

async function fixture(legacySchema = false) {
  const organization = await prisma.organization.create({
    data: { name: randomUUID() },
  });
  const user = legacySchema
    ? await (async () => {
        const id = randomUUID();
        await admin.query(
          'INSERT INTO "User" ("id","firstName","lastName","email","passwordHash","createdAt","updatedAt") VALUES ($1,$2,$3,$4,$5,NOW(),NOW())',
          [id, 'Test', 'Actor', `${randomUUID()}@example.test`, 'unused'],
        );
        return { id };
      })()
    : await prisma.user.create({
        data: {
          firstName: 'Test',
          lastName: 'Actor',
          email: `${randomUUID()}@example.test`,
          passwordHash: 'unused',
        },
      });
  const branch = legacySchema
    ? await (async () => {
        const id = randomUUID();
        await admin.query(
          'INSERT INTO "Branch" ("id","organizationId","name","addressLine1","city","province","countryCode","createdAt","updatedAt") VALUES ($1,$2,$3,$4,$5,$6,$7,NOW(),NOW())',
          [
            id,
            organization.id,
            'Original',
            'Test',
            'Makati',
            'Metro Manila',
            'PH',
          ],
        );
        return { id };
      })()
    : await prisma.branch.create({
        data: {
          organizationId: organization.id,
          name: 'Original',
          addressLine1: 'Test',
          city: 'Makati',
          province: 'Metro Manila',
          countryCode: 'PH',
        },
      });
  const merchant = await prisma.merchant.create({
    data: {
      organizationId: organization.id,
      name: 'Original business',
      contactName: 'Test',
      phone: '09171234567',
    },
  });
  const product = await prisma.product.create({
    data: {
      organizationId: organization.id,
      merchantId: merchant.id,
      name: 'Original goods',
    },
  });
  const inventory = legacySchema
    ? await (async () => {
        const id = randomUUID();
        const now = new Date();
        await admin.query(
          'INSERT INTO "BranchInventory" ("id", "organizationId", "branchId", "productId", "sellingPrice", "quantity", "createdAt", "updatedAt") VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
          [id, organization.id, branch.id, product.id, '12.50', 3, now, now],
        );
        return {
          id,
          organizationId: organization.id,
          branchId: branch.id,
          productId: product.id,
          sellingPrice: new Prisma.Decimal('12.50'),
          quantity: 3,
          lowStockThreshold: 5,
          createdAt: now,
          updatedAt: now,
        };
      })()
    : await fixtureInventory(prisma, {
        data: {
          organizationId: organization.id,
          branchId: branch.id,
          productId: product.id,
          sellingPrice: '12.50',
          quantity: 3,
        },
      });
  if (!legacySchema) await provisionPaymentFixtures(prisma, organization.id);
  const sale = legacySchema
    ? (
        await admin.query<Prisma.SaleGetPayload<Prisma.SaleDefaultArgs>>(
          `INSERT INTO "Sale" ("id","organizationId","branchId","createdById","receiptCode","requestId","paymentMethod","cashTender","cashChange","total","organizationName","branchName","cashierName","checkoutCommand") VALUES ($1,$2,$3,$4,$5,$6,'CASH',125,0,125,'Original store','Original','Original actor','{}') RETURNING *`,
          [
            randomUUID(),
            organization.id,
            branch.id,
            user.id,
            randomUUID(),
            randomUUID(),
          ],
        )
      ).rows[0]
    : await prisma.sale.create({
        data: {
          organizationId: organization.id,
          branchId: branch.id,
          createdById: user.id,
          receiptCode: randomUUID(),
          requestId: randomUUID(),
          ...testAccountSnapshot(organization.id),
          cashTender: '125.00',
          cashChange: '0.00',
          total: '125.00',
          organizationName: 'Original store',
          branchName: 'Original',
          cashierName: 'Original actor',
          checkoutCommand: {},
        },
      });
  const item = await prisma.saleItem.create({
    data: {
      organizationId: organization.id,
      branchId: branch.id,
      saleId: sale.id,
      branchInventoryId: inventory.id,
      productId: product.id,
      merchantId: merchant.id,
      quantity: 10,
      unitPrice: '12.50',
      lineTotal: '125.00',
      productName: 'Original goods',
      merchantName: 'Original business',
    },
  });
  return {
    organization,
    user,
    branch,
    merchant,
    product,
    inventory,
    sale,
    item,
  };
}
type Fixture = Awaited<ReturnType<typeof fixture>>;
let current: Fixture;
let legacy: Fixture;
let legacyProof: {
  sale: unknown;
  item: unknown;
  movements: {
    refundItemId: string | null;
    saleItemId: string | null;
    type: string;
  }[];
  refunds: number;
  quantity: number;
};
const refundData = (
  extra: Partial<Prisma.RefundUncheckedCreateInput> = {},
): Prisma.RefundUncheckedCreateInput => ({
  organizationId: current.organization.id,
  branchId: current.branch.id,
  saleId: current.sale.id,
  refundCode: randomUUID(),
  requestId: randomUUID(),
  createdById: current.user.id,
  reason: 'Returned goods',
  ...testAccountSnapshot(current.organization.id),
  total: '25.00',
  refundCommand: {
    items: [{ saleItemId: current.item.id, quantity: 2, restockQuantity: 1 }],
  },
  ...extra,
});
const itemData = (
  refundId: string,
  extra: Partial<Prisma.RefundItemUncheckedCreateInput> = {},
): Prisma.RefundItemUncheckedCreateInput => ({
  organizationId: current.organization.id,
  branchId: current.branch.id,
  saleId: current.sale.id,
  refundId,
  saleItemId: current.item.id,
  branchInventoryId: current.inventory.id,
  merchantId: current.merchant.id,
  quantity: 2,
  restockQuantity: 1,
  unitPrice: '12.50',
  lineTotal: '25.00',
  ...extra,
});
const movementData = (
  refundItemId: string,
  extra: Partial<Prisma.InventoryMovementUncheckedCreateInput> = {},
): Prisma.InventoryMovementUncheckedCreateInput => ({
  organizationId: current.organization.id,
  branchId: current.branch.id,
  branchInventoryId: current.inventory.id,
  refundItemId,
  type: 'RETURN',
  quantityChange: 1,
  quantityAfter: 4,
  reason: 'Returned goods',
  createdById: current.user.id,
  requestId: randomUUID(),
  ...extra,
});

describe('PostgreSQL refund persistence', () => {
  beforeAll(async () => {
    await admin.connect();
    await admin.query(`CREATE SCHEMA "${schema}"`);
    await admin.query(`SET search_path TO "${schema}"`);
    const migrations = join(__dirname, '../prisma/migrations');
    await admin.query(
      readFileSync(
        join(migrations, '20260911010000_foundation_baseline', 'migration.sql'),
        'utf8',
      ),
    );
    await admin.query(
      readFileSync(
        join(
          migrations,
          '20261025010000_add_controlled_access',
          'migration.sql',
        ),
        'utf8',
      ),
    );
    for (const directory of readdirSync(migrations)
      .filter(
        (name) =>
          /^\d/.test(name) &&
          name !== '20260911010000_foundation_baseline' &&
          name !== '20261025010000_add_controlled_access',
      )
      .sort()) {
      if (directory === '20260914020000_add_refund_persistence') {
        legacy = await fixture(true);
        for (const movement of [
          { type: 'RECEIPT', delta: 13, after: 13, itemId: null },
          { type: 'SALE', delta: -10, after: 3, itemId: legacy.item.id },
        ])
          await admin.query(
            'INSERT INTO "InventoryMovement" ("id", "organizationId", "branchId", "branchInventoryId", "type", "quantityChange", "quantityAfter", "reason", "createdById", "requestId", "saleItemId") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)',
            [
              randomUUID(),
              legacy.organization.id,
              legacy.branch.id,
              legacy.inventory.id,
              movement.type,
              movement.delta,
              movement.after,
              'Legacy history',
              legacy.user.id,
              randomUUID(),
              movement.itemId,
            ],
          );
      }
      if (directory === '20261025020000_payment_accounts') {
        legacyProof = {
          sale: (
            await admin.query('SELECT * FROM "Sale" WHERE "id"=$1', [
              legacy.sale.id,
            ])
          ).rows[0] as unknown,
          item: await prisma.saleItem.findUniqueOrThrow({
            where: { id: legacy.item.id },
          }),
          movements: await prisma.inventoryMovement.findMany({
            where: { branchInventoryId: legacy.inventory.id },
          }),
          refunds: await prisma.refund.count({
            where: { organizationId: legacy.organization.id },
          }),
          quantity: (
            await prisma.branchInventory.findUniqueOrThrow({
              where: { id: legacy.inventory.id },
            })
          ).quantity,
        };
        await expect(
          admin.query(
            readFileSync(join(migrations, directory, 'migration.sql'), 'utf8'),
          ),
        ).rejects.toThrow('requires empty Sale and Refund');
        await admin.query('ROLLBACK');
        await admin.query(
          'DELETE FROM "InventoryMovement" WHERE "saleItemId"=$1',
          [legacy.item.id],
        );
        await admin.query('DELETE FROM "SaleItem" WHERE "id"=$1', [
          legacy.item.id,
        ]);
        await admin.query('DELETE FROM "Sale" WHERE "id"=$1', [legacy.sale.id]);
      }
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
    current = await fixture();
  });

  it('upgrades existing sales/stock history without changing records or creating refunds', () => {
    expect(legacyProof.sale).toEqual(legacy.sale);
    expect(legacyProof.item).toEqual(legacy.item);
    const movements = legacyProof.movements;
    expect(movements).toHaveLength(2);
    expect(movements.every((movement) => movement.refundItemId === null)).toBe(
      true,
    );
    expect(
      movements.find((movement) => movement.type === 'SALE')?.saleItemId,
    ).toBe(legacy.item.id);
    expect(legacyProof.refunds).toBe(0);
    expect(legacyProof.quantity).toBe(3);
  });

  it.each(['CASH', 'GCASH', 'CARD'] as const)(
    'persists exact %s manual refunds independently of original payment',
    async (paymentMethod) => {
      const refund = await prisma.refund.create({
        data: refundData({
          ...testAccountSnapshot(current.organization.id, paymentMethod),
          paymentAccountId: testAccountId(
            current.organization.id,
            paymentMethod,
          ),
          paymentReference: paymentMethod === 'CASH' ? null : 'MANUAL-REF',
        }),
      });
      const item = await prisma.refundItem.create({
        data: itemData(refund.id),
      });
      expect(refund.total.toFixed(2)).toBe('25.00');
      expect(item.lineTotal.toFixed(2)).toBe('25.00');
      expect(refund.paymentAccountId).toBe(
        testAccountId(current.organization.id, paymentMethod),
      );
      expect(
        (
          await prisma.sale.findUniqueOrThrow({
            where: { id: current.sale.id },
          })
        ).paymentAccountId,
      ).toBe(testAccountId(current.organization.id));
    },
  );
  it.each([
    { total: '0' },
    { total: '-1' },
    { total: 'NaN' },
    { refundCode: ' ' },
    { refundCode: ' REF ' },
    { reason: 'x' },
    { reason: 'x'.repeat(501) },
    { reason: ' reason ' },
    { refundCommand: [] },
    { paymentReference: 'CASH-REFERENCE' },
    {
      paymentAccountId: 'GCASH',
      paymentReference: null,
    },
    {
      paymentAccountId: 'CARD',
      paymentReference: 'x',
    },
    {
      paymentAccountId: 'CARD',
      paymentReference: 'x'.repeat(101),
    },
    {
      paymentAccountId: 'GCASH',
      paymentReference: ' REF ',
    },
  ])('rejects invalid refund fields %j', async (extra) => {
    await expect(
      prisma.refund.create({
        data: refundData({
          ...extra,
          ...('paymentAccountId' in extra
            ? testAccountSnapshot(
                current.organization.id,
                extra.paymentAccountId,
              )
            : {}),
        }),
      }),
    ).rejects.toThrow();
  });
  it.each([
    { quantity: 0 },
    { quantity: -1 },
    { restockQuantity: -1 },
    { restockQuantity: 3 },
    { unitPrice: '0' },
    { unitPrice: 'NaN' },
    { unitPrice: '13.00', lineTotal: '26.00' },
    { lineTotal: '24.99' },
    { lineTotal: 'NaN' },
  ])(
    'rejects invalid restock/quantity/original-price fields %j',
    async (extra) => {
      const refund = await prisma.refund.create({ data: refundData() });
      await expect(
        prisma.refundItem.create({ data: itemData(refund.id, extra) }),
      ).rejects.toThrow();
    },
  );
  it('permits zero, partial and full restocking, with no automatic inventory side effect', async () => {
    for (const restockQuantity of [0, 1, 2]) {
      const refund = await prisma.refund.create({ data: refundData() });
      await prisma.refundItem.create({
        data: itemData(refund.id, { restockQuantity }),
      });
    }
    expect(
      (
        await prisma.branchInventory.findUniqueOrThrow({
          where: { id: current.inventory.id },
        })
      ).quantity,
    ).toBe(3);
    expect(
      await prisma.inventoryMovement.count({
        where: { organizationId: current.organization.id },
      }),
    ).toBe(0);
  });
  it('enforces request/code and per-refund original-line uniqueness but permits later partial refunds', async () => {
    const refund = await prisma.refund.create({ data: refundData() });
    await expect(
      prisma.refund.create({
        data: refundData({ requestId: refund.requestId }),
      }),
    ).rejects.toThrow();
    await expect(
      prisma.refund.create({
        data: refundData({ refundCode: refund.refundCode }),
      }),
    ).rejects.toThrow();
    await prisma.refundItem.create({ data: itemData(refund.id) });
    await expect(
      prisma.refundItem.create({ data: itemData(refund.id) }),
    ).rejects.toThrow();
    const later = await prisma.refund.create({ data: refundData() });
    await prisma.refundItem.create({ data: itemData(later.id) });
    const foreign = await fixture();
    await prisma.refund.create({
      data: {
        ...refundData({
          requestId: refund.requestId,
          refundCode: refund.refundCode,
        }),
        organizationId: foreign.organization.id,
        branchId: foreign.branch.id,
        saleId: foreign.sale.id,
        ...testAccountSnapshot(foreign.organization.id),
      },
    });
  });
  it('rejects cross-tenant/branch/sale/placement/merchant links', async () => {
    const foreign = await fixture();
    const otherBranch = await prisma.branch.create({
      data: {
        organizationId: current.organization.id,
        name: 'Other',
        addressLine1: 'Test',
        city: 'Makati',
        province: 'Metro Manila',
        countryCode: 'PH',
      },
    });
    for (const extra of [
      { organizationId: foreign.organization.id },
      { branchId: foreign.branch.id },
      { branchId: otherBranch.id },
      { saleId: foreign.sale.id },
    ])
      await expect(
        prisma.refund.create({ data: refundData(extra) }),
      ).rejects.toThrow();
    const refund = await prisma.refund.create({ data: refundData() });
    const sameBranchSale = await prisma.sale.create({
      data: {
        ...current.sale,
        id: randomUUID(),
        receiptCode: randomUUID(),
        requestId: randomUUID(),
        checkoutCommand: {},
      },
    });
    const sameBranchItem = await prisma.saleItem.create({
      data: { ...current.item, id: randomUUID(), saleId: sameBranchSale.id },
    });
    await expect(
      prisma.refundItem.create({
        data: itemData(refund.id, { saleItemId: sameBranchItem.id }),
      }),
    ).rejects.toThrow();
    for (const extra of [
      { refundId: randomUUID() },
      { saleItemId: foreign.item.id },
      { saleId: foreign.sale.id },
      { branchId: otherBranch.id },
      { organizationId: foreign.organization.id },
      { branchInventoryId: foreign.inventory.id },
      { merchantId: foreign.merchant.id },
    ])
      await expect(
        prisma.refundItem.create({ data: itemData(refund.id, extra) }),
      ).rejects.toThrow();
  });
  it('ties each positive RETURN exactly to its original restock quantity and allows only one movement', async () => {
    const refund = await prisma.refund.create({ data: refundData() });
    const item = await prisma.refundItem.create({ data: itemData(refund.id) });
    const foreign = await fixture();
    for (const extra of [
      { refundItemId: null },
      { refundItemId: randomUUID() },
      { quantityChange: 0 },
      { quantityChange: -1 },
      { quantityChange: 2 },
      { type: 'RECEIPT' as const },
      { type: 'ADJUSTMENT' as const },
      { type: 'SALE' as const, saleItemId: current.item.id },
      { branchInventoryId: foreign.inventory.id },
      { branchId: foreign.branch.id },
      { organizationId: foreign.organization.id },
    ])
      await expect(
        prisma.inventoryMovement.create({ data: movementData(item.id, extra) }),
      ).rejects.toThrow();
    await prisma.inventoryMovement.create({ data: movementData(item.id) });
    await expect(
      prisma.inventoryMovement.create({ data: movementData(item.id) }),
    ).rejects.toThrow();
    await expect(
      prisma.refundItem.update({
        where: { id: item.id },
        data: { restockQuantity: 2 },
      }),
    ).rejects.toThrow();
    const zeroRefund = await prisma.refund.create({ data: refundData() });
    const zero = await prisma.refundItem.create({
      data: itemData(zeroRefund.id, { restockQuantity: 0 }),
    });
    await expect(
      prisma.inventoryMovement.create({ data: movementData(zero.id) }),
    ).rejects.toThrow();
  });
  it('rolls back refund/items/stock when return movement fails and preserves the original sale', async () => {
    await expect(
      prisma.$transaction(async (tx) => {
        const refund = await tx.refund.create({ data: refundData() });
        const item = await tx.refundItem.create({ data: itemData(refund.id) });
        await tx.branchInventory.update({
          where: { id: current.inventory.id },
          data: { quantity: { increment: 1 } },
        });
        await tx.inventoryMovement.create({
          data: movementData(item.id, { quantityChange: 2 }),
        });
      }),
    ).rejects.toThrow();
    expect(
      await prisma.refund.count({
        where: { organizationId: current.organization.id },
      }),
    ).toBe(0);
    expect(
      await prisma.refundItem.count({
        where: { organizationId: current.organization.id },
      }),
    ).toBe(0);
    expect(
      (
        await prisma.branchInventory.findUniqueOrThrow({
          where: { id: current.inventory.id },
        })
      ).quantity,
    ).toBe(3);
    expect(
      await prisma.sale.findUniqueOrThrow({ where: { id: current.sale.id } }),
    ).toEqual(current.sale);
    expect(
      await prisma.saleItem.findUniqueOrThrow({
        where: { id: current.item.id },
      }),
    ).toEqual(current.item);
  });
  it('preserves source snapshots after lifecycle/identity changes and restricts history deletion', async () => {
    const refund = await prisma.refund.create({ data: refundData() });
    const item = await prisma.refundItem.create({ data: itemData(refund.id) });
    await prisma.inventoryMovement.create({ data: movementData(item.id) });
    await prisma.product.update({
      where: { id: current.product.id },
      data: { name: 'Changed', status: 'INACTIVE' },
    });
    await prisma.merchant.update({
      where: { id: current.merchant.id },
      data: { name: 'Changed', status: 'ENDED' },
    });
    await prisma.organizationMembership.create({
      data: {
        organizationId: current.organization.id,
        userId: current.user.id,
        role: 'OWNER',
      },
    });
    await prisma.organizationMembership.delete({
      where: {
        organizationId_userId: {
          organizationId: current.organization.id,
          userId: current.user.id,
        },
      },
    });
    await prisma.user.update({
      where: { id: current.user.id },
      data: { deletedAt: new Date() },
    });
    expect(
      (await prisma.refund.findUniqueOrThrow({ where: { id: refund.id } }))
        .createdById,
    ).toBe(current.user.id);
    expect(
      (
        await prisma.refundItem.findUniqueOrThrow({
          where: { id: item.id },
          include: { saleItem: true },
        })
      ).saleItem,
    ).toMatchObject({
      productName: 'Original goods',
      merchantName: 'Original business',
      unitPrice: current.item.unitPrice,
    });
    await expect(
      prisma.saleItem.update({
        where: { id: current.item.id },
        data: { unitPrice: '13.00', lineTotal: '130.00' },
      }),
    ).rejects.toThrow();
    for (const deletion of [
      () => prisma.refund.delete({ where: { id: refund.id } }),
      () => prisma.refundItem.delete({ where: { id: item.id } }),
      () => prisma.saleItem.delete({ where: { id: current.item.id } }),
      () => prisma.sale.delete({ where: { id: current.sale.id } }),
      () => prisma.user.delete({ where: { id: current.user.id } }),
    ])
      await expect(deletion()).rejects.toThrow();
  });
  it('keeps both private links and merchant actors out of existing inventory history', async () => {
    const refund = await prisma.refund.create({ data: refundData() });
    const item = await prisma.refundItem.create({ data: itemData(refund.id) });
    await prisma.inventoryMovement.create({ data: movementData(item.id) });
    const service = new BranchInventoryService(
      prisma as unknown as PrismaService,
    );
    for (const context of [
      undefined,
      {
        organizationId: current.organization.id,
        userId: current.user.id,
        role: 'MERCHANT' as const,
        merchantId: current.merchant.id,
      },
    ]) {
      const history = await service.findMovements(
        current.organization.id,
        current.branch.id,
        current.inventory.id,
        context,
      );
      expect(history.items).toHaveLength(1);
      expect(history.items[0].type).toBe('RETURN');
      expect(history.items[0]).not.toHaveProperty('refundItemId');
      expect(history.items[0]).not.toHaveProperty('saleItemId');
      if (context) expect(history.items[0]).not.toHaveProperty('createdById');
    }
  });
  it('supports maximum original price/quantity and whole-refund decimal capacity exactly', async () => {
    const Exact = Prisma.Decimal.clone({ precision: 40 });
    const lineTotal = new Exact('9999999999.99').times(2147483647);
    const total = lineTotal.times(100);
    await prisma.sale.update({
      where: { id: current.sale.id },
      data: { total, cashTender: total, cashChange: '0.00' },
    });
    await prisma.saleItem.update({
      where: { id: current.item.id },
      data: { quantity: 2147483647, unitPrice: '9999999999.99', lineTotal },
    });
    const refund = await prisma.refund.create({ data: refundData({ total }) });
    const item = await prisma.refundItem.create({
      data: itemData(refund.id, {
        quantity: 2147483647,
        restockQuantity: 2147483647,
        unitPrice: '9999999999.99',
        lineTotal,
      }),
    });
    expect(refund.total.toFixed(2)).toBe(total.toFixed(2));
    expect(item.lineTotal.toFixed(2)).toBe(lineTotal.toFixed(2));
  });
});
