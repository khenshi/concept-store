import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import request from 'supertest';
import { OrganizationRole, Prisma } from '../src/generated/prisma/client';
import { PrismaService } from '../src/infrastructure/database/prisma.service';
import { AuthGuard } from '../src/modules/auth/auth.guard';
import { OrganizationAccessGuard } from '../src/modules/organizations/authorization/organization-access.guard';
import { ReportsController } from '../src/modules/organizations/reports/reports.controller';
import { ReportsService } from '../src/modules/organizations/reports/reports.service';

const org = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const branch = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const actor = '11111111-1111-4111-8111-111111111111';
const path = `/organizations/${org}/branches/${branch}/reports/sales`;
const lookup = `/organizations/${org}/reports/sales/branches`;
const valid = { from: '2026-09-01T00:00:00Z', until: '2026-09-02T00:00:00Z' };
describe('Reports HTTP and OpenAPI boundaries', () => {
  let app: INestApplication;
  let jwt: JwtService;
  let role: OrganizationRole;
  const prisma = {
    user: { findFirst: jest.fn() },
    organizationMembership: { findUnique: jest.fn() },
    branch: { findFirst: jest.fn(), findMany: jest.fn() },
    $queryRaw: jest.fn(),
    $transaction: jest.fn(),
  };
  // Nest getHttpServer is an untyped Supertest boundary.
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
  const http = () => request(app.getHttpServer());
  const token = () =>
    jwt.sign({ email: 'report@example.test' }, { subject: actor });
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [JwtModule.register({ secret: 'reports-test-only' })],
      controllers: [ReportsController],
      providers: [
        ReportsService,
        AuthGuard,
        OrganizationAccessGuard,
        Reflector,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();
    await app.listen(0, '127.0.0.1');
    jwt = module.get(JwtService);
  });
  afterAll(async () => app.close());
  beforeEach(() => {
    jest.resetAllMocks();
    role = 'OWNER';
    prisma.user.findFirst.mockResolvedValue({ id: actor });
    prisma.organizationMembership.findUnique.mockImplementation(
      ({
        where,
      }: {
        where: { organizationId_userId: { organizationId: string } };
      }) =>
        Promise.resolve(
          where.organizationId_userId.organizationId === org
            ? { role, merchantId: role === 'MERCHANT' ? actor : null }
            : null,
        ),
    );
    prisma.branch.findFirst.mockResolvedValue({
      id: branch,
      name: 'Branch',
      code: null,
    });
    prisma.branch.findMany.mockResolvedValue([
      { id: branch, name: 'Branch', code: null },
    ]);
    prisma.$transaction.mockImplementation(
      (callback: (client: typeof prisma) => unknown) => callback(prisma),
    );
    prisma.$queryRaw.mockImplementation((sql: Prisma.Sql) =>
      Promise.resolve(
        sql.sql.includes('GROUP BY')
          ? []
          : sql.sql.includes('"Refund"')
            ? [{ refundedAmount: '0.00', refundCount: '0', returnedUnits: '0' }]
            : [{ grossSales: '0.00', transactionCount: '0', unitsSold: '0' }],
      ),
    );
  });
  it.each(['OWNER', 'MANAGER', 'MERCHANT'] as const)(
    'allows authorized %s summary and identity lookup',
    async (current) => {
      role = current;
      const response = await http()
        .get(path)
        .auth(token(), { type: 'bearer' })
        .query(valid)
        .expect(200);
      expect(response.body).toMatchObject({
        scope: current === 'MERCHANT' ? 'MERCHANT' : 'STAFF',
        from: '2026-09-01T00:00:00.000Z',
        until: '2026-09-02T00:00:00.000Z',
      });
      await http()
        .get(lookup)
        .auth(token(), { type: 'bearer' })
        .expect(200, [{ id: branch, name: 'Branch', code: null }]);
    },
  );
  it.each([path, lookup, `${path}/analytics`])(
    'requires authentication and denies cashier on %s',
    async (url) => {
      await http()
        .get(url)
        .query(url === lookup ? {} : valid)
        .expect(401);
      role = 'CASHIER';
      await http()
        .get(url)
        .auth(token(), { type: 'bearer' })
        .query(url === lookup ? {} : valid)
        .expect(403);
      expect(prisma.$queryRaw).not.toHaveBeenCalled();
      expect(prisma.$transaction).not.toHaveBeenCalled();
    },
  );
  it('hides guessed organizations and inaccessible branches', async () => {
    await http()
      .get(path.replace(org, branch))
      .auth(token(), { type: 'bearer' })
      .query(valid)
      .expect(404);
    prisma.branch.findFirst.mockResolvedValue(null);
    await http()
      .get(path)
      .auth(token(), { type: 'bearer' })
      .query(valid)
      .expect(404);
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });
  it.each([
    {},
    { from: valid.from },
    { ...valid, from: '2026-02-30T00:00:00Z' },
    { ...valid, until: valid.from },
    { ...valid, until: '2026-08-01T00:00:00Z' },
    { from: '2025-01-01T00:00:00Z', until: '2026-01-03T00:00:00Z' },
    { ...valid, until: '2026-09-02T08:00:00+08:00' },
    { ...valid, merchantId: actor },
    { ...valid, page: 1 },
  ])('rejects strict fields and invalid ranges %j', async (query) => {
    await http()
      .get(path)
      .auth(token(), { type: 'bearer' })
      .query(query)
      .expect(400);
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });
  it('rejects lookup filters and malformed UUIDs', async () => {
    await http()
      .get(lookup)
      .auth(token(), { type: 'bearer' })
      .query(valid)
      .expect(400);
    await http()
      .get(path.replace(branch, 'bad'))
      .auth(token(), { type: 'bearer' })
      .query(valid)
      .expect(400);
    await http()
      .get(path.replace(org, 'bad'))
      .auth(token(), { type: 'bearer' })
      .query(valid)
      .expect(400);
  });
  it('documents separate discriminated staff and merchant contracts and required ranges', () => {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder().addBearerAuth(undefined, 'access-token').build(),
    );
    const schemas = document.components?.schemas;
    expect(schemas?.StaffSalesAnalyticsResponseDto).toHaveProperty(
      'properties.dailyTrends.maxItems',
      367,
    );
    expect(schemas?.StaffSalesAnalyticsResponseDto).toHaveProperty(
      'properties.topMerchants.maxItems',
      10,
    );
    expect(schemas?.StaffSalesAnalyticsResponseDto).toHaveProperty(
      'properties.netByPaymentMethod.minItems',
      3,
    );
    expect(schemas?.StaffNetByPaymentMethodDto).toMatchObject({
      properties: {
        paymentMethod: { enum: ['CASH', 'GCASH', 'CARD'] },
        netRecordedSales: {
          type: 'string',
          pattern: '^-?(0|[1-9][0-9]*)\\.[0-9]{2}$',
        },
      },
    });
    expect(schemas?.StaffTopMerchantDto).toMatchObject({
      properties: {
        merchantId: { format: 'uuid' },
        merchantName: { type: 'string' },
        grossSales: { type: 'string', pattern: '^(0|[1-9][0-9]*)\\.[0-9]{2}$' },
      },
    });
    expect(schemas?.MerchantSalesAnalyticsResponseDto).not.toHaveProperty(
      'properties.topMerchants',
    );
    expect(schemas?.MerchantSalesAnalyticsResponseDto).not.toHaveProperty(
      'properties.netByPaymentMethod',
    );
    expect(schemas?.MerchantSalesAnalyticsResponseDto).toHaveProperty(
      'properties.topProducts.maxItems',
      10,
    );
    expect(schemas?.MerchantSalesAnalyticsResponseDto).not.toHaveProperty(
      'properties.payments',
    );
    expect(schemas?.MerchantDailyTrendDto).not.toHaveProperty(
      'properties.grossSales',
    );
    expect(schemas?.MerchantTopProductDto).not.toHaveProperty(
      'properties.refundedAmount',
    );
    expect(schemas?.MerchantSalesReportResponseDto).toMatchObject({
      properties: {
        scope: { enum: ['MERCHANT'] },
        ownGrossSales: { type: 'string' },
        ownRefundedAmount: { type: 'string' },
        ownRefundCount: { type: 'string' },
        ownReturnedUnits: { type: 'string' },
        ownNetRecordedSales: { type: 'string' },
      },
    });
    expect(schemas?.MerchantSalesReportResponseDto).not.toHaveProperty(
      'properties.payments',
    );
    expect(schemas?.MerchantSalesReportResponseDto).not.toHaveProperty(
      'properties.refundMethods',
    );
    expect(schemas?.StaffSalesReportResponseDto).toMatchObject({
      properties: {
        refundedAmount: { type: 'string' },
        refundCount: { type: 'string' },
        returnedUnits: { type: 'string' },
        netRecordedSales: { type: 'string' },
        refundMethods: { type: 'array' },
      },
    });
    expect(
      document.paths[
        '/organizations/{organizationId}/branches/{branchId}/reports/sales'
      ].get?.parameters,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'from', required: true }),
        expect.objectContaining({ name: 'until', required: true }),
      ]),
    );
  });
  it.each(['OWNER', 'MANAGER', 'MERCHANT'] as const)(
    'returns reduced analytics for %s without changing legacy summary',
    async (current) => {
      role = current;
      const summary = await http()
        .get(path)
        .auth(token(), { type: 'bearer' })
        .query(valid)
        .expect(200);
      const response = await http()
        .get(`${path}/analytics`)
        .auth(token(), { type: 'bearer' })
        .query(valid)
        .expect(200);
      expect(response.body).toEqual({
        ...summary.body,
        dailyTrends: ['2026-09-01', '2026-09-02'].map((date) =>
          current === 'MERCHANT'
            ? {
                date,
                ownGrossSales: '0.00',
                ownUnitsSold: '0',
                ownRefundedAmount: '0.00',
                ownReturnedUnits: '0',
                ownNetRecordedSales: '0.00',
                ownTransactionCount: '0',
                ownRefundCount: '0',
              }
            : {
                date,
                grossSales: '0.00',
                unitsSold: '0',
                refundedAmount: '0.00',
                returnedUnits: '0',
                netRecordedSales: '0.00',
                transactionCount: '0',
                refundCount: '0',
              },
        ),
        topProducts: [],
        totalProducts: '0',
        ...(current === 'MERCHANT'
          ? {}
          : {
              topMerchants: [],
              netByPaymentMethod: ['CASH', 'GCASH', 'CARD'].map(
                (paymentMethod) => ({
                  paymentMethod,
                  netRecordedSales: '0.00',
                }),
              ),
            }),
      });
    },
  );
  it.each([
    { ...valid, merchantId: actor },
    { ...valid, limit: 20 },
    { ...valid, role: 'OWNER' },
    { from: valid.from },
    { ...valid, until: valid.from },
  ])('rejects analytics overrides and invalid ranges %j', async (query) => {
    await http()
      .get(`${path}/analytics`)
      .auth(token(), { type: 'bearer' })
      .query(query)
      .expect(400);
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });
  it('rejects malformed and inaccessible analytics identities before aggregation', async () => {
    await http()
      .get(`${path}/analytics`.replace(branch, 'bad'))
      .auth(token(), { type: 'bearer' })
      .query(valid)
      .expect(400);
    await http()
      .get(`${path}/analytics`.replace(org, branch))
      .auth(token(), { type: 'bearer' })
      .query(valid)
      .expect(404);
    prisma.branch.findFirst.mockResolvedValue(null);
    await http()
      .get(`${path}/analytics`)
      .auth(token(), { type: 'bearer' })
      .query(valid)
      .expect(404);
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });
  it.each(['OWNER', 'MANAGER', 'MERCHANT'] as const)(
    'returns exact scoped refund and negative net fields for %s',
    async (current) => {
      role = current;
      prisma.$queryRaw.mockImplementation((sql: Prisma.Sql) =>
        Promise.resolve(
          sql.sql.includes('"Refund"')
            ? sql.sql.includes('GROUP BY')
              ? [
                  {
                    paymentMethod: 'CARD',
                    refundedAmount: '25.00',
                    refundCount: '1',
                  },
                ]
              : [
                  {
                    refundedAmount: '25.00',
                    refundCount: '1',
                    returnedUnits: '2',
                  },
                ]
            : sql.sql.includes('GROUP BY')
              ? []
              : [{ grossSales: '0.00', transactionCount: '0', unitsSold: '0' }],
        ),
      );
      const response = await http()
        .get(path)
        .auth(token(), { type: 'bearer' })
        .query(valid)
        .expect(200);
      expect(response.body).toMatchObject(
        current === 'MERCHANT'
          ? {
              scope: 'MERCHANT',
              ownRefundedAmount: '25.00',
              ownRefundCount: '1',
              ownReturnedUnits: '2',
              ownNetRecordedSales: '-25.00',
            }
          : {
              scope: 'STAFF',
              refundedAmount: '25.00',
              refundCount: '1',
              returnedUnits: '2',
              netRecordedSales: '-25.00',
              refundMethods: [
                {
                  paymentMethod: 'CASH',
                  refundedAmount: '0.00',
                  refundCount: '0',
                },
                {
                  paymentMethod: 'GCASH',
                  refundedAmount: '0.00',
                  refundCount: '0',
                },
                {
                  paymentMethod: 'CARD',
                  refundedAmount: '25.00',
                  refundCount: '1',
                },
              ],
            },
      );
      if (current === 'MERCHANT')
        for (const field of [
          'payments',
          'refundMethods',
          'refundedAmount',
          'refundCount',
          'returnedUnits',
          'netRecordedSales',
          'paymentReference',
        ])
          expect(response.body).not.toHaveProperty(field);
    },
  );
});
