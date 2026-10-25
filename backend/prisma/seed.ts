import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { hash } from 'bcryptjs';
import { createHash, randomUUID } from 'node:crypto';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  InventoryMovementType,
  MerchantStatus,
  OrganizationRole,
  PrismaClient,
  ProductStatus,
  Prisma,
  SalePaymentMethod,
} from '../src/generated/prisma/client';
import {
  assertDemoSeedDatabaseIdentity,
  assertDemoSeedMigrationState,
  getDemoSeedConnectionString,
} from '../src/infrastructure/database/demo-seed-safety';
const ids = {
  organization: '00000000-0000-4000-8000-000000000001',
  branches: {
    makati: '00000000-0000-4000-8000-000000000011',
    bgc: '00000000-0000-4000-8000-000000000012',
  },
  users: {
    owner: '00000000-0000-4000-8000-000000000021',
    manager: '00000000-0000-4000-8000-000000000022',
    cashier: '00000000-0000-4000-8000-000000000023',
    merchant: '00000000-0000-4000-8000-000000000024',
  },
  merchants: {
    active: '00000000-0000-4000-8000-000000000041',
    inactive: '00000000-0000-4000-8000-000000000042',
    suspended: '00000000-0000-4000-8000-000000000043',
    ended: '00000000-0000-4000-8000-000000000044',
    secondActive: '00000000-0000-4000-8000-000000000045',
  },
  products: {
    vase: '00000000-0000-4000-8000-000000000051',
    tray: '00000000-0000-4000-8000-000000000052',
    inactive: '00000000-0000-4000-8000-000000000053',
    pouch: '00000000-0000-4000-8000-000000000054',
  },
  inventory: {
    makatiVase: '00000000-0000-4000-8000-000000000061',
    bgcVase: '00000000-0000-4000-8000-000000000062',
    makatiTray: '00000000-0000-4000-8000-000000000063',
    inactive: '00000000-0000-4000-8000-000000000064',
    pouch: '00000000-0000-4000-8000-000000000065',
  },
} as const;

async function resetDatabase(prisma: PrismaClient): Promise<void> {
  const tables = await prisma.$queryRaw<Array<{ tablename: string }>>`
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'
  `;
  if (tables.length === 0) return;
  const quoted = tables
    .map(({ tablename }) => `"${tablename.replaceAll('"', '""')}"`)
    .join(', ');
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE ${quoted} RESTART IDENTITY CASCADE`,
  );
}

async function seedFoundation(prisma: PrismaClient): Promise<void> {
  const passwordHash = await hash('DemoPassword123!', 10);
  const users = [
    [ids.users.owner, 'Owner', 'Demo', 'owner.demo@example.com'],
    [ids.users.manager, 'Manager', 'Demo', 'manager.demo@example.com'],
    [ids.users.cashier, 'Cashier', 'Demo', 'cashier.demo@example.com'],
    [ids.users.merchant, 'Merchant', 'Demo', 'merchant.demo@example.com'],
  ] as const;

  await prisma.user.createMany({
    data: users.map(([id, firstName, lastName, email]) => ({
      id,
      firstName,
      lastName,
      email,
      passwordHash,
      emailVerifiedAt: new Date(),
    })),
  });

  await prisma.organization.create({
    data: { id: ids.organization, name: 'Kapwesto Demo Store' },
  });
  await prisma.organizationMembership.createMany({
    data: [
      {
        organizationId: ids.organization,
        userId: ids.users.owner,
        role: OrganizationRole.OWNER,
      },
      {
        organizationId: ids.organization,
        userId: ids.users.manager,
        role: OrganizationRole.MANAGER,
      },
      {
        organizationId: ids.organization,
        userId: ids.users.cashier,
        role: OrganizationRole.CASHIER,
      },
      {
        organizationId: ids.organization,
        userId: ids.users.merchant,
        role: OrganizationRole.MERCHANT,
      },
    ],
  });
  await prisma.branch.createMany({
    data: [
      {
        id: ids.branches.makati,
        organizationId: ids.organization,
        name: 'Makati Main',
        code: 'MAKATI',
        addressLine1: '123 Demo Retail Street',
        city: 'Makati',
        province: 'Metro Manila',
        postalCode: '1200',
        countryCode: 'PH',
      },
      {
        id: ids.branches.bgc,
        organizationId: ids.organization,
        name: 'BGC Satellite',
        code: 'BGC',
        addressLine1: '45 Demo Bonifacio Avenue',
        city: 'Taguig',
        province: 'Metro Manila',
        postalCode: '1634',
        countryCode: 'PH',
      },
    ],
  });
  await prisma.merchant.createMany({
    data: [
      {
        id: ids.merchants.active,
        organizationId: ids.organization,
        name: 'Amihan Home Studio',
        code: 'AMIHAN-HOME',
        contactName: 'Mara Santos',
        email: 'mara@amihan.example.com',
        phone: '+63 917 555 0101',
      },
      {
        id: ids.merchants.inactive,
        organizationId: ids.organization,
        name: 'Habi at Hiyas',
        code: 'HABI-HIYAS',
        contactName: 'Lina Reyes',
        email: 'lina@habihiyas.example.com',
        phone: '(02) 8555 0102',
        status: MerchantStatus.INACTIVE,
      },
      {
        id: ids.merchants.suspended,
        organizationId: ids.organization,
        name: 'Kape Tala Roasters',
        code: 'KAPE-TALA',
        contactName: 'Paolo Cruz',
        phone: '+63 905 555 0103',
        status: MerchantStatus.SUSPENDED,
      },
      {
        id: ids.merchants.ended,
        organizationId: ids.organization,
        name: 'Lumang Bayan Leather',
        contactName: 'Tomas Villanueva',
        email: 'tomas@lumangbayan.example.com',
        phone: '0917 555 0104',
        status: MerchantStatus.ENDED,
      },
      {
        id: ids.merchants.secondActive,
        organizationId: ids.organization,
        name: 'Luntian Studio',
        code: 'LUNTIAN',
        contactName: 'Ana Demo',
        phone: '09171234567',
      },
    ],
  });

  await prisma.organizationMembership.update({
    where: {
      organizationId_userId: {
        organizationId: ids.organization,
        userId: ids.users.merchant,
      },
    },
    data: { merchantId: ids.merchants.active },
  });
  await prisma.branchMembership.createMany({
    data: [
      {
        organizationId: ids.organization,
        branchId: ids.branches.makati,
        userId: ids.users.manager,
      },
      {
        organizationId: ids.organization,
        branchId: ids.branches.makati,
        userId: ids.users.cashier,
      },
    ],
  });

  await seedProductInventory(prisma);
  await seedSales(prisma);

  const invitationToken = 'foundation-demo-invitation-token-0000000001';
  await prisma.organizationInvitation.create({
    data: {
      id: '00000000-0000-4000-8000-000000000031',
      organizationId: ids.organization,
      email: 'invited.cashier.demo@example.com',
      role: OrganizationRole.CASHIER,
      tokenHash: createHash('sha256').update(invitationToken).digest('hex'),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      invitedById: ids.users.owner,
      branches: {
        create: {
          branchId: ids.branches.bgc,
        },
      },
    },
  });

  console.info('Foundation demo database seeded successfully.');
  console.info('Demo login password: DemoPassword123!');
  console.info('Invitation token:', invitationToken);
}

async function seedProductInventory(prisma: PrismaClient): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.product.createMany({
      data: [
        {
          id: ids.products.vase,
          organizationId: ids.organization,
          merchantId: ids.merchants.active,
          name: 'Amihan Ceramic Vase',
          sku: 'AMIHAN-VASE',
          barcode: '0001234567890',
        },
        {
          id: ids.products.tray,
          organizationId: ids.organization,
          merchantId: ids.merchants.active,
          name: 'Amihan Woven Tray',
          sku: 'AMIHAN-TRAY',
        },
        {
          id: ids.products.inactive,
          organizationId: ids.organization,
          merchantId: ids.merchants.active,
          name: 'Amihan Retired Planter',
          status: ProductStatus.INACTIVE,
        },
        {
          id: ids.products.pouch,
          organizationId: ids.organization,
          merchantId: ids.merchants.secondActive,
          name: 'Luntian Cotton Pouch',
          sku: 'LUNTIAN-POUCH',
        },
      ],
    });
    await tx.merchantBranch.createMany({
      data: [
        {
          organizationId: ids.organization,
          merchantId: ids.merchants.active,
          branchId: ids.branches.makati,
        },
        {
          organizationId: ids.organization,
          merchantId: ids.merchants.active,
          branchId: ids.branches.bgc,
        },
        {
          organizationId: ids.organization,
          merchantId: ids.merchants.secondActive,
          branchId: ids.branches.makati,
        },
      ],
    });
    await tx.branchInventory.createMany({
      data: [
        {
          id: ids.inventory.makatiVase,
          organizationId: ids.organization,
          branchId: ids.branches.makati,
          productId: ids.products.vase,
          merchantId: ids.merchants.active,
          sellingPrice: '850.00',
        },
        {
          id: ids.inventory.bgcVase,
          organizationId: ids.organization,
          branchId: ids.branches.bgc,
          productId: ids.products.vase,
          merchantId: ids.merchants.active,
          sellingPrice: '925.50',
        },
        {
          id: ids.inventory.makatiTray,
          organizationId: ids.organization,
          branchId: ids.branches.makati,
          productId: ids.products.tray,
          merchantId: ids.merchants.active,
          sellingPrice: '450.00',
        },
        {
          id: ids.inventory.inactive,
          organizationId: ids.organization,
          branchId: ids.branches.makati,
          productId: ids.products.inactive,
          merchantId: ids.merchants.active,
          sellingPrice: '600.00',
        },
        {
          id: ids.inventory.pouch,
          organizationId: ids.organization,
          branchId: ids.branches.makati,
          productId: ids.products.pouch,
          merchantId: ids.merchants.secondActive,
          sellingPrice: '250.00',
        },
      ],
    });

    const movements = [
      {
        id: '00000000-0000-4000-8000-000000000071',
        requestId: '00000000-0000-4000-8000-000000000081',
        inventoryId: ids.inventory.makatiVase,
        branchId: ids.branches.makati,
        type: InventoryMovementType.RECEIPT,
        delta: 12,
        reason: 'Initial demo stock received',
        createdAt: new Date('2026-09-12T00:00:00.000Z'),
      },
      {
        id: '00000000-0000-4000-8000-000000000072',
        requestId: '00000000-0000-4000-8000-000000000082',
        inventoryId: ids.inventory.bgcVase,
        branchId: ids.branches.bgc,
        type: InventoryMovementType.RECEIPT,
        delta: 8,
        reason: 'Independent BGC demo stock received',
        createdAt: new Date('2026-09-12T00:01:00.000Z'),
      },
      {
        id: '00000000-0000-4000-8000-000000000073',
        requestId: '00000000-0000-4000-8000-000000000083',
        inventoryId: ids.inventory.makatiVase,
        branchId: ids.branches.makati,
        type: InventoryMovementType.ADJUSTMENT,
        delta: -2,
        reason: 'Two damaged demo units removed',
        createdAt: new Date('2026-09-12T00:02:00.000Z'),
      },
    ];
    for (const movement of movements) {
      const inventory = await tx.branchInventory.update({
        where: {
          id: movement.inventoryId,
          organizationId: ids.organization,
          branchId: movement.branchId,
        },
        data: { quantity: { increment: movement.delta } },
      });
      await tx.inventoryMovement.create({
        data: {
          id: movement.id,
          organizationId: ids.organization,
          branchId: movement.branchId,
          branchInventoryId: inventory.id,
          type: movement.type,
          quantityChange: movement.delta,
          quantityAfter: inventory.quantity,
          reason: movement.reason,
          createdById: ids.users.owner,
          requestId: movement.requestId,
          createdAt: movement.createdAt,
        },
      });
    }
  });
}

// Persistence examples only: no application checkout API/service is implemented here.
async function seedSales(prisma: PrismaClient): Promise<void> {
  await prisma.$transaction(async (tx) => {
    for (const [inventoryId, quantity] of [
      [ids.inventory.makatiTray, 5],
      [ids.inventory.pouch, 6],
    ] as const) {
      const placement = await tx.branchInventory.update({
        where: {
          id: inventoryId,
          organizationId: ids.organization,
          branchId: ids.branches.makati,
        },
        data: { quantity: { increment: quantity } },
      });
      await tx.inventoryMovement.create({
        data: {
          organizationId: ids.organization,
          branchId: placement.branchId,
          branchInventoryId: placement.id,
          type: InventoryMovementType.RECEIPT,
          quantityChange: quantity,
          quantityAfter: placement.quantity,
          reason: 'Demo sale stock received',
          createdById: ids.users.owner,
          requestId: randomUUID(),
          createdAt: new Date('2026-09-13T00:00:00Z'),
        },
      });
    }
    const examples = [
      {
        id: '00000000-0000-4000-8000-000000000091',
        method: SalePaymentMethod.CASH,
        branchId: ids.branches.makati,
        actor: ids.users.cashier,
        tender: '1000.00',
        reference: null,
        lines: [{ id: ids.inventory.makatiVase, quantity: 1 }],
      },
      {
        id: '00000000-0000-4000-8000-000000000092',
        method: SalePaymentMethod.GCASH,
        branchId: ids.branches.makati,
        actor: ids.users.cashier,
        tender: null,
        reference: 'DEMO-GCASH-0001',
        lines: [
          { id: ids.inventory.makatiTray, quantity: 1 },
          { id: ids.inventory.pouch, quantity: 2 },
        ],
      },
      {
        id: '00000000-0000-4000-8000-000000000093',
        method: SalePaymentMethod.CARD,
        branchId: ids.branches.bgc,
        actor: ids.users.owner,
        tender: null,
        reference: 'DEMO-CARD-0001',
        lines: [{ id: ids.inventory.bgcVase, quantity: 1 }],
      },
    ];
    for (const [index, example] of examples.entries()) {
      const branch = await tx.branch.findUniqueOrThrow({
        where: { id: example.branchId, organizationId: ids.organization },
      });
      const actor = await tx.user.findUniqueOrThrow({
        where: { id: example.actor },
      });
      const lines = await Promise.all(
        example.lines.map(async (line) => ({
          quantity: line.quantity,
          placement: await tx.branchInventory.findUniqueOrThrow({
            where: {
              id: line.id,
              organizationId: ids.organization,
              branchId: example.branchId,
            },
            include: { product: { include: { merchant: true } } },
          }),
        })),
      );
      const total = lines.reduce(
        (sum, line) =>
          sum.plus(line.placement.sellingPrice.times(line.quantity)),
        new Prisma.Decimal(0),
      );
      const completedAt = new Date(`2026-09-13T00:0${index + 1}:00Z`);
      const sale = await tx.sale.create({
        data: {
          id: example.id,
          organizationId: ids.organization,
          branchId: branch.id,
          receiptCode: `DEMO-SALE-${index + 1}`,
          createdById: actor.id,
          requestId: example.id,
          paymentMethod: example.method,
          total,
          completedAt,
          cashTender: example.tender,
          cashChange: example.tender
            ? new Prisma.Decimal(example.tender).minus(total)
            : null,
          paymentReference: example.reference,
          organizationName: 'Kapwesto Demo Store',
          branchName: branch.name,
          branchCode: branch.code,
          cashierName: `${actor.firstName} ${actor.lastName}`,
          checkoutCommand: {
            items: lines.map(({ placement, quantity }) => ({
              branchInventoryId: placement.id,
              quantity,
              expectedUnitPrice: placement.sellingPrice.toFixed(2),
            })),
            paymentMethod: example.method,
            ...(example.tender
              ? { cashTender: example.tender }
              : { paymentReference: example.reference }),
          },
        },
      });
      for (const { placement, quantity } of lines) {
        const item = await tx.saleItem.create({
          data: {
            organizationId: ids.organization,
            branchId: branch.id,
            saleId: sale.id,
            branchInventoryId: placement.id,
            productId: placement.productId,
            merchantId: placement.product.merchantId,
            quantity,
            productName: placement.product.name,
            sku: placement.product.sku,
            barcode: placement.product.barcode,
            merchantName: placement.product.merchant.name,
            unitPrice: placement.sellingPrice,
            lineTotal: placement.sellingPrice.times(quantity),
          },
        });
        const updated = await tx.branchInventory.update({
          where: {
            id: placement.id,
            organizationId: ids.organization,
            branchId: branch.id,
          },
          data: { quantity: { decrement: quantity } },
        });
        await tx.inventoryMovement.create({
          data: {
            organizationId: ids.organization,
            branchId: branch.id,
            branchInventoryId: placement.id,
            saleItemId: item.id,
            type: InventoryMovementType.SALE,
            quantityChange: -quantity,
            quantityAfter: updated.quantity,
            reason: 'Point-of-sale checkout',
            createdById: actor.id,
            requestId: randomUUID(),
            createdAt: completedAt,
          },
        });
      }
    }

    const refundSaleId = '00000000-0000-4000-8000-000000000092';
    const refundRequestId = '00000000-0000-4000-8000-0000000000a1';
    const saleItem = await tx.saleItem.findUniqueOrThrow({
      where: {
        saleId_branchInventoryId: {
          saleId: refundSaleId,
          branchInventoryId: ids.inventory.makatiTray,
        },
      },
      select: {
        id: true,
        branchInventoryId: true,
        merchantId: true,
        unitPrice: true,
      },
    });
    const refund = await tx.refund.create({
      data: {
        id: '00000000-0000-4000-8000-0000000000a2',
        organizationId: ids.organization,
        branchId: ids.branches.makati,
        saleId: refundSaleId,
        refundCode: 'DEMO-REFUND-1',
        requestId: refundRequestId,
        createdById: ids.users.owner,
        completedAt: new Date('2026-09-13T00:10:00.000Z'),
        reason: 'Demo customer return',
        paymentMethod: SalePaymentMethod.CASH,
        paymentReference: null,
        total: saleItem.unitPrice,
        refundCommand: {
          items: [{ saleItemId: saleItem.id, quantity: 1, restockQuantity: 1 }],
          reason: 'Demo customer return',
          paymentMethod: SalePaymentMethod.CASH,
          refundConfirmed: true,
        },
      },
    });
    const refundItem = await tx.refundItem.create({
      data: {
        id: '00000000-0000-4000-8000-0000000000a3',
        organizationId: ids.organization,
        branchId: ids.branches.makati,
        saleId: refundSaleId,
        refundId: refund.id,
        saleItemId: saleItem.id,
        branchInventoryId: saleItem.branchInventoryId,
        merchantId: saleItem.merchantId,
        quantity: 1,
        restockQuantity: 1,
        unitPrice: saleItem.unitPrice,
        lineTotal: saleItem.unitPrice,
      },
    });
    const restored = await tx.branchInventory.update({
      where: {
        id: saleItem.branchInventoryId,
        organizationId: ids.organization,
        branchId: ids.branches.makati,
      },
      data: { quantity: { increment: refundItem.restockQuantity } },
    });
    await tx.inventoryMovement.create({
      data: {
        id: '00000000-0000-4000-8000-0000000000a4',
        organizationId: ids.organization,
        branchId: ids.branches.makati,
        branchInventoryId: saleItem.branchInventoryId,
        refundItemId: refundItem.id,
        type: InventoryMovementType.RETURN,
        quantityChange: refundItem.restockQuantity,
        quantityAfter: restored.quantity,
        reason: 'Returned goods restocked',
        createdById: ids.users.owner,
        requestId: '00000000-0000-4000-8000-0000000000a5',
        createdAt: refund.completedAt,
      },
    });
  });
}

async function main(): Promise<void> {
  const resetRequested = process.argv.includes('--reset');
  const connectionString = getDemoSeedConnectionString(
    resetRequested,
    process.env,
  );
  const expectedDatabaseName = process.env.SEED_DEMO_DATABASE_NAME;
  if (!expectedDatabaseName) {
    throw new Error('SEED_DEMO_DATABASE_NAME is required.');
  }
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });
  try {
    const [identity] = await prisma.$queryRaw<
      Array<{ database_name: string; current_schema: string }>
    >`SELECT current_database() AS database_name, current_schema() AS current_schema`;
    assertDemoSeedDatabaseIdentity(
      {
        databaseName: identity?.database_name ?? '',
        currentSchema: identity?.current_schema ?? '',
      },
      expectedDatabaseName,
    );

    const migrationTable = await prisma.$queryRaw<
      Array<{ table_exists: boolean }>
    >`SELECT to_regclass('public._prisma_migrations') IS NOT NULL AS table_exists`;
    if (!migrationTable[0]?.table_exists) {
      throw new Error(
        'Demo seed requires a migrated disposable database with Prisma history.',
      );
    }

    const migrations = await prisma.$queryRaw<
      Array<{
        migration_name: string;
        finished_at: Date | null;
        rolled_back_at: Date | null;
      }>
    >`SELECT migration_name, finished_at, rolled_back_at
       FROM public._prisma_migrations
       ORDER BY finished_at DESC NULLS LAST, started_at DESC`;
    const migrationDirectories = readdirSync(
      join(process.cwd(), 'prisma/migrations'),
    )
      .filter((name) => /^\d/.test(name))
      .sort();
    const expectedLatestMigration = migrationDirectories.at(-1);
    if (!expectedLatestMigration) {
      throw new Error(
        'No repository migration was found for demo seed preflight.',
      );
    }
    assertDemoSeedMigrationState(
      migrations.map((migration) => ({
        migrationName: migration.migration_name,
        finishedAt: migration.finished_at,
        rolledBackAt: migration.rolled_back_at,
      })),
      expectedLatestMigration,
    );

    await resetDatabase(prisma);
    await seedFoundation(prisma);
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
