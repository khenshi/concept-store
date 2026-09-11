import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { hash } from 'bcryptjs';
import { createHash } from 'node:crypto';
import {
  MerchantStatus,
  OrganizationRole,
  PrismaClient,
} from '../src/generated/prisma/client';

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
  },
} as const;

function assertSafeEnvironment(resetRequested: boolean): void {
  const runtimeEnvironment = process.env.NODE_ENV ?? 'development';
  if (!['development', 'test'].includes(runtimeEnvironment) && process.env.SEED_DEMO_DATA !== '1') {
    throw new Error(
      'Demo seed is restricted to development/test. Set SEED_DEMO_DATA=1 explicitly to override.',
    );
  }
  if (!resetRequested) {
    throw new Error('Foundation demo seed requires the --reset flag.');
  }
}

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
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${quoted} RESTART IDENTITY CASCADE`);
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
    })),
  });

  await prisma.organization.create({
    data: { id: ids.organization, name: 'Kapwesto Demo Store' },
  });
  await prisma.organizationMembership.createMany({
    data: [
      { organizationId: ids.organization, userId: ids.users.owner, role: OrganizationRole.OWNER },
      { organizationId: ids.organization, userId: ids.users.manager, role: OrganizationRole.MANAGER },
      { organizationId: ids.organization, userId: ids.users.cashier, role: OrganizationRole.CASHIER },
      { organizationId: ids.organization, userId: ids.users.merchant, role: OrganizationRole.MERCHANT },
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
    ],
  });

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
    },
  });

  console.info('Foundation demo database seeded successfully.');
  console.info('Demo login password: DemoPassword123!');
  console.info('Invitation token:', invitationToken);
}

async function main(): Promise<void> {
  const resetRequested = process.argv.includes('--reset');
  assertSafeEnvironment(resetRequested);
  const connectionString = process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL or DIRECT_DATABASE_URL is required to seed demo data');
  }
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  try {
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
