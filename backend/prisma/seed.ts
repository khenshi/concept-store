import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { hash } from 'bcryptjs';
import {
  AgreementPrepaymentKind,
  AgreementPrepaymentTransactionType,
  AgreementStatus,
  InventoryMovementType,
  MerchantFinanceAccrualKind,
  MerchantReceivableStatus,
  MerchantReceivableTransactionType,
  MerchantStatus,
  OrganizationRole,
  PaymentMethod,
  PayoutMethod,
  Prisma,
  ProductStatus,
  RefundStatus,
  SaleStatus,
  SettlementAuditEventType,
  SettlementSchedule,
  SettlementStatus,
  SpaceStatus,
  SpaceType,
} from '../src/generated/prisma/client';
import { PrismaClient } from '../src/generated/prisma/client';

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
    isla: '00000000-0000-4000-8000-000000000031',
    north: '00000000-0000-4000-8000-000000000032',
    bahay: '00000000-0000-4000-8000-000000000033',
  },
  agreements: {
    isla: '00000000-0000-4000-8000-000000000041',
    north: '00000000-0000-4000-8000-000000000042',
    bahay: '00000000-0000-4000-8000-000000000043',
  },
  products: {
    islaTote: '00000000-0000-4000-8000-000000000051',
    islaCandle: '00000000-0000-4000-8000-000000000052',
    northMug: '00000000-0000-4000-8000-000000000053',
    northTray: '00000000-0000-4000-8000-000000000054',
    bahaySoap: '00000000-0000-4000-8000-000000000055',
    bahayVase: '00000000-0000-4000-8000-000000000056',
  },
  sales: {
    isla: '00000000-0000-4000-8000-000000000061',
    north: '00000000-0000-4000-8000-000000000062',
    mixed: '00000000-0000-4000-8000-000000000063',
    bahay: '00000000-0000-4000-8000-000000000064',
  },
  spaces: {
    islaRack: '00000000-0000-4000-8000-000000000071',
    islaShelf: '00000000-0000-4000-8000-000000000072',
    northShelf: '00000000-0000-4000-8000-000000000073',
    sharedCabinet: '00000000-0000-4000-8000-000000000074',
    bahayBooth: '00000000-0000-4000-8000-000000000075',
    emptyTable: '00000000-0000-4000-8000-000000000076',
  },
  refunds: {
    mixedSale: '00000000-0000-4000-8000-000000000181',
  },
  settlements: {
    isla: '00000000-0000-4000-8000-000000000201',
    north: '00000000-0000-4000-8000-000000000202',
    bahay: '00000000-0000-4000-8000-000000000203',
  },
} as const;

function decimal(value: string): Prisma.Decimal {
  return new Prisma.Decimal(value);
}

function dateOnly(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

function startOfMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function addDays(anchor: Date, days: number): Date {
  const result = new Date(anchor);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
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
  return addDays(date, -1);
}

function atHour(date: Date, hour: number): Date {
  const result = new Date(date);
  result.setUTCHours(hour, 0, 0, 0);
  return result;
}

function assertSafeEnvironment(resetRequested: boolean): void {
  const runtimeEnvironment = process.env.NODE_ENV ?? 'development';
  const explicitlyAllowed = process.env.SEED_DEMO_DATA === '1';

  if (
    !['development', 'test'].includes(runtimeEnvironment) &&
    !explicitlyAllowed
  ) {
    throw new Error(
      'Demo seed is restricted to development/test. Set SEED_DEMO_DATA=1 explicitly to override.',
    );
  }

  if (resetRequested) {
    console.warn(
      'The demo reset will permanently remove all application data and preserve only Prisma migration history.',
    );
  }
}

/**
 * Reset every application table without dropping the schema or migration history.
 * Table names come from PostgreSQL metadata and are identifier-quoted by format().
 */
async function resetDatabase(prisma: PrismaClient): Promise<void> {
  await prisma.$executeRawUnsafe(`
    DO $$
    DECLARE
      table_record RECORD;
    BEGIN
      FOR table_record IN
        SELECT tablename
        FROM pg_catalog.pg_tables
        WHERE schemaname = 'public'
          AND tablename <> '_prisma_migrations'
      LOOP
        EXECUTE format(
          'TRUNCATE TABLE %I.%I RESTART IDENTITY CASCADE',
          'public',
          table_record.tablename
        );
      END LOOP;
    END $$;
  `);
}

async function createDemoUsers(
  prisma: PrismaClient,
  passwordHash: string,
): Promise<void> {
  const users = [
    {
      id: ids.users.owner,
      email: 'owner.demo@example.com',
      firstName: 'Demo',
      lastName: 'Owner',
      role: OrganizationRole.OWNER,
    },
    {
      id: ids.users.manager,
      email: 'manager.demo@example.com',
      firstName: 'Demo',
      lastName: 'Manager',
      role: OrganizationRole.MANAGER,
    },
    {
      id: ids.users.cashier,
      email: 'cashier.demo@example.com',
      firstName: 'Demo',
      lastName: 'Cashier',
      role: OrganizationRole.CASHIER,
    },
    {
      id: ids.users.merchant,
      email: 'merchant.demo@example.com',
      firstName: 'Demo',
      lastName: 'Merchant',
      role: OrganizationRole.MERCHANT,
    },
  ];

  for (const user of users) {
    await prisma.user.create({
      data: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        passwordHash,
      },
    });
    await prisma.organizationMembership.create({
      data: {
        organizationId: ids.organization,
        userId: user.id,
        role: user.role,
      },
    });
  }
}

async function createDemoMerchants(
  prisma: PrismaClient,
  activation: Date,
  scheduledEndDate: Date,
): Promise<void> {
  const merchants = [
    {
      id: ids.merchants.isla,
      name: 'Studio Isla',
      code: 'ISLA',
      contactName: 'Isabela Cruz',
      email: 'isla.demo@example.com',
      phone: '+639171234501',
      branchIds: [ids.branches.makati],
      agreementId: ids.agreements.isla,
      rent: '2500.00',
      commission: '5.00',
      securityDeposit: '5000.00',
      firstRent: true,
    },
    {
      id: ids.merchants.north,
      name: 'North Goods',
      code: 'NORTH',
      contactName: 'Nico Santos',
      email: 'north.demo@example.com',
      phone: '+639171234502',
      branchIds: [ids.branches.makati],
      agreementId: ids.agreements.north,
      rent: '1800.00',
      commission: '7.50',
      securityDeposit: '3600.00',
      firstRent: false,
    },
    {
      id: ids.merchants.bahay,
      name: 'Bahay Objects',
      code: 'BAHAY',
      contactName: 'Bea Mercado',
      email: 'bahay.demo@example.com',
      phone: '+639171234503',
      branchIds: [ids.branches.bgc],
      agreementId: ids.agreements.bahay,
      rent: '1500.00',
      commission: '10.00',
      securityDeposit: null,
      firstRent: false,
    },
  ] as const;

  for (const merchant of merchants) {
    await prisma.merchant.create({
      data: {
        id: merchant.id,
        organizationId: ids.organization,
        name: merchant.name,
        code: merchant.code,
        contactName: merchant.contactName,
        email: merchant.email,
        phone: merchant.phone,
        status: MerchantStatus.ACTIVE,
      },
    });

    for (const branchId of merchant.branchIds) {
      await prisma.merchantBranch.create({
        data: {
          organizationId: ids.organization,
          merchantId: merchant.id,
          branchId,
        },
      });
    }

    await prisma.merchantAgreement.create({
      data: {
        id: merchant.agreementId,
        organizationId: ids.organization,
        merchantId: merchant.id,
        activationAt: activation,
        startDate: activation,
        endDate: previousDate(scheduledEndDate),
        durationMonths: 12,
        activatedAt: atHour(activation, 2),
        scheduledEndDate,
        submittedAt: atHour(previousDate(activation), 2),
        submittedById: ids.users.manager,
        approvedAt: atHour(previousDate(activation), 4),
        approvedById: ids.users.owner,
        lastActivationAttemptAt: atHour(activation, 2),
        fixedRentAmount: decimal(merchant.rent),
        commissionRate: decimal(merchant.commission),
        securityDepositAmount: merchant.securityDeposit
          ? decimal(merchant.securityDeposit)
          : undefined,
        firstRentPaymentRequired: merchant.firstRent,
        rentDueWeek: 'FIRST',
        rentDueWeekday: 'MONDAY',
        settlementSchedule: SettlementSchedule.MONTHLY,
        status: AgreementStatus.ACTIVE,
      },
    });
  }

  await prisma.merchantAccount.create({
    data: {
      organizationId: ids.organization,
      userId: ids.users.merchant,
      merchantId: ids.merchants.isla,
    },
  });
}

async function createDemoSpacesAndPrepayments(
  prisma: PrismaClient,
  activation: Date,
  scheduledEndDate: Date,
  now: Date,
): Promise<void> {
  const spaces = [
    {
      id: ids.spaces.islaRack,
      branchId: ids.branches.makati,
      code: 'MAK-R01',
      name: 'Front rack 01',
      type: SpaceType.RACK,
    },
    {
      id: ids.spaces.islaShelf,
      branchId: ids.branches.makati,
      code: 'MAK-S01',
      name: 'Window shelf 01',
      type: SpaceType.SHELF,
    },
    {
      id: ids.spaces.northShelf,
      branchId: ids.branches.makati,
      code: 'MAK-S02',
      name: 'Window shelf 02',
      type: SpaceType.SHELF,
    },
    {
      id: ids.spaces.sharedCabinet,
      branchId: ids.branches.makati,
      code: 'MAK-C01',
      name: 'Checkout cabinet',
      type: SpaceType.CABINET,
    },
    {
      id: ids.spaces.bahayBooth,
      branchId: ids.branches.bgc,
      code: 'BGC-B01',
      name: 'Lifestyle booth 01',
      type: SpaceType.BOOTH,
    },
    {
      id: ids.spaces.emptyTable,
      branchId: ids.branches.bgc,
      code: 'BGC-T01',
      name: 'Pop-up table 01',
      type: SpaceType.TABLE,
    },
  ] as const;

  for (const space of spaces) {
    await prisma.space.create({
      data: {
        id: space.id,
        organizationId: ids.organization,
        branchId: space.branchId,
        code: space.code,
        name: space.name,
        type: space.type,
        status: SpaceStatus.ACTIVE,
      },
    });
  }

  const assignments = [
    {
      spaceId: ids.spaces.islaRack,
      merchantId: ids.merchants.isla,
      agreementId: ids.agreements.isla,
      branchId: ids.branches.makati,
    },
    {
      spaceId: ids.spaces.islaShelf,
      merchantId: ids.merchants.isla,
      agreementId: ids.agreements.isla,
      branchId: ids.branches.makati,
    },
    {
      spaceId: ids.spaces.northShelf,
      merchantId: ids.merchants.north,
      agreementId: ids.agreements.north,
      branchId: ids.branches.makati,
    },
    {
      spaceId: ids.spaces.bahayBooth,
      merchantId: ids.merchants.bahay,
      agreementId: ids.agreements.bahay,
      branchId: ids.branches.bgc,
    },
  ] as const;

  for (const [index, assignment] of assignments.entries()) {
    await prisma.spaceAssignment.create({
      data: {
        id: `00000000-0000-4000-8000-00000000009${index + 1}`,
        organizationId: ids.organization,
        branchId: assignment.branchId,
        spaceId: assignment.spaceId,
        merchantId: assignment.merchantId,
        agreementId: assignment.agreementId,
        startDate: activation,
        endDate: previousDate(scheduledEndDate),
      },
    });
    await prisma.merchantAgreementSpace.create({
      data: {
        id: `00000000-0000-4000-8000-00000000008${index + 1}`,
        organizationId: ids.organization,
        branchId: assignment.branchId,
        agreementId: assignment.agreementId,
        spaceId: assignment.spaceId,
        periodStart: activation,
        periodEnd: previousDate(scheduledEndDate),
      },
    });
  }

  const prepayments = [
    {
      id: '00000000-0000-4000-8000-000000000101',
      merchantId: ids.merchants.isla,
      agreementId: ids.agreements.isla,
      kind: AgreementPrepaymentKind.SECURITY_DEPOSIT,
      amount: '5000.00',
      transactionId: '00000000-0000-4000-8000-000000000111',
      referenceNumber: 'DEMO-DEP-ISLA',
      method: PaymentMethod.GCASH,
    },
    {
      id: '00000000-0000-4000-8000-000000000102',
      merchantId: ids.merchants.isla,
      agreementId: ids.agreements.isla,
      kind: AgreementPrepaymentKind.FIRST_RENT,
      amount: '2500.00',
      transactionId: '00000000-0000-4000-8000-000000000112',
      referenceNumber: null,
      method: PaymentMethod.CASH,
    },
    {
      id: '00000000-0000-4000-8000-000000000103',
      merchantId: ids.merchants.north,
      agreementId: ids.agreements.north,
      kind: AgreementPrepaymentKind.SECURITY_DEPOSIT,
      amount: '3600.00',
      transactionId: '00000000-0000-4000-8000-000000000113',
      referenceNumber: 'DEMO-DEP-NORTH',
      method: PaymentMethod.BANK_TRANSFER,
    },
  ] as const;

  for (const prepayment of prepayments) {
    const record = await prisma.agreementPrepayment.create({
      data: {
        id: prepayment.id,
        organizationId: ids.organization,
        merchantId: prepayment.merchantId,
        agreementId: prepayment.agreementId,
        kind: prepayment.kind,
        requiredAmount: decimal(prepayment.amount),
        appliedAt:
          prepayment.kind === AgreementPrepaymentKind.FIRST_RENT ? now : null,
      },
    });
    await prisma.agreementPrepaymentTransaction.create({
      data: {
        id: prepayment.transactionId,
        organizationId: ids.organization,
        merchantId: prepayment.merchantId,
        prepaymentId: record.id,
        type: AgreementPrepaymentTransactionType.COLLECTION,
        amount: decimal(prepayment.amount),
        paymentMethod: prepayment.method,
        referenceNumber: prepayment.referenceNumber,
        reason: 'Demo agreement prepayment collection',
        occurredAt: atHour(activation, 5),
        recordedById: ids.users.owner,
      },
    });
  }
}

async function createDemoProductsAndInventory(
  prisma: PrismaClient,
): Promise<void> {
  const products = [
    {
      id: ids.products.islaTote,
      merchantId: ids.merchants.isla,
      name: 'Isla Linen Tote',
      sku: 'DEMO-ISLA-TOTE',
      barcode: '4800000000511',
      price: '1200.00',
      branchId: ids.branches.makati,
      quantity: 16,
    },
    {
      id: ids.products.islaCandle,
      merchantId: ids.merchants.isla,
      name: 'Isla Scented Candle',
      sku: 'DEMO-ISLA-CANDLE',
      barcode: '4800000000528',
      price: '650.00',
      branchId: ids.branches.makati,
      quantity: 9,
    },
    {
      id: ids.products.northMug,
      merchantId: ids.merchants.north,
      name: 'North Ceramic Mug',
      sku: 'DEMO-NORTH-MUG',
      barcode: '4800000000535',
      price: '850.00',
      branchId: ids.branches.makati,
      quantity: 8,
    },
    {
      id: ids.products.northTray,
      merchantId: ids.merchants.north,
      name: 'North Acacia Tray',
      sku: 'DEMO-NORTH-TRAY',
      barcode: '4800000000542',
      price: '1450.00',
      branchId: ids.branches.makati,
      quantity: 5,
    },
    {
      id: ids.products.bahaySoap,
      merchantId: ids.merchants.bahay,
      name: 'Bahay Handcrafted Soap',
      sku: 'DEMO-BAHAY-SOAP',
      barcode: '4800000000559',
      price: '420.00',
      branchId: ids.branches.bgc,
      quantity: 23,
    },
    {
      id: ids.products.bahayVase,
      merchantId: ids.merchants.bahay,
      name: 'Bahay Terracotta Vase',
      sku: 'DEMO-BAHAY-VASE',
      barcode: '4800000000566',
      price: '1600.00',
      branchId: ids.branches.bgc,
      quantity: 4,
    },
  ] as const;

  for (const product of products) {
    await prisma.product.create({
      data: {
        id: product.id,
        organizationId: ids.organization,
        merchantId: product.merchantId,
        name: product.name,
        sku: product.sku,
        barcode: product.barcode,
        sellingPrice: decimal(product.price),
        status: ProductStatus.ACTIVE,
      },
    });
    await prisma.inventory.create({
      data: {
        organizationId: ids.organization,
        branchId: product.branchId,
        productId: product.id,
        quantity: product.quantity,
      },
    });
  }
}

async function createDemoSales(
  prisma: PrismaClient,
  previousMonthSaleDate: Date,
  previousMonthNorthSaleDate: Date,
  currentSaleDate: Date,
  previousMonthBahaySaleDate: Date,
): Promise<void> {
  await prisma.sale.create({
    data: {
      id: ids.sales.isla,
      organizationId: ids.organization,
      branchId: ids.branches.makati,
      cashierId: ids.users.cashier,
      saleNumber: 'DEMO-0001',
      clientTransactionId: 'demo-client-0001',
      subtotal: decimal('6100.00'),
      total: decimal('6100.00'),
      status: SaleStatus.COMPLETED,
      completedAt: previousMonthSaleDate,
      createdAt: previousMonthSaleDate,
      items: {
        create: [
          {
            id: '00000000-0000-4000-8000-000000000161',
            productId: ids.products.islaTote,
            merchantId: ids.merchants.isla,
            productName: 'Isla Linen Tote',
            productSku: 'DEMO-ISLA-TOTE',
            productBarcode: '4800000000511',
            merchantName: 'Studio Isla',
            quantity: 4,
            unitPrice: decimal('1200.00'),
            subtotal: decimal('4800.00'),
            total: decimal('4800.00'),
          },
          {
            id: '00000000-0000-4000-8000-000000000162',
            productId: ids.products.islaCandle,
            merchantId: ids.merchants.isla,
            productName: 'Isla Scented Candle',
            productSku: 'DEMO-ISLA-CANDLE',
            productBarcode: '4800000000528',
            merchantName: 'Studio Isla',
            quantity: 2,
            unitPrice: decimal('650.00'),
            subtotal: decimal('1300.00'),
            total: decimal('1300.00'),
          },
        ],
      },
      payments: {
        create: {
          method: PaymentMethod.CASH,
          amount: decimal('6100.00'),
          confirmedById: ids.users.cashier,
          paidAt: previousMonthSaleDate,
        },
      },
    },
  });

  await prisma.sale.create({
    data: {
      id: ids.sales.north,
      organizationId: ids.organization,
      branchId: ids.branches.makati,
      cashierId: ids.users.cashier,
      saleNumber: 'DEMO-0002',
      clientTransactionId: 'demo-client-0002',
      subtotal: decimal('3150.00'),
      total: decimal('3150.00'),
      status: SaleStatus.COMPLETED,
      completedAt: previousMonthNorthSaleDate,
      createdAt: previousMonthNorthSaleDate,
      items: {
        create: [
          {
            id: '00000000-0000-4000-8000-000000000163',
            productId: ids.products.northMug,
            merchantId: ids.merchants.north,
            productName: 'North Ceramic Mug',
            productSku: 'DEMO-NORTH-MUG',
            productBarcode: '4800000000535',
            merchantName: 'North Goods',
            quantity: 2,
            unitPrice: decimal('850.00'),
            subtotal: decimal('1700.00'),
            total: decimal('1700.00'),
          },
          {
            id: '00000000-0000-4000-8000-000000000164',
            productId: ids.products.northTray,
            merchantId: ids.merchants.north,
            productName: 'North Acacia Tray',
            productSku: 'DEMO-NORTH-TRAY',
            productBarcode: '4800000000542',
            merchantName: 'North Goods',
            quantity: 1,
            unitPrice: decimal('1450.00'),
            subtotal: decimal('1450.00'),
            total: decimal('1450.00'),
          },
        ],
      },
      payments: {
        create: {
          method: PaymentMethod.GCASH,
          amount: decimal('3150.00'),
          referenceNumber: 'GCASH-DEMO-0002',
          confirmedById: ids.users.cashier,
          paidAt: previousMonthNorthSaleDate,
        },
      },
    },
  });

  await prisma.sale.create({
    data: {
      id: ids.sales.mixed,
      organizationId: ids.organization,
      branchId: ids.branches.makati,
      cashierId: ids.users.cashier,
      saleNumber: 'DEMO-0003',
      clientTransactionId: 'demo-client-0003',
      subtotal: decimal('2340.00'),
      total: decimal('2340.00'),
      status: SaleStatus.COMPLETED,
      completedAt: currentSaleDate,
      createdAt: currentSaleDate,
      items: {
        create: [
          {
            id: '00000000-0000-4000-8000-000000000165',
            productId: ids.products.islaCandle,
            merchantId: ids.merchants.isla,
            productName: 'Isla Scented Candle',
            productSku: 'DEMO-ISLA-CANDLE',
            productBarcode: '4800000000528',
            merchantName: 'Studio Isla',
            quantity: 1,
            unitPrice: decimal('650.00'),
            subtotal: decimal('650.00'),
            total: decimal('650.00'),
          },
          {
            id: '00000000-0000-4000-8000-000000000166',
            productId: ids.products.northMug,
            merchantId: ids.merchants.north,
            productName: 'North Ceramic Mug',
            productSku: 'DEMO-NORTH-MUG',
            productBarcode: '4800000000535',
            merchantName: 'North Goods',
            quantity: 1,
            unitPrice: decimal('850.00'),
            subtotal: decimal('850.00'),
            total: decimal('850.00'),
          },
          {
            id: '00000000-0000-4000-8000-000000000167',
            productId: ids.products.bahaySoap,
            merchantId: ids.merchants.bahay,
            productName: 'Bahay Handcrafted Soap',
            productSku: 'DEMO-BAHAY-SOAP',
            productBarcode: '4800000000559',
            merchantName: 'Bahay Objects',
            quantity: 2,
            unitPrice: decimal('420.00'),
            subtotal: decimal('840.00'),
            total: decimal('840.00'),
          },
        ],
      },
      payments: {
        create: {
          method: PaymentMethod.BANK_TRANSFER,
          amount: decimal('2340.00'),
          referenceNumber: 'BANK-DEMO-0003',
          confirmedById: ids.users.owner,
          paidAt: currentSaleDate,
        },
      },
    },
  });

  await prisma.sale.create({
    data: {
      id: ids.sales.bahay,
      organizationId: ids.organization,
      branchId: ids.branches.bgc,
      cashierId: ids.users.cashier,
      saleNumber: 'DEMO-0004',
      clientTransactionId: 'demo-client-0004',
      subtotal: decimal('1600.00'),
      total: decimal('1600.00'),
      status: SaleStatus.COMPLETED,
      completedAt: previousMonthBahaySaleDate,
      createdAt: previousMonthBahaySaleDate,
      items: {
        create: {
          id: '00000000-0000-4000-8000-000000000168',
          productId: ids.products.bahayVase,
          merchantId: ids.merchants.bahay,
          productName: 'Bahay Terracotta Vase',
          productSku: 'DEMO-BAHAY-VASE',
          productBarcode: '4800000000566',
          merchantName: 'Bahay Objects',
          quantity: 1,
          unitPrice: decimal('1600.00'),
          subtotal: decimal('1600.00'),
          total: decimal('1600.00'),
        },
      },
      payments: {
        create: {
          method: PaymentMethod.CASH,
          amount: decimal('1600.00'),
          confirmedById: ids.users.cashier,
          paidAt: previousMonthBahaySaleDate,
        },
      },
    },
  });

  await prisma.saleRefund.create({
    data: {
      id: ids.refunds.mixedSale,
      organizationId: ids.organization,
      branchId: ids.branches.makati,
      saleId: ids.sales.mixed,
      reason: 'Demo customer return',
      status: RefundStatus.COMPLETED,
      completedById: ids.users.manager,
      completedAt: atHour(currentSaleDate, 12),
      createdAt: atHour(currentSaleDate, 12),
      items: {
        create: {
          id: '00000000-0000-4000-8000-000000000191',
          saleItemId: '00000000-0000-4000-8000-000000000166',
          merchantId: ids.merchants.north,
          quantity: 1,
          amount: decimal('850.00'),
        },
      },
    },
  });
}

async function createDemoInventoryMovements(
  prisma: PrismaClient,
  previousMonthSaleDate: Date,
  previousMonthNorthSaleDate: Date,
  currentSaleDate: Date,
  previousMonthBahaySaleDate: Date,
): Promise<void> {
  const stockIn = [
    [ids.products.islaTote, ids.branches.makati, 20, 'Initial demo stock'],
    [ids.products.islaCandle, ids.branches.makati, 12, 'Initial demo stock'],
    [ids.products.northMug, ids.branches.makati, 10, 'Initial demo stock'],
    [ids.products.northTray, ids.branches.makati, 6, 'Initial demo stock'],
    [ids.products.bahaySoap, ids.branches.bgc, 25, 'Initial demo stock'],
    [ids.products.bahayVase, ids.branches.bgc, 5, 'Initial demo stock'],
  ] as const;

  for (const [
    index,
    [productId, branchId, quantity, note],
  ] of stockIn.entries()) {
    await prisma.inventoryMovement.create({
      data: {
        id: `00000000-0000-4000-8000-00000000012${index + 1}`,
        organizationId: ids.organization,
        branchId,
        productId,
        quantityChange: quantity,
        type: InventoryMovementType.STOCK_IN,
        referenceId: `DEMO-STOCK-${index + 1}`,
        note,
        createdById: ids.users.manager,
        createdAt: atHour(previousMonthSaleDate, 1),
      },
    });
  }

  const salesMovements = [
    [
      ids.products.islaTote,
      ids.branches.makati,
      -4,
      ids.sales.isla,
      previousMonthSaleDate,
    ],
    [
      ids.products.islaCandle,
      ids.branches.makati,
      -2,
      ids.sales.isla,
      previousMonthSaleDate,
    ],
    [
      ids.products.northMug,
      ids.branches.makati,
      -2,
      ids.sales.north,
      previousMonthNorthSaleDate,
    ],
    [
      ids.products.northTray,
      ids.branches.makati,
      -1,
      ids.sales.north,
      previousMonthNorthSaleDate,
    ],
    [
      ids.products.islaCandle,
      ids.branches.makati,
      -1,
      ids.sales.mixed,
      currentSaleDate,
    ],
    [
      ids.products.northMug,
      ids.branches.makati,
      -1,
      ids.sales.mixed,
      currentSaleDate,
    ],
    [
      ids.products.bahaySoap,
      ids.branches.bgc,
      -2,
      ids.sales.mixed,
      currentSaleDate,
    ],
    [
      ids.products.bahayVase,
      ids.branches.bgc,
      -1,
      ids.sales.bahay,
      previousMonthBahaySaleDate,
    ],
  ] as const;

  for (const [
    index,
    [productId, branchId, quantityChange, saleId, createdAt],
  ] of salesMovements.entries()) {
    await prisma.inventoryMovement.create({
      data: {
        id: `00000000-0000-4000-8000-00000000013${index + 1}`,
        organizationId: ids.organization,
        branchId,
        productId,
        quantityChange,
        type: InventoryMovementType.SALE,
        referenceId: saleId,
        saleId,
        createdById: ids.users.cashier,
        createdAt,
      },
    });
  }

  await prisma.inventoryMovement.create({
    data: {
      id: '00000000-0000-4000-8000-000000000141',
      organizationId: ids.organization,
      branchId: ids.branches.makati,
      productId: ids.products.northMug,
      quantityChange: 1,
      type: InventoryMovementType.RETURN,
      referenceId: ids.refunds.mixedSale,
      note: 'Demo returned item restocked',
      createdById: ids.users.manager,
      createdAt: atHour(currentSaleDate, 12),
    },
  });
}

async function createDemoReceivables(
  prisma: PrismaClient,
  activation: Date,
  now: Date,
): Promise<void> {
  const receivableInputs = [
    [ids.merchants.isla, ids.agreements.isla, '2500.00'],
    [ids.merchants.north, ids.agreements.north, '1800.00'],
    [ids.merchants.bahay, ids.agreements.bahay, '1500.00'],
  ] as const;

  for (const [merchantId, agreementId, amount] of receivableInputs) {
    for (let cycle = 1; cycle <= 5; cycle += 1) {
      const periodStart = addMonths(activation, cycle - 1);
      const periodEnd = previousDate(addMonths(activation, cycle));
      const partiallyPaid = merchantId === ids.merchants.isla && cycle === 1;
      const remainingAmount = partiallyPaid
        ? decimal(amount).sub(decimal('500.00'))
        : decimal(amount);
      const receivable = await prisma.merchantReceivable.create({
        data: {
          organizationId: ids.organization,
          merchantId,
          agreementId,
          sourcePeriod: periodStart,
          periodStart,
          periodEnd,
          cycleNumber: cycle,
          originalAmount: decimal(amount),
          remainingAmount,
          dueDate: periodStart,
          status: partiallyPaid
            ? MerchantReceivableStatus.PARTIALLY_PAID
            : MerchantReceivableStatus.OPEN,
        },
      });

      if (partiallyPaid) {
        await prisma.merchantReceivableTransaction.create({
          data: {
            organizationId: ids.organization,
            merchantId,
            receivableId: receivable.id,
            type: MerchantReceivableTransactionType.PAYMENT,
            amount: decimal('500.00'),
            paymentMethod: PaymentMethod.CASH,
            note: 'Demo partial direct rent payment',
            recordedById: ids.users.owner,
            occurredAt: atHour(addMonths(activation, 1), 5),
          },
        });
      }
    }
  }
}

async function createDemoSettlements(
  prisma: PrismaClient,
  periodStart: Date,
  periodEnd: Date,
  now: Date,
): Promise<void> {
  const settlements = [
    {
      id: ids.settlements.isla,
      merchantId: ids.merchants.isla,
      agreementId: ids.agreements.isla,
      grossSales: '6100.00',
      commission: '305.00',
      rent: '2500.00',
      adjustment: '-100.00',
      netPayout: '3195.00',
      status: SettlementStatus.PAID,
      saleItemIds: [
        '00000000-0000-4000-8000-000000000161',
        '00000000-0000-4000-8000-000000000162',
      ],
      termSnapshotId: '00000000-0000-4000-8000-000000000211',
      payoutId: '00000000-0000-4000-8000-000000000251',
      auditId: '00000000-0000-4000-8000-000000000261',
      commissionRate: '5.00',
      payoutMethod: PayoutMethod.BANK_TRANSFER,
      payoutReference: 'DEMO-PAYOUT-ISLA',
    },
    {
      id: ids.settlements.north,
      merchantId: ids.merchants.north,
      agreementId: ids.agreements.north,
      grossSales: '3150.00',
      commission: '236.25',
      rent: '1800.00',
      adjustment: '0.00',
      netPayout: '1113.75',
      status: SettlementStatus.APPROVED,
      saleItemIds: [
        '00000000-0000-4000-8000-000000000163',
        '00000000-0000-4000-8000-000000000164',
      ],
      termSnapshotId: '00000000-0000-4000-8000-000000000212',
      payoutId: null,
      auditId: '00000000-0000-4000-8000-000000000262',
      commissionRate: '7.50',
      payoutMethod: null,
      payoutReference: null,
    },
    {
      id: ids.settlements.bahay,
      merchantId: ids.merchants.bahay,
      agreementId: ids.agreements.bahay,
      grossSales: '1600.00',
      commission: '160.00',
      rent: '1500.00',
      adjustment: '0.00',
      netPayout: '-60.00',
      status: SettlementStatus.DRAFT,
      saleItemIds: ['00000000-0000-4000-8000-000000000168'],
      termSnapshotId: '00000000-0000-4000-8000-000000000213',
      payoutId: null,
      auditId: '00000000-0000-4000-8000-000000000263',
      commissionRate: '10.00',
      payoutMethod: null,
      payoutReference: null,
    },
  ] as const;

  for (const settlement of settlements) {
    const reviewed = settlement.status !== SettlementStatus.DRAFT;
    const approved =
      settlement.status === SettlementStatus.APPROVED ||
      settlement.status === SettlementStatus.PAID;
    await prisma.merchantSettlement.create({
      data: {
        id: settlement.id,
        organizationId: ids.organization,
        merchantId: settlement.merchantId,
        periodStart,
        periodEnd,
        scheduledDeadline: periodEnd,
        schedule: SettlementSchedule.MONTHLY,
        status: settlement.status,
        grossSales: decimal(settlement.grossSales),
        refundTotal: decimal('0.00'),
        netSales: decimal(settlement.grossSales),
        commissionAmount: decimal(settlement.commission),
        fixedRentAmount: decimal(settlement.rent),
        adjustmentTotal: decimal(settlement.adjustment),
        netPayout: decimal(settlement.netPayout),
        calculatedById: ids.users.manager,
        calculatedAt: atHour(addDays(now, -2), 5),
        reviewedById: reviewed ? ids.users.manager : null,
        reviewedAt: reviewed ? atHour(addDays(now, -2), 6) : null,
        approvedById: approved ? ids.users.owner : null,
        approvedAt: approved ? atHour(addDays(now, -1), 6) : null,
      },
    });

    await prisma.settlementTermSnapshot.create({
      data: {
        id: settlement.termSnapshotId,
        organizationId: ids.organization,
        merchantId: settlement.merchantId,
        settlementId: settlement.id,
        agreementId: settlement.agreementId,
        segmentStart: periodStart,
        segmentEnd: periodEnd,
        schedule: SettlementSchedule.MONTHLY,
        fixedRentRate: decimal(settlement.rent),
        commissionRate: decimal(settlement.commissionRate),
        grossSales: decimal(settlement.grossSales),
        refundTotal: decimal('0.00'),
        netSales: decimal(settlement.grossSales),
        commissionAmount: decimal(settlement.commission),
      },
    });

    for (const [index, saleItemId] of settlement.saleItemIds.entries()) {
      const amounts =
        settlement.id === ids.settlements.isla
          ? ['4800.00', '1300.00']
          : settlement.id === ids.settlements.north
            ? ['1700.00', '1450.00']
            : ['1600.00'];
      await prisma.settlementSaleItem.create({
        data: {
          organizationId: ids.organization,
          merchantId: settlement.merchantId,
          settlementId: settlement.id,
          termSnapshotId: settlement.termSnapshotId,
          saleItemId,
          grossAmount: decimal(amounts[index]),
        },
      });
    }

    await prisma.settlementAuditEvent.create({
      data: {
        id: settlement.auditId,
        organizationId: ids.organization,
        settlementId: settlement.id,
        actorId: ids.users.manager,
        type: SettlementAuditEventType.MANUALLY_GENERATED,
        reason: 'Demo settlement generated for the previous month',
        createdAt: atHour(addDays(now, -2), 5),
      },
    });

    if (approved) {
      await prisma.settlementAuditEvent.create({
        data: {
          organizationId: ids.organization,
          settlementId: settlement.id,
          actorId: ids.users.owner,
          type: SettlementAuditEventType.APPROVED,
          createdAt: atHour(addDays(now, -1), 6),
        },
      });
    }

    if (settlement.adjustment !== '0.00') {
      await prisma.merchantFinanceEntry.create({
        data: {
          id: '00000000-0000-4000-8000-000000000241',
          organizationId: ids.organization,
          merchantId: settlement.merchantId,
          settlementId: settlement.id,
          amount: decimal(settlement.adjustment),
          reason: 'Demo packaging adjustment',
          occurredAt: atHour(addDays(now, -2), 5),
          createdById: ids.users.manager,
        },
      });
    }

    if (
      settlement.payoutId &&
      settlement.payoutMethod &&
      settlement.payoutReference
    ) {
      await prisma.merchantPayout.create({
        data: {
          id: settlement.payoutId,
          organizationId: ids.organization,
          merchantId: settlement.merchantId,
          settlementId: settlement.id,
          amount: decimal(settlement.netPayout),
          method: settlement.payoutMethod,
          referenceNumber: settlement.payoutReference,
          note: 'Demo payout record',
          paidAt: atHour(addDays(now, -1), 7),
          recordedById: ids.users.owner,
        },
      });
      await prisma.settlementAuditEvent.create({
        data: {
          organizationId: ids.organization,
          settlementId: settlement.id,
          actorId: ids.users.owner,
          type: SettlementAuditEventType.PAYOUT_RECORDED,
          createdAt: atHour(addDays(now, -1), 7),
        },
      });
    }
  }
}

async function createDemoFinanceAccruals(
  prisma: PrismaClient,
  currentPeriodStart: Date,
  today: Date,
): Promise<void> {
  const accruals = [
    {
      id: '00000000-0000-4000-8000-000000000271',
      merchantId: ids.merchants.isla,
      agreementId: ids.agreements.isla,
      commissionRate: '5.00',
      grossSales: '650.00',
      refundTotal: '0.00',
      commissionAmount: '32.50',
    },
    {
      id: '00000000-0000-4000-8000-000000000272',
      merchantId: ids.merchants.north,
      agreementId: ids.agreements.north,
      commissionRate: '7.50',
      grossSales: '850.00',
      refundTotal: '850.00',
      commissionAmount: '0.00',
    },
    {
      id: '00000000-0000-4000-8000-000000000273',
      merchantId: ids.merchants.bahay,
      agreementId: ids.agreements.bahay,
      commissionRate: '10.00',
      grossSales: '0.00',
      refundTotal: '0.00',
      commissionAmount: '0.00',
    },
  ] as const;

  for (const accrual of accruals) {
    await prisma.merchantFinanceAccrual.create({
      data: {
        id: accrual.id,
        organizationId: ids.organization,
        merchantId: accrual.merchantId,
        agreementId: accrual.agreementId,
        periodStart: currentPeriodStart,
        periodEnd: today,
        schedule: SettlementSchedule.MONTHLY,
        kind: MerchantFinanceAccrualKind.EARNED_ACTIVITY,
        commissionRate: decimal(accrual.commissionRate),
        grossSales: decimal(accrual.grossSales),
        refundTotal: decimal(accrual.refundTotal),
        commissionAmount: decimal(accrual.commissionAmount),
      },
    });
  }
}

async function seedDemoData(prisma: PrismaClient): Promise<void> {
  const now = new Date();
  const today = dateOnly(now);
  const activation = addMonths(today, -5);
  const scheduledEndDate = addMonths(activation, 12);
  const previousPeriodStart = startOfMonth(addMonths(today, -1));
  const previousPeriodEnd = previousDate(startOfMonth(today));
  const currentPeriodStart = startOfMonth(today);

  await prisma.organization.create({
    data: {
      id: ids.organization,
      name: 'Demo Kapwesto Concept Store',
    },
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

  const passwordHash = await hash('DemoPassword123!', 10);
  await createDemoUsers(prisma, passwordHash);
  await createDemoMerchants(prisma, activation, scheduledEndDate);
  await prisma.organizationInvitation.create({
    data: {
      id: '00000000-0000-4000-8000-000000000301',
      organizationId: ids.organization,
      email: 'new.cashier.demo@example.com',
      role: OrganizationRole.CASHIER,
      tokenHash: 'demo-invitation-token-hash',
      expiresAt: addDays(now, 7),
      invitedById: ids.users.owner,
    },
  });
  await createDemoSpacesAndPrepayments(
    prisma,
    activation,
    scheduledEndDate,
    now,
  );
  await createDemoProductsAndInventory(prisma);

  const previousMonthSaleDate = atHour(addDays(previousPeriodStart, 5), 2);
  const previousMonthNorthSaleDate = atHour(
    addDays(previousPeriodStart, 10),
    4,
  );
  const previousMonthBahaySaleDate = atHour(
    addDays(previousPeriodStart, 15),
    6,
  );
  const currentSaleDate = atHour(today, 8);
  await createDemoSales(
    prisma,
    previousMonthSaleDate,
    previousMonthNorthSaleDate,
    currentSaleDate,
    previousMonthBahaySaleDate,
  );
  await createDemoInventoryMovements(
    prisma,
    previousMonthSaleDate,
    previousMonthNorthSaleDate,
    currentSaleDate,
    previousMonthBahaySaleDate,
  );
  await createDemoReceivables(prisma, activation, now);
  await createDemoSettlements(
    prisma,
    previousPeriodStart,
    previousPeriodEnd,
    now,
  );
  await createDemoFinanceAccruals(prisma, currentPeriodStart, today);

  console.info('Demo database seeded successfully.');
  console.info('Demo login password: DemoPassword123!');
  console.info(
    'Demo users: owner.demo@example.com, manager.demo@example.com, cashier.demo@example.com, merchant.demo@example.com',
  );
}

async function main(): Promise<void> {
  const resetRequested = process.argv.includes('--reset');
  assertSafeEnvironment(resetRequested);

  const connectionString =
    process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      'DATABASE_URL or DIRECT_DATABASE_URL is required to seed demo data',
    );
  }

  const adapter = new PrismaPg({ connectionString });
  const prisma = new PrismaClient({ adapter });
  try {
    if (resetRequested) {
      await resetDatabase(prisma);
    }
    await seedDemoData(prisma);
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
