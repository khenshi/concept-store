import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { hash } from 'bcryptjs';
import {
  AgreementStatus,
  MerchantReceivableStatus,
  MerchantReceivableTransactionType,
  MerchantStatus,
  PaymentMethod,
  Prisma,
  ProductStatus,
  SaleStatus,
  SettlementSchedule,
} from '../src/generated/prisma/client';
import { PrismaClient } from '../src/generated/prisma/client';

function dateOnly(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

function addMonths(anchor: Date, months: number): Date {
  const result = new Date(
    Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + months, 1),
  );
  const lastDay = new Date(
    Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0),
  ).getUTCDate();
  result.setUTCDate(Math.min(anchor.getUTCDate(), lastDay));
  return result;
}

function previousDate(date: Date): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() - 1);
  return result;
}

async function main(): Promise<void> {
  const runtimeEnvironment = process.env.NODE_ENV ?? 'development';
  if (
    !['development', 'test'].includes(runtimeEnvironment) &&
    process.env.SEED_DEMO_DATA !== '1'
  ) {
    throw new Error(
      'Demo seed is restricted to development/test. Set SEED_DEMO_DATA=1 explicitly to override.',
    );
  }
  const connectionString =
    process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!connectionString)
    throw new Error('DATABASE_URL is required to seed demo data');
  const adapter = new PrismaPg({ connectionString });
  const prisma = new PrismaClient({ adapter });
  try {
    const organizationId = '00000000-0000-4000-8000-000000000001';
    const branchId = '00000000-0000-4000-8000-000000000011';
    const secondBranchId = '00000000-0000-4000-8000-000000000012';
    const ownerId = '00000000-0000-4000-8000-000000000021';
    const managerId = '00000000-0000-4000-8000-000000000022';
    const merchantAId = '00000000-0000-4000-8000-000000000031';
    const merchantBId = '00000000-0000-4000-8000-000000000032';
    const agreementAId = '00000000-0000-4000-8000-000000000041';
    const agreementBId = '00000000-0000-4000-8000-000000000042';

    await prisma.organization.upsert({
      where: { id: organizationId },
      update: { name: 'Demo Kapwesto Concept Store' },
      create: { id: organizationId, name: 'Demo Kapwesto Concept Store' },
    });
    const branch = await prisma.branch.upsert({
      where: { id: branchId },
      update: { name: 'Makati Main' },
      create: {
        id: branchId,
        organizationId,
        name: 'Makati Main',
        code: 'MAKATI',
        addressLine1: 'Demo retail address',
        city: 'Makati',
        province: 'Metro Manila',
        countryCode: 'PH',
      },
    });
    await prisma.branch.upsert({
      where: { id: secondBranchId },
      update: { name: 'BGC Satellite' },
      create: {
        id: secondBranchId,
        organizationId,
        name: 'BGC Satellite',
        code: 'BGC',
        addressLine1: 'Demo satellite address',
        city: 'Taguig',
        province: 'Metro Manila',
        countryCode: 'PH',
      },
    });

    const passwordHash = await hash('DemoPassword123!', 10);
    for (const user of [
      {
        id: ownerId,
        email: 'owner.demo@example.com',
        firstName: 'Demo',
        lastName: 'Owner',
      },
      {
        id: managerId,
        email: 'manager.demo@example.com',
        firstName: 'Demo',
        lastName: 'Manager',
      },
    ]) {
      await prisma.user.upsert({
        where: { id: user.id },
        update: {
          passwordHash,
          firstName: user.firstName,
          lastName: user.lastName,
        },
        create: { ...user, passwordHash },
      });
    }
    await prisma.organizationMembership.upsert({
      where: { organizationId_userId: { organizationId, userId: ownerId } },
      update: { role: 'OWNER' },
      create: { organizationId, userId: ownerId, role: 'OWNER' },
    });
    await prisma.organizationMembership.upsert({
      where: { organizationId_userId: { organizationId, userId: managerId } },
      update: { role: 'MANAGER' },
      create: { organizationId, userId: managerId, role: 'MANAGER' },
    });

    const merchants = [
      {
        id: merchantAId,
        name: 'Studio Isla',
        code: 'ISLA',
        email: 'isla.demo@example.com',
      },
      {
        id: merchantBId,
        name: 'North Goods',
        code: 'NORTH',
        email: 'north.demo@example.com',
      },
    ];
    for (const merchant of merchants) {
      await prisma.merchant.upsert({
        where: { id: merchant.id },
        update: { name: merchant.name, status: MerchantStatus.ACTIVE },
        create: {
          id: merchant.id,
          organizationId,
          name: merchant.name,
          code: merchant.code,
          contactName: merchant.name,
          email: merchant.email,
          phone: '+639000000000',
        },
      });
      await prisma.merchantBranch.upsert({
        where: { merchantId_branchId: { merchantId: merchant.id, branchId } },
        update: {},
        create: { merchantId: merchant.id, branchId, organizationId },
      });
    }

    const today = dateOnly(new Date());
    const activation = addMonths(today, -2);
    const scheduledEnd = addMonths(activation, 12);
    for (const [id, merchantId, rent, commission] of [
      [agreementAId, merchantAId, '2500.00', '5.00'],
      [agreementBId, merchantBId, '1800.00', '7.50'],
    ] as const) {
      await prisma.merchantAgreement.upsert({
        where: { id },
        update: {
          status: AgreementStatus.ACTIVE,
          activationAt: activation,
          startDate: activation,
          endDate: previousDate(scheduledEnd),
          durationMonths: 12,
          activatedAt: new Date(),
          scheduledEndDate: scheduledEnd,
          fixedRentAmount: new Prisma.Decimal(rent),
          commissionRate: new Prisma.Decimal(commission),
          settlementSchedule: SettlementSchedule.MONTHLY,
        },
        create: {
          id,
          organizationId,
          merchantId,
          activationAt: activation,
          startDate: activation,
          endDate: previousDate(scheduledEnd),
          durationMonths: 12,
          activatedAt: new Date(),
          scheduledEndDate: scheduledEnd,
          fixedRentAmount: new Prisma.Decimal(rent),
          commissionRate: new Prisma.Decimal(commission),
          settlementSchedule: SettlementSchedule.MONTHLY,
          status: AgreementStatus.ACTIVE,
        },
      });
    }

    const productA = await prisma.product.upsert({
      where: { id: '00000000-0000-4000-8000-000000000051' },
      update: { sellingPrice: new Prisma.Decimal('1200.00') },
      create: {
        id: '00000000-0000-4000-8000-000000000051',
        organizationId,
        merchantId: merchantAId,
        name: 'Isla Linen Tote',
        sku: 'DEMO-ISLA-TOTE',
        sellingPrice: new Prisma.Decimal('1200.00'),
        status: ProductStatus.ACTIVE,
      },
    });
    const productB = await prisma.product.upsert({
      where: { id: '00000000-0000-4000-8000-000000000052' },
      update: { sellingPrice: new Prisma.Decimal('850.00') },
      create: {
        id: '00000000-0000-4000-8000-000000000052',
        organizationId,
        merchantId: merchantBId,
        name: 'North Ceramic Mug',
        sku: 'DEMO-NORTH-MUG',
        sellingPrice: new Prisma.Decimal('850.00'),
        status: ProductStatus.ACTIVE,
      },
    });
    for (const product of [productA, productB]) {
      await prisma.inventory.upsert({
        where: {
          productId_branchId_organizationId: {
            productId: product.id,
            branchId,
            organizationId,
          },
        },
        update: { quantity: 20 },
        create: {
          productId: product.id,
          branchId,
          organizationId,
          quantity: 20,
        },
      });
    }

    const saleId = '00000000-0000-4000-8000-000000000061';
    await prisma.sale.upsert({
      where: { id: saleId },
      update: { total: new Prisma.Decimal('2050.00'), completedAt: new Date() },
      create: {
        id: saleId,
        organizationId,
        branchId: branch.id,
        cashierId: ownerId,
        saleNumber: 'DEMO-0001',
        clientTransactionId: 'demo-client-0001',
        subtotal: new Prisma.Decimal('2050.00'),
        total: new Prisma.Decimal('2050.00'),
        status: SaleStatus.COMPLETED,
        items: {
          create: [
            {
              productId: productA.id,
              merchantId: merchantAId,
              productName: productA.name,
              productSku: productA.sku,
              merchantName: 'Studio Isla',
              quantity: 1,
              unitPrice: new Prisma.Decimal('1200.00'),
              subtotal: new Prisma.Decimal('1200.00'),
              total: new Prisma.Decimal('1200.00'),
            },
            {
              productId: productB.id,
              merchantId: merchantBId,
              productName: productB.name,
              productSku: productB.sku,
              merchantName: 'North Goods',
              quantity: 1,
              unitPrice: new Prisma.Decimal('850.00'),
              subtotal: new Prisma.Decimal('850.00'),
              total: new Prisma.Decimal('850.00'),
            },
          ],
        },
        payments: {
          create: {
            method: PaymentMethod.CASH,
            amount: new Prisma.Decimal('2050.00'),
            confirmedById: ownerId,
            paidAt: new Date(),
          },
        },
      },
    });

    for (const [agreementId, merchantId, rent] of [
      [agreementAId, merchantAId, '2500.00'],
      [agreementBId, merchantBId, '1800.00'],
    ] as const) {
      const agreement = await prisma.merchantAgreement.findUniqueOrThrow({
        where: { id: agreementId },
      });
      for (let cycle = 0; cycle < 3; cycle += 1) {
        const periodStart = addMonths(agreement.startDate, cycle);
        const periodEnd = previousDate(
          addMonths(agreement.startDate, cycle + 1),
        );
        const existing = await prisma.merchantReceivable.findFirst({
          where: { organizationId, agreementId, cycleNumber: cycle + 1 },
        });
        if (existing) continue;
        const remaining = new Prisma.Decimal(rent).sub(
          merchantId === merchantAId && cycle === 0
            ? new Prisma.Decimal('500.00')
            : new Prisma.Decimal(0),
        );
        const receivable = await prisma.merchantReceivable.create({
          data: {
            organizationId,
            merchantId,
            agreementId,
            sourcePeriod: periodStart,
            periodStart,
            periodEnd,
            cycleNumber: cycle + 1,
            originalAmount: new Prisma.Decimal(rent),
            remainingAmount: remaining,
            dueDate: periodStart,
            status: remaining.eq(0)
              ? MerchantReceivableStatus.PAID
              : remaining.lt(new Prisma.Decimal(rent))
                ? MerchantReceivableStatus.PARTIALLY_PAID
                : MerchantReceivableStatus.OPEN,
          },
        });
        if (merchantId === merchantAId && cycle === 0) {
          await prisma.merchantReceivableTransaction.create({
            data: {
              organizationId,
              merchantId,
              receivableId: receivable.id,
              type: MerchantReceivableTransactionType.PAYMENT,
              amount: new Prisma.Decimal('500.00'),
              paymentMethod: PaymentMethod.CASH,
              note: 'Demo partial direct rent payment',
              recordedById: ownerId,
              occurredAt: new Date(),
            },
          });
        }
      }
    }
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
