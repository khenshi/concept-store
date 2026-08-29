import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { OPENAPI_JSON_PATH, setupSwagger } from '../src/config/swagger';
import {
  OrganizationRole,
  PaymentMethod,
} from '../src/generated/prisma/client';
import { PrismaService } from '../src/infrastructure/database/prisma.service';
import { AuthGuard } from '../src/modules/auth/auth.guard';
import { OrganizationAccessGuard } from '../src/modules/organizations/authorization/organization-access.guard';
import { PosProductsController } from '../src/modules/sales/pos-products.controller';
import { PosProductsService } from '../src/modules/sales/pos-products.service';
import { SalesController } from '../src/modules/sales/sales.controller';
import { SalesService } from '../src/modules/sales/sales.service';

const OWNER_ID = '11111111-1111-4111-8111-111111111111';
const MANAGER_ID = '22222222-2222-4222-8222-222222222222';
const CASHIER_ID = '33333333-3333-4333-8333-333333333333';
const MERCHANT_USER_ID = '44444444-4444-4444-8444-444444444444';
const ORGANIZATION_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const OTHER_ORGANIZATION_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const BRANCH_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const PRODUCT_ID = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const MERCHANT_ID = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const SALE_ID = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
const CLIENT_TRANSACTION_ID = '99999999-9999-4999-8999-999999999999';

describe('Milestone 5 online POS access and contracts (e2e)', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  const posProductsService = {
    findAll: jest
      .fn()
      .mockResolvedValue({ items: [], total: 0, offset: 0, limit: 30 }),
    findByCode: jest.fn().mockResolvedValue({ id: PRODUCT_ID }),
  };
  const salesService = {
    checkout: jest.fn().mockResolvedValue({ id: SALE_ID }),
    findAll: jest
      .fn()
      .mockResolvedValue({ items: [], total: 0, offset: 0, limit: 30 }),
    findOne: jest.fn().mockResolvedValue({ id: SALE_ID }),
  };
  const rolesByUserId: Record<string, OrganizationRole> = {
    [OWNER_ID]: OrganizationRole.OWNER,
    [MANAGER_ID]: OrganizationRole.MANAGER,
    [CASHIER_ID]: OrganizationRole.CASHIER,
    [MERCHANT_USER_ID]: OrganizationRole.MERCHANT,
  };
  const prismaService = {
    user: {
      findFirst: jest.fn(
        ({ where }: { where: { id: string; deletedAt: null } }) =>
          Promise.resolve(
            rolesByUserId[where.id] && where.deletedAt === null
              ? { id: where.id }
              : null,
          ),
      ),
    },
    organizationMembership: {
      findUnique: jest.fn(
        ({
          where,
        }: {
          where: {
            organizationId_userId: {
              organizationId: string;
              userId: string;
            };
          };
        }) => {
          const { organizationId, userId } = where.organizationId_userId;
          const role = rolesByUserId[userId];
          return Promise.resolve(
            organizationId === ORGANIZATION_ID && role ? { role } : null,
          );
        },
      ),
    },
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        JwtModule.register({
          secret: 'milestone-5-e2e-secret-at-least-32-characters',
        }),
      ],
      controllers: [PosProductsController, SalesController],
      providers: [
        AuthGuard,
        OrganizationAccessGuard,
        Reflector,
        { provide: PrismaService, useValue: prismaService },
        { provide: PosProductsService, useValue: posProductsService },
        { provide: SalesService, useValue: salesService },
      ],
    }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        forbidNonWhitelisted: true,
        transform: true,
        whitelist: true,
      }),
    );
    setupSwagger(app);
    await app.init();
    jwtService = moduleRef.get(JwtService);
  });

  afterAll(async () => app.close());
  beforeEach(() => jest.clearAllMocks());

  function token(userId: string, email: string): string {
    return jwtService.sign({ email }, { subject: userId });
  }

  it('rejects unauthenticated POS access', async () => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    await request(app.getHttpServer())
      .get(
        `/organizations/${ORGANIZATION_ID}/branches/${BRANCH_ID}/pos/products`,
      )
      .expect(401);
  });

  it('conceals an organization without membership', async () => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    await request(app.getHttpServer())
      .get(
        `/organizations/${OTHER_ORGANIZATION_ID}/branches/${BRANCH_ID}/pos/sales`,
      )
      .set('Authorization', `Bearer ${token(OWNER_ID, 'owner@example.com')}`)
      .expect(404);
    expect(salesService.findAll).not.toHaveBeenCalled();
  });

  it('forbids merchants from owner/staff POS endpoints', async () => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    await request(app.getHttpServer())
      .get(
        `/organizations/${ORGANIZATION_ID}/branches/${BRANCH_ID}/pos/products`,
      )
      .set(
        'Authorization',
        `Bearer ${token(MERCHANT_USER_ID, 'merchant@example.com')}`,
      )
      .expect(403);
    expect(posProductsService.findAll).not.toHaveBeenCalled();
  });

  it('normalizes POS product filters and uses trusted tenant context', async () => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    await request(app.getHttpServer())
      .get(
        `/organizations/${ORGANIZATION_ID}/branches/${BRANCH_ID}/pos/products`,
      )
      .query({ search: '  pouch  ', merchantId: MERCHANT_ID, limit: '25' })
      .set(
        'Authorization',
        `Bearer ${token(CASHIER_ID, 'cashier@example.com')}`,
      )
      .expect(200);
    expect(posProductsService.findAll).toHaveBeenCalledWith(
      ORGANIZATION_ID,
      BRANCH_ID,
      { search: 'pouch', merchantId: MERCHANT_ID, offset: 0, limit: 25 },
    );
  });

  it('normalizes exact SKU or barcode lookup', async () => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    await request(app.getHttpServer())
      .get(
        `/organizations/${ORGANIZATION_ID}/branches/${BRANCH_ID}/pos/products/lookup`,
      )
      .query({ code: '  amh-01  ' })
      .set(
        'Authorization',
        `Bearer ${token(CASHIER_ID, 'cashier@example.com')}`,
      )
      .expect(200);
    expect(posProductsService.findByCode).toHaveBeenCalledWith(
      ORGANIZATION_ID,
      BRANCH_ID,
      'amh-01',
    );
  });

  it('forwards checkout with the authenticated actor and validated payload', async () => {
    const payload = {
      clientTransactionId: CLIENT_TRANSACTION_ID,
      items: [{ productId: PRODUCT_ID, quantity: 2 }],
      payments: [
        {
          method: PaymentMethod.GCASH,
          amount: '450.00',
          referenceNumber: '  GCASH-1001  ',
        },
      ],
    };
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    await request(app.getHttpServer())
      .post(`/organizations/${ORGANIZATION_ID}/branches/${BRANCH_ID}/pos/sales`)
      .set(
        'Authorization',
        `Bearer ${token(CASHIER_ID, 'cashier@example.com')}`,
      )
      .send(payload)
      .expect(201, { id: SALE_ID });
    expect(salesService.checkout).toHaveBeenCalledWith(
      ORGANIZATION_ID,
      BRANCH_ID,
      CASHIER_ID,
      {
        ...payload,
        payments: [
          {
            ...payload.payments[0],
            referenceNumber: 'GCASH-1001',
          },
        ],
      },
    );
  });

  it('rejects malformed checkout payloads before the service', async () => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    await request(app.getHttpServer())
      .post(`/organizations/${ORGANIZATION_ID}/branches/${BRANCH_ID}/pos/sales`)
      .set('Authorization', `Bearer ${token(OWNER_ID, 'owner@example.com')}`)
      .send({
        clientTransactionId: CLIENT_TRANSACTION_ID,
        items: [{ productId: PRODUCT_ID, quantity: 0 }],
        payments: [{ method: PaymentMethod.CASH, amount: '0.00' }],
        total: '0.00',
      })
      .expect(400);
    expect(salesService.checkout).not.toHaveBeenCalled();
  });

  it('validates and forwards sales-history filters', async () => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    await request(app.getHttpServer())
      .get(`/organizations/${ORGANIZATION_ID}/branches/${BRANCH_ID}/pos/sales`)
      .query({
        search: '  S-ABC  ',
        cashierId: CASHIER_ID,
        paymentMethod: PaymentMethod.CASH,
        completedFrom: '2026-08-01T00:00:00.000Z',
        completedTo: '2026-08-31T23:59:59.999Z',
        offset: '10',
        limit: '20',
      })
      .set(
        'Authorization',
        `Bearer ${token(MANAGER_ID, 'manager@example.com')}`,
      )
      .expect(200);
    expect(salesService.findAll).toHaveBeenCalledWith(
      ORGANIZATION_ID,
      BRANCH_ID,
      {
        search: 'S-ABC',
        cashierId: CASHIER_ID,
        paymentMethod: PaymentMethod.CASH,
        completedFrom: '2026-08-01T00:00:00.000Z',
        completedTo: '2026-08-31T23:59:59.999Z',
        offset: 10,
        limit: 20,
      },
    );
  });

  it('routes a sale detail request within its organization and branch', async () => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    await request(app.getHttpServer())
      .get(
        `/organizations/${ORGANIZATION_ID}/branches/${BRANCH_ID}/pos/sales/${SALE_ID}`,
      )
      .set('Authorization', `Bearer ${token(OWNER_ID, 'owner@example.com')}`)
      .expect(200, { id: SALE_ID });
    expect(salesService.findOne).toHaveBeenCalledWith(
      ORGANIZATION_ID,
      BRANCH_ID,
      SALE_ID,
    );
  });

  it('publishes all Milestone 5 online POS contracts in OpenAPI', async () => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    const response = await request(app.getHttpServer())
      .get(`/${OPENAPI_JSON_PATH}`)
      .expect(200);
    expect(response.text).toContain(
      '"/organizations/{organizationId}/branches/{branchId}/pos/products"',
    );
    expect(response.text).toContain(
      '"/organizations/{organizationId}/branches/{branchId}/pos/products/lookup"',
    );
    expect(response.text).toContain(
      '"/organizations/{organizationId}/branches/{branchId}/pos/sales"',
    );
    expect(response.text).toContain(
      '"/organizations/{organizationId}/branches/{branchId}/pos/sales/{saleId}"',
    );
    expect(response.text).toContain('"PosProductPageResponseDto"');
    expect(response.text).toContain('"SalePageResponseDto"');
    expect(response.text).toContain('"SaleResponseDto"');
  });
});
