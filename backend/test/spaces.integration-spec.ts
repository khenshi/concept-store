import { randomUUID } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { PrismaPg } from '@prisma/adapter-pg';
import { Client } from 'pg';
import { Test } from '@nestjs/testing';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaService } from '../src/infrastructure/database/prisma.service';
import { AuthGuard } from '../src/modules/auth/auth.guard';
import { OrganizationAccessGuard } from '../src/modules/organizations/authorization/organization-access.guard';
import { SpacesController } from '../src/modules/organizations/spaces/spaces.controller';
import { SpacesService } from '../src/modules/organizations/spaces/spaces.service';
import { MerchantBranchesService } from '../src/modules/organizations/merchant-branches/merchant-branches.service';
import { MerchantsService } from '../src/modules/organizations/merchants/merchants.service';
import { MerchantsController } from '../src/modules/organizations/merchants/merchants.controller';
import { MerchantBranchesController } from '../src/modules/organizations/merchant-branches/merchant-branches.controller';
import type { OrganizationContext } from '../src/modules/organizations/authorization/organization-authorization.types';

const connectionString = process.env.TEST_DATABASE_URL;
if (!connectionString)
  throw new Error('TEST_DATABASE_URL must refer to a disposable database');
const schema = `spaces_${randomUUID().replaceAll('-', '')}`;
const admin = new Client({ connectionString });
const db = new PrismaClient({
  adapter: new PrismaPg(
    { connectionString, options: `-c search_path=${schema}`, max: 12 },
    { schema },
  ),
});
const prisma = db as unknown as PrismaService;
const spaces = new SpacesService(prisma),
  branches = new MerchantBranchesService(prisma),
  merchants = new MerchantsService(prisma);
let context: OrganizationContext,
  owner2: OrganizationContext,
  manager: OrganizationContext,
  merchant: OrganizationContext,
  cashier: OrganizationContext;
let branchId: string,
  secondBranch: string,
  merchantId: string,
  secondMerchant: string;
let app: INestApplication, jwt: JwtService;
const old = (offset = 0) =>
  new Date(Date.now() - 86400000 + offset).toISOString();
const create = (name = randomUUID(), branch = branchId) =>
  spaces.create(context, branch, { name, type: 'Shelf' });
const assign = (id: string, m = merchantId, branch = branchId, c = context) =>
  spaces.assign(c, branch, id, { merchantId: m, startedAt: old() });
const user = () =>
  db.user.create({
    data: {
      email: `${randomUUID()}@example.test`,
      firstName: 'Test',
      lastName: 'User',
      passwordHash: 'unused',
    },
  });
const http = () =>
  request(app.getHttpServer() as Parameters<typeof request>[0]);
const token = (c = context) =>
  jwt.sign({ email: 'test@example.test' }, { subject: c.userId });
const path = () =>
  `/organizations/${context.organizationId}/branches/${branchId}/spaces`;

beforeAll(async () => {
  await admin.connect();
  await admin.query(`CREATE SCHEMA "${schema}"`);
  await admin.query(`SET search_path TO "${schema}"`);
  const root = join(__dirname, '../prisma/migrations');
  for (const name of readdirSync(root)
    .filter((name) => /^\d/.test(name))
    .sort())
    await admin.query(readFileSync(join(root, name, 'migration.sql'), 'utf8'));
  const module = await Test.createTestingModule({
    imports: [
      JwtModule.register({
        secret: 'spaces-test-secret',
        signOptions: { expiresIn: '1h' },
      }),
    ],
    controllers: [
      SpacesController,
      MerchantsController,
      MerchantBranchesController,
    ],
    providers: [
      SpacesService,
      MerchantsService,
      MerchantBranchesService,
      AuthGuard,
      OrganizationAccessGuard,
      { provide: PrismaService, useValue: prisma },
    ],
  }).compile();
  app = module.createNestApplication();
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  await app.init();
  jwt = module.get(JwtService);
});
afterAll(async () => {
  await app?.close();
  await db.$disconnect();
  await admin.query(`DROP SCHEMA "${schema}" CASCADE`);
  await admin.end();
});
beforeEach(async () => {
  const org = await db.organization.create({ data: { name: 'Spaces test' } });
  const b = await db.branch.create({
    data: {
      organizationId: org.id,
      name: 'Main',
      addressLine1: 'Test',
      city: 'Makati',
      province: 'Metro Manila',
      countryCode: 'PH',
    },
  });
  branchId = b.id;
  secondBranch = (
    await db.branch.create({ data: { ...b, id: randomUUID(), name: 'Second' } })
  ).id;
  merchantId = (
    await db.merchant.create({
      data: {
        organizationId: org.id,
        name: 'First merchant',
        contactName: 'Contact',
        phone: '09171234567',
      },
    })
  ).id;
  secondMerchant = (
    await db.merchant.create({
      data: {
        organizationId: org.id,
        name: 'Second merchant',
        contactName: 'Contact',
        phone: '09171234567',
      },
    })
  ).id;
  const contexts: OrganizationContext[] = [];
  for (const role of [
    'OWNER',
    'OWNER',
    'MANAGER',
    'MERCHANT',
    'CASHIER',
  ] as const) {
    const u = await user();
    await db.organizationMembership.create({
      data: {
        organizationId: org.id,
        userId: u.id,
        role,
        ...(role === 'MERCHANT' ? { merchantId } : {}),
      },
    });
    if (role === 'MANAGER' || role === 'CASHIER')
      await db.branchMembership.create({
        data: { organizationId: org.id, branchId, userId: u.id },
      });
    contexts.push({
      organizationId: org.id,
      userId: u.id,
      role,
      ...(role === 'MERCHANT' ? { merchantId } : {}),
    });
  }
  [context, owner2, manager, merchant, cashier] = contexts;
  for (const m of [merchantId, secondMerchant])
    for (const branch of [branchId, secondBranch])
      await branches.assign(context, m, branch);
});

describe('Optional branch spaces and occupancy', () => {
  it('starts empty without modifying merchant participation, stock, or sales', async () => {
    expect((await spaces.list(context, branchId, { page: 1 })).total).toBe(0);
    expect(
      await db.merchantBranch.count({
        where: { organizationId: context.organizationId },
      }),
    ).toBe(4);
    expect(
      await db.branchInventory.count({
        where: { organizationId: context.organizationId },
      }),
    ).toBe(0);
    expect(
      await db.sale.count({
        where: { organizationId: context.organizationId },
      }),
    ).toBe(0);
  });
  it('keeps branch-local names unique ignoring case and supports custom types', async () => {
    await create('Rack A1');
    await expect(create('rack a1')).rejects.toMatchObject({ status: 409 });
    expect((await create('Rack A1', secondBranch)).type).toBe('Shelf');
    const s = await create();
    expect(
      (
        await spaces.update(context, branchId, s.id, {
          type: 'Handmade display',
        })
      ).type,
    ).toBe('Handmade display');
    await expect(
      spaces.update(context, branchId, s.id, {}),
    ).rejects.toMatchObject({ status: 400 });
  });
  it('permits multiple spaces per merchant but prevents exclusive occupancy conflicts', async () => {
    const a = await create(),
      b = await create();
    await assign(a.id);
    await assign(b.id);
    expect(
      (
        await spaces.occupancies(context, 'merchant', merchantId, {
          page: 1,
          view: 'CURRENT',
        })
      ).total,
    ).toBe(2);
    await expect(assign(a.id, secondMerchant)).rejects.toMatchObject({
      status: 409,
    });
    await expect(
      db.spaceOccupancy.create({
        data: {
          organizationId: context.organizationId,
          branchId,
          spaceId: a.id,
          merchantId: secondMerchant,
          assignedById: context.userId,
          startedAt: new Date(),
        },
      }),
    ).rejects.toThrow();
  });
  it('records non-overlapping historical intervals and permits adjacent intervals', async () => {
    const a = await create(),
      start = old(),
      end = old(1000),
      later = old(2000);
    await spaces.assign(context, branchId, a.id, {
      merchantId,
      startedAt: start,
      endedAt: end,
    });
    await spaces.assign(context, branchId, a.id, {
      merchantId: secondMerchant,
      startedAt: end,
      endedAt: later,
    });
    await expect(
      spaces.assign(context, branchId, a.id, {
        merchantId,
        startedAt: old(500),
        endedAt: old(1500),
      }),
    ).rejects.toMatchObject({ status: 409 });
    await expect(
      spaces.assign(context, branchId, a.id, { merchantId, startedAt: start }),
    ).rejects.toMatchObject({ status: 409 });
    await spaces.assign(context, branchId, a.id, {
      merchantId,
      startedAt: later,
    });
    expect(
      (await spaces.occupancies(context, 'space', a.id, { page: 1 }, branchId))
        .total,
    ).toBe(3);
  });
  it('rejects future, reversed, timezone-less and null dates', async () => {
    const a = await create();
    for (const dates of [
      { startedAt: new Date(Date.now() + 60000).toISOString() },
      { startedAt: old(1000), endedAt: old() },
      { startedAt: '2026-01-01T00:00:00' },
    ])
      await expect(
        spaces.assign(context, branchId, a.id, { merchantId, ...dates }),
      ).rejects.toMatchObject({ status: 400 });
    await http()
      .post(`${path()}/${a.id}/occupancies`)
      .auth(token(), { type: 'bearer' })
      .send({ merchantId, startedAt: null })
      .expect(400);
  });
  it('releases at a past time and archives only a free space, retaining history', async () => {
    const a = await create(),
      occupancy = await assign(a.id);
    await expect(
      spaces.update(context, branchId, a.id, { status: 'ARCHIVED' }),
    ).rejects.toMatchObject({ status: 409 });
    const end = old(10000);
    expect(
      (
        await spaces.release(context, branchId, a.id, occupancy.id, {
          endedAt: end,
        })
      ).endedAt?.toISOString(),
    ).toBe(end);
    await expect(
      spaces.release(context, branchId, a.id, occupancy.id, {}),
    ).rejects.toMatchObject({ status: 409 });
    await spaces.update(context, branchId, a.id, { status: 'ARCHIVED' });
    await expect(assign(a.id)).rejects.toMatchObject({ status: 409 });
    expect(
      (await spaces.occupancies(context, 'space', a.id, { page: 1 }, branchId))
        .total,
    ).toBe(1);
    await spaces.update(context, branchId, a.id, { status: 'ACTIVE' });
    await spaces.assign(context, branchId, a.id, {
      merchantId,
      startedAt: end,
    });
  });
  it('requires active profiles and affiliation without deriving affiliation from occupancy', async () => {
    const a = await create();
    await branches.setStatus(context, merchantId, branchId, 'INACTIVE');
    await expect(assign(a.id)).rejects.toMatchObject({ status: 409 });
    await branches.setStatus(context, merchantId, branchId, 'ACTIVE');
    await merchants.updateStatus(
      context.organizationId,
      merchantId,
      { status: 'SUSPENDED' },
      context.userId,
    );
    await expect(assign(a.id)).rejects.toMatchObject({ status: 409 });
    await db.merchantBranch.delete({
      where: {
        organizationId_branchId_merchantId: {
          organizationId: context.organizationId,
          branchId,
          merchantId: secondMerchant,
        },
      },
    });
    await expect(assign(a.id, secondMerchant)).rejects.toMatchObject({
      status: 404,
    });
  });
  it('releases only the deactivated branch and preserves release timestamps on replay', async () => {
    const a = await create(),
      b = await create(undefined, secondBranch);
    await assign(a.id);
    await assign(b.id, merchantId, secondBranch);
    await branches.setStatus(context, merchantId, branchId, 'INACTIVE');
    const first = await spaces.occupancies(context, 'merchant', merchantId, {
      page: 1,
      view: 'HISTORY',
    });
    expect(first.items[0].releaseReason).toBe('PARTICIPATION_INACTIVE');
    expect(
      (
        await spaces.occupancies(context, 'merchant', merchantId, {
          page: 1,
          view: 'CURRENT',
        })
      ).total,
    ).toBe(1);
    await branches.setStatus(context, merchantId, branchId, 'INACTIVE');
    await branches.setStatus(context, merchantId, branchId, 'ACTIVE');
    expect(
      (
        await spaces.occupancies(context, 'merchant', merchantId, {
          page: 1,
          view: 'HISTORY',
        })
      ).items[0].endedAt,
    ).toEqual(first.items[0].endedAt);
    expect(
      (await spaces.list(context, branchId, { page: 1 })).items[0]
        .currentOccupancy,
    ).toBeNull();
  });
  it.each(['INACTIVE', 'SUSPENDED', 'ENDED'] as const)(
    'releases all branches for %s and records the actor without changing affiliations',
    async (status) => {
      const a = await create(),
        b = await create(undefined, secondBranch);
      await assign(a.id);
      await assign(b.id, merchantId, secondBranch);
      await merchants.updateStatus(
        context.organizationId,
        merchantId,
        { status },
        context.userId,
      );
      const history = await db.spaceOccupancy.findMany({
        where: { organizationId: context.organizationId },
      });
      expect(history).toHaveLength(2);
      expect(
        history.every(
          (row) =>
            row.releaseReason === `MERCHANT_${status}` &&
            row.releasedById === context.userId &&
            row.endedAt,
        ),
      ).toBe(true);
      await merchants.updateStatus(
        context.organizationId,
        merchantId,
        { status: 'ENDED' },
        context.userId,
      );
      expect(
        (
          await db.spaceOccupancy.findMany({
            where: { organizationId: context.organizationId },
            orderBy: { id: 'asc' },
          })
        ).map((row) => row.endedAt),
      ).toEqual(
        history
          .sort((a, b) => a.id.localeCompare(b.id))
          .map((row) => row.endedAt),
      );
      await merchants.updateStatus(
        context.organizationId,
        merchantId,
        { status: 'ACTIVE' },
        context.userId,
      );
      expect(
        (
          await spaces.occupancies(context, 'merchant', merchantId, {
            page: 1,
            view: 'CURRENT',
          })
        ).total,
      ).toBe(0);
      expect(
        await db.merchantBranch.count({
          where: {
            organizationId: context.organizationId,
            merchantId,
            status: 'ACTIVE',
          },
        }),
      ).toBe(2);
    },
  );
  it('does not release spaces when the branch metadata becomes inactive', async () => {
    const a = await create();
    await assign(a.id);
    await db.branch.update({
      where: { id: branchId },
      data: { status: 'INACTIVE' },
    });
    expect(
      (await spaces.list(context, branchId, { page: 1 })).items[0]
        .currentOccupancy,
    ).not.toBeNull();
  });
  it('limits managers to assigned branches and merchants to their own current and past records', async () => {
    const a = await create(),
      b = await create(),
      c = await create(undefined, secondBranch);
    await assign(a.id);
    await assign(b.id, secondMerchant);
    await assign(c.id, merchantId, secondBranch);
    expect((await spaces.list(manager, branchId, { page: 1 })).total).toBe(2);
    await expect(
      spaces.list(manager, secondBranch, { page: 1 }),
    ).rejects.toMatchObject({ status: 404 });
    expect(
      (await spaces.occupancies(manager, 'merchant', merchantId, { page: 1 }))
        .total,
    ).toBe(1);
    expect(
      (await spaces.list(merchant, branchId, { page: 1 })).items.map(
        (row) => row.id,
      ),
    ).toEqual([a.id]);
    await expect(
      spaces.findOne(merchant, branchId, b.id),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      spaces.occupancies(merchant, 'merchant', secondMerchant, { page: 1 }),
    ).rejects.toMatchObject({ status: 404 });
    await branches.setStatus(context, merchantId, branchId, 'INACTIVE');
    const history = await spaces.occupancies(
      merchant,
      'space',
      a.id,
      { page: 1 },
      branchId,
    );
    expect(history.total).toBe(1);
    expect(JSON.stringify(history)).not.toMatch(
      /contactName|phone|assignedById|releasedById/,
    );
    await db.organizationMembership.update({
      where: {
        organizationId_userId: {
          organizationId: context.organizationId,
          userId: merchant.userId,
        },
      },
      data: { merchantId: secondMerchant },
    });
    expect(
      (await spaces.list(merchant, branchId, { page: 1 })).items.map(
        (row) => row.id,
      ),
    ).toEqual([b.id]);
  });
  it('returns not found for foreign IDs and rejects cross-tenant database relations', async () => {
    const org = await db.organization.create({ data: { name: 'Foreign' } });
    const foreign = await db.branch.create({
      data: {
        organizationId: org.id,
        name: 'Foreign',
        addressLine1: 'Test',
        city: 'Test',
        province: 'Test',
        countryCode: 'PH',
      },
    });
    await expect(
      spaces.create(context, foreign.id, { name: 'Foreign', type: 'Shelf' }),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      db.space.create({
        data: {
          organizationId: context.organizationId,
          branchId: foreign.id,
          name: 'Bad',
          type: 'Shelf',
        },
      }),
    ).rejects.toThrow();
    const a = await create();
    await expect(
      spaces.findOne(context, secondBranch, a.id),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      db.spaceOccupancy.create({
        data: {
          organizationId: context.organizationId,
          branchId: secondBranch,
          spaceId: a.id,
          merchantId,
          assignedById: context.userId,
          startedAt: new Date(),
        },
      }),
    ).rejects.toThrow();
  });
  it('rejects unauthorized HTTP writes, unknown fields, bad pagination, and cashiers', async () => {
    await http().get(path()).expect(401);
    await http()
      .get(path())
      .auth(token(cashier), { type: 'bearer' })
      .expect(403);
    for (const c of [manager, merchant, cashier])
      await http()
        .post(path())
        .auth(token(c), { type: 'bearer' })
        .send({ name: 'Rack', type: 'Rack' })
        .expect(403);
    await http()
      .post(path())
      .auth(token(), { type: 'bearer' })
      .send({ name: 'Rack', type: 'Rack', organizationId: randomUUID() })
      .expect(400);
    await http()
      .get(`${path()}?page=0`)
      .auth(token(), { type: 'bearer' })
      .expect(400);
    await http()
      .get(`${path()}?unexpected=1`)
      .auth(token(), { type: 'bearer' })
      .expect(400);
    const res = await http()
      .post(path())
      .auth(token(), { type: 'bearer' })
      .send({ name: ' Rack ', type: ' Shelf ' })
      .expect(201);
    const id = (res.body as { id: string }).id;
    await http()
      .post(`${path()}/${id}/occupancies`)
      .auth(token(), { type: 'bearer' })
      .send({ merchantId, startedAt: old() })
      .expect(201);
    await http()
      .patch(
        `/organizations/${context.organizationId}/merchants/${merchantId}/status`,
      )
      .auth(token(), { type: 'bearer' })
      .send({ status: 'ENDED' })
      .expect(200);
    expect(
      (await spaces.list(context, branchId, { page: 1 })).items[0]
        .currentOccupancy,
    ).toBeNull();
  });
  it('paginates and filters spaces without leaking foreign records', async () => {
    for (let i = 0; i < 11; i++)
      await create(`Shelf ${String(i).padStart(2, '0')}`);
    expect(
      (await spaces.list(context, branchId, { page: 1, type: 'shelf' })).items,
    ).toHaveLength(10);
    expect(
      (await spaces.list(context, branchId, { page: 2 })).items,
    ).toHaveLength(1);
    expect(
      (await spaces.list(context, branchId, { page: 1, q: 'Shelf 10' })).total,
    ).toBe(1);
  });
  it('publishes matching OpenAPI space and occupancy contracts', () => {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder().addBearerAuth(undefined, 'access-token').build(),
    );
    expect(
      document.paths[
        '/organizations/{organizationId}/branches/{branchId}/spaces/{spaceId}/occupancies'
      ]?.post,
    ).toBeDefined();
    expect(
      document.paths[
        '/organizations/{organizationId}/merchants/{merchantId}/spaces'
      ]?.get,
    ).toBeDefined();
    expect(
      document.components?.schemas?.SpaceOccupancyResponseDto,
    ).toMatchObject({
      properties: {
        startedAt: { format: 'date-time' },
        endedAt: { nullable: true },
        releaseReason: { nullable: true },
        space: expect.any(Object) as object,
      },
    });
  });
  it('prevents concurrent archiving from leaving an archived space occupied', async () => {
    const a = await create();
    const results = await Promise.allSettled([
      assign(a.id, merchantId, branchId, owner2),
      spaces.update(context, branchId, a.id, { status: 'ARCHIVED' }),
    ]);
    expect(results.some((row) => row.status === 'fulfilled')).toBe(true);
    const saved = await db.space.findUniqueOrThrow({ where: { id: a.id } });
    const count = await db.spaceOccupancy.count({
      where: { spaceId: a.id, endedAt: null },
    });
    expect(saved.status === 'ARCHIVED' ? count === 0 : count === 1).toBe(true);
  });
  it('serializes simultaneous assignments from different owners to one space', async () => {
    const a = await create();
    const results = await Promise.allSettled([
      assign(a.id, merchantId),
      assign(a.id, secondMerchant, branchId, owner2),
    ]);
    expect(results.filter((row) => row.status === 'fulfilled')).toHaveLength(1);
    expect(
      await db.spaceOccupancy.count({
        where: { spaceId: a.id, endedAt: null },
      }),
    ).toBe(1);
  });
  it.each(['merchant', 'participation'] as const)(
    'does not assign through concurrent %s deactivation',
    async (kind) => {
      const a = await create();
      let unlock!: () => void, ready!: () => void;
      const hold = new Promise<void>((resolve) => {
          unlock = resolve;
        }),
        acquired = new Promise<void>((resolve) => {
          ready = resolve;
        });
      const writer = db.$transaction(
        async (tx) => {
          await tx.$queryRaw`SELECT "id" FROM "Merchant" WHERE "id" = ${merchantId} FOR UPDATE`;
          if (kind === 'merchant')
            await tx.merchant.update({
              where: { id: merchantId },
              data: { status: 'INACTIVE' },
            });
          else
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
          ready();
          await hold;
        },
        { timeout: 10000 },
      );
      await acquired;
      const pending = assign(a.id, merchantId, branchId, owner2).then(
        () => 'assigned',
        () => 'rejected',
      );
      try {
        let waiting = false;
        for (let i = 0; i < 100; i++) {
          const rows = await admin.query(
            "SELECT count(*)::int AS count FROM pg_stat_activity WHERE wait_event_type = 'Lock' AND query LIKE '%Merchant%'",
          );
          if ((rows.rows[0] as { count: number }).count) {
            waiting = true;
            break;
          }
          await new Promise((resolve) => setTimeout(resolve, 10));
        }
        expect(waiting).toBe(true);
      } finally {
        unlock();
      }
      await writer;
      expect(await pending).toBe('rejected');
      expect(await db.spaceOccupancy.count({ where: { spaceId: a.id } })).toBe(
        0,
      );
    },
  );
});

it('filters occupancy before pagination and combines lifecycle and merchant filters', async () => {
  for (let i = 0; i < 12; i++)
    await create(`Vacancy ${String(i).padStart(2, '0')}`);
  const occupied = await create('Vacancy occupied');
  await assign(occupied.id);
  const historical = await create('Vacancy history');
  await spaces.assign(context, branchId, historical.id, {
    merchantId,
    startedAt: old(),
    endedAt: old(1000),
  });
  await spaces.update(context, branchId, historical.id, { status: 'ARCHIVED' });
  const vacant = await spaces.list(context, branchId, {
    page: 1,
    q: 'Vacancy',
    occupancy: 'VACANT',
  });
  expect(vacant.total).toBe(13);
  expect(vacant.items).toHaveLength(10);
  const second = await spaces.list(context, branchId, {
    page: 2,
    q: 'Vacancy',
    occupancy: 'VACANT',
  });
  expect(second.items).toHaveLength(3);
  expect(
    [...vacant.items, ...second.items].some((row) => row.id === historical.id),
  ).toBe(true);
  const current = await spaces.list(context, branchId, {
    page: 1,
    occupancy: 'OCCUPIED',
    merchantId,
    type: 'Shelf',
    status: 'ACTIVE',
  });
  expect(current.total).toBe(1);
  expect(current.items[0].id).toBe(occupied.id);
  expect(
    (
      await spaces.list(context, branchId, {
        page: 1,
        occupancy: 'VACANT',
        merchantId,
      })
    ).total,
  ).toBe(0);
  expect((await spaces.list(context, branchId, { page: 1 })).total).toBe(14);
});

it('enforces occupancy query validation, role scope, and branch isolation', async () => {
  const occupied = await create();
  await assign(occupied.id);
  for (const occupancy of ['OCCUPIED', 'VACANT']) {
    await http()
      .get(`${path()}?occupancy=${occupancy}`)
      .set('Authorization', `Bearer ${token(merchant)}`)
      .expect(403);
    await http()
      .get(`${path()}?occupancy=${occupancy}`)
      .set('Authorization', `Bearer ${token(cashier)}`)
      .expect(403);
  }
  await http()
    .get(`${path()}?occupancy=INVALID`)
    .set('Authorization', `Bearer ${token()}`)
    .expect(400);
  await http()
    .get(`${path()}?unknown=VACANT`)
    .set('Authorization', `Bearer ${token()}`)
    .expect(400);
  const result = await http()
    .get(`${path()}?occupancy=OCCUPIED`)
    .set('Authorization', `Bearer ${token(manager)}`)
    .expect(200);
  expect((result.body as { total: number }).total).toBe(1);
  await http()
    .get(path().replace(branchId, secondBranch) + '?occupancy=VACANT')
    .set('Authorization', `Bearer ${token(manager)}`)
    .expect(404);
  const foreignOrg = await db.organization.create({
    data: { name: 'Foreign filter' },
  });
  const foreignBranch = await db.branch.create({
    data: {
      organizationId: foreignOrg.id,
      name: 'Foreign',
      addressLine1: 'Test',
      city: 'Makati',
      province: 'Metro Manila',
      countryCode: 'PH',
    },
  });
  await http()
    .get(path().replace(branchId, foreignBranch.id) + '?occupancy=VACANT')
    .set('Authorization', `Bearer ${token()}`)
    .expect(404);
});

it('shares types across branches, canonicalizes legacy labels, and rolls back failed implicit additions', async () => {
  const created = await spaces.createType(context, { name: ' Rack ' });
  expect(created.name).toBe('Rack');
  const a = await spaces.create(context, branchId, { name: 'A', type: 'rack' });
  const b = await spaces.create(context, secondBranch, {
    name: 'B',
    type: 'RACK',
  });
  expect(a.type).toBe('Rack');
  expect(b.type).toBe('Rack');
  expect((await spaces.listTypes(manager)).map((row) => row.name)).toEqual([
    'Rack',
  ]);
  await expect(
    spaces.createType(context, { name: 'rAcK' }),
  ).rejects.toMatchObject({ status: 409 });
  await expect(
    spaces.create(context, branchId, { name: 'A', type: 'Failed type' }),
  ).rejects.toMatchObject({ status: 409 });
  expect(
    (await spaces.listTypes(context)).some((row) => row.name === 'Failed type'),
  ).toBe(false);
  await spaces.createType(context, { name: 'Unused' });
  await spaces.create(context, secondBranch, {
    name: 'Private',
    type: 'Private type',
  });
  await assign(a.id);
  await spaces.release(
    context,
    branchId,
    a.id,
    (
      await spaces.occupancies(
        context,
        'space',
        a.id,
        { page: 1, view: 'CURRENT' },
        branchId,
      )
    ).items[0].id,
    {},
  );
  expect((await spaces.listTypes(merchant)).map((row) => row.name)).toEqual([
    'Rack',
  ]);
  const foreign = await db.organization.create({
    data: { name: 'Foreign catalog' },
  });
  await db.spaceType.create({
    data: { organizationId: foreign.id, name: 'Foreign-only' },
  });
  expect(
    (await spaces.listTypes(context)).some(
      (row) => row.name === 'Foreign-only',
    ),
  ).toBe(false);
  await expect(
    db.spaceType.delete({ where: { id: created.id } }),
  ).rejects.toBeDefined();
});

it('validates type HTTP commands and enforces current membership roles', async () => {
  const typePath = `/organizations/${context.organizationId}/space-types`;
  await http().get(typePath).expect(401);
  await http()
    .get(typePath)
    .auth(token(cashier), { type: 'bearer' })
    .expect(403);
  for (const c of [manager, merchant, cashier])
    await http()
      .post(typePath)
      .auth(token(c), { type: 'bearer' })
      .send({ name: 'Rack' })
      .expect(403);
  for (const body of [
    { name: ' ' },
    { name: 'x'.repeat(81) },
    { name: null },
    { name: 'Rack', organizationId: randomUUID() },
  ])
    await http()
      .post(typePath)
      .auth(token(), { type: 'bearer' })
      .send(body)
      .expect(400);
  await http()
    .post(typePath)
    .auth(token(), { type: 'bearer' })
    .send({ name: 'Shelf' })
    .expect(201);
  await http()
    .post(typePath)
    .auth(token(), { type: 'bearer' })
    .send({ name: 'shelf' })
    .expect(409);
  await db.organizationMembership.update({
    where: {
      organizationId_userId: {
        organizationId: context.organizationId,
        userId: context.userId,
      },
    },
    data: { role: 'MANAGER' },
  });
  await expect(
    spaces.createType(context, { name: 'Stale owner' }),
  ).rejects.toMatchObject({ status: 403 });
});

it('allows only one concurrent case-insensitive type creation', async () => {
  const results = await Promise.allSettled([
    spaces.createType(context, { name: 'Display' }),
    spaces.createType(owner2, { name: 'DISPLAY' }),
  ]);
  expect(results.filter((row) => row.status === 'fulfilled')).toHaveLength(1);
  expect(await spaces.listTypes(context)).toHaveLength(1);
  expect(results.find((row) => row.status === 'rejected')).toMatchObject({
    reason: { status: 409 },
  });
});
