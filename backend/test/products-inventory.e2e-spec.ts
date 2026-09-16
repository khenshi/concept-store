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
import { InventoryReconciliationService } from '../src/modules/organizations/inventory/inventory-reconciliation.service';
import { PosCatalogController } from '../src/modules/organizations/pos/pos-catalog.controller';
import { PosCatalogService } from '../src/modules/organizations/pos/pos-catalog.service';
import { CheckoutController } from '../src/modules/organizations/sales/checkout.controller';
import { CheckoutService } from '../src/modules/organizations/sales/checkout.service';
import {
  SalesReadController,
  MerchantSalesBranchesController,
} from '../src/modules/organizations/sales/sales-read.controller';
import { SalesReadService } from '../src/modules/organizations/sales/sales-read.service';

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
    updateThreshold: jest.fn(),
    summarize: jest.fn(),
    findMovements: jest.fn(),
  };
  const stock = { receive: jest.fn(), adjust: jest.fn() };
  const reconciliation = { reconcile: jest.fn() };
  const checkout = { complete: jest.fn() };
  const sales = {
    findAll: jest.fn(),
    findOne: jest.fn(),
    sellingBranches: jest.fn(),
  };
  const prisma = {
    branch: { findFirst: jest.fn().mockResolvedValue({ id: branch }) },
    product: { findFirst: jest.fn().mockResolvedValue({ id: item }) },
    merchant: { findFirst: jest.fn().mockResolvedValue({ id: item }) },
    branchInventory: {
      findFirst: jest.fn().mockResolvedValue({ id: item }),
      findMany: jest.fn().mockResolvedValue([]),
    },
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
      controllers: [
        ProductsController,
        BranchInventoryController,
        PosCatalogController,
        CheckoutController,
        SalesReadController,
        MerchantSalesBranchesController,
      ],
      providers: [
        AuthGuard,
        OrganizationAccessGuard,
        Reflector,
        { provide: PrismaService, useValue: prisma },
        { provide: ProductsService, useValue: products },
        { provide: BranchInventoryService, useValue: inventory },
        { provide: InventoryStockService, useValue: stock },
        { provide: InventoryReconciliationService, useValue: reconciliation },
        PosCatalogService,
        { provide: CheckoutService, useValue: checkout },
        { provide: SalesReadService, useValue: sales },
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
    for (const service of [
      products,
      inventory,
      stock,
      reconciliation,
      checkout,
      sales,
    ]) {
      for (const method of Object.values(service))
        method.mockResolvedValue({ id: item });
    }
  });

  const reads = [
    productsPath,
    `${productsPath}/${item}`,
    `${productsPath}/${item}/inventory`,
    inventoryPath,
    `${inventoryPath}/summary`,
    `${inventoryPath}/${item}`,
    `${inventoryPath}/${item}/movements`,
  ];
  it('limits reconciliation to staff and validates its bounded query', async () => {
    const path = `${inventoryPath}/reconciliation`;
    await http().get(path).expect(401);
    for (const userId of [cashier, merchant])
      await http()
        .get(path)
        .auth(token(userId), { type: 'bearer' })
        .expect(403);
    expect(reconciliation.reconcile).not.toHaveBeenCalled();
    for (const suffix of [
      '?limit=0',
      '?limit=101',
      '?limit=1.5',
      '?cursor=bad',
      '?other=x',
    ])
      await http()
        .get(path + suffix)
        .auth(token(), { type: 'bearer' })
        .expect(400);
    expect(reconciliation.reconcile).not.toHaveBeenCalled();
    for (const userId of [actor, manager]) {
      await http()
        .get(path + '?limit=2&cursor=' + item)
        .auth(token(userId), { type: 'bearer' })
        .expect(200);
      expect(reconciliation.reconcile).toHaveBeenLastCalledWith(
        expect.objectContaining({
          organizationId: org,
          userId,
          role: roles.get(userId),
        }),
        branch,
        expect.objectContaining({ limit: 2, cursor: item }),
      );
    }
    reconciliation.reconcile.mockClear();
    prisma.branch.findFirst.mockResolvedValueOnce(null);
    await http().get(path).auth(token(manager), { type: 'bearer' }).expect(404);
    await http()
      .get(path.replace(org, item))
      .auth(token(), { type: 'bearer' })
      .expect(404);
    expect(reconciliation.reconcile).not.toHaveBeenCalled();
  });
  const posPath = `/organizations/${org}/branches/${branch}/pos/products`;
  const salesPath = `/organizations/${org}/branches/${branch}/sales`;
  it.each([actor, manager, cashier, merchant])(
    'allows current member sales reads %s with trusted context',
    async (userId) => {
      await http()
        .get(salesPath + '?page=2&limit=10')
        .auth(token(userId), { type: 'bearer' })
        .expect(200);
      expect(sales.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: org,
          userId,
          role: roles.get(userId),
        }),
        branch,
        expect.objectContaining({ page: 2, limit: 10 }),
      );
      await http()
        .get(salesPath + '/' + item)
        .auth(token(userId), { type: 'bearer' })
        .expect(200);
    },
  );
  it('requires authentication and organization membership for sales reads', async () => {
    await http().get(salesPath).expect(401);
    await http()
      .get(salesPath + '/' + item)
      .expect(401);
    await http()
      .get(salesPath.replace(org, item))
      .auth(token(), { type: 'bearer' })
      .expect(404);
    expect(sales.findAll).not.toHaveBeenCalled();
  });
  it('restricts historical branch lookup to merchants and rejects extra queries', async () => {
    const path = `/organizations/${org}/sales/branches`;
    await http().get(path).expect(401);
    for (const userId of [actor, manager, cashier])
      await http()
        .get(path)
        .auth(token(userId), { type: 'bearer' })
        .expect(403);
    await http()
      .get(path)
      .auth(token(merchant), { type: 'bearer' })
      .expect(200);
    await http()
      .get(path + '?merchantId=' + item)
      .auth(token(merchant), { type: 'bearer' })
      .expect(400);
  });
  it.each([
    '?limit=101',
    '?page=0',
    '?from=invalid',
    '?merchantId=' + item,
    '/' + item + '?receipt=full',
    '/invalid',
    '?until=2026-09-13',
  ])('rejects malformed sales read %s', async (suffix) => {
    await http()
      .get(salesPath + suffix)
      .auth(token(merchant), { type: 'bearer' })
      .expect(400);
  });
  const saleCommand = {
    requestId: item,
    items: [
      { branchInventoryId: item, quantity: 1, expectedUnitPrice: '12.50' },
    ],
    paymentMethod: 'CASH',
    cashTender: '20.00',
  };
  it('requires authentication and rejects merchant checkout', async () => {
    await http().post(salesPath).send(saleCommand).expect(401);
    await http()
      .post(salesPath)
      .auth(token(merchant), { type: 'bearer' })
      .send(saleCommand)
      .expect(403);
    expect(checkout.complete).not.toHaveBeenCalled();
  });
  it.each([actor, manager, cashier])(
    'delegates normalized checkout for authorized role %s',
    async (userId) => {
      await http()
        .post(salesPath)
        .auth(token(userId), { type: 'bearer' })
        .send({ ...saleCommand, cashTender: ' 20.00 ' })
        .expect(201);
      expect(checkout.complete).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: org,
          userId,
          role: roles.get(userId),
        }),
        branch,
        expect.objectContaining(saleCommand),
      );
    },
  );
  it.each([
    { total: '12.50' },
    { organizationId: org },
    { createdById: actor },
    { cashTender: 20 },
    { paymentReference: 'cash cannot have reference' },
    { items: [saleCommand.items[0], saleCommand.items[0]] },
    { items: [{ ...saleCommand.items[0], unitPrice: '0.01' }] },
  ])('rejects untrusted HTTP checkout fields %j', async (extra) => {
    await http()
      .post(salesPath)
      .auth(token(), { type: 'bearer' })
      .send({ ...saleCommand, ...extra })
      .expect(400);
    expect(checkout.complete).not.toHaveBeenCalled();
  });
  it('rejects foreign organization and invalid branch IDs before checkout', async () => {
    await http()
      .post(salesPath.replace(org, item))
      .auth(token(), { type: 'bearer' })
      .send(saleCommand)
      .expect(404);
    await http()
      .post(salesPath.replace(branch, 'invalid'))
      .auth(token(), { type: 'bearer' })
      .send(saleCommand)
      .expect(400);
    expect(checkout.complete).not.toHaveBeenCalled();
  });
  it.each(['', '/code?code=001Ab'])(
    'enforces POS authentication and merchant denial on %s',
    async (suffix) => {
      await http()
        .get(posPath + suffix)
        .expect(401);
      await http()
        .get(posPath + suffix)
        .auth(token(merchant), { type: 'bearer' })
        .expect(403);
    },
  );
  it.each([actor, manager, cashier])(
    'allows authorized POS staff %s with minimal reads',
    async (userId) => {
      await http()
        .get(posPath)
        .auth(token(userId), { type: 'bearer' })
        .expect(200, []);
      await http()
        .get(posPath + '/code?code=%20001Ab%20')
        .auth(token(userId), { type: 'bearer' })
        .expect(200, []);
      expect(prisma.branchInventory.findMany).toHaveBeenLastCalledWith(
        expect.objectContaining({
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          where: expect.objectContaining({
            organizationId: org,
            branchId: branch,
          }),
        }),
      );
    },
  );
  it('hides inaccessible POS branches and foreign organizations', async () => {
    prisma.branch.findFirst.mockResolvedValueOnce(null);
    await http()
      .get(posPath)
      .auth(token(cashier), { type: 'bearer' })
      .expect(404);
    expect(prisma.branchInventory.findMany).not.toHaveBeenCalled();
    await http()
      .get(posPath.replace(org, item))
      .auth(token(), { type: 'bearer' })
      .expect(404);
  });
  it.each([
    '/code',
    '/code?code=',
    '/code?code=bad%20code',
    '/code?code=' + 'A'.repeat(65),
    '?q=' + 'A'.repeat(255),
    '?merchantId=' + item,
    '/code?code=OK&q=test',
  ])('rejects malformed or extra POS query %s', async (suffix) => {
    await http()
      .get(posPath + suffix)
      .auth(token(), { type: 'bearer' })
      .expect(400);
    expect(prisma.branchInventory.findMany).not.toHaveBeenCalled();
  });
  it('hides an unassigned branch before business operations', async () => {
    prisma.branch.findFirst.mockResolvedValueOnce(null);
    await http()
      .get(inventoryPath)
      .auth(token(manager), { type: 'bearer' })
      .expect(404);
    expect(inventory.findAll).not.toHaveBeenCalled();
  });
  it('rejects unassigned manager stock writes before touching the ledger', async () => {
    prisma.branch.findFirst.mockResolvedValueOnce(null);
    await http()
      .post(`${inventoryPath}/${item}/receipts`)
      .auth(token(manager), { type: 'bearer' })
      .send({ quantity: 1, reason: 'Delivery', requestId: item })
      .expect(404);
    expect(stock.receive).not.toHaveBeenCalled();
  });
  it('hides cross-merchant inventory and movement IDs', async () => {
    for (const suffix of ['', '/movements']) {
      prisma.branchInventory.findFirst.mockResolvedValueOnce(null);
      await http()
        .get(`${inventoryPath}/${item}${suffix}`)
        .auth(token(merchant), { type: 'bearer' })
        .expect(404);
    }
    expect(inventory.findOne).not.toHaveBeenCalled();
    expect(inventory.findMovements).not.toHaveBeenCalled();
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
  it('passes trusted merchant scope to the inventory health summary', async () => {
    await http()
      .get(`${inventoryPath}/summary`)
      .auth(token(merchant), { type: 'bearer' })
      .expect(200);
    expect(inventory.summarize).toHaveBeenCalledWith(
      org,
      branch,
      expect.objectContaining({ role: 'MERCHANT', merchantId: null }),
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
      method: 'patch',
      path: `${inventoryPath}/${item}/threshold`,
      body: { lowStockThreshold: 3 },
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
      actor,
    );
  });

  it('passes a validated placement threshold without tenant fields', async () => {
    await http()
      .post(inventoryPath)
      .auth(token(), { type: 'bearer' })
      .send({
        productId: item,
        sellingPrice: '12.50',
        lowStockThreshold: 0,
      })
      .expect(201);
    expect(inventory.create).toHaveBeenCalledWith(org, branch, {
      productId: item,
      sellingPrice: '12.50',
      lowStockThreshold: 0,
    });
  });

  it('passes validated opening stock and the authenticated owner to product creation', async () => {
    await http()
      .post(productsPath)
      .auth(token(), { type: 'bearer' })
      .send({
        merchantId: item,
        name: ' Vase ',
        requestId: item.toUpperCase(),
        initialInventory: {
          branchId: branch.toUpperCase(),
          sellingPrice: ' 12.50 ',
          quantity: 3,
          lowStockThreshold: 0,
        },
      })
      .expect(201);
    expect(products.create).toHaveBeenCalledWith(
      org,
      expect.objectContaining({
        name: 'Vase',
        requestId: item,
        initialInventory: {
          branchId: branch,
          sellingPrice: '12.50',
          quantity: 3,
          lowStockThreshold: 0,
        },
      }),
      actor,
    );
  });

  it.each([manager, cashier, merchant])(
    'denies opening stock creation for non-owner %s',
    async (userId) => {
      await http()
        .post(productsPath)
        .auth(token(userId), { type: 'bearer' })
        .send({
          merchantId: item,
          name: 'Vase',
          requestId: item,
          initialInventory: {
            branchId: branch,
            sellingPrice: '1',
            quantity: 1,
          },
        })
        .expect(403);
      expect(products.create).not.toHaveBeenCalled();
    },
  );

  it.each([
    { requestId: item },
    { initialInventory: { branchId: branch, sellingPrice: '1', quantity: 1 } },
    { requestId: item, initialInventory: null },
    {
      requestId: item,
      initialInventory: { branchId: branch, sellingPrice: '1', quantity: '1' },
    },
    {
      requestId: item,
      initialInventory: {
        branchId: branch,
        sellingPrice: '1',
        quantity: 2147483648,
      },
    },
    {
      requestId: item,
      initialInventory: {
        branchId: branch,
        sellingPrice: '1',
        quantity: 1,
        createdById: actor,
      },
    },
  ])('rejects invalid opening stock at the HTTP boundary %j', async (extra) => {
    await http()
      .post(productsPath)
      .auth(token(), { type: 'bearer' })
      .send({ merchantId: item, name: 'Vase', ...extra })
      .expect(400);
    expect(products.create).not.toHaveBeenCalled();
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

  it.each([-1, 1.5, '5', 2147483648, null])(
    'rejects invalid threshold at the HTTP boundary %s',
    async (lowStockThreshold) => {
      await http()
        .patch(`${inventoryPath}/${item}/threshold`)
        .auth(token(), { type: 'bearer' })
        .send({ lowStockThreshold })
        .expect(400);
      expect(inventory.updateThreshold).not.toHaveBeenCalled();
    },
  );
});
