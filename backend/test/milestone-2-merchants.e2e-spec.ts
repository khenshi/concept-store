import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { OPENAPI_JSON_PATH, setupSwagger } from '../src/config/swagger';
import {
  MerchantStatus,
  OrganizationRole,
} from '../src/generated/prisma/client';
import { PrismaService } from '../src/infrastructure/database/prisma.service';
import { AuthGuard } from '../src/modules/auth/auth.guard';
import { MerchantsController } from '../src/modules/merchants/merchants.controller';
import { MerchantsService } from '../src/modules/merchants/merchants.service';
import { OrganizationAccessGuard } from '../src/modules/organizations/authorization/organization-access.guard';

const OWNER_ID = '11111111-1111-4111-8111-111111111111';
const MANAGER_ID = '22222222-2222-4222-8222-222222222222';
const CASHIER_ID = '33333333-3333-4333-8333-333333333333';
const MERCHANT_USER_ID = '44444444-4444-4444-8444-444444444444';
const ORGANIZATION_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const OTHER_ORGANIZATION_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const MERCHANT_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const BRANCH_ID = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

describe('Milestone 2 merchant API access (e2e)', () => {
  let app: INestApplication;
  let jwtService: JwtService;

  const merchantsService = {
    create: jest.fn().mockResolvedValue({ id: MERCHANT_ID }),
    findAll: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue({ id: MERCHANT_ID }),
    update: jest.fn().mockResolvedValue({ id: MERCHANT_ID }),
    updateStatus: jest.fn().mockResolvedValue({
      id: MERCHANT_ID,
      status: MerchantStatus.SUSPENDED,
    }),
    updateBranches: jest.fn().mockResolvedValue({ id: MERCHANT_ID }),
  };
  const rolesByUserId: Record<string, OrganizationRole> = {
    [OWNER_ID]: OrganizationRole.OWNER,
    [MANAGER_ID]: OrganizationRole.MANAGER,
    [CASHIER_ID]: OrganizationRole.CASHIER,
    [MERCHANT_USER_ID]: OrganizationRole.MERCHANT,
  };
  const prismaService = {
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
          secret: 'milestone-2-e2e-secret-at-least-32-characters',
        }),
      ],
      controllers: [MerchantsController],
      providers: [
        AuthGuard,
        OrganizationAccessGuard,
        Reflector,
        { provide: PrismaService, useValue: prismaService },
        { provide: MerchantsService, useValue: merchantsService },
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

  function accessToken(userId: string, email: string): string {
    return jwtService.sign({ email }, { subject: userId });
  }

  it('rejects an unauthenticated merchant request', async () => {
    // Nest's adapter is intentionally framework-agnostic; supertest accepts it.
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    await request(app.getHttpServer())
      .get(`/organizations/${ORGANIZATION_ID}/merchants`)
      .expect(401);

    expect(merchantsService.findAll).not.toHaveBeenCalled();
  });

  it('hides merchant routes for an organization without membership', async () => {
    const token = accessToken(OWNER_ID, 'owner@example.com');

    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    await request(app.getHttpServer())
      .get(`/organizations/${OTHER_ORGANIZATION_ID}/merchants`)
      .set('Authorization', `Bearer ${token}`)
      .expect(404);

    expect(merchantsService.findAll).not.toHaveBeenCalled();
  });

  it.each([
    [CASHIER_ID, 'cashier@example.com'],
    [MERCHANT_USER_ID, 'merchant@example.com'],
  ])('forbids an unauthorized organization role', async (userId, email) => {
    const token = accessToken(userId, email);

    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    await request(app.getHttpServer())
      .get(`/organizations/${ORGANIZATION_ID}/merchants`)
      .set('Authorization', `Bearer ${token}`)
      .expect(403);

    expect(merchantsService.findAll).not.toHaveBeenCalled();
  });

  it('allows a manager to list merchants with normalized filters', async () => {
    const token = accessToken(MANAGER_ID, 'manager@example.com');

    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    await request(app.getHttpServer())
      .get(`/organizations/${ORGANIZATION_ID}/merchants`)
      .query({ search: '  amihan  ', status: MerchantStatus.ACTIVE })
      .set('Authorization', `Bearer ${token}`)
      .expect(200, []);

    expect(merchantsService.findAll).toHaveBeenCalledWith(ORGANIZATION_ID, {
      search: 'amihan',
      status: MerchantStatus.ACTIVE,
    });
  });

  it('allows an owner to create a normalized merchant profile', async () => {
    const token = accessToken(OWNER_ID, 'owner@example.com');

    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    await request(app.getHttpServer())
      .post(`/organizations/${ORGANIZATION_ID}/merchants`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: '  Amihan Goods  ',
        code: ' amihan-01 ',
        contactName: '  Maria Santos  ',
        email: '  MARIA@AMIHAN.EXAMPLE  ',
        phone: '  +63 917 123 4567  ',
        branchIds: [BRANCH_ID],
      })
      .expect(201, { id: MERCHANT_ID });

    expect(merchantsService.create).toHaveBeenCalledWith(ORGANIZATION_ID, {
      name: 'Amihan Goods',
      code: 'AMIHAN-01',
      contactName: 'Maria Santos',
      email: 'maria@amihan.example',
      phone: '+63 917 123 4567',
      branchIds: [BRANCH_ID],
    });
  });

  it('rejects a merchant without the required contact fields', async () => {
    const token = accessToken(OWNER_ID, 'owner@example.com');

    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    await request(app.getHttpServer())
      .post(`/organizations/${ORGANIZATION_ID}/merchants`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Amihan Goods' })
      .expect(400);

    expect(merchantsService.create).not.toHaveBeenCalled();
  });

  it('normalizes partial profile updates and permits clearing the code', async () => {
    const token = accessToken(MANAGER_ID, 'manager@example.com');

    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    await request(app.getHttpServer())
      .patch(`/organizations/${ORGANIZATION_ID}/merchants/${MERCHANT_ID}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ code: '', email: '  NEW@AMIHAN.EXAMPLE ' })
      .expect(200, { id: MERCHANT_ID });

    expect(merchantsService.update).toHaveBeenCalledWith(
      ORGANIZATION_ID,
      MERCHANT_ID,
      { code: null, email: 'new@amihan.example' },
    );
  });

  it('allows a manager to change merchant status', async () => {
    const token = accessToken(MANAGER_ID, 'manager@example.com');

    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    await request(app.getHttpServer())
      .patch(
        `/organizations/${ORGANIZATION_ID}/merchants/${MERCHANT_ID}/status`,
      )
      .set('Authorization', `Bearer ${token}`)
      .send({ status: MerchantStatus.SUSPENDED })
      .expect(200, { id: MERCHANT_ID, status: MerchantStatus.SUSPENDED });

    expect(merchantsService.updateStatus).toHaveBeenCalledWith(
      ORGANIZATION_ID,
      MERCHANT_ID,
      { status: MerchantStatus.SUSPENDED },
    );
  });

  it('allows a manager to replace merchant branch assignments', async () => {
    const token = accessToken(MANAGER_ID, 'manager@example.com');

    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    await request(app.getHttpServer())
      .put(
        `/organizations/${ORGANIZATION_ID}/merchants/${MERCHANT_ID}/branches`,
      )
      .set('Authorization', `Bearer ${token}`)
      .send({ branchIds: [BRANCH_ID] })
      .expect(200, { id: MERCHANT_ID });

    expect(merchantsService.updateBranches).toHaveBeenCalledWith(
      ORGANIZATION_ID,
      MERCHANT_ID,
      { branchIds: [BRANCH_ID] },
    );
  });

  it('publishes the merchant routes and schema in OpenAPI', async () => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    const response = await request(app.getHttpServer())
      .get(`/${OPENAPI_JSON_PATH}`)
      .expect(200);

    expect(response.text).toContain(
      '"/organizations/{organizationId}/merchants"',
    );
    expect(response.text).toContain(
      '"/organizations/{organizationId}/merchants/{merchantId}/status"',
    );
    expect(response.text).toContain(
      '"/organizations/{organizationId}/merchants/{merchantId}/branches"',
    );
    expect(response.text).toContain('"MerchantResponseDto"');
  });
});
