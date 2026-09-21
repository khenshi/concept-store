import { randomUUID } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { PrismaPg } from '@prisma/adapter-pg';
import { Client } from 'pg';
import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaService } from '../src/infrastructure/database/prisma.service';
import { InventoryStockService } from '../src/modules/organizations/inventory/inventory-stock.service';
import { BranchInventoryService } from '../src/modules/organizations/inventory/branch-inventory.service';
import { InventoryReconciliationService } from '../src/modules/organizations/inventory/inventory-reconciliation.service';
import { InventoryStockStatus } from '../src/modules/organizations/inventory/inventory.types';
import { ProductsService } from '../src/modules/organizations/products/products.service';
import { OrganizationMembershipsService } from '../src/modules/organizations/memberships/organization-memberships.service';
import { OrganizationInvitationsService } from '../src/modules/organizations/invitations/organization-invitations.service';
import { BranchesService } from '../src/modules/organizations/branches/branches.service';
import { MerchantsService } from '../src/modules/organizations/merchants/merchants.service';

// No application DATABASE_URL fallback. Only this run's random schema is removed.
const connectionString = process.env.TEST_DATABASE_URL;
if (!connectionString)
  throw new Error(
    'Set TEST_DATABASE_URL to an explicitly disposable PostgreSQL test database',
  );
const schema = `inventory_test_${randomUUID().replaceAll('-', '')}`;
const admin = new Client({ connectionString });
const prisma = new PrismaClient({
  adapter: new PrismaPg(
    { connectionString, options: `-c search_path=${schema}`, max: 20 },
    { schema },
  ),
});
const stock = new InventoryStockService(prisma as unknown as PrismaService);
const inventory = new BranchInventoryService(
  prisma as unknown as PrismaService,
);
const reconciliation = new InventoryReconciliationService(
  prisma as unknown as PrismaService,
);
const products = new ProductsService(prisma as unknown as PrismaService);
const memberships = new OrganizationMembershipsService(
  prisma as unknown as PrismaService,
);
let organizationId: string;
let branchId: string;
let otherBranchId: string;
let merchantId: string;
let productId: string;
let inventoryId: string;
let userId: string;

const receive = (quantity: number, requestId = randomUUID(), actor = userId) =>
  stock.receive(organizationId, branchId, inventoryId, actor, {
    quantity,
    requestId,
  });
const adjust = (quantityChange: number, requestId = randomUUID()) =>
  stock.adjust(organizationId, branchId, inventoryId, userId, {
    quantityChange,
    reason: 'Correction',
    requestId,
  });
const balance = () =>
  prisma.branchInventory.findUniqueOrThrow({ where: { id: inventoryId } });

describe('PostgreSQL inventory integrity and concurrency', () => {
  it('rolls back membership and invitation claim when a branch grant insertion fails', async () => {
    const invites = new OrganizationInvitationsService(
      prisma as unknown as PrismaService,
    );
    const actor = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });
    const recipient = await prisma.user.create({
      data: {
        firstName: 'Invited',
        lastName: 'User',
        email: `${randomUUID()}@example.test`,
        passwordHash: 'unused',
      },
    });
    const invitation = await invites.create(organizationId, actor, {
      email: recipient.email,
      role: 'MERCHANT',
      merchantId,
      branchIds: [branchId],
    });
    // Trigger exists only in this run's isolated schema; fail the actual grant write.
    await admin.query(
      `CREATE FUNCTION fail_test_grant() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW."userId" = '${recipient.id}' THEN RAISE EXCEPTION 'Test grant failure'; END IF; RETURN NEW; END $$`,
    );
    await admin.query(
      'CREATE TRIGGER fail_test_grant BEFORE INSERT ON "BranchMembership" FOR EACH ROW EXECUTE FUNCTION fail_test_grant()',
    );
    try {
      await expect(
        invites.accept(invitation.token, recipient),
      ).rejects.toThrow();
      expect(
        await prisma.organizationMembership.count({
          where: { organizationId, userId: recipient.id },
        }),
      ).toBe(0);
      expect(
        await prisma.branchMembership.count({
          where: { organizationId, userId: recipient.id },
        }),
      ).toBe(0);
      expect(
        await prisma.organizationInvitation.findUnique({
          where: { id: invitation.invitation.id },
        }),
      ).toMatchObject({ acceptedAt: null, acceptedById: null });
    } finally {
      await admin.query('DROP TRIGGER fail_test_grant ON "BranchMembership"');
      await admin.query('DROP FUNCTION fail_test_grant()');
    }
  });
  const retryConflict = async (operation: () => Promise<unknown>) => {
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        return await operation();
      } catch (error: unknown) {
        if (
          !(error instanceof Error) ||
          !error.message.includes('concurrently') ||
          attempt === 4
        )
          throw error;
      }
    }
  };

  it('does not retain explicit grants after concurrent owner promotion', async () => {
    await prisma.organizationMembership.create({
      data: { organizationId, userId, role: 'MANAGER' },
    });
    const results = await Promise.allSettled([
      memberships.setBranch(organizationId, userId, branchId, true),
      retryConflict(() =>
        memberships.updateRole(organizationId, userId, { role: 'OWNER' }),
      ),
    ]);
    expect(results[1]).toMatchObject({ status: 'fulfilled' });
    expect(
      await prisma.organizationMembership.findUnique({
        where: { organizationId_userId: { organizationId, userId } },
      }),
    ).toMatchObject({ role: 'OWNER', merchantId: null });
    expect(
      await prisma.branchMembership.count({
        where: { organizationId, userId },
      }),
    ).toBe(0);
  });

  it('does not retain assignments after concurrent membership removal', async () => {
    await prisma.organizationMembership.create({
      data: { organizationId, userId, role: 'MANAGER' },
    });
    const results = await Promise.allSettled([
      memberships.setBranch(organizationId, userId, branchId, true),
      retryConflict(() => memberships.remove(organizationId, userId)),
    ]);
    expect(results[1]).toMatchObject({ status: 'fulfilled' });
    expect(
      await prisma.organizationMembership.count({
        where: { organizationId, userId },
      }),
    ).toBe(0);
    expect(
      await prisma.branchMembership.count({
        where: { organizationId, userId },
      }),
    ).toBe(0);
  });

  it('clears merchant links when relinking races with a nonmerchant role change', async () => {
    await prisma.organizationMembership.create({
      data: { organizationId, userId, role: 'MERCHANT', merchantId },
    });
    const results = await Promise.allSettled([
      memberships.setMerchant(organizationId, userId, merchantId),
      retryConflict(() =>
        memberships.updateRole(organizationId, userId, { role: 'CASHIER' }),
      ),
    ]);
    if (results[1].status === 'rejected')
      throw new Error(JSON.stringify(results[1].reason));
    expect(results[1]).toMatchObject({ status: 'fulfilled' });
    expect(
      await prisma.organizationMembership.findUnique({
        where: { organizationId_userId: { organizationId, userId } },
      }),
    ).toMatchObject({ role: 'CASHIER', merchantId: null });
  });

  it('retains one owner when two owners are concurrently demoted', async () => {
    const second = await prisma.user.create({
      data: {
        firstName: 'Second',
        lastName: 'Owner',
        email: `${randomUUID()}@example.test`,
        passwordHash: 'unused',
      },
    });
    await prisma.organizationMembership.createMany({
      data: [userId, second.id].map((userId) => ({
        organizationId,
        userId,
        role: 'OWNER' as const,
      })),
    });
    const results = await Promise.allSettled(
      [userId, second.id].map((target) =>
        memberships.updateRole(organizationId, target, { role: 'MANAGER' }),
      ),
    );
    expect(results.filter(({ status }) => status === 'fulfilled')).toHaveLength(
      1,
    );
    expect(
      await prisma.organizationMembership.count({
        where: { organizationId, role: 'OWNER' },
      }),
    ).toBe(1);
  });

  it('creates one membership and grant set for simultaneous invitation acceptance', async () => {
    const invites = new OrganizationInvitationsService(
      prisma as unknown as PrismaService,
    );
    const actor = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });
    const recipient = await prisma.user.create({
      data: {
        firstName: 'Invited',
        lastName: 'User',
        email: `${randomUUID()}@example.test`,
        passwordHash: 'unused',
      },
    });
    const invitation = await invites.create(organizationId, actor, {
      email: recipient.email,
      role: 'MERCHANT',
      merchantId,
      branchIds: [branchId, otherBranchId],
    });
    const results = await Promise.allSettled(
      Array.from({ length: 6 }, () =>
        invites.accept(invitation.token, recipient),
      ),
    );
    expect(results.filter(({ status }) => status === 'fulfilled')).toHaveLength(
      1,
    );
    expect(
      await prisma.organizationMembership.count({
        where: { organizationId, userId: recipient.id },
      }),
    ).toBe(1);
    expect(
      await prisma.branchMembership.count({
        where: { organizationId, userId: recipient.id },
      }),
    ).toBe(2);
  });

  it('never both revokes and accepts a pending invitation concurrently', async () => {
    const invites = new OrganizationInvitationsService(
      prisma as unknown as PrismaService,
    );
    const actor = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });
    const recipient = await prisma.user.create({
      data: {
        firstName: 'Invited',
        lastName: 'User',
        email: `${randomUUID()}@example.test`,
        passwordHash: 'unused',
      },
    });
    const invitation = await invites.create(organizationId, actor, {
      email: recipient.email,
      role: 'CASHIER',
      branchIds: [branchId],
    });
    const results = await Promise.allSettled([
      invites.accept(invitation.token, recipient),
      invites.revoke(organizationId, invitation.invitation.id),
    ]);
    expect(results.filter(({ status }) => status === 'fulfilled')).toHaveLength(
      1,
    );
    const saved = await prisma.organizationInvitation.findUniqueOrThrow({
      where: { id: invitation.invitation.id },
    });
    expect(Boolean(saved.acceptedAt)).not.toBe(Boolean(saved.revokedAt));
    expect(
      await prisma.branchMembership.count({
        where: { organizationId, userId: recipient.id },
      }),
    ).toBe(saved.acceptedAt ? 1 : 0);
  });

  it('fresh database context loses branch visibility after revoke and changes merchant visibility after relink', async () => {
    const branches = new BranchesService(prisma as unknown as PrismaService);
    await prisma.organizationMembership.create({
      data: { organizationId, userId, role: 'MANAGER' },
    });
    await memberships.setBranch(organizationId, userId, branchId, true);
    const context = { organizationId, userId, role: 'MANAGER' as const };
    expect(await branches.findAll(organizationId, context)).toHaveLength(1);
    await memberships.setBranch(organizationId, userId, branchId, false);
    expect(await branches.findAll(organizationId, context)).toEqual([]);
    await memberships.updateRole(organizationId, userId, {
      role: 'MERCHANT',
      merchantId,
    });
    const other = await prisma.merchant.create({
      data: {
        organizationId,
        name: 'Other',
        contactName: 'Other Contact',
        phone: '09171234567',
      },
    });
    await memberships.setMerchant(organizationId, userId, other.id);
    const fresh = await prisma.organizationMembership.findUniqueOrThrow({
      where: { organizationId_userId: { organizationId, userId } },
    });
    expect(await products.findAll(organizationId, {}, fresh)).toEqual([]);
    await expect(
      products.findOne(organizationId, productId, fresh),
    ).rejects.toThrow();
  });
  it('filters assigned manager reads and projects merchant own-placement reads without contacts or actors', async () => {
    const branches = new BranchesService(prisma as unknown as PrismaService);
    const merchants = new MerchantsService(prisma as unknown as PrismaService);
    await prisma.organizationMembership.create({
      data: { organizationId, userId, role: 'MANAGER' },
    });
    await memberships.setBranch(organizationId, userId, branchId, true);
    const manager = { organizationId, userId, role: 'MANAGER' as const };
    expect(await branches.findAll(organizationId, manager)).toHaveLength(1);
    await expect(
      branches.findOne(organizationId, otherBranchId, manager),
    ).rejects.toThrow();
    expect(await products.findAll(organizationId, {}, manager)).toHaveLength(1);
    const summary = await merchants.findOne(
      organizationId,
      merchantId,
      manager,
    );
    expect(summary).not.toHaveProperty('contactName');
    const unplaced = await products.create(organizationId, {
      merchantId,
      name: 'Unplaced',
    });
    await expect(
      products.findOne(organizationId, unplaced.id, manager),
    ).rejects.toThrow();
    await inventory.create(
      organizationId,
      otherBranchId,
      {
        productId,
        sellingPrice: '14.00',
        initialQuantity: 0,
      },
      userId,
    );
    expect(
      await products.findInventory(organizationId, productId, manager),
    ).toHaveLength(1);
    await receive(2);
    const merchant = {
      organizationId,
      userId,
      role: 'MERCHANT' as const,
      merchantId,
    };
    const visibleBranches = await branches.findAll(organizationId, merchant);
    expect(visibleBranches).toHaveLength(2);
    expect(visibleBranches[0]).not.toHaveProperty('addressLine1');
    expect(
      await products.findInventory(organizationId, productId, merchant),
    ).toHaveLength(2);
    const history = await inventory.findMovements(
      organizationId,
      branchId,
      inventoryId,
      merchant,
    );
    expect(history.items).toHaveLength(1);
    expect(history.items[0]).not.toHaveProperty('createdById');
    const otherMerchant = await prisma.merchant.create({
      data: {
        organizationId,
        name: 'Other business',
        contactName: 'Private contact',
        phone: '09171234567',
      },
    });
    const otherProduct = await products.create(organizationId, {
      merchantId: otherMerchant.id,
      name: 'Other product',
    });
    const hidden = await inventory.create(
      organizationId,
      branchId,
      {
        productId: otherProduct.id,
        sellingPrice: '15.00',
        initialQuantity: 0,
      },
      userId,
    );
    expect(
      (await inventory.findAll(organizationId, branchId, {}, merchant)).items,
    ).toHaveLength(1);
    expect(
      await inventory.summarize(organizationId, branchId, merchant),
    ).toEqual({
      inStock: 0,
      lowStock: 1,
      outOfStock: 0,
    });
    expect(
      (
        await inventory.findAll(
          organizationId,
          branchId,
          {
            stockStatus: InventoryStockStatus.OUT_OF_STOCK,
          },
          merchant,
        )
      ).items,
    ).toEqual([]);
    expect(
      await inventory.summarize(organizationId, branchId, manager),
    ).toEqual({
      inStock: 0,
      lowStock: 1,
      outOfStock: 1,
    });
    await expect(
      inventory.findOne(organizationId, branchId, hidden.id, merchant),
    ).rejects.toThrow();
    await expect(
      products.findOne(organizationId, otherProduct.id, merchant),
    ).rejects.toThrow();
    await expect(
      merchants.findOne(organizationId, otherMerchant.id, merchant),
    ).rejects.toThrow();
    expect(
      await products.findAll(
        organizationId,
        {},
        { ...merchant, merchantId: null },
      ),
    ).toEqual([]);
  });
  it('atomically accepts merchant invitation grants and rejects replay/revocation', async () => {
    const invites = new OrganizationInvitationsService(
      prisma as unknown as PrismaService,
    );
    const actor = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });
    const recipient = await prisma.user.create({
      data: {
        firstName: 'Invited',
        lastName: 'Merchant',
        email: `${randomUUID()}@example.test`,
        passwordHash: 'unused',
      },
    });
    const created = await invites.create(organizationId, actor, {
      email: recipient.email,
      role: 'MERCHANT',
      merchantId,
      branchIds: [branchId, otherBranchId],
    });
    expect(created.invitation.branches).toHaveLength(2);
    expect(await invites.preview(created.token)).not.toHaveProperty(
      'merchantId',
    );
    await invites.accept(created.token, recipient);
    expect(
      await prisma.organizationMembership.findUnique({
        where: {
          organizationId_userId: { organizationId, userId: recipient.id },
        },
      }),
    ).toMatchObject({ role: 'MERCHANT', merchantId });
    expect(
      await prisma.branchMembership.count({
        where: { organizationId, userId: recipient.id },
      }),
    ).toBe(2);
    await expect(invites.accept(created.token, recipient)).rejects.toThrow();
    const revoked = await invites.create(organizationId, actor, {
      email: `${randomUUID()}@example.test`,
      role: 'CASHIER',
      branchIds: [branchId],
    });
    await invites.revoke(organizationId, revoked.invitation.id);
    await expect(invites.accept(revoked.token, recipient)).rejects.toThrow();
  });

  it('rolls back an invitation claim when membership creation fails', async () => {
    const invites = new OrganizationInvitationsService(
      prisma as unknown as PrismaService,
    );
    const actor = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });
    const email = `${randomUUID()}@example.test`;
    const created = await invites.create(organizationId, actor, {
      email,
      role: 'MERCHANT',
      merchantId,
      branchIds: [branchId],
    });
    await expect(
      invites.accept(created.token, { id: randomUUID(), email }),
    ).rejects.toThrow();
    expect(
      await prisma.organizationInvitation.findUnique({
        where: { id: created.invitation.id },
      }),
    ).toMatchObject({ acceptedAt: null, acceptedById: null });
  });
  beforeAll(async () => {
    await admin.connect();
    await admin.query(`CREATE SCHEMA "${schema}"`);
    await admin.query(`SET search_path TO "${schema}"`);
    const migrations = join(__dirname, '../prisma/migrations');
    for (const directory of readdirSync(migrations)
      .filter((name) => /^\d/.test(name))
      .sort()) {
      // Baseline schema declaration is omitted: all objects belong to the isolated schema.
      const sql = readFileSync(
        join(migrations, directory, 'migration.sql'),
        'utf8',
      ).replace('CREATE SCHEMA IF NOT EXISTS "public";', '');
      await admin.query(sql);
    }
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await admin.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await admin.end();
  });

  beforeEach(async () => {
    const organization = await prisma.organization.create({
      data: { name: randomUUID() },
    });
    organizationId = organization.id;
    userId = (
      await prisma.user.create({
        data: {
          firstName: 'Test',
          lastName: 'Actor',
          email: `${randomUUID()}@example.test`,
          passwordHash: 'unused-test-hash',
        },
      })
    ).id;
    merchantId = (
      await prisma.merchant.create({
        data: {
          organizationId,
          name: 'Merchant',
          contactName: 'Test Contact',
          code: 'TEST',
          phone: '09171234567',
        },
      })
    ).id;
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
    otherBranchId = (
      await prisma.branch.create({ data: { ...branchData, name: 'Second' } })
    ).id;
    productId = (
      await products.create(organizationId, {
        merchantId,
        name: 'Product',
        sku: 'SKU',
        barcode: '001Ab',
      })
    ).id;
    inventoryId = (
      await inventory.create(
        organizationId,
        branchId,
        {
          productId,
          sellingPrice: '12.50',
          initialQuantity: 0,
        },
        userId,
      )
    ).id;
  });

  it('keeps database stock filters and health counts equal at threshold boundaries', async () => {
    const placements = [
      { quantity: 0, lowStockThreshold: 0 },
      { quantity: 5, lowStockThreshold: 5 },
      { quantity: 6, lowStockThreshold: 5 },
      { quantity: 1, lowStockThreshold: 0 },
    ];
    await prisma.branchInventory.update({
      where: { id: inventoryId },
      data: placements[0],
    });
    for (const [index, state] of placements.slice(1).entries()) {
      const product = await products.create(organizationId, {
        merchantId,
        name: `Boundary ${index}`,
        sku: randomUUID(),
      });
      const placed = await inventory.create(
        organizationId,
        branchId,
        {
          productId: product.id,
          sellingPrice: '1.00',
          initialQuantity: 0,
        },
        userId,
      );
      await prisma.branchInventory.update({
        where: { id: placed.id },
        data: state,
      });
    }
    const context = { organizationId, userId, role: 'OWNER' as const };
    const all = await inventory.findAll(organizationId, branchId, {}, context);
    const summary = await inventory.summarize(
      organizationId,
      branchId,
      context,
    );
    expect(summary).toEqual({ inStock: 2, lowStock: 1, outOfStock: 1 });
    for (const status of Object.values(InventoryStockStatus)) {
      const filtered = await inventory.findAll(
        organizationId,
        branchId,
        { stockStatus: status },
        context,
      );
      expect(filtered.items.map((item) => item.id)).toEqual(
        all.items
          .filter((item) => item.stockStatus === status)
          .map((item) => item.id),
      );
    }
  });

  it('traverses bounded inventory pages and scopes picker candidates to assigned branches', async () => {
    const owner = { organizationId, userId, role: 'OWNER' as const };
    const names = ['Alpha', 'Bravo', 'Charlie'];
    for (const name of names) {
      const product = await products.create(organizationId, {
        merchantId,
        name,
        sku: randomUUID(),
      });
      await inventory.create(
        organizationId,
        branchId,
        {
          productId: product.id,
          sellingPrice: '2.00',
          initialQuantity: 0,
        },
        userId,
      );
    }
    const bulkProducts = Array.from({ length: 125 }, (_, index) => ({
      id: randomUUID(),
      organizationId,
      merchantId,
      name: `Paged ${String(index).padStart(3, '0')}`,
      sku: `PAGE-${randomUUID()}`,
    }));
    await prisma.product.createMany({ data: bulkProducts });
    await prisma.branchInventory.createMany({
      data: bulkProducts.map((product) => ({
        organizationId,
        branchId,
        productId: product.id,
        sellingPrice: '2.00',
      })),
    });
    const seen: string[] = [];
    let cursor: string | undefined;
    do {
      const page = await inventory.findAll(
        organizationId,
        branchId,
        { limit: 37, cursor },
        owner,
      );
      expect(page.items.length).toBeLessThanOrEqual(37);
      seen.push(...page.items.map((item) => item.id));
      cursor = page.nextCursor ?? undefined;
    } while (cursor);
    expect(seen).toHaveLength(129);
    expect(new Set(seen).size).toBe(129);

    const foreignCursor = await inventory.findAll(
      organizationId,
      branchId,
      { limit: 1 },
      owner,
    );
    await expect(
      inventory.findAll(
        organizationId,
        otherBranchId,
        { limit: 1, cursor: foreignCursor.nextCursor! },
        owner,
      ),
    ).rejects.toThrow();

    await prisma.organizationMembership.create({
      data: { organizationId, userId, role: 'MANAGER' },
    });
    for (const id of [branchId, otherBranchId])
      await prisma.branchMembership.create({
        data: { organizationId, branchId: id, userId },
      });
    const manager = { organizationId, userId, role: 'MANAGER' as const };
    const otherProduct = await products.create(organizationId, {
      merchantId,
      name: 'Eligible elsewhere',
      sku: randomUUID(),
    });
    await inventory.create(
      organizationId,
      otherBranchId,
      {
        productId: otherProduct.id,
        sellingPrice: '3.00',
        initialQuantity: 0,
      },
      userId,
    );
    const unplaced = await products.create(organizationId, {
      merchantId,
      name: 'Unplaced',
      sku: randomUUID(),
    });
    const managerCandidates = await inventory.eligibleProducts(
      organizationId,
      branchId,
      { limit: 1 },
      manager,
    );
    expect(managerCandidates.items.map((item) => item.id)).toEqual([
      otherProduct.id,
    ]);
    const ownerCandidates = await inventory.eligibleProducts(
      organizationId,
      branchId,
      { limit: 1 },
      owner,
    );
    expect(ownerCandidates.items.map((item) => item.id)).toEqual([
      otherProduct.id,
    ]);
    expect(ownerCandidates.nextCursor).toBeTruthy();
    const next = await inventory.eligibleProducts(
      organizationId,
      branchId,
      { limit: 1, cursor: ownerCandidates.nextCursor! },
      owner,
    );
    expect(next.items.map((item) => item.id)).toEqual([unplaced.id]);
    await expect(
      inventory.eligibleProducts(
        organizationId,
        branchId,
        { limit: 1, cursor: ownerCandidates.nextCursor! },
        manager,
      ),
    ).rejects.toThrow();
  });

  it('pages large movement history without exposing a foreign cursor or merchant actors', async () => {
    const start = Date.now() - 200000;
    const entries = Array.from({ length: 125 }, (_, index) => ({
      id: randomUUID(),
      organizationId,
      branchId,
      branchInventoryId: inventoryId,
      type: 'RECEIPT' as const,
      quantityChange: 1,
      quantityAfter: index + 1,
      reason: 'Test receipt',
      createdById: userId,
      requestId: randomUUID(),
      createdAt: new Date(start + index),
    }));
    await prisma.inventoryMovement.createMany({ data: entries });
    await prisma.branchInventory.update({
      where: { id: inventoryId },
      data: { quantity: 125 },
    });
    const first = await inventory.findMovements(
      organizationId,
      branchId,
      inventoryId,
    );
    expect(first.items).toHaveLength(50);
    expect(first.nextCursor).toBe(first.items[49].id);
    const second = await inventory.findMovements(
      organizationId,
      branchId,
      inventoryId,
      undefined,
      { limit: 50, cursor: first.nextCursor! },
    );
    const third = await inventory.findMovements(
      organizationId,
      branchId,
      inventoryId,
      undefined,
      { limit: 50, cursor: second.nextCursor! },
    );
    expect(second.items).toHaveLength(50);
    expect(third.items).toHaveLength(25);
    expect(third.nextCursor).toBeNull();
    expect(
      new Set(
        [...first.items, ...second.items, ...third.items].map(
          (item) => item.id,
        ),
      ).size,
    ).toBe(125);
    expect(first.items.map((item) => item.createdAt.getTime())).toEqual(
      [...first.items.map((item) => item.createdAt.getTime())].sort(
        (a, b) => b - a,
      ),
    );
    const other = await inventory.create(
      organizationId,
      otherBranchId,
      {
        productId,
        sellingPrice: '1.00',
        initialQuantity: 0,
      },
      userId,
    );
    const foreignCursor = randomUUID();
    await prisma.inventoryMovement.create({
      data: {
        id: foreignCursor,
        organizationId,
        branchId: otherBranchId,
        branchInventoryId: other.id,
        type: 'RECEIPT',
        quantityChange: 1,
        quantityAfter: 1,
        reason: 'Other branch',
        createdById: userId,
        requestId: randomUUID(),
      },
    });
    await expect(
      inventory.findMovements(
        organizationId,
        branchId,
        inventoryId,
        undefined,
        { limit: 50, cursor: foreignCursor },
      ),
    ).rejects.toThrow('Movement cursor not found');
    const merchant = {
      organizationId,
      userId,
      role: 'MERCHANT' as const,
      merchantId,
    };
    const own = await inventory.findMovements(
      organizationId,
      branchId,
      inventoryId,
      merchant,
    );
    expect(own.items).toHaveLength(50);
    expect(own.items[0]).not.toHaveProperty('createdById');
  });

  it('reports only exact stock/ledger mismatches and never changes stock', async () => {
    await prisma.organizationMembership.create({
      data: { organizationId, userId, role: 'OWNER' },
    });
    const context = { organizationId, userId, role: 'OWNER' as const };
    const scan = (limit = 25, cursor?: string) =>
      reconciliation.reconcile(context, branchId, { limit, cursor });
    expect(await scan()).toEqual({ items: [], nextCursor: null });
    await receive(7);
    await adjust(-2);
    expect(await scan()).toEqual({ items: [], nextCursor: null });
    await prisma.branchInventory.update({
      where: { id: inventoryId },
      data: { quantity: 6 },
    });
    expect(await scan()).toEqual({
      items: [
        {
          inventoryId,
          productId,
          productName: 'Product',
          sku: 'SKU',
          recordedQuantity: 6,
          ledgerQuantity: '5',
          difference: '1',
        },
      ],
      nextCursor: null,
    });
    expect(
      await prisma.inventoryMovement.count({
        where: { organizationId, branchId, branchInventoryId: inventoryId },
      }),
    ).toBe(2);
    expect((await balance()).quantity).toBe(6);
  });

  it('paginates mismatches and isolates branches and manager assignments', async () => {
    await prisma.organizationMembership.create({
      data: { organizationId, userId, role: 'MANAGER' },
    });
    await prisma.branchMembership.create({
      data: { organizationId, userId, branchId },
    });
    const anotherProduct = await products.create(organizationId, {
      merchantId,
      name: 'Second product',
      sku: randomUUID(),
    });
    const another = await inventory.create(
      organizationId,
      branchId,
      {
        productId: anotherProduct.id,
        sellingPrice: '1.00',
        initialQuantity: 0,
      },
      userId,
    );
    const otherPlacement = await inventory.create(
      organizationId,
      otherBranchId,
      {
        productId,
        sellingPrice: '1.00',
        initialQuantity: 0,
      },
      userId,
    );
    await prisma.branchInventory.updateMany({
      where: { id: { in: [inventoryId, another.id, otherPlacement.id] } },
      data: { quantity: 1 },
    });
    const context = { organizationId, userId, role: 'MANAGER' as const };
    const first = await reconciliation.reconcile(context, branchId, {
      limit: 1,
    });
    expect(first.items).toHaveLength(1);
    expect(first.nextCursor).toBe(first.items[0].inventoryId);
    const second = await reconciliation.reconcile(context, branchId, {
      limit: 1,
      cursor: first.nextCursor!,
    });
    expect(second.items).toHaveLength(1);
    expect(second.nextCursor).toBeNull();
    expect(
      new Set(
        [...first.items, ...second.items].map((item) => item.inventoryId),
      ),
    ).toEqual(new Set([inventoryId, another.id]));
    await expect(
      reconciliation.reconcile(context, otherBranchId, { limit: 25 }),
    ).rejects.toThrow('Branch not found');
    const foreign = await prisma.organization.create({
      data: { name: randomUUID() },
    });
    await expect(
      reconciliation.reconcile(
        { ...context, organizationId: foreign.id },
        branchId,
        { limit: 25 },
      ),
    ).rejects.toThrow('Organization not found');
    await prisma.organizationMembership.update({
      where: { organizationId_userId: { organizationId, userId } },
      data: { role: 'MERCHANT', merchantId },
    });
    await expect(
      reconciliation.reconcile(context, branchId, { limit: 25 }),
    ).rejects.toThrow('Inventory diagnostics require staff access');
  });

  it('keeps branch prices and quantities independent', async () => {
    const second = await inventory.create(
      organizationId,
      otherBranchId,
      {
        productId,
        sellingPrice: '9999999999.99',
        initialQuantity: 0,
      },
      userId,
    );
    await receive(5);
    await inventory.updatePrice(organizationId, branchId, inventoryId, {
      sellingPrice: '0.01',
    });
    expect((await balance()).quantity).toBe(5);
    expect((await balance()).sellingPrice.toFixed(2)).toBe('0.01');
    expect(
      await inventory.findOne(organizationId, otherBranchId, second.id),
    ).toMatchObject({
      quantity: 0,
      sellingPrice: '9999999999.99',
      lowStockThreshold: 5,
    });
  });

  it('manages branch grants, role clearing, merchant links and removal with real membership locks', async () => {
    await prisma.organizationMembership.create({
      data: { organizationId, userId, role: 'MANAGER' },
    });
    await memberships.setBranch(organizationId, userId, branchId, true);
    await memberships.setBranch(organizationId, userId, branchId, true);
    expect(await memberships.findBranches(organizationId, userId)).toEqual([
      expect.objectContaining({ id: branchId }),
    ]);
    await expect(
      memberships.updateRole(organizationId, userId, {
        role: 'MERCHANT',
        merchantId: randomUUID(),
      }),
    ).rejects.toThrow();
    expect(
      await prisma.branchMembership.count({
        where: { organizationId, userId },
      }),
    ).toBe(1);
    await memberships.updateRole(organizationId, userId, {
      role: 'MERCHANT',
      merchantId,
    });
    expect(await memberships.findBranches(organizationId, userId)).toEqual([]);
    await memberships.setMerchant(organizationId, userId, merchantId);
    await memberships.setBranch(organizationId, userId, branchId, false);
    await memberships.setBranch(organizationId, userId, branchId, true);
    await memberships.remove(organizationId, userId);
    expect(
      await prisma.branchMembership.count({
        where: { organizationId, userId },
      }),
    ).toBe(0);
    expect((await balance()).quantity).toBe(0);
  });

  it('requires tenant-local membership and branch for unique branch assignments', async () => {
    const data = { organizationId, branchId, userId };
    await expect(prisma.branchMembership.create({ data })).rejects.toThrow();
    await prisma.organizationMembership.create({
      data: { organizationId, userId, role: 'MANAGER' },
    });
    await prisma.branchMembership.create({ data });
    await expect(prisma.branchMembership.create({ data })).rejects.toThrow();
    await expect(
      prisma.branchMembership.create({
        data: { ...data, branchId: randomUUID() },
      }),
    ).rejects.toThrow();
    const foreign = await prisma.organization.create({
      data: { name: randomUUID() },
    });
    await prisma.organizationMembership.create({
      data: { organizationId: foreign.id, userId, role: 'MANAGER' },
    });
    await expect(
      prisma.branchMembership.create({
        data: { ...data, organizationId: foreign.id },
      }),
    ).rejects.toThrow();
    await prisma.organizationMembership.delete({
      where: { organizationId_userId: { organizationId, userId } },
    });
    expect(
      await prisma.branchMembership.count({
        where: { organizationId, userId },
      }),
    ).toBe(0);
    expect((await balance()).quantity).toBe(0);
  });

  it('permits legacy unlinked merchants but restricts linked memberships to same-tenant merchants and role', async () => {
    const key = { organizationId, userId };
    await prisma.organizationMembership.create({
      data: { ...key, role: 'MERCHANT' },
    });
    await prisma.organizationMembership.update({
      where: { organizationId_userId: key },
      data: { merchantId },
    });
    await expect(
      prisma.organizationMembership.update({
        where: { organizationId_userId: key },
        data: { role: 'MANAGER' },
      }),
    ).rejects.toThrow();
    const foreign = await prisma.organization.create({
      data: { name: randomUUID() },
    });
    await expect(
      prisma.organizationMembership.create({
        data: {
          organizationId: foreign.id,
          userId,
          role: 'MERCHANT',
          merchantId,
        },
      }),
    ).rejects.toThrow();
    const second = await prisma.user.create({
      data: {
        firstName: 'Second',
        lastName: 'Merchant',
        email: `${randomUUID()}@example.test`,
        passwordHash: 'unused',
      },
    });
    await prisma.organizationMembership.create({
      data: { organizationId, userId: second.id, role: 'MERCHANT', merchantId },
    });
    expect(
      await prisma.organizationMembership.count({
        where: { organizationId, merchantId },
      }),
    ).toBe(2);
  });

  it('enforces unique tenant-local invitation grants and removes grants with their invitation', async () => {
    const invitation = await prisma.organizationInvitation.create({
      data: {
        organizationId,
        email: 'invite@example.test',
        role: 'CASHIER',
        tokenHash: randomUUID(),
        expiresAt: new Date(Date.now() + 60000),
        invitedById: userId,
      },
    });
    const data = { organizationId, invitationId: invitation.id, branchId };
    await prisma.invitationBranch.create({ data });
    await expect(prisma.invitationBranch.create({ data })).rejects.toThrow();
    const foreign = await prisma.organization.create({
      data: { name: randomUUID() },
    });
    await expect(
      prisma.invitationBranch.create({
        data: { ...data, organizationId: foreign.id, branchId: otherBranchId },
      }),
    ).rejects.toThrow();
    await expect(
      prisma.organizationInvitation.update({
        where: { id: invitation.id },
        data: { merchantId },
      }),
    ).rejects.toThrow();
    await prisma.organizationInvitation.update({
      where: { id: invitation.id },
      data: { role: 'MERCHANT', merchantId },
    });
    await prisma.organizationInvitation.delete({
      where: { id: invitation.id },
    });
    expect(
      await prisma.invitationBranch.count({
        where: { invitationId: invitation.id },
      }),
    ).toBe(0);
  });

  it('rolls back quantity when actor foreign key rejects movement insertion', async () => {
    await expect(receive(3, randomUUID(), randomUUID())).rejects.toThrow();
    expect((await balance()).quantity).toBe(0);
    expect(
      await prisma.inventoryMovement.count({
        where: { branchInventoryId: inventoryId },
      }),
    ).toBe(0);
  });

  it('serializes concurrent receipts with reconciled snapshots and no lost updates', async () => {
    const results = await Promise.all(
      Array.from({ length: 12 }, () => receive(1)),
    );
    expect(
      results.map((item) => item.quantityAfter).sort((a, b) => a - b),
    ).toEqual(Array.from({ length: 12 }, (_, index) => index + 1));
    expect((await balance()).quantity).toBe(12);
    const movements = await prisma.inventoryMovement.findMany({
      where: { branchInventoryId: inventoryId },
    });
    expect(
      movements.reduce((total, item) => total + item.quantityChange, 0),
    ).toBe(12);
  });

  it('allows only one simultaneous withdrawal when stock would otherwise underflow', async () => {
    await receive(5);
    const results = await Promise.allSettled([adjust(-4), adjust(-4)]);
    expect(results.filter((item) => item.status === 'fulfilled')).toHaveLength(
      1,
    );
    expect((await balance()).quantity).toBe(1);
    expect(
      await prisma.inventoryMovement.count({
        where: { branchInventoryId: inventoryId },
      }),
    ).toBe(2);
  });

  it('deduplicates simultaneous requests and rejects changed command content', async () => {
    const requestId = randomUUID();
    const results = await Promise.all(
      Array.from({ length: 8 }, () => receive(3, requestId)),
    );
    expect(new Set(results.map((item) => item.id)).size).toBe(1);
    expect((await balance()).quantity).toBe(3);
    expect(
      await prisma.inventoryMovement.count({
        where: { branchInventoryId: inventoryId },
      }),
    ).toBe(1);
    await expect(receive(4, requestId)).rejects.toThrow(
      'different stock command',
    );
    expect((await balance()).quantity).toBe(3);
  });

  it('deduplicates retries even when the repeated increment would overflow', async () => {
    const requestId = randomUUID();
    const results = await Promise.all([
      receive(2147483647, requestId),
      receive(2147483647, requestId),
    ]);
    expect(results[0].id).toBe(results[1].id);
    await expect(receive(1)).rejects.toThrow('quantity range');
    expect((await balance()).quantity).toBe(2147483647);
  });

  it('enforces branch isolation in service operations', async () => {
    await expect(
      inventory.findOne(organizationId, otherBranchId, inventoryId),
    ).rejects.toThrow('not found');
    await expect(
      stock.receive(organizationId, otherBranchId, inventoryId, userId, {
        quantity: 1,
        requestId: randomUUID(),
      }),
    ).rejects.toThrow('not found');
    expect((await balance()).quantity).toBe(0);
  });

  it('supports the lifecycle/profile/history workflow without hidden stock side effects', async () => {
    const requestId = randomUUID();
    const original = await receive(5, requestId);
    await products.updateStatus(organizationId, productId, {
      status: 'INACTIVE',
    });
    await products.update(organizationId, productId, {
      name: 'Renamed',
      sku: null,
    });
    await inventory.updatePrice(organizationId, branchId, inventoryId, {
      sellingPrice: '15.75',
    });
    await expect(receive(1)).rejects.toThrow('active product');
    await expect(receive(5, requestId)).resolves.toEqual(original);
    await adjust(-2);
    expect((await balance()).quantity).toBe(3);
    expect(await products.findInventory(organizationId, productId)).toEqual([
      expect.objectContaining({ branchId, quantity: 3, sellingPrice: '15.75' }),
    ]);
    const history = await inventory.findMovements(
      organizationId,
      branchId,
      inventoryId,
    );
    expect(history.items).toHaveLength(2);
    expect(
      history.items.every(
        (entry) => 'createdById' in entry && entry.createdById === userId,
      ),
    ).toBe(true);
    expect(
      history.items.reduce((sum, entry) => sum + entry.quantityChange, 0),
    ).toBe(3);
  });

  it('permits identifiers and request IDs in separate organizations without disclosure', async () => {
    const foreign = await prisma.organization.create({
      data: { name: 'Foreign' },
    });
    const foreignMerchant = await prisma.merchant.create({
      data: {
        organizationId: foreign.id,
        name: 'Foreign',
        contactName: 'Contact',
        code: 'TEST',
        phone: '09171234567',
      },
    });
    await expect(
      products.create(foreign.id, {
        merchantId: foreignMerchant.id,
        name: 'Other',
        sku: 'SKU',
        barcode: '001Ab',
      }),
    ).resolves.toMatchObject({ organizationId: foreign.id });
    const requestId = randomUUID();
    await receive(1, requestId);
    await expect(
      stock.receive(foreign.id, branchId, inventoryId, userId, {
        quantity: 1,
        requestId,
      }),
    ).rejects.toThrow('not found');
    expect((await balance()).quantity).toBe(1);
  });

  it('enforces composite tenant foreign keys and organization-scoped uniqueness', async () => {
    const foreign = await prisma.organization.create({
      data: { name: 'Foreign' },
    });
    await expect(
      prisma.product.create({
        data: { organizationId: foreign.id, merchantId, name: 'Cross tenant' },
      }),
    ).rejects.toThrow();
    await expect(
      prisma.branchInventory.create({
        data: {
          organizationId: foreign.id,
          branchId,
          productId,
          sellingPrice: '1',
        },
      }),
    ).rejects.toThrow();
    await expect(
      products.create(organizationId, {
        merchantId,
        name: 'Duplicate',
        sku: 'SKU',
      }),
    ).rejects.toThrow('already exists');
    await expect(
      inventory.create(
        organizationId,
        branchId,
        {
          productId,
          sellingPrice: '1',
          initialQuantity: 0,
        },
        userId,
      ),
    ).rejects.toThrow('already placed');
    await expect(products.findOne(foreign.id, productId)).rejects.toThrow(
      'not found',
    );
  });

  it.each([
    { quantity: -1 },
    { lowStockThreshold: -1 },
    { sellingPrice: '0' },
    { sellingPrice: '-1' },
    { sellingPrice: 'NaN' },
  ])('database rejects invalid inventory %j', async (data) => {
    await expect(
      prisma.branchInventory.update({ where: { id: inventoryId }, data }),
    ).rejects.toThrow();
    expect((await balance()).quantity).toBe(0);
  });

  it.each([
    { quantityChange: 0 },
    { quantityChange: -1 },
    { quantityAfter: -1 },
    { branchId: 'wrong' },
  ])('database rejects invalid movement %j', async (extra) => {
    await expect(
      prisma.inventoryMovement.create({
        data: {
          organizationId,
          branchId,
          branchInventoryId: inventoryId,
          type: 'RECEIPT',
          quantityChange: 1,
          quantityAfter: 1,
          reason: 'Test',
          createdById: userId,
          requestId: randomUUID(),
          ...extra,
        },
      }),
    ).rejects.toThrow();
  });
});
