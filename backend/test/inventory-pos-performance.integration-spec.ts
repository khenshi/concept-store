import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { PrismaPg } from '@prisma/adapter-pg';
import { Client } from 'pg';
import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaService } from '../src/infrastructure/database/prisma.service';
import { BranchInventoryService } from '../src/modules/organizations/inventory/branch-inventory.service';
import { PosCatalogService } from '../src/modules/organizations/pos/pos-catalog.service';

// Explicit opt-in: never seed or benchmark an application database.
const enabled = process.env.RUN_PERF_BENCHMARK === '1';
const connectionString = process.env.TEST_DATABASE_URL;
const schema = `perf_test_${randomUUID().replaceAll('-', '')}`;
const admin = connectionString ? new Client({ connectionString }) : null;
let queryCount = 0;
const prisma = connectionString
  ? new PrismaClient({
      adapter: new PrismaPg(
        { connectionString, options: `-c search_path=${schema}`, max: 20 },
        { schema },
      ),
      log: [{ emit: 'event', level: 'query' }],
    })
  : null;
prisma?.$on('query', () => {
  queryCount++;
});

const suite = enabled ? describe : describe.skip;
suite('disposable Inventory/POS performance baseline', () => {
  if (!connectionString || !prisma || !admin)
    throw new Error(
      'Set TEST_DATABASE_URL to an explicitly disposable PostgreSQL database',
    );
  const db = prisma;
  const pg = admin;
  let organizationId: string;
  let branchId: string;
  let userId: string;
  let hotInventoryId: string;

  beforeAll(async () => {
    await pg.connect();
    await pg.query(`CREATE SCHEMA "${schema}"`);
    await pg.query(`SET search_path TO "${schema}"`);
    const migrations = join(__dirname, '../prisma/migrations');
    for (const directory of readdirSync(migrations)
      .filter((name) => /^\d/.test(name))
      .sort())
      await pg.query(
        readFileSync(
          join(migrations, directory, 'migration.sql'),
          'utf8',
        ).replace('CREATE SCHEMA IF NOT EXISTS "public";', ''),
      );
    organizationId = (
      await db.organization.create({ data: { name: randomUUID() } })
    ).id;
    userId = (
      await db.user.create({
        data: {
          firstName: 'Performance',
          lastName: 'Test',
          email: `${randomUUID()}@example.test`,
          passwordHash: 'unused',
        },
      })
    ).id;
    await db.organizationMembership.create({
      data: { organizationId, userId, role: 'OWNER' },
    });
    const merchantId = (
      await db.merchant.create({
        data: {
          organizationId,
          name: 'Benchmark merchant',
          contactName: 'Test',
          phone: '09171234567',
        },
      })
    ).id;
    branchId = (
      await db.branch.create({
        data: {
          organizationId,
          name: 'Benchmark branch',
          addressLine1: 'Test',
          city: 'Makati',
          province: 'Metro Manila',
          countryCode: 'PH',
        },
      })
    ).id;
    const products = Array.from({ length: 5000 }, (_, index) => ({
      id: randomUUID(),
      organizationId,
      merchantId,
      name: `Item ${String(index).padStart(5, '0')}`,
      sku: `SKU-${String(index).padStart(5, '0')}`,
      barcode: `BAR-${String(index).padStart(5, '0')}`,
    }));
    for (let offset = 0; offset < products.length; offset += 500)
      await db.product.createMany({
        data: products.slice(offset, offset + 500),
      });
    const placements = products.map((product, index) => ({
      id: randomUUID(),
      organizationId,
      branchId,
      productId: product.id,
      sellingPrice: '12.50',
      quantity: index % 3 === 0 ? 0 : index % 3 === 1 ? 3 : 10,
      lowStockThreshold: 5,
    }));
    hotInventoryId = placements[0].id;
    for (let offset = 0; offset < placements.length; offset += 500)
      await db.branchInventory.createMany({
        data: placements.slice(offset, offset + 500),
      });
    for (let offset = 0; offset < 10000; offset += 500)
      await db.inventoryMovement.createMany({
        data: Array.from({ length: 500 }, (_, index) => ({
          id: randomUUID(),
          organizationId,
          branchId,
          branchInventoryId: hotInventoryId,
          type: 'RECEIPT' as const,
          quantityChange: 1,
          quantityAfter: offset + index + 1,
          reason: 'Benchmark fixture',
          createdById: userId,
          requestId: randomUUID(),
        })),
      });
    await pg.query('ANALYZE');
  }, 120000);

  afterAll(async () => {
    await db.$disconnect();
    await pg.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await pg.end();
  });

  it('records representative service timings/query counts and PostgreSQL plans', async () => {
    const inventory = new BranchInventoryService(
      db as unknown as PrismaService,
    );
    const pos = new PosCatalogService(db as unknown as PrismaService);
    const context = { organizationId, userId, role: 'OWNER' as const };
    const firstPage = await inventory.findAll(
      organizationId,
      branchId,
      {},
      context,
    );
    if (firstPage.items.length !== 50 || !firstPage.nextCursor)
      throw new Error('Expected a full bounded first Inventory page');
    const nextCursor = firstPage.nextCursor;
    const actions = {
      directoryPage: () =>
        inventory.findAll(organizationId, branchId, {}, context),
      directoryNextPage: () =>
        inventory.findAll(
          organizationId,
          branchId,
          { cursor: nextCursor },
          context,
        ),
      statusPage: () =>
        inventory.findAll(
          organizationId,
          branchId,
          { stockStatus: 'LOW_STOCK' },
          context,
        ),
      summary: () => inventory.summarize(organizationId, branchId, context),
      movements: () =>
        inventory.findMovements(
          organizationId,
          branchId,
          hotInventoryId,
          context,
        ),
      posSearch: () => pos.findAll(context, branchId, 'Item 049'),
      posCode: () => pos.findByCode(context, branchId, 'SKU-04999'),
    };
    for (const [name, action] of Object.entries(actions)) {
      await action();
      const samples: number[] = [];
      const initialCount = queryCount;
      for (let index = 0; index < 5; index++) {
        const start = performance.now();
        await action();
        samples.push(performance.now() - start);
      }
      samples.sort((a, b) => a - b);
      console.log(
        JSON.stringify({
          name,
          medianMs: Number(samples[2].toFixed(2)),
          queriesPerCall: (queryCount - initialCount) / 5,
        }),
      );
    }
    const plans = {
      directoryPage: `SELECT bi."id" FROM "BranchInventory" bi JOIN "Product" p ON p."id" = bi."productId" WHERE bi."organizationId" = '${organizationId}' AND bi."branchId" = '${branchId}' ORDER BY p."name", bi."id" LIMIT 51`,
      statusPage: `SELECT bi."id" FROM "BranchInventory" bi JOIN "Product" p ON p."id" = bi."productId" WHERE bi."organizationId" = '${organizationId}' AND bi."branchId" = '${branchId}' AND bi."quantity" > 0 AND bi."quantity" <= bi."lowStockThreshold" AND bi."lowStockThreshold" > 0 ORDER BY p."name", bi."id" LIMIT 51`,
      summary: `SELECT "quantity", "lowStockThreshold" FROM "BranchInventory" WHERE "organizationId" = '${organizationId}' AND "branchId" = '${branchId}'`,
      summaryCountLow: `SELECT COUNT(*) FROM "BranchInventory" WHERE "organizationId" = '${organizationId}' AND "branchId" = '${branchId}' AND "quantity" > 0 AND "quantity" <= "lowStockThreshold" AND "lowStockThreshold" > 0`,
      movements: `SELECT "id", "createdAt" FROM "InventoryMovement" WHERE "organizationId" = '${organizationId}' AND "branchId" = '${branchId}' AND "branchInventoryId" = '${hotInventoryId}' ORDER BY "createdAt" DESC, "id" DESC`,
      movementsPage: `SELECT "id", "createdAt" FROM "InventoryMovement" WHERE "organizationId" = '${organizationId}' AND "branchId" = '${branchId}' AND "branchInventoryId" = '${hotInventoryId}' ORDER BY "createdAt" DESC, "id" DESC LIMIT 51`,
      posSearch: `SELECT bi."id" FROM "BranchInventory" bi JOIN "Product" p ON p."id" = bi."productId" JOIN "Merchant" m ON m."id" = p."merchantId" WHERE bi."organizationId" = '${organizationId}' AND bi."branchId" = '${branchId}' AND p."status" = 'ACTIVE' AND m."status" = 'ACTIVE' AND p."name" ILIKE '%Item 049%' ORDER BY p."name", bi."id" LIMIT 100`,
      posCode: `SELECT bi."id" FROM "BranchInventory" bi JOIN "Product" p ON p."id" = bi."productId" WHERE bi."organizationId" = '${organizationId}' AND bi."branchId" = '${branchId}' AND (p."sku" = 'SKU-04999' OR p."barcode" = 'SKU-04999') ORDER BY p."name", bi."id"`,
    };
    for (const [name, sql] of Object.entries(plans)) {
      const plan = await pg.query<{ 'QUERY PLAN': string }>(
        `EXPLAIN (ANALYZE, BUFFERS) ${sql}`,
      );
      console.log(
        JSON.stringify({
          plan: name,
          lines: plan.rows.map((row) => row['QUERY PLAN']),
        }),
      );
    }
    const merchant = await db.merchant.findFirstOrThrow({
      where: { organizationId },
      select: { id: true },
    });
    const eligible = Array.from({ length: 100 }, (_, index) => ({
      id: randomUUID(),
      organizationId,
      merchantId: merchant.id,
      name: `Unplaced ${String(index).padStart(5, '0')}`,
    }));
    await db.product.createMany({ data: eligible });
    await pg.query('ANALYZE');
    const picker = () =>
      inventory.eligibleProducts(organizationId, branchId, {}, context);
    const pickerFirst = await picker();
    if (pickerFirst.items.length !== 50 || !pickerFirst.nextCursor)
      throw new Error('Expected a full bounded first picker page');
    const pickerSamples: number[] = [];
    const pickerCount = queryCount;
    for (let index = 0; index < 5; index++) {
      const start = performance.now();
      await picker();
      pickerSamples.push(performance.now() - start);
    }
    pickerSamples.sort((a, b) => a - b);
    console.log(
      JSON.stringify({
        name: 'eligibleProductsPage',
        medianMs: Number(pickerSamples[2].toFixed(2)),
        queriesPerCall: (queryCount - pickerCount) / 5,
        returned: pickerFirst.items.length,
      }),
    );
    const pickerPlan = await pg.query<{ 'QUERY PLAN': string }>(
      `EXPLAIN (ANALYZE, BUFFERS) SELECT p."id" FROM "Product" p JOIN "Merchant" m ON m."id" = p."merchantId" WHERE p."organizationId" = '${organizationId}' AND p."status" = 'ACTIVE' AND m."status" = 'ACTIVE' AND NOT EXISTS (SELECT 1 FROM "BranchInventory" bi WHERE bi."organizationId" = '${organizationId}' AND bi."branchId" = '${branchId}' AND bi."productId" = p."id") ORDER BY p."name", p."id" LIMIT 51`,
    );
    console.log(
      JSON.stringify({
        plan: 'eligibleProductsPage',
        lines: pickerPlan.rows.map((row) => row['QUERY PLAN']),
      }),
    );
  }, 120000);
});
