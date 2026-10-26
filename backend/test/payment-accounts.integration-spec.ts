import { randomUUID } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { PrismaPg } from '@prisma/adapter-pg';
import { Client } from 'pg';
import { PrismaClient, Prisma } from '../src/generated/prisma/client';
import { PrismaService } from '../src/infrastructure/database/prisma.service';
import { PaymentAccountsService } from '../src/modules/organizations/payment-accounts/payment-accounts.service';
import { PaymentAccountOperation } from '../src/modules/organizations/payment-accounts/payment-account.dto';
import { CheckoutService } from '../src/modules/organizations/sales/checkout.service';
import { RefundsService } from '../src/modules/organizations/refunds/refunds.service';
import { ReportsService } from '../src/modules/organizations/reports/reports.service';
import type { OrganizationContext } from '../src/modules/organizations/authorization/organization-authorization.types';
import { fixtureInventory } from './merchant-branch-fixtures';

const connectionString = process.env.TEST_DATABASE_URL;
if (!connectionString)
  throw new Error(
    'TEST_DATABASE_URL must identify an explicitly disposable database',
  );
const schema = `payment_accounts_${randomUUID().replaceAll('-', '')}`;
const admin = new Client({ connectionString });
const db = new PrismaClient({
  adapter: new PrismaPg(
    { connectionString, options: `-c search_path=${schema}`, max: 12 },
    { schema },
  ),
});
const prisma = db as unknown as PrismaService;
const accounts = new PaymentAccountsService(prisma),
  checkout = new CheckoutService(prisma),
  refunds = new RefundsService(prisma),
  reports = new ReportsService(prisma);
let context: OrganizationContext,
  branchId: string,
  secondBranch: string,
  inventoryId: string,
  cashId: string;
const branchData = (organizationId: string, name: string) => ({
  organizationId,
  name,
  addressLine1: 'Test',
  city: 'Makati',
  province: 'Metro Manila',
  countryCode: 'PH',
});
const custom = (name = 'Wallet Main', extra = {}) =>
  accounts.save(context, {
    name,
    enabled: true,
    requiresReference: true,
    assignmentMode: 'ALL',
    branchIds: [],
    ...extra,
  });
const command = (paymentAccountId = cashId, extra = {}) => ({
  requestId: randomUUID(),
  paymentAccountId,
  cashTender: '100.00',
  items: [
    { branchInventoryId: inventoryId, quantity: 2, expectedUnitPrice: '12.50' },
  ],
  ...extra,
});
const payout = (
  sale: Awaited<ReturnType<CheckoutService['complete']>>,
  paymentAccountId = cashId,
  extra = {},
) => ({
  requestId: randomUUID(),
  paymentAccountId,
  refundConfirmed: true,
  reason: 'Returned goods',
  items: [{ saleItemId: sale.items[0].id, quantity: 1, restockQuantity: 1 }],
  ...extra,
});
const options = (operation = PaymentAccountOperation.SALE, history = false) =>
  accounts.available(context, branchId, { operation, history });
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}
function observeOrganizationLock(entered: ReturnType<typeof deferred>) {
  return {
    $transaction: (
      callback: (tx: Prisma.TransactionClient) => Promise<unknown>,
      settings: object,
    ) =>
      db.$transaction(async (tx) => {
        const wrapped = new Proxy(tx, {
          get(target, key) {
            if (key === '$queryRaw')
              return (...args: unknown[]) => {
                const sql = args[0] as { sql?: string } | TemplateStringsArray;
                if (
                  (Array.isArray(sql)
                    ? sql.join('')
                    : ((sql as { sql?: string }).sql ?? '')
                  ).includes('FROM "Organization"')
                )
                  entered.resolve();
                return (
                  target.$queryRaw as (...args: unknown[]) => Promise<unknown>
                )(...args);
              };
            return Reflect.get(target, key) as unknown;
          },
        });
        return callback(wrapped);
      }, settings),
  } as unknown as PrismaService;
}

describe('Payment account financial and tenant invariants', () => {
  beforeAll(async () => {
    await admin.connect();
    await admin.query(`CREATE SCHEMA "${schema}"`);
    await admin.query(`SET search_path TO "${schema}"`);
    const root = join(__dirname, '../prisma/migrations');
    for (const name of readdirSync(root)
      .filter((n) => /^\d/.test(n))
      .sort())
      await admin.query(
        readFileSync(join(root, name, 'migration.sql'), 'utf8'),
      );
  });
  afterAll(async () => {
    await db.$disconnect();
    await admin.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await admin.end();
  });
  beforeEach(async () => {
    const org = await db.organization.create({ data: { name: randomUUID() } });
    const user = await db.user.create({
      data: {
        email: `${randomUUID()}@example.test`,
        passwordHash: 'unused',
        firstName: 'Owner',
        lastName: 'Test',
        emailVerifiedAt: new Date(),
      },
    });
    await db.organizationMembership.create({
      data: { organizationId: org.id, userId: user.id, role: 'OWNER' },
    });
    context = { organizationId: org.id, userId: user.id, role: 'OWNER' };
    branchId = (await db.branch.create({ data: branchData(org.id, 'Main') }))
      .id;
    secondBranch = (
      await db.branch.create({ data: branchData(org.id, 'Second') })
    ).id;
    cashId = (
      await db.paymentAccount.findUniqueOrThrow({
        where: {
          organizationId_systemKey: {
            organizationId: org.id,
            systemKey: 'CASH',
          },
        },
      })
    ).id;
    const merchant = await db.merchant.create({
      data: {
        organizationId: org.id,
        name: 'Merchant',
        contactName: 'Test',
        phone: '09123456789',
      },
    });
    const product = await db.product.create({
      data: {
        organizationId: org.id,
        merchantId: merchant.id,
        name: 'Product',
      },
    });
    inventoryId = (
      await fixtureInventory(db, {
        data: {
          organizationId: org.id,
          branchId,
          productId: product.id,
          sellingPrice: '12.50',
          quantity: 20,
        },
      })
    ).id;
  });
  it('provisions exactly one immutable Cash for every organization, including concurrent creation', async () => {
    const organizations = await Promise.all(
      Array.from({ length: 8 }, () =>
        db.organization.create({ data: { name: randomUUID() } }),
      ),
    );
    expect(
      await db.paymentAccount.count({
        where: {
          organizationId: { in: organizations.map((o) => o.id) },
          systemKey: 'CASH',
        },
      }),
    ).toBe(8);
    for (const data of [
      { enabled: false },
      { name: 'cash', normalizedName: 'cash' },
      { assignmentMode: 'SELECTED' as const },
      { requiresReference: true },
      { systemKey: null },
    ])
      await expect(
        db.paymentAccount.update({ where: { id: cashId }, data }),
      ).rejects.toThrow();
    await expect(
      db.paymentAccount.delete({ where: { id: cashId } }),
    ).rejects.toThrow();
    await expect(custom(' cAsH ')).rejects.toMatchObject({ status: 400 });
    expect((await options()).find((a) => a.id === cashId)).toMatchObject({
      available: true,
      requiresReference: false,
      assignmentMode: 'ALL',
    });
  });
  it('normalizes names, rejects conflicts and foreign branches, and atomically versions assignment changes', async () => {
    const account = await custom(' Wallet Main ', {
      assignmentMode: 'SELECTED',
      branchIds: [branchId],
    });
    expect(account.name).toBe('Wallet Main');
    await expect(custom('wallet MAIN')).rejects.toMatchObject({ status: 409 });
    await expect(
      custom('Invalid', { assignmentMode: 'SELECTED', branchIds: [] }),
    ).rejects.toMatchObject({ status: 400 });
    const foreign = await db.organization.create({ data: { name: 'Foreign' } });
    const foreignBranch = await db.branch.create({
      data: branchData(foreign.id, 'Foreign'),
    });
    await expect(
      custom('Foreign', {
        assignmentMode: 'SELECTED',
        branchIds: [foreignBranch.id],
      }),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      db.paymentAccountBranch.create({
        data: {
          organizationId: context.organizationId,
          paymentAccountId: account.id,
          branchId: foreignBranch.id,
        },
      }),
    ).rejects.toThrow();
    const updated = await accounts.save(
      context,
      { ...account, assignmentMode: 'ALL', branchIds: [] },
      account.id,
    );
    expect(updated.version).toBe(2);
    expect(updated.branchIds).toEqual([]);
    await expect(
      accounts.save(context, account, account.id),
    ).rejects.toMatchObject({ status: 409 });
    expect(
      (
        await accounts.available(context, secondBranch, {
          operation: PaymentAccountOperation.SALE,
          history: false,
        })
      ).map((a) => a.id),
    ).toContain(account.id);
    await expect(
      db.$transaction(async (tx) => {
        await tx.paymentAccount.update({
          where: { id: account.id },
          data: { assignmentMode: 'SELECTED' },
        });
      }),
    ).rejects.toThrow();
  });
  it('rejects branch-link reassignment and retains valid selected accounts', async () => {
    const account = await custom('Selected', {
      assignmentMode: 'SELECTED',
      branchIds: [branchId],
    });
    const other = await custom('Other');
    await expect(
      db.paymentAccountBranch.update({
        where: {
          paymentAccountId_branchId: { paymentAccountId: account.id, branchId },
        },
        data: { paymentAccountId: other.id },
      }),
    ).rejects.toThrow();
    await expect(
      db.paymentAccountBranch.deleteMany({
        where: { paymentAccountId: account.id },
      }),
    ).rejects.toThrow();
  });
  it('enforces fresh roles, assigned branches and operation-specific access without assignment leakage', async () => {
    for (const role of ['MANAGER', 'CASHIER', 'MERCHANT'] as const) {
      await db.organizationMembership.update({
        where: {
          organizationId_userId: {
            organizationId: context.organizationId,
            userId: context.userId,
          },
        },
        data: { role },
      });
      await expect(accounts.list(context)).rejects.toMatchObject({
        status: 403,
      });
      await expect(custom()).rejects.toMatchObject({ status: 403 });
      if (role === 'MERCHANT') {
        await expect(options()).rejects.toMatchObject({ status: 403 });
        continue;
      }
      await expect(options()).rejects.toMatchObject({ status: 404 });
      await db.branchMembership.upsert({
        where: {
          organizationId_branchId_userId: {
            organizationId: context.organizationId,
            branchId,
            userId: context.userId,
          },
        },
        create: {
          organizationId: context.organizationId,
          branchId,
          userId: context.userId,
        },
        update: {},
      });
      expect((await options())[0]).not.toHaveProperty('branchIds');
      if (role === 'CASHIER')
        await expect(
          options(PaymentAccountOperation.REFUND),
        ).rejects.toMatchObject({ status: 403 });
      await db.branchMembership.deleteMany({
        where: {
          organizationId: context.organizationId,
          userId: context.userId,
        },
      });
    }
    await db.organizationMembership.delete({
      where: {
        organizationId_userId: {
          organizationId: context.organizationId,
          userId: context.userId,
        },
      },
    });
    await expect(options()).rejects.toMatchObject({ status: 404 });
  });
  it('preserves exact snapshots and completed replay after rename, disable, unassign and reference-policy changes', async () => {
    const account = await custom();
    const dto = command(account.id, {
      cashTender: undefined,
      paymentReference: 'REF-01',
    });
    const sale = await checkout.complete(context, branchId, dto);
    const refundDto = payout(sale, account.id, {
      paymentReference: 'REFUND-01',
    });
    const refund = await refunds.complete(
      context,
      branchId,
      sale.id,
      refundDto,
    );
    await accounts.save(
      context,
      {
        ...account,
        name: 'Renamed',
        enabled: false,
        requiresReference: false,
        assignmentMode: 'SELECTED',
        branchIds: [secondBranch],
      },
      account.id,
    );
    expect(await checkout.complete(context, branchId, dto)).toEqual(sale);
    expect(
      await refunds.complete(context, branchId, sale.id, refundDto),
    ).toEqual(refund);
    expect((await options()).map((a) => a.id)).not.toContain(account.id);
    expect(
      (await options(PaymentAccountOperation.SALE, true)).find(
        (a) => a.id === account.id,
      ),
    ).toMatchObject({ name: 'Renamed', available: false });
    await expect(
      checkout.complete(context, branchId, { ...dto, requestId: randomUUID() }),
    ).rejects.toMatchObject({ status: 409 });
    await expect(
      checkout.complete(context, branchId, {
        ...dto,
        paymentReference: 'DIFFERENT',
      }),
    ).rejects.toMatchObject({ status: 409 });
    await expect(
      db.sale.update({
        where: { id: sale.id },
        data: { paymentAccountName: 'Changed' },
      }),
    ).rejects.toThrow();
    await db.organizationMembership.delete({
      where: {
        organizationId_userId: {
          organizationId: context.organizationId,
          userId: context.userId,
        },
      },
    });
    await expect(
      checkout.complete(context, branchId, dto),
    ).rejects.toMatchObject({ status: 404 });
  });
  it('validates custom required/optional references and cash tender without stock side effects', async () => {
    const required = await custom(),
      optional = await custom('Optional', { requiresReference: false });
    for (const dto of [
      command(required.id, { cashTender: undefined }),
      command(required.id),
      command(cashId, { paymentReference: 'NO' }),
      command(optional.id, { cashTender: undefined, paymentReference: '' }),
    ])
      await expect(
        checkout.complete(context, branchId, dto),
      ).rejects.toMatchObject({ status: 400 });
    expect(
      (
        await db.branchInventory.findUniqueOrThrow({
          where: { id: inventoryId },
        })
      ).quantity,
    ).toBe(20);
    const sale = await checkout.complete(
      context,
      branchId,
      command(optional.id, { cashTender: undefined }),
    );
    expect(sale).toMatchObject({
      paymentAccountIsCash: false,
      paymentAccountRequiresReference: false,
      paymentReference: null,
      cashTender: null,
      cashChange: null,
    });
    await expect(
      refunds.complete(
        context,
        branchId,
        sale.id,
        payout(sale, cashId, { cashTender: '1.00' }),
      ),
    ).rejects.toMatchObject({ status: 400 });
  });
  it('reconciles all accounts to gross/refunded/net using actual payout account and independent refund dates', async () => {
    const wallet = await custom('Wallet'),
      dormant = await custom('Dormant', { enabled: false });
    const sale = await checkout.complete(
      context,
      branchId,
      command(wallet.id, {
        cashTender: undefined,
        paymentReference: 'SALE-01',
      }),
    );
    await db.sale.update({
      where: { id: sale.id },
      data: { completedAt: new Date('2026-09-01T12:00:00Z') },
    });
    const refund = await refunds.complete(
      context,
      branchId,
      sale.id,
      payout(sale),
    );
    await db.refund.update({
      where: { id: refund.id },
      data: { completedAt: new Date('2026-09-02T12:00:00Z') },
    });
    await accounts.save(
      context,
      { ...wallet, enabled: false, name: 'Wallet Renamed' },
      wallet.id,
    );
    const result = await reports.analytics(context, branchId, {
      from: '2026-09-01T00:00:00Z',
      until: '2026-09-03T00:00:00Z',
    });
    if (result.scope !== 'STAFF') throw new Error('Wrong scope');
    expect(result).toMatchObject({
      grossSales: '25.00',
      refundedAmount: '12.50',
      netRecordedSales: '12.50',
    });
    expect(
      result.paymentAccounts.find((a) => a.accountId === wallet.id),
    ).toMatchObject({
      displayName: 'Wallet Renamed',
      received: '25.00',
      refunded: '0.00',
      netReceived: '25.00',
      available: false,
    });
    expect(
      result.paymentAccounts.find((a) => a.accountId === cashId),
    ).toMatchObject({
      received: '0.00',
      refunded: '12.50',
      netReceived: '-12.50',
    });
    expect(result.paymentAccounts.map((a) => a.accountId)).not.toContain(
      dormant.id,
    );
    for (const [field, total] of [
      ['received', result.grossSales],
      ['refunded', result.refundedAmount],
      ['netReceived', result.netRecordedSales],
    ] as const)
      expect(
        result.paymentAccounts.reduce(
          (sum, row) => sum + BigInt(row[field].replace('.', '')),
          0n,
        ),
      ).toBe(BigInt(total.replace('.', '')));
    const onlyRefund = await reports.sales(context, branchId, {
      from: '2026-09-02T00:00:00Z',
      until: '2026-09-03T00:00:00Z',
    });
    expect(onlyRefund).toMatchObject({
      grossSales: '0.00',
      refundedAmount: '12.50',
      netRecordedSales: '-12.50',
    });
    const empty = await reports.sales(context, secondBranch, {
      from: '2026-09-01T00:00:00Z',
      until: '2026-09-03T00:00:00Z',
    });
    if (empty.scope !== 'STAFF') throw new Error('Wrong scope');
    expect(empty.paymentAccounts.map((a) => a.accountId)).toEqual([cashId]);
  });
  it.each(['disable', 'unassign', 'reference'] as const)(
    'serializes a winning %s configuration edit against checkout and refund with no partial stock writes',
    async (change) => {
      const account = await custom('Race', { requiresReference: false });
      const sale = await checkout.complete(context, branchId, command());
      for (const operation of ['SALE', 'REFUND'] as const) {
        await db.$transaction(async (tx) => {
          await tx.paymentAccount.update({
            where: { id: account.id },
            data: {
              enabled: true,
              requiresReference: false,
              assignmentMode: 'ALL',
            },
          });
          await tx.paymentAccountBranch.deleteMany({
            where: { paymentAccountId: account.id },
          });
        });
        const locked = deferred(),
          release = deferred(),
          entered = deferred();
        const edit = db.$transaction(
          async (tx) => {
            await tx.$queryRaw`SELECT "id" FROM "Organization" WHERE "id" = ${context.organizationId} FOR UPDATE`;
            await tx.$queryRaw`SELECT "id" FROM "PaymentAccount" WHERE "id" = ${account.id} FOR UPDATE`;
            await tx.paymentAccount.update({
              where: { id: account.id },
              data:
                change === 'disable'
                  ? { enabled: false }
                  : change === 'reference'
                    ? { requiresReference: true }
                    : { assignmentMode: 'SELECTED' },
            });
            if (change === 'unassign')
              await tx.paymentAccountBranch.create({
                data: {
                  organizationId: context.organizationId,
                  paymentAccountId: account.id,
                  branchId: secondBranch,
                },
              });
            locked.resolve();
            await release.promise;
          },
          { timeout: 10000 },
        );
        await locked.promise;
        const before = (
          await db.branchInventory.findUniqueOrThrow({
            where: { id: inventoryId },
          })
        ).quantity;
        const observed = observeOrganizationLock(entered);
        const attempt =
          operation === 'SALE'
            ? new CheckoutService(observed).complete(
                context,
                branchId,
                command(account.id, { cashTender: undefined }),
              )
            : new RefundsService(observed).complete(
                context,
                branchId,
                sale.id,
                payout(sale, account.id),
              );
        const rejected = attempt.then(
          () => {
            throw new Error('Racing command unexpectedly committed');
          },
          (error: unknown) => {
            if (
              !(error instanceof Error) ||
              !('getStatus' in error) ||
              !('getResponse' in error)
            )
              throw error;
            const status = (error as { getStatus(): number }).getStatus();
            const response = (
              error as { getResponse(): { code?: string; message?: string } }
            ).getResponse();
            expect([400, 409]).toContain(status);
            if (status === 400)
              expect(response.message).toBe(
                'Payment fields do not match the selected account',
              );
            else
              expect([
                'CHECKOUT_RETRY',
                'REFUND_RETRY',
                'PAYMENT_ACCOUNT_UNAVAILABLE',
              ]).toContain(response.code);
          },
        );
        await entered.promise;
        release.resolve();
        await edit;
        await rejected;
        expect(
          (
            await db.branchInventory.findUniqueOrThrow({
              where: { id: inventoryId },
            })
          ).quantity,
        ).toBe(before);
        expect(await db.refund.count({ where: { saleId: sale.id } })).toBe(0);
        expect(
          await db.sale.count({
            where: { organizationId: context.organizationId },
          }),
        ).toBe(1);
      }
    },
  );
  it.each(['SALE', 'REFUND'] as const)(
    'preserves saved snapshots when %s completion wins a concurrent account edit',
    async (operation) => {
      const account = await custom('Before Edit', { requiresReference: false });
      const originalSale = await checkout.complete(
        context,
        branchId,
        command(),
      );
      const locked = deferred(),
        release = deferred(),
        editEntered = deferred();
      const observed = {
        $transaction: (
          callback: (tx: Prisma.TransactionClient) => Promise<unknown>,
          settings: object,
        ) =>
          db.$transaction(async (tx) => {
            const wrapped = new Proxy(tx, {
              get(target, key) {
                if (key === 'branchInventory')
                  return {
                    ...target.branchInventory,
                    updateMany: async (
                      args: Prisma.BranchInventoryUpdateManyArgs,
                    ) => {
                      const result =
                        await target.branchInventory.updateMany(args);
                      locked.resolve();
                      await release.promise;
                      return result;
                    },
                  };
                return Reflect.get(target, key) as unknown;
              },
            });
            return callback(wrapped);
          }, settings),
      } as unknown as PrismaService;
      const saleCommand = command(account.id, { cashTender: undefined });
      const refundCommand = payout(originalSale, account.id);
      const completion =
        operation === 'SALE'
          ? new CheckoutService(observed).complete(
              context,
              branchId,
              saleCommand,
            )
          : new RefundsService(observed).complete(
              context,
              branchId,
              originalSale.id,
              refundCommand,
            );
      await locked.promise;
      const editCommand = {
        ...account,
        name: 'After Edit',
        enabled: false,
        requiresReference: true,
        assignmentMode: 'SELECTED' as const,
        branchIds: [secondBranch],
      };
      const edit = new PaymentAccountsService(
        observeOrganizationLock(editEntered),
      )
        .save(context, editCommand, account.id)
        .catch((error: unknown) => error);
      await editEntered.promise;
      release.resolve();
      const saved = await completion;
      const changed: unknown = await edit;
      if (changed instanceof Error) {
        expect(changed).toMatchObject({ status: 409 });
        await accounts.save(context, editCommand, account.id);
      }
      expect(saved).toMatchObject({
        paymentAccountId: account.id,
        paymentAccountName: 'Before Edit',
        paymentAccountIsCash: false,
        paymentAccountRequiresReference: false,
      });
      const replayed =
        operation === 'SALE'
          ? await checkout.complete(context, branchId, saleCommand)
          : await refunds.complete(
              context,
              branchId,
              originalSale.id,
              refundCommand,
            );
      expect(replayed).toEqual(saved);
      expect((await options()).map((a) => a.id)).not.toContain(account.id);
    },
  );
  it('allows completed authorized replay while inactive but denies new commands and revoked verification', async () => {
    const dto = command();
    const sale = await checkout.complete(context, branchId, dto);
    const refundDto = payout(sale);
    const refund = await refunds.complete(
      context,
      branchId,
      sale.id,
      refundDto,
    );
    await db.organization.update({
      where: { id: context.organizationId },
      data: { status: 'INACTIVE' },
    });
    expect(await checkout.complete(context, branchId, dto)).toEqual(sale);
    expect(
      await refunds.complete(context, branchId, sale.id, refundDto),
    ).toEqual(refund);
    await expect(
      checkout.complete(context, branchId, command()),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      refunds.complete(context, branchId, sale.id, {
        ...refundDto,
        requestId: randomUUID(),
      }),
    ).rejects.toMatchObject({ status: 403 });
    await expect(custom()).rejects.toMatchObject({ status: 403 });
    expect(await options()).toEqual([]);
    await db.user.update({
      where: { id: context.userId },
      data: { emailVerifiedAt: null },
    });
    await expect(
      checkout.complete(context, branchId, dto),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      refunds.complete(context, branchId, sale.id, refundDto),
    ).rejects.toMatchObject({ status: 404 });
    await expect(accounts.list(context)).rejects.toMatchObject({ status: 404 });
    expect(
      await db.sale.count({
        where: { organizationId: context.organizationId },
      }),
    ).toBe(1);
    expect(
      await db.refund.count({
        where: { organizationId: context.organizationId },
      }),
    ).toBe(1);
  });
});
