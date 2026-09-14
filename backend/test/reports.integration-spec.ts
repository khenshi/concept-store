import { randomUUID } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { PrismaPg } from '@prisma/adapter-pg';
import { Client } from 'pg';
import { Prisma, PrismaClient } from '../src/generated/prisma/client';
import { PrismaService } from '../src/infrastructure/database/prisma.service';
import { ReportsService } from '../src/modules/organizations/reports/reports.service';
import { ProductsService } from '../src/modules/organizations/products/products.service';
import { CheckoutService } from '../src/modules/organizations/sales/checkout.service';
import { RefundsService } from '../src/modules/organizations/refunds/refunds.service';
import type { OrganizationContext } from '../src/modules/organizations/authorization/organization-authorization.types';
import type { SalesReport } from '../src/modules/organizations/reports/reports.types';

const connectionString = process.env.TEST_DATABASE_URL;
if (!connectionString)
  throw new Error(
    'Set TEST_DATABASE_URL to an explicitly disposable PostgreSQL test database',
  );
const schema = `reports_test_${randomUUID().replaceAll('-', '')}`;
const admin = new Client({ connectionString });
const prisma = new PrismaClient({
  adapter: new PrismaPg(
    { connectionString, options: `-c search_path=${schema}`, max: 20 },
    { schema },
  ),
});
const reports = new ReportsService(prisma as unknown as PrismaService);
const products = new ProductsService(prisma as unknown as PrismaService);
const checkout = new CheckoutService(prisma as unknown as PrismaService);
const refunds = new RefundsService(prisma as unknown as PrismaService);
async function refund(
  sale: Awaited<ReturnType<typeof complete>>,
  lines: [number, number][],
  method: 'CASH' | 'GCASH' | 'CARD' = 'CASH',
  completedAt = '2026-09-01T19:00:00Z',
) {
  const result = await refunds.complete(context(), branchId, sale.id, {
    requestId: randomUUID(),
    reason: 'Private return reason',
    paymentMethod: method,
    refundConfirmed: true,
    ...(method === 'CASH'
      ? {}
      : { paymentReference: 'PRIVATE-REFUND-REFERENCE' }),
    items: lines.map(([index, quantity]) => ({
      saleItemId: sale.items.find(
        (item) => item.branchInventoryId === inventories[index],
      )!.id,
      quantity,
      restockQuantity: 0,
    })),
  });
  await prisma.refund.update({
    where: { id: result.id },
    data: { completedAt: new Date(completedAt) },
  });
  return result;
}
const range = { from: '2026-09-01T16:00:00Z', until: '2026-09-02T16:00:00Z' };
let organizationId: string;
let branchId: string;
let emptyBranchId: string;
let ownerId: string;
let managerId: string;
let merchantUserId: string;
let cashierId: string;
let merchantId: string;
let otherMerchantId: string;
let inventories: string[];
const context = (userId = ownerId): OrganizationContext => ({
  organizationId,
  userId,
  role: 'OWNER',
});
const identity = (id: string) => ({
  id,
  name: id === branchId ? 'First' : 'Empty',
  code: null,
});
async function actor(role: OrganizationContext['role'], link?: string) {
  const user = await prisma.user.create({
    data: {
      firstName: 'Test',
      lastName: role,
      email: `${randomUUID()}@example.test`,
      passwordHash: 'unused',
    },
  });
  await prisma.organizationMembership.create({
    data: { organizationId, userId: user.id, role, merchantId: link },
  });
  return user.id;
}
async function complete(
  method: 'CASH' | 'GCASH' | 'CARD',
  lines: [number, number][],
  actorId = ownerId,
) {
  const sale = await checkout.complete(context(actorId), branchId, {
    requestId: randomUUID(),
    items: lines.map(([index, quantity]) => ({
      branchInventoryId: inventories[index],
      quantity,
      expectedUnitPrice: ['12.50', '0.01', '5.00'][index],
    })),
    paymentMethod: method,
    ...(method === 'CASH'
      ? { cashTender: '100.00' }
      : { paymentReference: 'manual-test-reference' }),
  });
  await prisma.sale.update({
    where: { id: sale.id },
    data: { completedAt: new Date('2026-09-01T18:00:00Z') },
  });
  return sale;
}
async function mixedSales() {
  return [
    await complete('CASH', [
      [0, 2],
      [1, 3],
      [2, 4],
    ]),
    await complete('GCASH', [
      [0, 1],
      [2, 1],
    ]),
    await complete('CARD', [[2, 2]]),
  ];
}
async function read(userId = ownerId) {
  return reports.sales(context(userId), branchId, range);
}

describe('PostgreSQL branch sales reporting', () => {
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
    const merchantData = {
      organizationId,
      contactName: 'Contact',
      phone: '09171234567',
    };
    merchantId = (
      await prisma.merchant.create({
        data: { ...merchantData, name: 'Own merchant', code: 'OWN' },
      })
    ).id;
    otherMerchantId = (
      await prisma.merchant.create({
        data: { ...merchantData, name: 'Other merchant', code: 'OTHER' },
      })
    ).id;
    managerId = await actor('MANAGER');
    merchantUserId = await actor('MERCHANT', merchantId);
    cashierId = await actor('CASHIER');
    const branchData = {
      organizationId,
      addressLine1: 'Test',
      city: 'Makati',
      province: 'Metro Manila',
      countryCode: 'PH',
    };
    branchId = (
      await prisma.branch.create({ data: { ...branchData, name: 'First' } })
    ).id;
    emptyBranchId = (
      await prisma.branch.create({ data: { ...branchData, name: 'Empty' } })
    ).id;
    await prisma.branchMembership.createMany({
      data: [
        { organizationId, branchId, userId: managerId },
        { organizationId, branchId, userId: cashierId },
        { organizationId, branchId: emptyBranchId, userId: merchantUserId },
      ],
    });
    inventories = [];
    for (let index = 0; index < 3; index++) {
      const created = await products.create(
        organizationId,
        {
          merchantId: index === 2 ? otherMerchantId : merchantId,
          name: `Product ${index}`,
          requestId: randomUUID(),
          initialInventory: {
            branchId,
            sellingPrice: ['12.50', '0.01', '5.00'][index],
            quantity: 100,
          },
        },
        ownerId,
      );
      inventories.push(
        (
          await prisma.branchInventory.findFirstOrThrow({
            where: { organizationId, productId: created.id },
          })
        ).id,
      );
    }
  });

  it('returns explicit zero totals and all three zero staff payment rows for an empty authorized period', async () => {
    expect(await read()).toMatchObject({
      scope: 'STAFF',
      grossSales: '0.00',
      transactionCount: '0',
      unitsSold: '0',
      refundedAmount: '0.00',
      refundCount: '0',
      returnedUnits: '0',
      netRecordedSales: '0.00',
      refundMethods: ['CASH', 'GCASH', 'CARD'].map((paymentMethod) => ({
        paymentMethod,
        refundedAmount: '0.00',
        refundCount: '0',
      })),
      payments: ['CASH', 'GCASH', 'CARD'].map((paymentMethod) => ({
        paymentMethod,
        grossSales: '0.00',
        transactionCount: '0',
      })),
    });
  });
  it('sums each completed sale once and reconciles all payment methods instead of tender', async () => {
    await mixedSales();
    expect(await read()).toMatchObject({
      scope: 'STAFF',
      grossSales: '72.53',
      transactionCount: '3',
      unitsSold: '13',
      payments: [
        { paymentMethod: 'CASH', grossSales: '45.03', transactionCount: '1' },
        { paymentMethod: 'GCASH', grossSales: '17.50', transactionCount: '1' },
        { paymentMethod: 'CARD', grossSales: '10.00', transactionCount: '1' },
      ],
    });
    expect(await read(managerId)).toEqual(await read());
  });
  it('returns only own amounts/units and distinct matching transactions in mixed sales', async () => {
    await mixedSales();
    const result = await read(merchantUserId);
    expect(result).toEqual({
      scope: 'MERCHANT',
      branch: identity(branchId),
      from: '2026-09-01T16:00:00.000Z',
      until: '2026-09-02T16:00:00.000Z',
      ownGrossSales: '37.53',
      ownTransactionCount: '2',
      ownUnitsSold: '6',
      ownRefundedAmount: '0.00',
      ownRefundCount: '0',
      ownReturnedUnits: '0',
      ownNetRecordedSales: '37.53',
    });
    expect(Object.keys(result).sort()).toEqual(
      [
        'scope',
        'branch',
        'from',
        'until',
        'ownGrossSales',
        'ownTransactionCount',
        'ownUnitsSold',
        'ownRefundedAmount',
        'ownRefundCount',
        'ownReturnedUnits',
        'ownNetRecordedSales',
      ].sort(),
    );
  });
  it('looks up identity-only assigned plus historical merchant branches independently of the period', async () => {
    const [sale] = await mixedSales();
    await prisma.sale.update({
      where: { id: sale.id },
      data: { completedAt: new Date('2025-01-01T00:00:00Z') },
    });
    expect(await reports.branches(context())).toEqual([
      identity(emptyBranchId),
      identity(branchId),
    ]);
    expect(await reports.branches(context(managerId))).toEqual([
      identity(branchId),
    ]);
    expect(await reports.branches(context(merchantUserId))).toEqual([
      identity(emptyBranchId),
      identity(branchId),
    ]);
    expect(
      await reports.sales(context(merchantUserId), emptyBranchId, range),
    ).toMatchObject({
      scope: 'MERCHANT',
      ownGrossSales: '0.00',
      ownTransactionCount: '0',
      ownUnitsSold: '0',
    });
  });
  it('does not grant report access solely from unsold current product placements', async () => {
    expect(await reports.branches(context(merchantUserId))).toEqual([
      identity(emptyBranchId),
    ]);
    await expect(read(merchantUserId)).rejects.toMatchObject({ status: 404 });
  });
  it('includes the start, excludes the end, and preserves millisecond boundaries', async () => {
    const sales = [
      await complete('CARD', [[0, 1]]),
      await complete('CARD', [[0, 1]]),
      await complete('CARD', [[0, 1]]),
      await complete('CARD', [[0, 1]]),
    ];
    const dates = [
      '2026-09-01T15:59:59.999Z',
      '2026-09-01T16:00:00.000Z',
      '2026-09-02T15:59:59.999Z',
      '2026-09-02T16:00:00.000Z',
    ];
    for (let index = 0; index < sales.length; index++)
      await prisma.sale.update({
        where: { id: sales[index].id },
        data: { completedAt: new Date(dates[index]) },
      });
    expect(await read()).toMatchObject({
      grossSales: '25.00',
      transactionCount: '2',
      unitsSold: '2',
    });
    expect(await read(merchantUserId)).toMatchObject({
      ownGrossSales: '25.00',
      ownTransactionCount: '2',
      ownUnitsSold: '2',
    });
  });
  it('historical totals survive identity/price/lifecycle changes and merchant assignment removal', async () => {
    await mixedSales();
    const before = await read(merchantUserId);
    await prisma.merchant.update({
      where: { id: merchantId },
      data: { status: 'INACTIVE', name: 'Renamed' },
    });
    await prisma.product.updateMany({
      where: { organizationId, merchantId },
      data: { status: 'INACTIVE', name: 'Renamed product' },
    });
    await prisma.branchInventory.updateMany({
      where: { organizationId },
      data: { sellingPrice: '999.00' },
    });
    await prisma.branchMembership.deleteMany({
      where: { organizationId, userId: merchantUserId },
    });
    expect(await read(merchantUserId)).toEqual(before);
    expect(await reports.branches(context(merchantUserId))).toEqual([
      identity(branchId),
    ]);
  });
  it('relinking and shared profiles alter current scope without rewriting historical ownership', async () => {
    await mixedSales();
    const shared = await actor('MERCHANT', merchantId);
    expect(await read(shared)).toEqual(await read(merchantUserId));
    await prisma.organizationMembership.update({
      where: {
        organizationId_userId: { organizationId, userId: merchantUserId },
      },
      data: { merchantId: otherMerchantId },
    });
    expect(await read(merchantUserId)).toMatchObject({
      ownGrossSales: '35.00',
      ownTransactionCount: '3',
      ownUnitsSold: '7',
    });
    expect(await read(shared)).toMatchObject({ ownGrossSales: '37.53' });
  });
  it('unlinked merchants have only assigned empty own totals and no historical branch access', async () => {
    await mixedSales();
    await prisma.organizationMembership.update({
      where: {
        organizationId_userId: { organizationId, userId: merchantUserId },
      },
      data: { merchantId: null },
    });
    expect(await reports.branches(context(merchantUserId))).toEqual([
      identity(emptyBranchId),
    ]);
    await expect(read(merchantUserId)).rejects.toMatchObject({ status: 404 });
    expect(
      await reports.sales(context(merchantUserId), emptyBranchId, range),
    ).toMatchObject({
      scope: 'MERCHANT',
      ownGrossSales: '0.00',
      ownTransactionCount: '0',
      ownUnitsSold: '0',
    });
  });
  it('denies cashiers even when assigned and after stale owner-context role changes', async () => {
    await mixedSales();
    await expect(read(cashierId)).rejects.toMatchObject({ status: 403 });
    await expect(reports.branches(context(cashierId))).rejects.toMatchObject({
      status: 403,
    });
    await prisma.organizationMembership.update({
      where: { organizationId_userId: { organizationId, userId: ownerId } },
      data: { role: 'CASHIER' },
    });
    await expect(read()).rejects.toMatchObject({ status: 403 });
  });
  it('denies managers after grant removal and never lists unassigned branches', async () => {
    await mixedSales();
    await expect(
      reports.sales(context(managerId), emptyBranchId, range),
    ).rejects.toMatchObject({ status: 404 });
    await prisma.branchMembership.deleteMany({
      where: { organizationId, userId: managerId },
    });
    expect(await reports.branches(context(managerId))).toEqual([]);
    await expect(read(managerId)).rejects.toMatchObject({ status: 404 });
  });
  it.each(['removed', 'deleted'])(
    'denies reports after an account is %s',
    async (state) => {
      if (state === 'removed')
        await prisma.organizationMembership.delete({
          where: { organizationId_userId: { organizationId, userId: ownerId } },
        });
      else
        await prisma.user.update({
          where: { id: ownerId },
          data: { deletedAt: new Date() },
        });
      await expect(read()).rejects.toMatchObject({ status: 404 });
      await expect(reports.branches(context())).rejects.toMatchObject({
        status: 404,
      });
    },
  );
  it('hides foreign/missing branches and guessed organizations without leaking their totals', async () => {
    await mixedSales();
    const foreignOrg = (
      await prisma.organization.create({ data: { name: 'Foreign' } })
    ).id;
    const foreignBranch = (
      await prisma.branch.create({
        data: {
          organizationId: foreignOrg,
          name: 'Foreign',
          addressLine1: 'Test',
          city: 'Makati',
          province: 'Metro Manila',
          countryCode: 'PH',
        },
      })
    ).id;
    for (const id of [foreignBranch, randomUUID()])
      await expect(reports.sales(context(), id, range)).rejects.toMatchObject({
        status: 404,
      });
    await expect(
      reports.sales(
        { ...context(), organizationId: foreignOrg },
        foreignBranch,
        range,
      ),
    ).rejects.toMatchObject({ status: 404 });
    expect(await reports.branches(context())).toEqual([
      identity(emptyBranchId),
      identity(branchId),
    ]);
  });
  it('excludes other-branch recorded sales from the selected branch report', async () => {
    await mixedSales();
    const created = await products.create(
      organizationId,
      {
        merchantId,
        name: 'Other branch product',
        requestId: randomUUID(),
        initialInventory: {
          branchId: emptyBranchId,
          sellingPrice: '20.00',
          quantity: 10,
        },
      },
      ownerId,
    );
    const placement = await prisma.branchInventory.findFirstOrThrow({
      where: { organizationId, productId: created.id },
    });
    const sale = await checkout.complete(context(), emptyBranchId, {
      requestId: randomUUID(),
      items: [
        {
          branchInventoryId: placement.id,
          quantity: 1,
          expectedUnitPrice: '20.00',
        },
      ],
      paymentMethod: 'CARD',
      paymentReference: 'manual-other-branch',
    });
    await prisma.sale.update({
      where: { id: sale.id },
      data: { completedAt: new Date('2026-09-01T18:00:00Z') },
    });
    expect(await read()).toMatchObject({
      grossSales: '72.53',
      transactionCount: '3',
      unitsSold: '13',
    });
    expect(await reports.sales(context(), emptyBranchId, range)).toMatchObject({
      grossSales: '20.00',
      transactionCount: '1',
      unitsSold: '1',
    });
    expect(await read(merchantUserId)).toMatchObject({
      ownGrossSales: '37.53',
      ownTransactionCount: '2',
      ownUnitsSold: '6',
    });
  });
  it('preserves exact high-capacity PHP totals and quantities beyond 32-bit range', async () => {
    await prisma.branchInventory.updateMany({
      where: { organizationId },
      data: { sellingPrice: '9999999999.99', quantity: 2147483647 },
    });
    const sale = await checkout.complete(context(), branchId, {
      requestId: randomUUID(),
      items: inventories.map((branchInventoryId) => ({
        branchInventoryId,
        quantity: 2147483647,
        expectedUnitPrice: '9999999999.99',
      })),
      paymentMethod: 'CARD',
      paymentReference: 'manual-high-capacity',
    });
    await prisma.sale.update({
      where: { id: sale.id },
      data: { completedAt: new Date('2026-09-01T18:00:00Z') },
    });
    const cents = 999999999999n * 2147483647n;
    const money = (value: bigint) =>
      `${value / 100n}.${(value % 100n).toString().padStart(2, '0')}`;
    expect(await read()).toMatchObject({
      grossSales: money(cents * 3n),
      unitsSold: '6442450941',
      transactionCount: '1',
    });
    expect(await read(merchantUserId)).toMatchObject({
      ownGrossSales: money(cents * 2n),
      ownUnitsSold: '4294967294',
      ownTransactionCount: '1',
    });
    await refund(
      sale,
      [
        [0, 2147483647],
        [1, 2147483647],
        [2, 2147483647],
      ],
      'GCASH',
    );
    expect(await read()).toMatchObject({
      refundedAmount: money(cents * 3n),
      returnedUnits: '6442450941',
      refundCount: '1',
      netRecordedSales: '0.00',
    });
    expect(await read(merchantUserId)).toMatchObject({
      ownRefundedAmount: money(cents * 2n),
      ownReturnedUnits: '4294967294',
      ownRefundCount: '1',
      ownNetRecordedSales: '0.00',
    });
  });
  it('counts more than one history page without reading paginated history', async () => {
    for (let index = 0; index < 51; index++) await complete('CARD', [[0, 1]]);
    expect(await read()).toMatchObject({
      grossSales: '637.50',
      transactionCount: '51',
      unitsSold: '51',
    });
    expect(await read(merchantUserId)).toMatchObject({
      ownGrossSales: '637.50',
      ownTransactionCount: '51',
      ownUnitsSold: '51',
    });
  });
  it('does not mutate recorded sales, balances or ledger history during report reads', async () => {
    await mixedSales();
    const before = await Promise.all([
      prisma.sale.count({ where: { organizationId } }),
      prisma.saleItem.count({ where: { organizationId } }),
      prisma.inventoryMovement.count({ where: { organizationId } }),
      prisma.branchInventory.findMany({
        where: { organizationId },
        orderBy: { id: 'asc' },
      }),
    ]);
    await read();
    await read(merchantUserId);
    await reports.branches(context());
    expect(
      await Promise.all([
        prisma.sale.count({ where: { organizationId } }),
        prisma.saleItem.count({ where: { organizationId } }),
        prisma.inventoryMovement.count({ where: { organizationId } }),
        prisma.branchInventory.findMany({
          where: { organizationId },
          orderBy: { id: 'asc' },
        }),
      ]),
    ).toEqual(before);
  });
  it('keeps summary and payment rows in the same snapshot while another checkout commits', async () => {
    await complete('CASH', [[0, 1]]);
    let captured!: () => void;
    let release!: () => void;
    const ready = new Promise<void>((done) => {
      captured = done;
    });
    const resumed = new Promise<void>((done) => {
      release = done;
    });
    const facade = {
      $transaction: (
        callback: (tx: Prisma.TransactionClient) => Promise<SalesReport>,
        options: { isolationLevel: Prisma.TransactionIsolationLevel },
      ) =>
        prisma.$transaction(
          async (tx) => {
            const intercepted = {
              ...tx,
              $queryRaw: async <T>(query: Prisma.Sql): Promise<T> => {
                const result = await tx.$queryRaw<T>(query);
                if (query.sql.includes('WITH matched')) {
                  captured();
                  await resumed;
                }
                return result;
              },
            } as unknown as Prisma.TransactionClient;
            return callback(intercepted);
          },
          { ...options, timeout: 15000 },
        ),
    };
    const snapshotReports = new ReportsService(
      facade as unknown as PrismaService,
    );
    const pending = snapshotReports.sales(context(), branchId, range);
    try {
      await ready;
      await complete('GCASH', [[0, 1]]);
    } finally {
      release();
    }
    expect(await pending).toMatchObject({
      grossSales: '12.50',
      transactionCount: '1',
      unitsSold: '1',
      payments: [
        { paymentMethod: 'CASH', grossSales: '12.50', transactionCount: '1' },
        { paymentMethod: 'GCASH', grossSales: '0.00', transactionCount: '0' },
        { paymentMethod: 'CARD', grossSales: '0.00', transactionCount: '0' },
      ],
    });
    expect(await read()).toMatchObject({
      grossSales: '25.00',
      transactionCount: '2',
    });
  });
  it.each(['CASH', 'GCASH', 'CARD'] as const)(
    'reconciles actual %s refunds separately from original sale payments',
    async (method) => {
      const [sale] = await mixedSales();
      await refund(
        sale,
        [
          [0, 1],
          [1, 2],
          [2, 2],
        ],
        method,
      );
      expect(await read()).toMatchObject({
        grossSales: '72.53',
        transactionCount: '3',
        unitsSold: '13',
        refundedAmount: '22.52',
        refundCount: '1',
        returnedUnits: '5',
        netRecordedSales: '50.01',
        refundMethods: ['CASH', 'GCASH', 'CARD'].map((paymentMethod) => ({
          paymentMethod,
          refundedAmount: paymentMethod === method ? '22.52' : '0.00',
          refundCount: paymentMethod === method ? '1' : '0',
        })),
      });
      expect(await read(managerId)).toEqual(await read());
      expect(await read(merchantUserId)).toMatchObject({
        ownGrossSales: '37.53',
        ownRefundedAmount: '12.52',
        ownRefundCount: '1',
        ownReturnedUnits: '3',
        ownNetRecordedSales: '25.01',
      });
    },
  );
  it('counts distinct own refunds across several own lines without multiplying parent totals', async () => {
    const [sale] = await mixedSales();
    await refund(
      sale,
      [
        [0, 1],
        [1, 1],
        [2, 1],
      ],
      'CARD',
    );
    await refund(
      sale,
      [
        [0, 1],
        [1, 2],
      ],
      'GCASH',
    );
    await refund(sale, [[2, 1]], 'CASH');
    expect(await read()).toMatchObject({
      refundedAmount: '35.03',
      refundCount: '3',
      returnedUnits: '7',
      netRecordedSales: '37.50',
    });
    const own = await read(merchantUserId);
    expect(own).toMatchObject({
      ownRefundedAmount: '25.03',
      ownRefundCount: '2',
      ownReturnedUnits: '5',
      ownNetRecordedSales: '12.50',
    });
    expect(Object.keys(own).sort()).toEqual(
      [
        'scope',
        'branch',
        'from',
        'until',
        'ownGrossSales',
        'ownTransactionCount',
        'ownUnitsSold',
        'ownRefundedAmount',
        'ownRefundCount',
        'ownReturnedUnits',
        'ownNetRecordedSales',
      ].sort(),
    );
    expect(JSON.stringify(own)).not.toMatch(
      /PRIVATE|payment|refundMethods|createdById|reason|contactName|requestId|refundCommand/,
    );
  });
  it('recognizes refund completion dates independently of original sale dates, allowing negative periods', async () => {
    const sale = await complete('CARD', [
      [0, 2],
      [2, 2],
    ]);
    await prisma.sale.update({
      where: { id: sale.id },
      data: { completedAt: new Date('2026-08-01T00:00:00Z') },
    });
    await refund(
      sale,
      [
        [0, 2],
        [2, 1],
      ],
      'CASH',
    );
    expect(await read()).toMatchObject({
      grossSales: '0.00',
      transactionCount: '0',
      unitsSold: '0',
      refundedAmount: '30.00',
      refundCount: '1',
      returnedUnits: '3',
      netRecordedSales: '-30.00',
    });
    expect(await read(merchantUserId)).toMatchObject({
      ownGrossSales: '0.00',
      ownTransactionCount: '0',
      ownUnitsSold: '0',
      ownRefundedAmount: '25.00',
      ownRefundCount: '1',
      ownReturnedUnits: '2',
      ownNetRecordedSales: '-25.00',
    });
    expect(await reports.branches(context(merchantUserId))).toEqual([
      identity(emptyBranchId),
      identity(branchId),
    ]);
  });
  it('does not deduct refunds completed outside the applied period', async () => {
    const sale = await complete('CASH', [[0, 2]]);
    await refund(sale, [[0, 2]], 'CARD', range.until);
    expect(await read()).toMatchObject({
      grossSales: '25.00',
      refundedAmount: '0.00',
      refundCount: '0',
      returnedUnits: '0',
      netRecordedSales: '25.00',
    });
    expect(await read(merchantUserId)).toMatchObject({
      ownGrossSales: '25.00',
      ownRefundedAmount: '0.00',
      ownRefundCount: '0',
      ownReturnedUnits: '0',
      ownNetRecordedSales: '25.00',
    });
  });
  it.each([
    ['2026-09-01T15:59:59.999Z', '0.00'],
    [range.from, '12.50'],
    ['2026-09-02T15:59:59.999Z', '12.50'],
    [range.until, '0.00'],
  ])(
    'uses half-open millisecond refund boundary %s',
    async (date, expected) => {
      const sale = await complete('CASH', [[0, 1]]);
      await refund(sale, [[0, 1]], 'CARD', date);
      expect(await read()).toMatchObject({ refundedAmount: expected });
      expect(await read(merchantUserId)).toMatchObject({
        ownRefundedAmount: expected,
      });
    },
  );
  it('aggregates more than one refund history page without paginating refund lines', async () => {
    const sale = await complete('CARD', [[1, 60]]);
    for (let n = 0; n < 55; n++) await refund(sale, [[1, 1]]);
    expect(await read()).toMatchObject({
      grossSales: '0.60',
      refundedAmount: '0.55',
      refundCount: '55',
      returnedUnits: '55',
      netRecordedSales: '0.05',
    });
    expect(await read(merchantUserId)).toMatchObject({
      ownGrossSales: '0.60',
      ownRefundedAmount: '0.55',
      ownRefundCount: '55',
      ownReturnedUnits: '55',
      ownNetRecordedSales: '0.05',
    });
  });
  it('preserves historical refund totals after lifecycle/price edits and applies current profile links', async () => {
    const sale = await complete('CASH', [
      [0, 2],
      [2, 1],
    ]);
    await refund(
      sale,
      [
        [0, 1],
        [2, 1],
      ],
      'CARD',
    );
    const before = await read(merchantUserId);
    await prisma.merchant.update({
      where: { id: merchantId },
      data: { status: 'ENDED', name: 'Renamed' },
    });
    await prisma.product.updateMany({
      where: { organizationId },
      data: { status: 'INACTIVE', name: 'Renamed' },
    });
    await prisma.branchInventory.updateMany({
      where: { organizationId },
      data: { sellingPrice: '99.00' },
    });
    expect(await read(merchantUserId)).toEqual(before);
    await prisma.organizationMembership.update({
      where: {
        organizationId_userId: { organizationId, userId: merchantUserId },
      },
      data: { merchantId: otherMerchantId },
    });
    expect(await read(merchantUserId)).toMatchObject({
      ownRefundedAmount: '5.00',
      ownReturnedUnits: '1',
      ownRefundCount: '1',
      ownNetRecordedSales: '0.00',
    });
    await prisma.branchMembership.create({
      data: { organizationId, branchId, userId: merchantUserId },
    });
    await prisma.organizationMembership.update({
      where: {
        organizationId_userId: { organizationId, userId: merchantUserId },
      },
      data: { merchantId: null },
    });
    expect(await read(merchantUserId)).toMatchObject({
      ownRefundedAmount: '0.00',
      ownReturnedUnits: '0',
      ownRefundCount: '0',
      ownNetRecordedSales: '0.00',
    });
  });
  it('never lets assignments expose other-only refunds and retains explicit empty own zeros', async () => {
    const sale = await complete('CARD', [[2, 1]]);
    await refund(sale, [[2, 1]]);
    await prisma.branchMembership.create({
      data: { organizationId, branchId, userId: merchantUserId },
    });
    expect(await read(merchantUserId)).toMatchObject({
      ownGrossSales: '0.00',
      ownRefundedAmount: '0.00',
      ownReturnedUnits: '0',
      ownRefundCount: '0',
      ownNetRecordedSales: '0.00',
    });
  });
  it('does not select other-branch or foreign-tenant refund streams', async () => {
    await prisma.branchMembership.create({
      data: { organizationId, branchId, userId: merchantUserId },
    });
    const data = {
      requestId: randomUUID(),
      merchantId,
      name: 'Other branch stock',
      initialInventory: {
        branchId: emptyBranchId,
        sellingPrice: '20.00',
        quantity: 2,
      },
    };
    const created = await products.create(organizationId, data, ownerId);
    const placement = await prisma.branchInventory.findFirstOrThrow({
      where: { organizationId, productId: created.id },
    });
    const sale = await checkout.complete(context(), emptyBranchId, {
      requestId: randomUUID(),
      paymentMethod: 'CASH',
      cashTender: '20.00',
      items: [
        {
          branchInventoryId: placement.id,
          quantity: 1,
          expectedUnitPrice: '20.00',
        },
      ],
    });
    const returned = await refunds.complete(context(), emptyBranchId, sale.id, {
      requestId: randomUUID(),
      reason: 'Returned',
      paymentMethod: 'CARD',
      paymentReference: 'PRIVATE',
      refundConfirmed: true,
      items: [
        { saleItemId: sale.items[0].id, quantity: 1, restockQuantity: 0 },
      ],
    });
    await prisma.refund.update({
      where: { id: returned.id },
      data: { completedAt: new Date(range.from) },
    });
    expect(await read()).toMatchObject({
      refundedAmount: '0.00',
      refundCount: '0',
      returnedUnits: '0',
    });
    expect(await reports.sales(context(), emptyBranchId, range)).toMatchObject({
      refundedAmount: '20.00',
      refundCount: '1',
      returnedUnits: '1',
    });
    expect(await read(merchantUserId)).toMatchObject({
      ownRefundedAmount: '0.00',
      ownRefundCount: '0',
    });
    const foreign = await prisma.organization.create({
      data: { name: 'Foreign' },
    });
    await prisma.organizationMembership.create({
      data: { organizationId: foreign.id, userId: ownerId, role: 'OWNER' },
    });
    await expect(
      reports.sales(
        { ...context(), organizationId: foreign.id },
        emptyBranchId,
        range,
      ),
    ).rejects.toMatchObject({ status: 404 });
  });
  it('report reads preserve completed refund records, original sales, inventory and ledger', async () => {
    const sale = await complete('CASH', [
      [0, 2],
      [1, 1],
      [2, 1],
    ]);
    await refund(
      sale,
      [
        [0, 1],
        [1, 1],
        [2, 1],
      ],
      'GCASH',
    );
    const persisted = () =>
      Promise.all([
        prisma.refund.findMany({
          where: { organizationId },
          include: { items: true },
          orderBy: { id: 'asc' },
        }),
        prisma.sale.findMany({
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
    await read();
    await read(managerId);
    await read(merchantUserId);
    await reports.branches(context(merchantUserId));
    expect(await persisted()).toEqual(before);
  });
  it.each(['OWNER', 'MERCHANT'] as const)(
    'keeps %s sale/refund streams in a single snapshot during a concurrent refund',
    async (role) => {
      const sale = await complete('CASH', [[0, 3]]);
      await refund(sale, [[0, 1]]);
      let captured!: () => void, release!: () => void;
      const ready = new Promise<void>((done) => {
        captured = done;
      });
      const resumed = new Promise<void>((done) => {
        release = done;
      });
      let paused = false;
      const facade = {
        $transaction: (
          callback: (tx: Prisma.TransactionClient) => Promise<SalesReport>,
          options: { isolationLevel: Prisma.TransactionIsolationLevel },
        ) =>
          prisma.$transaction(
            async (tx) => {
              const intercepted = {
                ...tx,
                $queryRaw: async <T>(sql: Prisma.Sql): Promise<T> => {
                  const result = await tx.$queryRaw<T>(sql);
                  if (!paused) {
                    paused = true;
                    captured();
                    await resumed;
                  }
                  return result;
                },
              } as unknown as Prisma.TransactionClient;
              return callback(intercepted);
            },
            { ...options, timeout: 15000 },
          ),
      };
      const userId = role === 'OWNER' ? ownerId : merchantUserId;
      const pending = new ReportsService(
        facade as unknown as PrismaService,
      ).sales(context(userId), branchId, range);
      try {
        await ready;
        await refund(sale, [[0, 1]], 'CARD');
      } finally {
        release();
      }
      expect(await pending).toMatchObject(
        role === 'OWNER'
          ? {
              grossSales: '37.50',
              refundedAmount: '12.50',
              refundCount: '1',
              netRecordedSales: '25.00',
              refundMethods: [
                {
                  paymentMethod: 'CASH',
                  refundedAmount: '12.50',
                  refundCount: '1',
                },
                {
                  paymentMethod: 'GCASH',
                  refundedAmount: '0.00',
                  refundCount: '0',
                },
                {
                  paymentMethod: 'CARD',
                  refundedAmount: '0.00',
                  refundCount: '0',
                },
              ],
            }
          : {
              ownGrossSales: '37.50',
              ownRefundedAmount: '12.50',
              ownRefundCount: '1',
              ownNetRecordedSales: '25.00',
            },
      );
      expect(await read(userId)).toMatchObject(
        role === 'OWNER'
          ? {
              refundedAmount: '25.00',
              refundCount: '2',
              netRecordedSales: '12.50',
            }
          : {
              ownRefundedAmount: '25.00',
              ownRefundCount: '2',
              ownNetRecordedSales: '12.50',
            },
      );
    },
  );
});
