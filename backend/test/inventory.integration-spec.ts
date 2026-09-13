import { randomUUID } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { PrismaPg } from '@prisma/adapter-pg';
import { Client } from 'pg';
import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaService } from '../src/infrastructure/database/prisma.service';
import { InventoryStockService } from '../src/modules/organizations/inventory/inventory-stock.service';
import { BranchInventoryService } from '../src/modules/organizations/inventory/branch-inventory.service';
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
    reason: 'Delivery',
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
    await inventory.create(organizationId, otherBranchId, {
      productId,
      sellingPrice: '14.00',
    });
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
    expect(history).toHaveLength(1);
    expect(history[0]).not.toHaveProperty('createdById');
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
    const hidden = await inventory.create(organizationId, branchId, {
      productId: otherProduct.id,
      sellingPrice: '15.00',
    });
    expect(
      await inventory.findAll(organizationId, branchId, {}, merchant),
    ).toHaveLength(1);
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
      await inventory.create(organizationId, branchId, {
        productId,
        sellingPrice: '12.50',
      })
    ).id;
  });

  it('keeps branch prices and quantities independent', async () => {
    const second = await inventory.create(organizationId, otherBranchId, {
      productId,
      sellingPrice: '9999999999.99',
    });
    await receive(5);
    await inventory.updatePrice(organizationId, branchId, inventoryId, {
      sellingPrice: '0.01',
    });
    expect((await balance()).quantity).toBe(5);
    expect((await balance()).sellingPrice.toFixed(2)).toBe('0.01');
    expect(
      await inventory.findOne(organizationId, otherBranchId, second.id),
    ).toMatchObject({ quantity: 0, sellingPrice: '9999999999.99' });
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
        reason: 'Delivery',
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
    expect(history).toHaveLength(2);
    expect(history.every((entry) => entry.createdById === userId)).toBe(true);
    expect(history.reduce((sum, entry) => sum + entry.quantityChange, 0)).toBe(
      3,
    );
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
        reason: 'Delivery',
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
      inventory.create(organizationId, branchId, {
        productId,
        sellingPrice: '1',
      }),
    ).rejects.toThrow('already placed');
    await expect(products.findOne(foreign.id, productId)).rejects.toThrow(
      'not found',
    );
  });

  it.each([
    { quantity: -1 },
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
