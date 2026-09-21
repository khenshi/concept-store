import { randomUUID } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { PrismaPg } from '@prisma/adapter-pg';
import { Client } from 'pg';
import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaService } from '../src/infrastructure/database/prisma.service';
import { ProductsService } from '../src/modules/organizations/products/products.service';
import { InventoryStockService } from '../src/modules/organizations/inventory/inventory-stock.service';
import { CreateProductDto } from '../src/modules/organizations/products/dto/create-product.dto';
import { BranchInventoryService } from '../src/modules/organizations/inventory/branch-inventory.service';
import { PosCatalogService } from '../src/modules/organizations/pos/pos-catalog.service';

const connectionString = process.env.TEST_DATABASE_URL;
if (!connectionString)
  throw new Error(
    'Set TEST_DATABASE_URL to an explicitly disposable PostgreSQL test database',
  );
const schema = `opening_test_${randomUUID().replaceAll('-', '')}`;
const admin = new Client({ connectionString });
const prisma = new PrismaClient({
  adapter: new PrismaPg(
    { connectionString, options: `-c search_path=${schema}`, max: 20 },
    { schema },
  ),
});
const products = new ProductsService(prisma as unknown as PrismaService);
const stock = new InventoryStockService(prisma as unknown as PrismaService);
let organizationId: string;
let branchId: string;
let otherBranchId: string;
let merchantId: string;
let actorId: string;
const command = (): CreateProductDto => ({
  merchantId,
  name: 'Vase',
  requestId: randomUUID(),
  initialInventory: { branchId, sellingPrice: '12.50', quantity: 3 },
});
const counts = async () =>
  Promise.all([
    prisma.product.count({ where: { organizationId } }),
    prisma.branchInventory.count({ where: { organizationId } }),
    prisma.inventoryMovement.count({ where: { organizationId } }),
  ]);

describe('PostgreSQL atomic product opening stock', () => {
  it('persists an explicit zero threshold without changing opening stock atomicity', async () => {
    const created = await products.create(
      organizationId,
      {
        ...command(),
        name: 'Zero threshold product',
        initialInventory: {
          branchId,
          sellingPrice: '8.50',
          quantity: 2,
          lowStockThreshold: 0,
        },
      },
      actorId,
    );
    await expect(
      prisma.branchInventory.findUniqueOrThrow({
        where: {
          organizationId_branchId_productId: {
            organizationId,
            branchId,
            productId: created.id,
          },
        },
      }),
    ).resolves.toMatchObject({ quantity: 2, lowStockThreshold: 0 });
    await expect(
      prisma.inventoryMovement.count({
        where: {
          organizationId,
          inventory: { productId: created.id },
        },
      }),
    ).resolves.toBe(1);
  });
  it('exposes opening stock through existing inventory, product-placement and POS reads only in the selected branch', async () => {
    const inventory = new BranchInventoryService(
      prisma as unknown as PrismaService,
    );
    const catalog = new PosCatalogService(prisma as unknown as PrismaService);
    const context = { organizationId, userId: actorId, role: 'OWNER' as const };
    const created = await products.create(
      organizationId,
      { ...command(), sku: 'OPENING-SKU', barcode: '001Opening' },
      actorId,
    );
    expect(
      await products.findInventory(organizationId, created.id, context),
    ).toEqual([
      expect.objectContaining({
        branchId,
        productId: created.id,
        quantity: 3,
        sellingPrice: '12.50',
        lowStockThreshold: 5,
      }),
    ]);
    expect(
      (await inventory.findAll(organizationId, branchId, {}, context)).items,
    ).toEqual([
      expect.objectContaining({
        productId: created.id,
        quantity: 3,
        sellingPrice: '12.50',
        lowStockThreshold: 5,
      }),
    ]);
    expect(await catalog.findAll(context, branchId)).toEqual([
      expect.objectContaining({
        productId: created.id,
        quantity: 3,
        sellingPrice: '12.50',
        eligible: true,
      }),
    ]);
    expect(await catalog.findByCode(context, branchId, '001Opening')).toEqual([
      expect.objectContaining({ productId: created.id }),
    ]);
    expect(
      (await inventory.findAll(organizationId, otherBranchId, {}, context))
        .items,
    ).toEqual([]);
    expect(await catalog.findAll(context, otherBranchId)).toEqual([]);
  });
  beforeAll(async () => {
    await admin.connect();
    await admin.query(`CREATE SCHEMA "${schema}"`);
    await admin.query(`SET search_path TO "${schema}"`);
    const migrations = join(__dirname, '../prisma/migrations');
    for (const directory of readdirSync(migrations)
      .filter((name) => /^\d/.test(name))
      .sort()) {
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
    organizationId = (
      await prisma.organization.create({ data: { name: randomUUID() } })
    ).id;
    actorId = (
      await prisma.user.create({
        data: {
          firstName: 'Test',
          lastName: 'Owner',
          email: `${randomUUID()}@example.test`,
          passwordHash: 'unused',
        },
      })
    ).id;
    await prisma.organizationMembership.create({
      data: { organizationId, userId: actorId, role: 'OWNER' },
    });
    merchantId = (
      await prisma.merchant.create({
        data: {
          organizationId,
          name: 'Merchant',
          contactName: 'Contact',
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
  });

  it('preserves legacy product-only creation without placement, movement or request metadata', async () => {
    const product = await products.create(
      organizationId,
      { merchantId, name: 'Legacy' },
      actorId,
    );
    expect(product).not.toHaveProperty('creationRequestId');
    expect(await counts()).toEqual([1, 0, 0]);
    expect(
      await prisma.product.findUniqueOrThrow({ where: { id: product.id } }),
    ).toMatchObject({
      creationRequestId: null,
      creationActorId: null,
      creationCommand: null,
    });
  });
  it.each([
    { sellingPrice: '0.01', quantity: 1 },
    { sellingPrice: '9999999999.99', quantity: 2147483647 },
  ])(
    'creates an exact-price balanced opening receipt at bounds %j',
    async (opening) => {
      const dto = command();
      dto.initialInventory = { branchId, ...opening };
      const product = await products.create(organizationId, dto, actorId);
      const placement = await prisma.branchInventory.findFirstOrThrow({
        where: { organizationId, productId: product.id },
      });
      expect(placement).toMatchObject({ branchId, quantity: opening.quantity });
      expect(placement.sellingPrice.toFixed(2)).toBe(opening.sellingPrice);
      expect(
        await prisma.inventoryMovement.findFirstOrThrow({
          where: { organizationId, branchInventoryId: placement.id },
        }),
      ).toMatchObject({
        type: 'RECEIPT',
        quantityChange: opening.quantity,
        quantityAfter: opening.quantity,
        createdById: actorId,
        reason: 'Initial stock on product creation',
      });
      expect(
        await prisma.branchInventory.count({
          where: { organizationId, branchId: otherBranchId },
        }),
      ).toBe(0);
      expect(await counts()).toEqual([1, 1, 1]);
      for (const response of [
        product,
        await products.findOne(organizationId, product.id),
        ...(await products.findAll(organizationId, {})),
        await products.update(organizationId, product.id, { name: 'Updated' }),
        await products.updateStatus(organizationId, product.id, {
          status: 'INACTIVE',
        }),
      ]) {
        expect(response).not.toHaveProperty('creationCommand');
        expect(response).not.toHaveProperty('creationActorId');
        expect(response).not.toHaveProperty('creationRequestId');
      }
    },
  );
  it('replays a no-code product after identity, price, quantity and merchant lifecycle edits', async () => {
    const dto = command();
    const original = await products.create(organizationId, dto, actorId);
    const placement = await prisma.branchInventory.findFirstOrThrow({
      where: { organizationId, productId: original.id },
    });
    await products.update(organizationId, original.id, {
      name: 'Changed',
      sku: 'LATER',
    });
    await prisma.branchInventory.update({
      where: { id: placement.id },
      data: { sellingPrice: '22.00' },
    });
    await stock.receive(organizationId, branchId, placement.id, actorId, {
      quantity: 2,
      requestId: randomUUID(),
    });
    await prisma.merchant.update({
      where: { id: merchantId },
      data: { status: 'INACTIVE' },
    });
    expect(
      await products.create(
        organizationId,
        {
          ...dto,
          name: ' Vase ',
          sku: null,
          barcode: null,
          initialInventory: { ...dto.initialInventory!, sellingPrice: '012.5' },
        },
        actorId,
      ),
    ).toMatchObject({ id: original.id, name: 'Changed', sku: 'LATER' });
    expect(await counts()).toEqual([1, 1, 2]);
    expect(
      await prisma.branchInventory.findUniqueOrThrow({
        where: { id: placement.id },
      }),
    ).toMatchObject({ quantity: 5 });
  });
  it.each(['name', 'quantity', 'price', 'branch', 'merchant'] as const)(
    'rejects changed %s content with the same request ID',
    async (field) => {
      const dto = command();
      await products.create(organizationId, dto, actorId);
      const changed = structuredClone(dto);
      if (field === 'name') changed.name = 'Different';
      if (field === 'quantity') changed.initialInventory!.quantity = 4;
      if (field === 'price') changed.initialInventory!.sellingPrice = '13';
      if (field === 'branch')
        changed.initialInventory!.branchId = otherBranchId;
      if (field === 'merchant') changed.merchantId = randomUUID();
      await expect(
        products.create(organizationId, changed, actorId),
      ).rejects.toMatchObject({
        response: { code: 'PRODUCT_CREATE_REQUEST_CONFLICT' },
      });
      expect(await counts()).toEqual([1, 1, 1]);
    },
  );
  it('rejects another owner reusing a request ID without disclosing the original command', async () => {
    const dto = command();
    await products.create(organizationId, dto, actorId);
    const other = (
      await prisma.user.create({
        data: {
          firstName: 'Other',
          lastName: 'Owner',
          email: `${randomUUID()}@example.test`,
          passwordHash: 'unused',
        },
      })
    ).id;
    await prisma.organizationMembership.create({
      data: { organizationId, userId: other, role: 'OWNER' },
    });
    await expect(
      products.create(organizationId, dto, other),
    ).rejects.toMatchObject({
      response: { code: 'PRODUCT_CREATE_REQUEST_CONFLICT' },
    });
    expect(await counts()).toEqual([1, 1, 1]);
  });
  it.each(['MANAGER', 'CASHIER', 'MERCHANT'] as const)(
    'denies fresh writes and replay after role changes to %s',
    async (role) => {
      const dto = command();
      await products.create(organizationId, dto, actorId);
      await prisma.organizationMembership.update({
        where: { organizationId_userId: { organizationId, userId: actorId } },
        data: { role, ...(role === 'MERCHANT' ? { merchantId } : {}) },
      });
      await expect(
        products.create(organizationId, dto, actorId),
      ).rejects.toMatchObject({ status: 403 });
      await expect(
        products.create(organizationId, command(), actorId),
      ).rejects.toMatchObject({ status: 403 });
      expect(await counts()).toEqual([1, 1, 1]);
    },
  );
  it.each(['branch', 'merchant'] as const)(
    'treats foreign and missing %s alike and leaves no partial records',
    async (field) => {
      const foreignOrg = (
        await prisma.organization.create({ data: { name: 'Foreign' } })
      ).id;
      const foreignId =
        field === 'branch'
          ? (
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
            ).id
          : (
              await prisma.merchant.create({
                data: {
                  organizationId: foreignOrg,
                  name: 'Foreign',
                  code: 'FOREIGN',
                  contactName: 'Test',
                  phone: '09171234567',
                },
              })
            ).id;
      for (const id of [foreignId, randomUUID()]) {
        const dto = command();
        if (field === 'branch') dto.initialInventory!.branchId = id;
        else dto.merchantId = id;
        await expect(
          products.create(organizationId, dto, actorId),
        ).rejects.toMatchObject({ status: 404 });
      }
      expect(await counts()).toEqual([0, 0, 0]);
    },
  );
  it.each(['INACTIVE', 'SUSPENDED', 'ENDED'] as const)(
    'rejects new products for %s merchants',
    async (status) => {
      await prisma.merchant.update({
        where: { id: merchantId },
        data: { status },
      });
      await expect(
        products.create(organizationId, command(), actorId),
      ).rejects.toMatchObject({ status: 409 });
      expect(await counts()).toEqual([0, 0, 0]);
    },
  );
  it.each(['Product', 'BranchInventory', 'InventoryMovement'])(
    'rolls back all records when the actual %s insertion fails',
    async (table) => {
      await admin.query(
        "CREATE FUNCTION fail_opening_write() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Opening write test failure'; END $$",
      );
      await admin.query(
        `CREATE TRIGGER fail_opening_write BEFORE INSERT ON "${table}" FOR EACH ROW EXECUTE FUNCTION fail_opening_write()`,
      );
      try {
        await expect(
          products.create(organizationId, command(), actorId),
        ).rejects.toThrow();
        expect(await counts()).toEqual([0, 0, 0]);
      } finally {
        await admin.query(`DROP TRIGGER fail_opening_write ON "${table}"`);
        await admin.query('DROP FUNCTION fail_opening_write()');
      }
    },
  );
  it('does not duplicate no-code commands under concurrency; explicit retries recover serialization rollbacks', async () => {
    const dto = command();
    const results = await Promise.allSettled(
      Array.from({ length: 6 }, () =>
        products.create(organizationId, dto, actorId),
      ),
    );
    const winner = results.find((result) => result.status === 'fulfilled');
    expect(winner?.status).toBe('fulfilled');
    for (const result of results) {
      if (result.status === 'rejected')
        expect(result.reason).toMatchObject({
          response: { code: 'PRODUCT_CREATE_RETRY' },
        });
      const replay = await products.create(organizationId, dto, actorId);
      if (winner?.status === 'fulfilled')
        expect(replay.id).toBe(winner.value.id);
    }
    expect(await counts()).toEqual([1, 1, 1]);
  });
  it('rolls back identifier conflicts without treating a new request as a replay', async () => {
    await products.create(
      organizationId,
      { ...command(), sku: 'DUPLICATE' },
      actorId,
    );
    await expect(
      products.create(
        organizationId,
        { ...command(), sku: 'DUPLICATE' },
        actorId,
      ),
    ).rejects.toMatchObject({ status: 409 });
    expect(await counts()).toEqual([1, 1, 1]);
  });
  it.each(['removed', 'deleted'])(
    'denies replay after the owner is %s',
    async (state) => {
      const dto = command();
      await products.create(organizationId, dto, actorId);
      if (state === 'removed')
        await prisma.organizationMembership.delete({
          where: { organizationId_userId: { organizationId, userId: actorId } },
        });
      else
        await prisma.user.update({
          where: { id: actorId },
          data: { deletedAt: new Date() },
        });
      await expect(
        products.create(organizationId, dto, actorId),
      ).rejects.toMatchObject({ status: 403 });
      expect(await counts()).toEqual([1, 1, 1]);
    },
  );
  it('scopes identical request IDs to each tenant without returning a foreign product', async () => {
    const dto = command();
    const original = await products.create(organizationId, dto, actorId);
    const foreignOrg = (
      await prisma.organization.create({ data: { name: 'Second tenant' } })
    ).id;
    await prisma.organizationMembership.create({
      data: { organizationId: foreignOrg, userId: actorId, role: 'OWNER' },
    });
    const foreignMerchant = (
      await prisma.merchant.create({
        data: {
          organizationId: foreignOrg,
          name: 'Foreign',
          code: 'FOREIGN',
          contactName: 'Test',
          phone: '09171234567',
        },
      })
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
    const other = await products.create(
      foreignOrg,
      {
        ...dto,
        merchantId: foreignMerchant,
        initialInventory: { ...dto.initialInventory!, branchId: foreignBranch },
      },
      actorId,
    );
    expect(other.id).not.toBe(original.id);
    expect(other.organizationId).toBe(foreignOrg);
    await expect(
      products.findOne(organizationId, other.id),
    ).rejects.toMatchObject({ status: 404 });
    expect(await counts()).toEqual([1, 1, 1]);
  });
  it('enforces the complete nullable request metadata group in PostgreSQL', async () => {
    await expect(
      prisma.product.create({
        data: {
          organizationId,
          merchantId,
          name: 'Invalid',
          creationRequestId: randomUUID(),
        },
      }),
    ).rejects.toThrow();
    await expect(
      prisma.product.create({
        data: {
          organizationId,
          merchantId,
          name: 'Invalid',
          creationRequestId: randomUUID(),
          creationActorId: randomUUID(),
          creationCommand: {},
        },
      }),
    ).rejects.toThrow();
    expect(await counts()).toEqual([0, 0, 0]);
  });
});
