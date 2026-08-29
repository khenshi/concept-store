import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { OPENAPI_JSON_PATH, setupSwagger } from '../src/config/swagger';
import {
  InventoryMovementType,
  OrganizationRole,
  ProductStatus,
} from '../src/generated/prisma/client';
import { PrismaService } from '../src/infrastructure/database/prisma.service';
import { AuthGuard } from '../src/modules/auth/auth.guard';
import { InventoryController } from '../src/modules/inventory/inventory.controller';
import { InventoryService } from '../src/modules/inventory/inventory.service';
import { OrganizationAccessGuard } from '../src/modules/organizations/authorization/organization-access.guard';
import { ProductsController } from '../src/modules/products/products.controller';
import { ProductsService } from '../src/modules/products/products.service';

const OWNER_ID = '11111111-1111-4111-8111-111111111111';
const MANAGER_ID = '22222222-2222-4222-8222-222222222222';
const CASHIER_ID = '33333333-3333-4333-8333-333333333333';
const MERCHANT_USER_ID = '44444444-4444-4444-8444-444444444444';
const ORGANIZATION_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const OTHER_ORGANIZATION_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const MERCHANT_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const BRANCH_ID = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const PRODUCT_ID = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';

describe('Milestone 4 product and inventory access (e2e)', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  const productsService = {
    create: jest.fn().mockResolvedValue({ id: PRODUCT_ID }),
    findAll: jest.fn().mockResolvedValue([]),
    findByCode: jest.fn().mockResolvedValue({ id: PRODUCT_ID }),
    findOne: jest.fn().mockResolvedValue({ id: PRODUCT_ID }),
    update: jest.fn().mockResolvedValue({ id: PRODUCT_ID }),
    updateStatus: jest.fn().mockResolvedValue({
      id: PRODUCT_ID,
      status: ProductStatus.INACTIVE,
    }),
  };
  const inventoryService = {
    stockIn: jest.fn().mockResolvedValue({ inventory: {}, movement: {} }),
    adjust: jest.fn().mockResolvedValue({ inventory: {}, movement: {} }),
    findAll: jest
      .fn()
      .mockResolvedValue({ items: [], total: 0, offset: 0, limit: 50 }),
    findMovements: jest.fn().mockResolvedValue({ items: [], nextCursor: null }),
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
          secret: 'milestone-4-e2e-secret-at-least-32-characters',
        }),
      ],
      controllers: [ProductsController, InventoryController],
      providers: [
        AuthGuard,
        OrganizationAccessGuard,
        Reflector,
        { provide: PrismaService, useValue: prismaService },
        { provide: ProductsService, useValue: productsService },
        { provide: InventoryService, useValue: inventoryService },
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

  it('rejects unauthenticated product access', async () => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    await request(app.getHttpServer())
      .get(`/organizations/${ORGANIZATION_ID}/products`)
      .expect(401);
  });

  it('conceals an organization without membership', async () => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    await request(app.getHttpServer())
      .get(`/organizations/${OTHER_ORGANIZATION_ID}/inventory`)
      .set('Authorization', `Bearer ${token(OWNER_ID, 'owner@example.com')}`)
      .expect(404);
    expect(inventoryService.findAll).not.toHaveBeenCalled();
  });

  it.each([
    [CASHIER_ID, 'cashier@example.com'],
    [MERCHANT_USER_ID, 'merchant@example.com'],
  ])(
    'forbids a role without inventory-management access',
    async (userId, email) => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      await request(app.getHttpServer())
        .get(`/organizations/${ORGANIZATION_ID}/inventory`)
        .set('Authorization', `Bearer ${token(userId, email)}`)
        .expect(403);
      expect(inventoryService.findAll).not.toHaveBeenCalled();
    },
  );

  it('normalizes product SKU and decimal input', async () => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    await request(app.getHttpServer())
      .post(`/organizations/${ORGANIZATION_ID}/products`)
      .set('Authorization', `Bearer ${token(OWNER_ID, 'owner@example.com')}`)
      .send({
        merchantId: MERCHANT_ID,
        name: '  Handwoven pouch  ',
        sku: ' amh-01 ',
        barcode: ' 4801234567890 ',
        sellingPrice: ' 450.00 ',
      })
      .expect(201, { id: PRODUCT_ID });
    expect(productsService.create).toHaveBeenCalledWith(ORGANIZATION_ID, {
      merchantId: MERCHANT_ID,
      name: 'Handwoven pouch',
      sku: 'AMH-01',
      barcode: '4801234567890',
      sellingPrice: '450.00',
    });
  });

  it('passes the trusted actor to stock-in and validates quantities', async () => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    await request(app.getHttpServer())
      .post(`/organizations/${ORGANIZATION_ID}/inventory/stock-in`)
      .set(
        'Authorization',
        `Bearer ${token(MANAGER_ID, 'manager@example.com')}`,
      )
      .send({ productId: PRODUCT_ID, branchId: BRANCH_ID, quantity: 12 })
      .expect(201);
    expect(inventoryService.stockIn).toHaveBeenCalledWith(
      ORGANIZATION_ID,
      MANAGER_ID,
      { productId: PRODUCT_ID, branchId: BRANCH_ID, quantity: 12 },
    );

    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    await request(app.getHttpServer())
      .post(`/organizations/${ORGANIZATION_ID}/inventory/stock-in`)
      .set(
        'Authorization',
        `Bearer ${token(MANAGER_ID, 'manager@example.com')}`,
      )
      .send({ productId: PRODUCT_ID, branchId: BRANCH_ID, quantity: 0 })
      .expect(400);
  });

  it('requires an explanation for adjustments', async () => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    await request(app.getHttpServer())
      .post(`/organizations/${ORGANIZATION_ID}/inventory/adjustments`)
      .set('Authorization', `Bearer ${token(OWNER_ID, 'owner@example.com')}`)
      .send({ productId: PRODUCT_ID, branchId: BRANCH_ID, quantityChange: -2 })
      .expect(400);
    expect(inventoryService.adjust).not.toHaveBeenCalled();
  });

  it('transforms and bounds inventory query pagination', async () => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    await request(app.getHttpServer())
      .get(`/organizations/${ORGANIZATION_ID}/inventory`)
      .query({
        branchId: BRANCH_ID,
        search: '  pouch  ',
        offset: '5',
        limit: '25',
      })
      .set(
        'Authorization',
        `Bearer ${token(MANAGER_ID, 'manager@example.com')}`,
      )
      .expect(200);
    expect(inventoryService.findAll).toHaveBeenCalledWith(ORGANIZATION_ID, {
      branchId: BRANCH_ID,
      search: 'pouch',
      offset: 5,
      limit: 25,
    });
  });

  it('validates and forwards movement-history filters', async () => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    await request(app.getHttpServer())
      .get(`/organizations/${ORGANIZATION_ID}/inventory/movements`)
      .query({ productId: PRODUCT_ID, type: InventoryMovementType.STOCK_IN })
      .set('Authorization', `Bearer ${token(OWNER_ID, 'owner@example.com')}`)
      .expect(200);
    expect(inventoryService.findMovements).toHaveBeenCalledWith(
      ORGANIZATION_ID,
      {
        productId: PRODUCT_ID,
        type: InventoryMovementType.STOCK_IN,
        limit: 50,
      },
    );
  });

  it('publishes product and inventory contracts in OpenAPI', async () => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    const response = await request(app.getHttpServer())
      .get(`/${OPENAPI_JSON_PATH}`)
      .expect(200);
    expect(response.text).toContain(
      '"/organizations/{organizationId}/products"',
    );
    expect(response.text).toContain(
      '"/organizations/{organizationId}/inventory/movements"',
    );
    expect(response.text).toContain('"InventoryPageResponseDto"');
  });
});
