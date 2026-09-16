import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import request from 'supertest';
import { PrismaService } from '../src/infrastructure/database/prisma.service';
import { AuthGuard } from '../src/modules/auth/auth.guard';
import { OrganizationAccessGuard } from '../src/modules/organizations/authorization/organization-access.guard';
import { RefundsController } from '../src/modules/organizations/refunds/refunds.controller';
import { RefundsService } from '../src/modules/organizations/refunds/refunds.service';
import { RefundReadController } from '../src/modules/organizations/refunds/refund-read.controller';
import { RefundReadService } from '../src/modules/organizations/refunds/refund-read.service';
const org = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const branch = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const sale = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const actor = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const path = `/organizations/${org}/branches/${branch}/sales/${sale}/refunds`;
const valid = {
  requestId: actor,
  items: [{ saleItemId: actor, quantity: 2 }],
  reason: 'Returned goods',
  paymentMethod: 'CASH',
  refundConfirmed: true,
};
describe('Refund command HTTP/OpenAPI boundaries', () => {
  let app: INestApplication;
  let jwt: JwtService;
  let role = 'OWNER';
  const refunds = { complete: jest.fn() };
  const reads = { findAll: jest.fn(), findOne: jest.fn() };
  const prisma = {
    user: { findFirst: jest.fn() },
    organizationMembership: { findUnique: jest.fn() },
  };
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
  const http = () => request(app.getHttpServer());
  const token = () =>
    jwt.sign({ email: 'refund@example.test' }, { subject: actor });
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [JwtModule.register({ secret: 'refund-http-test-only' })],
      controllers: [RefundsController, RefundReadController],
      providers: [
        AuthGuard,
        OrganizationAccessGuard,
        Reflector,
        { provide: PrismaService, useValue: prisma },
        { provide: RefundsService, useValue: refunds },
        { provide: RefundReadService, useValue: reads },
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
          where.organizationId_userId.organizationId === org ? { role } : null,
        ),
    );
    refunds.complete.mockResolvedValue({ scope: 'STAFF', total: '25.00' });
    reads.findAll.mockResolvedValue({
      scope: 'STAFF',
      items: [],
      remainingItems: [],
      page: 1,
      limit: 50,
      total: 0,
      totalPages: 0,
    });
    reads.findOne.mockResolvedValue({ scope: 'STAFF', total: '25.00' });
  });
  it.each(['OWNER', 'MANAGER', 'MERCHANT'])(
    'allows %s to call refund reads but not wider write roles',
    async (current) => {
      role = current;
      await http().get(path).auth(token(), { type: 'bearer' }).expect(200);
      expect(reads.findAll).toHaveBeenCalledWith(
        expect.objectContaining({ organizationId: org, userId: actor, role }),
        branch,
        sale,
        expect.objectContaining({ page: 1, limit: 50 }),
      );
      await http()
        .get(`${path}/${actor}`)
        .auth(token(), { type: 'bearer' })
        .expect(200);
      expect(reads.findOne).toHaveBeenCalledWith(
        expect.objectContaining({ role }),
        branch,
        sale,
        actor,
      );
    },
  );
  it('denies cashier refund reads and requires authentication/tenant membership', async () => {
    await http().get(path).expect(401);
    await http().get(`${path}/${actor}`).expect(401);
    await http()
      .get(path.replace(org, actor))
      .auth(token(), { type: 'bearer' })
      .expect(404);
    role = 'CASHIER';
    await http().get(path).auth(token(), { type: 'bearer' }).expect(403);
    await http()
      .get(`${path}/${actor}`)
      .auth(token(), { type: 'bearer' })
      .expect(403);
    expect(reads.findAll).not.toHaveBeenCalled();
    expect(reads.findOne).not.toHaveBeenCalled();
  });
  it.each([
    { page: '0' },
    { page: '-1' },
    { page: '1.2' },
    { page: '21474837' },
    { page: '1e2' },
    { limit: '0' },
    { limit: '101' },
    { limit: 'x' },
    { merchantId: actor },
    { from: '2026-09-14T00:00:00Z' },
    { limit: ['1', '2'] },
  ])('rejects invalid or unknown refund pagination %j', async (query) => {
    await http()
      .get(path)
      .query(query)
      .auth(token(), { type: 'bearer' })
      .expect(400);
    expect(reads.findAll).not.toHaveBeenCalled();
  });
  it('normalizes read IDs, parses bounded pages and rejects malformed detail queries', async () => {
    await http()
      .get(
        path
          .replace(branch, branch.toUpperCase())
          .replace(sale, sale.toUpperCase()),
      )
      .query({ page: '2', limit: '100' })
      .auth(token(), { type: 'bearer' })
      .expect(200);
    expect(reads.findAll).toHaveBeenCalledWith(
      expect.anything(),
      branch,
      sale,
      expect.objectContaining({ page: 2, limit: 100 }),
    );
    await http()
      .get(`${path}/${actor.toUpperCase()}`)
      .auth(token(), { type: 'bearer' })
      .expect(200);
    expect(reads.findOne).toHaveBeenCalledWith(
      expect.anything(),
      branch,
      sale,
      actor,
    );
    for (const id of [org, branch, sale, actor])
      await http()
        .get(`${path}/${actor}`.replace(id, 'bad'))
        .auth(token(), { type: 'bearer' })
        .expect(400);
    await http()
      .get(`${path}/${actor}`)
      .query({ page: 1 })
      .auth(token(), { type: 'bearer' })
      .expect(400);
  });
  it('documents discriminated staff/merchant reads and excludes private merchant fields', () => {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder().build(),
    );
    const list =
      document.paths[
        '/organizations/{organizationId}/branches/{branchId}/sales/{saleId}/refunds'
      ].get;
    const detail =
      document.paths[
        '/organizations/{organizationId}/branches/{branchId}/sales/{saleId}/refunds/{refundId}'
      ].get;
    expect(list).toMatchObject({
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  { $ref: '#/components/schemas/StaffRefundPageDto' },
                  { $ref: '#/components/schemas/MerchantRefundPageDto' },
                ],
                discriminator: { propertyName: 'scope' },
              },
            },
          },
        },
      },
    });
    expect(detail).toMatchObject({
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  { $ref: '#/components/schemas/CompletedRefundResponseDto' },
                  { $ref: '#/components/schemas/MerchantRefundResponseDto' },
                ],
              },
            },
          },
        },
      },
    });
    const own = document.components?.schemas?.MerchantRefundResponseDto;
    for (const field of [
      'total',
      'paymentMethod',
      'paymentReference',
      'reason',
      'createdById',
      'refundCommand',
      'requestId',
    ])
      expect(own).not.toHaveProperty(`properties.${field}`);
    expect(document.components?.schemas?.MerchantRefundPageDto).toMatchObject({
      properties: {
        scope: { enum: ['MERCHANT'] },
        remainingItems: { type: 'array' },
      },
    });
  });
  it.each(['OWNER', 'MANAGER'])(
    'allows %s and supplies zero-default restock quantities',
    async (current) => {
      role = current;
      await http()
        .post(path)
        .auth(token(), { type: 'bearer' })
        .send(valid)
        .expect(201);
      expect(refunds.complete).toHaveBeenCalledWith(
        expect.objectContaining({ organizationId: org, userId: actor, role }),
        branch,
        sale,
        expect.objectContaining({
          items: [
            expect.objectContaining({
              saleItemId: actor,
              quantity: 2,
              restockQuantity: 0,
            }),
          ],
        }),
      );
    },
  );
  it.each(['GCASH', 'CARD'])(
    'accepts manually confirmed %s with trimmed reference/reason',
    async (paymentMethod) => {
      await http()
        .post(path)
        .auth(token(), { type: 'bearer' })
        .send({
          ...valid,
          paymentMethod,
          paymentReference: ' REF-123 ',
          reason: ' Returned goods ',
        })
        .expect(201);
      expect(refunds.complete).toHaveBeenCalledWith(
        expect.anything(),
        branch,
        sale,
        expect.objectContaining({
          paymentReference: 'REF-123',
          reason: 'Returned goods',
        }),
      );
    },
  );
  it('requires authentication and hides foreign tenant guesses', async () => {
    await http().post(path).send(valid).expect(401);
    await http()
      .post(path.replace(org, actor))
      .auth(token(), { type: 'bearer' })
      .send(valid)
      .expect(404);
    expect(refunds.complete).not.toHaveBeenCalled();
  });
  it.each(['CASHIER', 'MERCHANT'])(
    'denies %s before invoking refund writes',
    async (current) => {
      role = current;
      await http()
        .post(path)
        .auth(token(), { type: 'bearer' })
        .send(valid)
        .expect(403);
      expect(refunds.complete).not.toHaveBeenCalled();
    },
  );
  it.each([
    { ...valid, requestId: 'bad' },
    { ...valid, items: [] },
    { ...valid, items: Array.from({ length: 101 }, () => valid.items[0]) },
    {
      ...valid,
      items: [
        valid.items[0],
        { ...valid.items[0], saleItemId: actor.toUpperCase() },
      ],
    },
    { ...valid, items: [{ saleItemId: actor, quantity: 0 }] },
    { ...valid, items: [{ saleItemId: actor, quantity: 1.5 }] },
    { ...valid, items: [{ saleItemId: actor, quantity: '2' }] },
    { ...valid, items: [{ saleItemId: actor, quantity: 2147483648 }] },
    { ...valid, items: [{ saleItemId: 'bad', quantity: 2 }] },
    { ...valid, items: [{ ...valid.items[0], restockQuantity: -1 }] },
    { ...valid, items: [{ ...valid.items[0], restockQuantity: 3 }] },
    { ...valid, items: [{ ...valid.items[0], restockQuantity: null }] },
    { ...valid, items: [{ ...valid.items[0], expectedUnitPrice: '1.00' }] },
    { ...valid, total: '1.00' },
    { ...valid, merchantId: actor },
    { ...valid, branchInventoryId: actor },
    { ...valid, reason: 'x' },
    { ...valid, reason: 'x'.repeat(501) },
    { ...valid, refundConfirmed: false },
    { ...valid, refundConfirmed: undefined },
    { ...valid, refundConfirmed: 'true' },
    { ...valid, paymentMethod: 'OTHER' },
    { ...valid, paymentReference: null },
    { ...valid, cashTender: '25.00' },
    { ...valid, paymentMethod: 'GCASH' },
    { ...valid, paymentMethod: 'CARD', paymentReference: 'x' },
    { ...valid, paymentMethod: 'CARD', paymentReference: 'x'.repeat(101) },
  ])('rejects invalid/unknown command fields %j', async (command) => {
    await http()
      .post(path)
      .auth(token(), { type: 'bearer' })
      .send(command)
      .expect(400);
    expect(refunds.complete).not.toHaveBeenCalled();
  });
  it('normalizes UUID case and rejects malformed paths/query filters', async () => {
    await http()
      .post(
        path
          .replace(branch, branch.toUpperCase())
          .replace(sale, sale.toUpperCase()),
      )
      .auth(token(), { type: 'bearer' })
      .send({
        ...valid,
        requestId: actor.toUpperCase(),
        items: [{ saleItemId: actor.toUpperCase(), quantity: 2 }],
      })
      .expect(201);
    expect(refunds.complete).toHaveBeenCalledWith(
      expect.anything(),
      branch,
      sale,
      expect.objectContaining({
        requestId: actor,
        items: [expect.objectContaining({ saleItemId: actor })],
      }),
    );
    for (const id of [org, branch, sale])
      await http()
        .post(path.replace(id, 'bad'))
        .auth(token(), { type: 'bearer' })
        .send(valid)
        .expect(400);
    await http()
      .post(path)
      .query({ page: 1 })
      .auth(token(), { type: 'bearer' })
      .send(valid)
      .expect(400);
  });
  it('documents required confirmation, precise staff response and conflicts without private metadata', () => {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder().addBearerAuth(undefined, 'access-token').build(),
    );
    expect(document.components?.schemas?.CreateRefundDto).toMatchObject({
      required: expect.arrayContaining([
        'requestId',
        'items',
        'reason',
        'paymentMethod',
        'refundConfirmed',
      ]) as unknown,
    });
    const response = document.components?.schemas?.CompletedRefundResponseDto;
    expect(response).toMatchObject({
      properties: {
        scope: { enum: ['STAFF'] },
        total: { type: 'string' },
        items: { type: 'array' },
      },
    });
    for (const privateKey of ['requestId', 'refundCommand', 'createdById'])
      expect(response).not.toHaveProperty(`properties.${privateKey}`);
    expect(
      document.paths[
        '/organizations/{organizationId}/branches/{branchId}/sales/{saleId}/refunds'
      ].post?.responses,
    ).toHaveProperty('409');
  });
});
