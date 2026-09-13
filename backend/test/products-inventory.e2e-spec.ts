import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { OrganizationRole } from '../src/generated/prisma/client';
import { PrismaService } from '../src/infrastructure/database/prisma.service';
import { AuthGuard } from '../src/modules/auth/auth.guard';
import { OrganizationAccessGuard } from '../src/modules/organizations/authorization/organization-access.guard';
import { ProductsController } from '../src/modules/organizations/products/products.controller';
import { ProductsService } from '../src/modules/organizations/products/products.service';
import { BranchInventoryController } from '../src/modules/organizations/inventory/branch-inventory.controller';
import { BranchInventoryService } from '../src/modules/organizations/inventory/branch-inventory.service';
import { InventoryStockService } from '../src/modules/organizations/inventory/inventory-stock.service';

const org = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const branch = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const item = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const actor = '11111111-1111-4111-8111-111111111111';
const manager = '22222222-2222-4222-8222-222222222222';
const cashier = '33333333-3333-4333-8333-333333333333';
const merchant = '44444444-4444-4444-8444-444444444444';
const productsPath = `/organizations/${org}/products`;
const inventoryPath = `/organizations/${org}/branches/${branch}/inventory`;
const roles = new Map([
  [actor, OrganizationRole.OWNER],
  [manager, OrganizationRole.MANAGER],
  [cashier, OrganizationRole.CASHIER],
  [merchant, OrganizationRole.MERCHANT],
]);

describe('Products and inventory HTTP boundaries', () => {
  let app: INestApplication;
  let jwt: JwtService;
  const products = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    updateStatus: jest.fn(),
    findInventory: jest.fn(),
  };
  const inventory = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    updatePrice: jest.fn(),
    findMovements: jest.fn(),
  };
  const stock = { receive: jest.fn(), adjust: jest.fn() };
  const prisma = {
    branch: { findFirst: jest.fn().mockResolvedValue({ id: branch }) },
    product: { findFirst: jest.fn().mockResolvedValue({ id: item }) },
    merchant: { findFirst: jest.fn().mockResolvedValue({ id: item }) },
    branchInventory: { findFirst: jest.fn().mockResolvedValue({ id: item }) },
    user: {
      findFirst: jest.fn(({ where }: { where: { id: string } }) =>
        Promise.resolve(roles.has(where.id) ? { id: where.id } : null),
      ),
    },
    organizationMembership: {
      findUnique: jest.fn(
        ({
          where,
        }: {
          where: {
            organizationId_userId: { organizationId: string; userId: string };
          };
        }) => {
          const context = where.organizationId_userId;
          const role = roles.get(context.userId);
          return Promise.resolve(
            context.organizationId === org && role ? { role } : null,
          );
        },
      ),
    },
  };
  const token = (userId = actor) =>
    jwt.sign({ email: `${userId}@example.test` }, { subject: userId });
  // Supertest's getHttpServer boundary is untyped in Nest's application interface.
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [
        JwtModule.register({ secret: 'products-inventory-http-test-secret' }),
      ],
      controllers: [ProductsController, BranchInventoryController],
      providers: [
        AuthGuard,
        OrganizationAccessGuard,
        Reflector,
        { provide: PrismaService, useValue: prisma },
        { provide: ProductsService, useValue: products },
        { provide: BranchInventoryService, useValue: inventory },
        { provide: InventoryStockService, useValue: stock },
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
    jwt = module.get(JwtService);
  });
  afterAll(async () => app.close());
  beforeEach(() => {
    jest.clearAllMocks();
    for (const service of [products, inventory, stock]) {
      for (const method of Object.values(service))
        method.mockResolvedValue({ id: item });
    }
  });

  const reads = [
    productsPath,
    `${productsPath}/${item}`,
    `${productsPath}/${item}/inventory`,
    inventoryPath,
    `${inventoryPath}/${item}`,
    `${inventoryPath}/${item}/movements`,
  ];
  it('hides an unassigned branch before business operations', async () => {
    prisma.branch.findFirst.mockResolvedValueOnce(null);
    await http()
      .get(inventoryPath)
      .auth(token(manager), { type: 'bearer' })
      .expect(404);
    expect(inventory.findAll).not.toHaveBeenCalled();
  });
  it('accepts merchant read routes after scoped object checks', async () => {
    await http()
      .get(`${inventoryPath}/${item}/movements`)
      .auth(token(merchant), { type: 'bearer' })
      .expect(200);
    expect(inventory.findMovements).toHaveBeenCalledWith(
      org,
      branch,
      item,
      expect.objectContaining({ role: 'MERCHANT' }),
    );
  });
  it.each(reads)('requires authentication on %s', async (path) => {
    await http().get(path).expect(401);
  });
  it.each(reads)('denies cashier roles on %s', async (path) => {
    for (const userId of [cashier])
      await http()
        .get(path)
        .auth(token(userId), { type: 'bearer' })
        .expect(403);
  });
  it.each(reads)('allows owners and managers on %s', async (path) => {
    for (const userId of [actor, manager])
      await http()
        .get(path)
        .auth(token(userId), { type: 'bearer' })
        .expect(200);
  });

  const writes = [
    {
      method: 'post',
      path: productsPath,
      body: { merchantId: item, name: 'Vase' },
      status: 201,
    },
    {
      method: 'patch',
      path: `${productsPath}/${item}`,
      body: { name: 'Vase' },
      status: 200,
    },
    {
      method: 'patch',
      path: `${productsPath}/${item}/status`,
      body: { status: 'INACTIVE' },
      status: 200,
    },
    {
      method: 'post',
      path: inventoryPath,
      body: { productId: item, sellingPrice: '12.50' },
      status: 201,
    },
    {
      method: 'patch',
      path: `${inventoryPath}/${item}/price`,
      body: { sellingPrice: '13.50' },
      status: 200,
    },
    {
      method: 'post',
      path: `${inventoryPath}/${item}/receipts`,
      body: { quantity: 1, reason: 'Delivery', requestId: item },
      status: 201,
    },
    {
      method: 'post',
      path: `${inventoryPath}/${item}/adjustments`,
      body: { quantityChange: -1, reason: 'Correction', requestId: item },
      status: 201,
    },
  ] as const;

  it.each(writes)(
    'protects write $path and accepts only owner/manager',
    async ({ method, path, body, status }) => {
      await http()[method](path).send(body).expect(401);
      for (const userId of [cashier, merchant])
        await http()
          [method](path)
          .auth(token(userId), { type: 'bearer' })
          .send(body)
          .expect(403);
      for (const userId of [actor, manager])
        await http()
          [method](path)
          .auth(token(userId), { type: 'bearer' })
          .send(body)
          .expect(
            userId === manager && path.startsWith(productsPath) ? 403 : status,
          );
    },
  );

  it.each(writes)(
    'rejects untrusted organization fields on $path',
    async ({ method, path, body }) => {
      await http()
        [method](path)
        .auth(token(), { type: 'bearer' })
        .send({ ...body, organizationId: org })
        .expect(400);
      expect(products.create).not.toHaveBeenCalled();
      expect(inventory.create).not.toHaveBeenCalled();
      expect(stock.receive).not.toHaveBeenCalled();
      expect(stock.adjust).not.toHaveBeenCalled();
    },
  );

  it.each([
    `${productsPath}/bad`,
    `/organizations/${org}/branches/bad/inventory`,
    `${inventoryPath}/bad/movements`,
  ])('rejects malformed entity IDs %s', async (path) => {
    await http().get(path).auth(token(), { type: 'bearer' }).expect(400);
  });

  it('denies a guessed organization before invoking business services', async () => {
    await http()
      .get(`/organizations/${branch}/products`)
      .auth(token(), { type: 'bearer' })
      .expect(404);
    expect(products.findAll).not.toHaveBeenCalled();
  });

  it('normalizes product inputs before passing trusted organization context', async () => {
    await http()
      .post(productsPath)
      .auth(token(), { type: 'bearer' })
      .send({
        merchantId: item,
        name: ' Vase ',
        sku: ' va-01 ',
        barcode: ' 001Ab ',
      })
      .expect(201);
    expect(products.create).toHaveBeenCalledWith(
      org,
      expect.objectContaining({
        merchantId: item,
        name: 'Vase',
        sku: 'VA-01',
        barcode: '001Ab',
      }),
    );
  });

  it('derives stock actor from the JWT, not a submitted field', async () => {
    await http()
      .post(`${inventoryPath}/${item}/receipts`)
      .auth(token(manager), { type: 'bearer' })
      .send({ quantity: 2, reason: ' Delivery ', requestId: item })
      .expect(201);
    expect(stock.receive).toHaveBeenCalledWith(
      org,
      branch,
      item,
      manager,
      expect.objectContaining({
        quantity: 2,
        reason: 'Delivery',
        requestId: item,
      }),
    );
    await http()
      .post(`${inventoryPath}/${item}/receipts`)
      .auth(token(), { type: 'bearer' })
      .send({
        quantity: 2,
        reason: 'Delivery',
        requestId: item,
        createdById: manager,
      })
      .expect(400);
  });

  it.each([12.5, '1e2', '0', '1.001'])(
    'rejects invalid price at the HTTP boundary %s',
    async (sellingPrice) => {
      await http()
        .patch(`${inventoryPath}/${item}/price`)
        .auth(token(), { type: 'bearer' })
        .send({ sellingPrice })
        .expect(400);
      expect(inventory.updatePrice).not.toHaveBeenCalled();
    },
  );
});
