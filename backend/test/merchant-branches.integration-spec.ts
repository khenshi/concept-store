import {
  provisionPaymentFixtures,
  testAccountId,
  testAccountSnapshot,
} from './payment-account-fixtures';
import { randomUUID } from 'node:crypto';
import { sessionIdFor } from './auth-session-fixtures';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { PrismaPg } from '@prisma/adapter-pg';
import { Client } from 'pg';
import { Test } from '@nestjs/testing';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaService } from '../src/infrastructure/database/prisma.service';
import { EmailService } from '../src/infrastructure/email/email.service';
import { AuthGuard } from '../src/modules/auth/auth.guard';
import { OrganizationAccessGuard } from '../src/modules/organizations/authorization/organization-access.guard';
import { MerchantBranchesController } from '../src/modules/organizations/merchant-branches/merchant-branches.controller';
import { MerchantBranchesService } from '../src/modules/organizations/merchant-branches/merchant-branches.service';
import { BranchInventoryService } from '../src/modules/organizations/inventory/branch-inventory.service';
import { InventoryStockService } from '../src/modules/organizations/inventory/inventory-stock.service';
import { ProductsService } from '../src/modules/organizations/products/products.service';
import { CheckoutService } from '../src/modules/organizations/sales/checkout.service';
import { PosCatalogService } from '../src/modules/organizations/pos/pos-catalog.service';
import {
  branchScope,
  merchantScope,
  productScope,
} from '../src/modules/organizations/authorization/resource-access';
import { requireActiveParticipation } from '../src/modules/organizations/merchant-branches/merchant-branch-participation';
import { OrganizationMembershipsService } from '../src/modules/organizations/memberships/organization-memberships.service';
import { OrganizationInvitationsService } from '../src/modules/organizations/invitations/organization-invitations.service';
import { RefundsService } from '../src/modules/organizations/refunds/refunds.service';
import { SalesReadService } from '../src/modules/organizations/sales/sales-read.service';
import type { OrganizationContext } from '../src/modules/organizations/authorization/organization-authorization.types';
const connectionString = process.env.TEST_DATABASE_URL;
if (!connectionString)
  throw new Error('TEST_DATABASE_URL must refer to a disposable database');
const schema = `merchant_branches_${randomUUID().replaceAll('-', '')}`;
const admin = new Client({ connectionString });
const db = new PrismaClient({
  adapter: new PrismaPg(
    { connectionString, options: `-c search_path=${schema}`, max: 12 },
    { schema },
  ),
});
const prisma = db as unknown as PrismaService;
const associations = new MerchantBranchesService(prisma),
  inventory = new BranchInventoryService(prisma),
  stock = new InventoryStockService(prisma),
  products = new ProductsService(prisma),
  checkout = new CheckoutService(prisma),
  members = new OrganizationMembershipsService(prisma);
const emails = {
  sendInvitationEmail: () => Promise.resolve({ status: 'disabled' as const }),
} as unknown as EmailService;
let context: OrganizationContext;
let merchantId: string,
  otherMerchantId: string,
  branchId: string,
  otherBranchId: string,
  productId: string,
  merchantUser: string,
  sharedUser: string,
  managerUser: string,
  cashierUser: string;
let app: INestApplication, jwt: JwtService;
const migrationNotices: string[] = [];
admin.on('notice', (notice) => {
  if (notice.message) migrationNotices.push(notice.message);
});
let migrationBefore: unknown,
  migrationAfter: unknown,
  legacyOrganization: string;
const branchData = (organizationId: string, name: string) => ({
  organizationId,
  name,
  addressLine1: 'Test',
  city: 'Makati',
  province: 'Metro Manila',
  countryCode: 'PH',
});
const merchantData = (organizationId: string, name: string) => ({
  organizationId,
  name,
  contactName: 'Contact',
  phone: '09171234567',
});
const user = () => {
  const id = randomUUID();
  return db.user.create({
    data: {
      id,
      email: `${randomUUID()}@example.test`,
      passwordHash: 'unused',
      emailVerifiedAt: new Date(),
      firstName: 'Test',
      lastName: 'User',
      sessions: {
        create: {
          id: sessionIdFor(id),
          refreshTokenHash: randomUUID(),
          expiresAt: new Date(Date.now() + 3600000),
        },
      },
    },
  });
};
const merchantContext = (
  id = merchantId,
  userId = merchantUser,
): OrganizationContext => ({
  ...context,
  role: 'MERCHANT',
  userId,
  merchantId: id,
});
const createPlacement = (id = branchId, price = '12.50') =>
  inventory.create(
    context.organizationId,
    id,
    { productId, sellingPrice: price, initialQuantity: 5 },
    context.userId,
  );
const http = () =>
  request(app.getHttpServer() as Parameters<typeof request>[0]);
const token = (id: string) =>
  jwt.sign(
    { email: 'test@example.test', sid: sessionIdFor(id) },
    { subject: id },
  );
async function snapshotMigration() {
  const tables = [
    'BranchInventory',
    'InventoryMovement',
    'Sale',
    'SaleItem',
    'Refund',
    'RefundItem',
  ];
  return Promise.all(
    tables.map(
      async (table) =>
        (
          await admin.query<{ record: unknown }>(
            `SELECT ${table === 'BranchInventory' ? "to_jsonb(t) - 'merchantId'" : 'to_jsonb(t)'} AS record FROM "${table}" t ORDER BY "id"`,
          )
        ).rows,
    ),
  );
}
describe('Merchant branch HTTP authorization and operational integrity', () => {
  beforeAll(async () => {
    await admin.connect();
    await admin.query(`CREATE SCHEMA "${schema}"`);
    await admin.query(`SET search_path TO "${schema}"`);
    const root = join(__dirname, '../prisma/migrations');
    await admin.query(
      readFileSync(
        join(root, '20260911010000_foundation_baseline', 'migration.sql'),
        'utf8',
      ),
    );
    await admin.query(
      readFileSync(
        join(root, '20261025010000_add_controlled_access', 'migration.sql'),
        'utf8',
      ),
    );
    for (const directory of readdirSync(root)
      .filter(
        (name) =>
          /^\d/.test(name) &&
          name !== '20260911010000_foundation_baseline' &&
          name !== '20261025010000_add_controlled_access',
      )
      .sort()) {
      if (directory === '20261025020000_payment_accounts') continue;
      if (directory === '20261001020000_add_merchant_branches') {
        await admin.query(
          readFileSync(
            join(root, '20261025020000_payment_accounts', 'migration.sql'),
            'utf8',
          ),
        );
        const org = await db.organization.create({ data: { name: 'Legacy' } });
        legacyOrganization = org.id;
        await provisionPaymentFixtures(db, org.id);
        const merchant = await db.merchant.create({
          data: merchantData(org.id, 'Legacy merchant'),
        });
        const branch = await db.branch.create({
          data: branchData(org.id, 'Placed'),
        });
        const granted = await db.branch.create({
          data: branchData(org.id, 'Grant only'),
        });
        const actor = await user(),
          staff = await user();
        await db.organizationMembership.createMany({
          data: [
            {
              organizationId: org.id,
              userId: actor.id,
              role: 'MERCHANT',
              merchantId: merchant.id,
            },
            { organizationId: org.id, userId: staff.id, role: 'MANAGER' },
          ],
        });
        await db.branchMembership.createMany({
          data: [
            { organizationId: org.id, branchId: branch.id, userId: actor.id },
            { organizationId: org.id, branchId: granted.id, userId: actor.id },
            { organizationId: org.id, branchId: branch.id, userId: staff.id },
          ],
        });
        const product = await db.product.create({
          data: {
            organizationId: org.id,
            merchantId: merchant.id,
            name: 'Legacy product',
          },
        });
        const placementId = randomUUID();
        await admin.query(
          'INSERT INTO "BranchInventory" ("id","organizationId","branchId","productId","sellingPrice","quantity","updatedAt") VALUES ($1,$2,$3,$4,12.50,0,CURRENT_TIMESTAMP)',
          [placementId, org.id, branch.id, product.id],
        );
        const sale = await db.sale.create({
          data: {
            organizationId: org.id,
            branchId: branch.id,
            createdById: staff.id,
            requestId: randomUUID(),
            receiptCode: randomUUID(),
            ...testAccountSnapshot(org.id),
            cashTender: '12.50',
            cashChange: '0.00',
            total: '12.50',
            organizationName: org.name,
            branchName: branch.name,
            cashierName: 'Legacy',
            checkoutCommand: {},
          },
        });
        const item = await db.saleItem.create({
          data: {
            organizationId: org.id,
            branchId: branch.id,
            saleId: sale.id,
            branchInventoryId: placementId,
            productId: product.id,
            merchantId: merchant.id,
            quantity: 1,
            productName: product.name,
            merchantName: merchant.name,
            unitPrice: '12.50',
            lineTotal: '12.50',
          },
        });
        await db.inventoryMovement.create({
          data: {
            organizationId: org.id,
            branchId: branch.id,
            branchInventoryId: placementId,
            createdById: staff.id,
            requestId: randomUUID(),
            type: 'SALE',
            saleItemId: item.id,
            quantityChange: -1,
            quantityAfter: 0,
            reason: 'Legacy sale',
          },
        });
        await db.organizationInvitation.createMany({
          data: ['MERCHANT', 'MANAGER'].map((role) => ({
            organizationId: org.id,
            invitedById: staff.id,
            email: `${role}@example.test`,
            role: role as 'MERCHANT' | 'MANAGER',
            merchantId: role === 'MERCHANT' ? merchant.id : null,
            tokenHash: randomUUID(),
            expiresAt: new Date(Date.now() + 86400000),
          })),
        });
        migrationBefore = await snapshotMigration();
      }
      await admin.query(
        readFileSync(join(root, directory, 'migration.sql'), 'utf8').replace(
          'CREATE SCHEMA IF NOT EXISTS "public";',
          '',
        ),
      );
    }
    migrationAfter = await snapshotMigration();
    const module = await Test.createTestingModule({
      imports: [JwtModule.register({ secret: 'merchant-branches-test' })],
      controllers: [MerchantBranchesController],
      providers: [
        AuthGuard,
        OrganizationAccessGuard,
        MerchantBranchesService,
        { provide: PrismaService, useValue: db },
      ],
    }).compile();
    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();
    await app.listen(0, '127.0.0.1');
    jwt = module.get(JwtService);
  });
  afterAll(async () => {
    if (app) await app.close();
    await db.$disconnect();
    await admin.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await admin.end();
  });
  beforeEach(async () => {
    const org = await db.organization.create({ data: { name: randomUUID() } });
    await provisionPaymentFixtures(db, org.id);
    const owner = await user();
    context = { organizationId: org.id, userId: owner.id, role: 'OWNER' };
    merchantId = (
      await db.merchant.create({ data: merchantData(org.id, 'Merchant') })
    ).id;
    otherMerchantId = (
      await db.merchant.create({ data: merchantData(org.id, 'Other merchant') })
    ).id;
    branchId = (await db.branch.create({ data: branchData(org.id, 'First') }))
      .id;
    otherBranchId = (
      await db.branch.create({ data: branchData(org.id, 'Second') })
    ).id;
    merchantUser = (await user()).id;
    sharedUser = (await user()).id;
    managerUser = (await user()).id;
    cashierUser = (await user()).id;
    await db.organizationMembership.createMany({
      data: [
        { organizationId: org.id, userId: owner.id, role: 'OWNER' },
        {
          organizationId: org.id,
          userId: merchantUser,
          role: 'MERCHANT',
          merchantId,
        },
        {
          organizationId: org.id,
          userId: sharedUser,
          role: 'MERCHANT',
          merchantId,
        },
        { organizationId: org.id, userId: managerUser, role: 'MANAGER' },
        { organizationId: org.id, userId: cashierUser, role: 'CASHIER' },
      ],
    });
    await db.branchMembership.createMany({
      data: [managerUser, cashierUser].map((userId) => ({
        organizationId: org.id,
        branchId,
        userId,
      })),
    });
    productId = (await products.create(org.id, { merchantId, name: 'Product' }))
      .id;
  });
  it('migrates zero-stock placements and grants, preserves transaction records, and revokes only merchant invitations', async () => {
    expect(migrationAfter).toEqual(migrationBefore);
    expect(migrationNotices).toContain(
      'Merchant branches: 2 associations created, 2 linked grants converted, 2 merchant grants removed, 1 invitations revoked, 1 inventory rows backfilled',
    );
    expect(
      await db.merchantBranch.count({
        where: { organizationId: legacyOrganization },
      }),
    ).toBe(2);
    expect(
      await db.branchMembership.count({
        where: { organizationId: legacyOrganization },
      }),
    ).toBe(1);
    const invites = await db.organizationInvitation.findMany({
      where: { organizationId: legacyOrganization },
    });
    expect(
      invites.find((row) => row.role === 'MERCHANT')?.revokedAt,
    ).not.toBeNull();
    expect(invites.find((row) => row.role === 'MANAGER')?.revokedAt).toBeNull();
    expect(
      await db.branchInventory.count({
        where: { organizationId: legacyOrganization, merchantId: { not: '' } },
      }),
    ).toBe(1);
  });
  it('assigns idempotently, retains inactive status on PUT, and reactivates explicitly', async () => {
    const a = await associations.assign(context, merchantId, branchId);
    expect((await associations.assign(context, merchantId, branchId)).id).toBe(
      a.id,
    );
    await associations.setStatus(context, merchantId, branchId, 'INACTIVE');
    expect(
      (await associations.assign(context, merchantId, branchId)).status,
    ).toBe('INACTIVE');
    expect(
      (await associations.setStatus(context, merchantId, branchId, 'ACTIVE'))
        .status,
    ).toBe('ACTIVE');
  });
  it('rejects missing affiliation and keeps branch stock, prices and sales independent', async () => {
    await expect(createPlacement()).rejects.toMatchObject({
      response: { code: 'MERCHANT_BRANCH_INACTIVE' },
    });
    await associations.assign(context, merchantId, branchId);
    await associations.assign(context, merchantId, otherBranchId);
    await associations.assign(context, otherMerchantId, branchId);
    const first = await createPlacement(),
      second = await createPlacement(otherBranchId, '30.00');
    const sale = await checkout.complete(context, branchId, {
      requestId: randomUUID(),
      items: [
        {
          branchInventoryId: first.id,
          quantity: 2,
          expectedUnitPrice: '12.50',
        },
      ],
      paymentAccountId: testAccountId(context.organizationId, 'CASH'),
      cashTender: '25.00',
    });
    expect(sale.total).toBe('25.00');
    expect(
      (await db.branchInventory.findUniqueOrThrow({ where: { id: first.id } }))
        .quantity,
    ).toBe(3);
    expect(
      (await db.branchInventory.findUniqueOrThrow({ where: { id: second.id } }))
        .quantity,
    ).toBe(5);
    expect(await db.sale.count({ where: { branchId: otherBranchId } })).toBe(0);
  });
  it('blocks operational writes after deactivation but preserves correction, history and replay', async () => {
    await associations.assign(context, merchantId, branchId);
    const placed = await createPlacement();
    const receipt = { requestId: randomUUID(), quantity: 1 };
    const original = await stock.receive(
      context.organizationId,
      branchId,
      placed.id,
      context.userId,
      receipt,
    );
    const command = {
      requestId: randomUUID(),
      items: [
        {
          branchInventoryId: placed.id,
          quantity: 1,
          expectedUnitPrice: '12.50',
        },
      ],
      paymentAccountId: testAccountId(context.organizationId, 'CASH'),
      cashTender: '12.50',
    };
    const sale = await checkout.complete(context, branchId, command);
    await associations.setStatus(context, merchantId, branchId, 'INACTIVE');
    await expect(
      stock.receive(
        context.organizationId,
        branchId,
        placed.id,
        context.userId,
        { requestId: randomUUID(), quantity: 1 },
      ),
    ).rejects.toMatchObject({ response: { code: 'MERCHANT_BRANCH_INACTIVE' } });
    await expect(
      checkout.complete(context, branchId, {
        ...command,
        requestId: randomUUID(),
      }),
    ).rejects.toMatchObject({ response: { code: 'MERCHANT_BRANCH_INACTIVE' } });
    expect(
      (
        await stock.receive(
          context.organizationId,
          branchId,
          placed.id,
          context.userId,
          receipt,
        )
      ).id,
    ).toBe(original.id);
    expect((await checkout.complete(context, branchId, command)).id).toBe(
      sale.id,
    );
    await stock.adjust(
      context.organizationId,
      branchId,
      placed.id,
      context.userId,
      { requestId: randomUUID(), newQuantity: 2, reason: 'Stock correction' },
    );
    expect(
      (await inventory.findOne(context.organizationId, branchId, placed.id))
        .participationStatus,
    ).toBe('INACTIVE');
    expect(
      (await new PosCatalogService(prisma).findAll(context, branchId))[0]
        .eligible,
    ).toBe(false);
    expect(
      (
        await new SalesReadService(prisma).findAll(
          merchantContext(),
          branchId,
          { page: 1, limit: 10 },
        )
      ).total,
    ).toBe(1);
  });
  it('rechecks organization status inside direct mutation transactions', async () => {
    await associations.assign(context, merchantId, branchId);
    const placed = await createPlacement();
    const correction = {
      requestId: randomUUID(),
      newQuantity: 4,
      reason: 'Direct service correction',
    };
    const original = await stock.adjust(
      context.organizationId,
      branchId,
      placed.id,
      context.userId,
      correction,
    );
    await db.organization.update({
      where: { id: context.organizationId },
      data: { status: 'INACTIVE' },
    });

    expect(
      (
        await stock.adjust(
          context.organizationId,
          branchId,
          placed.id,
          context.userId,
          correction,
        )
      ).id,
    ).toBe(original.id);
    await expect(
      stock.adjust(
        context.organizationId,
        branchId,
        placed.id,
        context.userId,
        {
          requestId: randomUUID(),
          newQuantity: 2,
          reason: 'New correction after deactivation',
        },
      ),
    ).rejects.toMatchObject({ status: 403 });
    expect(
      (await db.branchInventory.findUniqueOrThrow({ where: { id: placed.id } }))
        .quantity,
    ).toBe(4);
  });
  it('restocks the original placement after participation ends', async () => {
    await associations.assign(context, merchantId, branchId);
    const placed = await createPlacement();
    const sale = await checkout.complete(context, branchId, {
      requestId: randomUUID(),
      items: [
        {
          branchInventoryId: placed.id,
          quantity: 1,
          expectedUnitPrice: '12.50',
        },
      ],
      paymentAccountId: testAccountId(context.organizationId, 'CASH'),
      cashTender: '12.50',
    });
    await associations.setStatus(context, merchantId, branchId, 'INACTIVE');
    const refund = await new RefundsService(prisma).complete(
      context,
      branchId,
      sale.id,
      {
        requestId: randomUUID(),
        items: [
          { saleItemId: sale.items[0].id, quantity: 1, restockQuantity: 1 },
        ],
        reason: 'Returned after participation ended',
        paymentAccountId: testAccountId(context.organizationId, 'CASH'),
        refundConfirmed: true,
      },
    );
    expect(refund.items[0].restockQuantity).toBe(1);
    expect(
      (await db.branchInventory.findUniqueOrThrow({ where: { id: placed.id } }))
        .quantity,
    ).toBe(5);
  });
  it.each(['placement', 'receiving', 'checkout'] as const)(
    'does not bypass concurrent deactivation during %s',
    async (operation) => {
      await associations.assign(context, merchantId, branchId);
      const placed = operation === 'placement' ? null : await createPlacement();
      let unlock!: () => void, acquired!: () => void;
      const held = new Promise<void>((resolve) => {
        unlock = resolve;
      });
      const ready = new Promise<void>((resolve) => {
        acquired = resolve;
      });
      const deactivation = db.$transaction(
        async (tx) => {
          await tx.$queryRaw`SELECT "id" FROM "MerchantBranch" WHERE "organizationId" = ${context.organizationId} AND "branchId" = ${branchId} AND "merchantId" = ${merchantId} FOR UPDATE`;
          await tx.merchantBranch.update({
            where: {
              organizationId_branchId_merchantId: {
                organizationId: context.organizationId,
                branchId,
                merchantId,
              },
            },
            data: { status: 'INACTIVE' },
          });
          acquired();
          await held;
        },
        { timeout: 10000 },
      );
      await ready;
      const pending =
        operation === 'placement'
          ? createPlacement()
          : operation === 'receiving'
            ? stock.receive(
                context.organizationId,
                branchId,
                placed!.id,
                context.userId,
                { requestId: randomUUID(), quantity: 1 },
              )
            : checkout.complete(context, branchId, {
                requestId: randomUUID(),
                items: [
                  {
                    branchInventoryId: placed!.id,
                    quantity: 1,
                    expectedUnitPrice: '12.50',
                  },
                ],
                paymentAccountId: testAccountId(context.organizationId, 'CASH'),
                cashTender: '12.50',
              });
      const result = pending.then(
        () => 'written',
        () => 'denied',
      );
      let waiting = false;
      try {
        for (let n = 0; n < 100; n++) {
          const locks = await admin.query<{ count: number }>(
            "SELECT count(*)::int AS count FROM pg_stat_activity WHERE wait_event_type = 'Lock' AND query LIKE '%MerchantBranch%'",
          );
          if (locks.rows[0].count) {
            waiting = true;
            break;
          }
          await new Promise((resolve) => setTimeout(resolve, 10));
        }
        expect(waiting).toBe(true);
      } finally {
        unlock();
      }
      await deactivation;
      expect(await result).toBe('denied');
      expect(
        await db.sale.count({
          where: { organizationId: context.organizationId },
        }),
      ).toBe(0);
      if (placed)
        expect(
          (
            await db.branchInventory.findUniqueOrThrow({
              where: { id: placed.id },
            })
          ).quantity,
        ).toBe(5);
      else
        expect(
          await db.branchInventory.count({
            where: { organizationId: context.organizationId },
          }),
        ).toBe(0);
    },
  );
  it('shares profile access and lets managers place previously unplaced affiliated products', async () => {
    await associations.assign(context, merchantId, branchId);
    for (const id of [merchantUser, sharedUser])
      expect(
        await db.branch.count({
          where: branchScope(merchantContext(merchantId, id)),
        }),
      ).toBe(1);
    const manager: OrganizationContext = {
      ...context,
      userId: managerUser,
      role: 'MANAGER',
    };
    expect(await db.merchant.count({ where: merchantScope(manager) })).toBe(1);
    expect(await db.product.count({ where: productScope(manager) })).toBe(1);
    expect(
      (
        await inventory.eligibleProducts(
          context.organizationId,
          branchId,
          {},
          manager,
        )
      ).items,
    ).toHaveLength(1);
    await members.setMerchant(
      context.organizationId,
      merchantUser,
      otherMerchantId,
    );
    expect(
      await db.branch.count({
        where: branchScope(merchantContext(otherMerchantId)),
      }),
    ).toBe(0);
    expect(
      await db.branch.count({
        where: branchScope(merchantContext(merchantId, sharedUser)),
      }),
    ).toBe(1);
    await expect(
      members.setBranch(context.organizationId, sharedUser, branchId, true),
    ).rejects.toThrow('inherit');
  });
  it('prevents cross-tenant associations and mismatched product ownership in the database', async () => {
    const foreign = await db.organization.create({ data: { name: 'Foreign' } });
    const m = await db.merchant.create({
      data: merchantData(foreign.id, 'Foreign'),
    });
    await expect(
      associations.assign(context, m.id, branchId),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      db.merchantBranch.create({
        data: {
          organizationId: context.organizationId,
          branchId,
          merchantId: m.id,
        },
      }),
    ).rejects.toThrow();
    await associations.assign(context, otherMerchantId, branchId);
    await expect(
      db.branchInventory.create({
        data: {
          organizationId: context.organizationId,
          branchId,
          productId,
          merchantId: otherMerchantId,
          sellingPrice: '12.50',
        },
      }),
    ).rejects.toThrow();
    await associations.assign(context, merchantId, branchId);
    await expect(
      db.merchantBranch.create({
        data: { organizationId: context.organizationId, branchId, merchantId },
      }),
    ).rejects.toThrow();
  });
  it('coordinates participation locks with concurrent deactivation', async () => {
    await associations.assign(context, merchantId, branchId);
    let release!: () => void, acquired!: () => void;
    const hold = new Promise<void>((resolve) => {
        release = resolve;
      }),
      ready = new Promise<void>((resolve) => {
        acquired = resolve;
      });
    const reader = db.$transaction(
      async (tx) => {
        await requireActiveParticipation(tx, context.organizationId, branchId, [
          merchantId,
        ]);
        acquired();
        await hold;
      },
      { timeout: 10000 },
    );
    await ready;
    let completed = false;
    const writer = associations
      .setStatus(context, merchantId, branchId, 'INACTIVE')
      .then(() => {
        completed = true;
      });
    try {
      for (let i = 0; i < 30; i++) {
        const result = await admin.query(
          "SELECT count(*)::int AS count FROM pg_stat_activity WHERE wait_event_type = 'Lock' AND query LIKE '%MerchantBranch%'",
        );
        if ((result.rows[0] as { count: number }).count) break;
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      expect(completed).toBe(false);
    } finally {
      release();
    }
    await reader;
    await writer;
    await expect(createPlacement()).rejects.toMatchObject({
      response: { code: 'MERCHANT_BRANCH_INACTIVE' },
    });
  });
  it('validates HTTP authorization, unknown fields, pagination and own-only projections', async () => {
    const path = `/organizations/${context.organizationId}/merchants/${merchantId}/branches/${branchId}`;
    await http().put(path).send({}).expect(401);
    for (const id of [merchantUser, managerUser, cashierUser])
      await http()
        .put(path)
        .auth(token(id), { type: 'bearer' })
        .send({})
        .expect(403);
    await http()
      .put(path)
      .auth(token(context.userId), { type: 'bearer' })
      .send({ organizationId: randomUUID() })
      .expect(400);
    await http()
      .put(path)
      .auth(token(context.userId), { type: 'bearer' })
      .send({})
      .expect(200);
    await http()
      .patch(`${path}/status`)
      .auth(token(context.userId), { type: 'bearer' })
      .send({ status: 'INVALID' })
      .expect(400);
    const list = `/organizations/${context.organizationId}/branches/${branchId}/merchants`;
    const response = await http()
      .get(list)
      .auth(token(merchantUser), { type: 'bearer' })
      .expect(200);
    expect((response.body as { items: unknown[] }).items).toHaveLength(1);
    expect(JSON.stringify(response.body)).not.toContain('contactName');
    await http()
      .get(`${list}?page=0`)
      .auth(token(context.userId), { type: 'bearer' })
      .expect(400);
    await http()
      .get(`${list}?unexpected=1`)
      .auth(token(context.userId), { type: 'bearer' })
      .expect(400);
    await http()
      .get(list.replace(branchId, randomUUID()))
      .auth(token(merchantUser), { type: 'bearer' })
      .expect(404);
    for (let i = 0; i < 15; i++) {
      const m = await db.merchant.create({
        data: merchantData(context.organizationId, `Merchant ${i}`),
      });
      await associations.assign(context, m.id, branchId);
    }
    const page = await associations.list(context, 'branch', branchId, {
      page: 1,
    });
    expect(page.items).toHaveLength(15);
    expect(page.hasNext).toBe(true);
    expect(
      (await associations.list(context, 'branch', branchId, { page: 2 })).items,
    ).toHaveLength(1);
    expect(
      (
        await associations.list(merchantContext(), 'branch', branchId, {
          page: 1,
        })
      ).items,
    ).toHaveLength(1);
  });
  it('merchant invitations reject grants and inherit profile affiliations on acceptance', async () => {
    const invites = new OrganizationInvitationsService(prisma, emails),
      actor = await db.user.findUniqueOrThrow({
        where: { id: context.userId },
      }),
      recipient = await user();
    await associations.assign(context, merchantId, branchId);
    await expect(
      invites.create(context.organizationId, actor, {
        email: recipient.email,
        role: 'MERCHANT',
        merchantId,
        branchIds: [branchId],
      }),
    ).rejects.toMatchObject({ status: 400 });
    const invite = await invites.create(context.organizationId, actor, {
      email: recipient.email,
      role: 'MERCHANT',
      merchantId,
    });
    await invites.accept(invite.token, recipient);
    expect(
      await db.branchMembership.count({ where: { userId: recipient.id } }),
    ).toBe(0);
    expect(
      await db.branch.count({
        where: branchScope(merchantContext(merchantId, recipient.id)),
      }),
    ).toBe(1);
  });
});
