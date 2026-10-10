import { randomUUID } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { Client } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

const connectionString = process.env.TEST_DATABASE_URL;
if (!connectionString)
  throw new Error('TEST_DATABASE_URL must refer to a disposable database');
const schema = `types_migration_${randomUUID().replaceAll('-', '')}`;
const sql = new Client({ connectionString });
const db = new PrismaClient({
  adapter: new PrismaPg(
    { connectionString, options: `-c search_path=${schema}` },
    { schema },
  ),
});
const migration = '20261010010000_add_space_types';
beforeAll(async () => {
  await sql.connect();
  await sql.query(`CREATE SCHEMA "${schema}"`);
  await sql.query(`SET search_path TO "${schema}"`);
  const root = join(process.cwd(), 'prisma/migrations');
  for (const name of readdirSync(root)
    .filter((name) => /^\d/.test(name) && name < migration)
    .sort())
    await sql.query(readFileSync(join(root, name, 'migration.sql'), 'utf8'));
});
afterAll(async () => {
  await db.$disconnect();
  await sql.query(`DROP SCHEMA "${schema}" CASCADE`);
  await sql.end();
});
it('backfills existing active/archived labels without losing spaces or occupancy and keeps legacy writers safe', async () => {
  const org = await db.organization.create({ data: { name: 'Migration' } });
  const foreign = await db.organization.create({ data: { name: 'Other' } });
  const branch = await db.branch.create({
    data: {
      organizationId: org.id,
      name: 'Main',
      addressLine1: 'Test',
      city: 'Makati',
      province: 'Metro Manila',
      countryCode: 'PH',
    },
  });
  const foreignBranch = await db.branch.create({
    data: {
      organizationId: foreign.id,
      name: 'Main',
      addressLine1: 'Test',
      city: 'Makati',
      province: 'Metro Manila',
      countryCode: 'PH',
    },
  });
  const owner = await db.user.create({
    data: {
      email: `${randomUUID()}@example.test`,
      firstName: 'Owner',
      lastName: 'Test',
      passwordHash: 'unused',
    },
  });
  const merchant = await db.merchant.create({
    data: {
      organizationId: org.id,
      name: 'Merchant',
      contactName: 'Test',
      phone: '09171234567',
    },
  });
  await db.merchantBranch.create({
    data: {
      organizationId: org.id,
      branchId: branch.id,
      merchantId: merchant.id,
    },
  });
  const space = await db.space.create({
    data: {
      organizationId: org.id,
      branchId: branch.id,
      name: 'A',
      type: 'rack',
    },
  });
  const archived = await db.space.create({
    data: {
      organizationId: org.id,
      branchId: branch.id,
      name: 'B',
      type: 'Rack',
      status: 'ARCHIVED',
    },
  });
  await db.space.create({
    data: {
      organizationId: foreign.id,
      branchId: foreignBranch.id,
      name: 'C',
      type: 'rack',
    },
  });
  const occupancy = await db.spaceOccupancy.create({
    data: {
      organizationId: org.id,
      branchId: branch.id,
      spaceId: space.id,
      merchantId: merchant.id,
      assignedById: owner.id,
      startedAt: new Date('2026-01-01T00:00:00Z'),
    },
  });
  const before = await db.spaceOccupancy.findUniqueOrThrow({
    where: { id: occupancy.id },
  });
  await sql.query(
    readFileSync(
      join(process.cwd(), 'prisma/migrations', migration, 'migration.sql'),
      'utf8',
    ),
  );
  expect(await db.spaceType.count()).toBe(2);
  expect(await db.space.count()).toBe(3);
  expect(
    await db.spaceOccupancy.findUniqueOrThrow({ where: { id: occupancy.id } }),
  ).toEqual(before);
  expect(
    (await db.space.findUniqueOrThrow({ where: { id: space.id } })).type,
  ).toBe('Rack');
  expect(
    (await db.space.findUniqueOrThrow({ where: { id: archived.id } })).status,
  ).toBe('ARCHIVED');
  const added = await db.space.create({
    data: {
      organizationId: org.id,
      branchId: branch.id,
      name: 'Legacy',
      type: ' shelf ',
    },
  });
  expect(added.type).toBe('shelf');
  expect(
    await db.spaceType.count({
      where: { organizationId: org.id, name: 'shelf' },
    }),
  ).toBe(1);
  await db.space.update({ where: { id: added.id }, data: { type: 'SHELF' } });
  expect(
    (await db.space.findUniqueOrThrow({ where: { id: added.id } })).type,
  ).toBe('shelf');
  await expect(
    db.spaceType.create({ data: { organizationId: org.id, name: 'SHELF' } }),
  ).rejects.toBeDefined();
  await expect(
    db.space.create({
      data: {
        organizationId: foreign.id,
        branchId: branch.id,
        name: 'Foreign relation',
        type: 'New',
      },
    }),
  ).rejects.toBeDefined();
  expect(
    await db.spaceType.count({
      where: { organizationId: foreign.id, name: 'New' },
    }),
  ).toBe(0);
  await sql.query(
    'ALTER TABLE "Space" DROP CONSTRAINT "Space_organizationId_type_fkey"; DROP TRIGGER "Space_register_type" ON "Space"; DROP FUNCTION register_space_type(); DROP TABLE "SpaceType";',
  );
  expect(await db.space.count()).toBe(4);
  expect(
    await db.spaceOccupancy.findUniqueOrThrow({ where: { id: occupancy.id } }),
  ).toEqual(before);
  expect(
    (
      await db.space.create({
        data: {
          organizationId: org.id,
          branchId: branch.id,
          name: 'Rollback',
          type: 'Free form',
        },
      })
    ).type,
  ).toBe('Free form');
});
