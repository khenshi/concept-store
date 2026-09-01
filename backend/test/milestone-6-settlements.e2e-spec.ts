import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { OPENAPI_JSON_PATH, setupSwagger } from '../src/config/swagger';
import { OrganizationRole, PayoutMethod } from '../src/generated/prisma/client';
import { PrismaService } from '../src/infrastructure/database/prisma.service';
import { AuthGuard } from '../src/modules/auth/auth.guard';
import { OrganizationAccessGuard } from '../src/modules/organizations/authorization/organization-access.guard';
import { SettlementsController } from '../src/modules/settlements/settlements.controller';
import { SettlementsService } from '../src/modules/settlements/settlements.service';

const OWNER_ID = '11111111-1111-4111-8111-111111111111';
const MANAGER_ID = '22222222-2222-4222-8222-222222222222';
const CASHIER_ID = '33333333-3333-4333-8333-333333333333';
const ORGANIZATION_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const OTHER_ORGANIZATION_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const MERCHANT_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const SETTLEMENT_ID = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const ENTRY_ID = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';

describe('Milestone 6 merchant finance API (e2e)', () => {
  let app: INestApplication;
  let jwt: JwtService;
  const finance = {
    findLivePayables: jest.fn().mockResolvedValue([]),
    closeLivePayable: jest.fn().mockResolvedValue({ id: SETTLEMENT_ID }),
    addAccountEntry: jest.fn().mockResolvedValue({ merchantId: MERCHANT_ID }),
    removeAccountEntry: jest
      .fn()
      .mockResolvedValue({ merchantId: MERCHANT_ID }),
    approve: jest.fn().mockResolvedValue({ id: SETTLEMENT_ID }),
    recordPayout: jest.fn().mockResolvedValue({ id: SETTLEMENT_ID }),
    findAll: jest
      .fn()
      .mockResolvedValue({ items: [], total: 0, offset: 0, limit: 30 }),
    summary: jest.fn().mockResolvedValue({}),
    findOne: jest.fn().mockResolvedValue({ id: SETTLEMENT_ID }),
  };
  const roles: Record<string, OrganizationRole> = {
    [OWNER_ID]: OrganizationRole.OWNER,
    [MANAGER_ID]: OrganizationRole.MANAGER,
    [CASHIER_ID]: OrganizationRole.CASHIER,
  };
  const prisma = {
    user: {
      findFirst: jest.fn(({ where }: { where: { id: string } }) =>
        Promise.resolve(roles[where.id] ? { id: where.id } : null),
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
          const role = roles[context.userId];
          return Promise.resolve(
            context.organizationId === ORGANIZATION_ID && role
              ? { role }
              : null,
          );
        },
      ),
    },
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        JwtModule.register({
          secret: 'milestone-6-e2e-secret-at-least-32-characters',
        }),
      ],
      controllers: [SettlementsController],
      providers: [
        AuthGuard,
        OrganizationAccessGuard,
        Reflector,
        { provide: PrismaService, useValue: prisma },
        { provide: SettlementsService, useValue: finance },
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
    jwt = moduleRef.get(JwtService);
  });

  afterAll(async () => app.close());
  beforeEach(() => jest.clearAllMocks());
  const token = (userId: string) =>
    jwt.sign({ email: `${userId}@example.com` }, { subject: userId });

  it('enforces authentication, finance roles, and tenant concealment', async () => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    await request(app.getHttpServer())
      .get(`/organizations/${ORGANIZATION_ID}/settlements/payables`)
      .expect(401);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    await request(app.getHttpServer())
      .get(`/organizations/${ORGANIZATION_ID}/settlements/payables`)
      .set('Authorization', `Bearer ${token(CASHIER_ID)}`)
      .expect(403);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    await request(app.getHttpServer())
      .get(`/organizations/${OTHER_ORGANIZATION_ID}/settlements/payables`)
      .set('Authorization', `Bearer ${token(OWNER_ID)}`)
      .expect(404);
  });

  it('lists and closes live payables using trusted context', async () => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    await request(app.getHttpServer())
      .get(`/organizations/${ORGANIZATION_ID}/settlements/payables`)
      .set('Authorization', `Bearer ${token(MANAGER_ID)}`)
      .expect(200, []);
    expect(finance.findLivePayables).toHaveBeenCalledWith(
      ORGANIZATION_ID,
      undefined,
      undefined,
    );
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    await request(app.getHttpServer())
      .post(
        `/organizations/${ORGANIZATION_ID}/settlements/payables/${MERCHANT_ID}/close`,
      )
      .set('Authorization', `Bearer ${token(MANAGER_ID)}`)
      .expect(201, { id: SETTLEMENT_ID });
    expect(finance.closeLivePayable).toHaveBeenCalledWith(
      ORGANIZATION_ID,
      MERCHANT_ID,
      MANAGER_ID,
    );
  });

  it('validates explicit merchant finance entries', async () => {
    const entry = {
      type: 'MERCHANT_PAYMENT',
      amount: '2500.00',
      reason: 'December rent payment',
    };
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    await request(app.getHttpServer())
      .post(
        `/organizations/${ORGANIZATION_ID}/settlements/payables/${MERCHANT_ID}/entries`,
      )
      .set('Authorization', `Bearer ${token(MANAGER_ID)}`)
      .send(entry)
      .expect(201);
    expect(finance.addAccountEntry).toHaveBeenCalledWith(
      ORGANIZATION_ID,
      MERCHANT_ID,
      MANAGER_ID,
      entry,
    );
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    await request(app.getHttpServer())
      .delete(
        `/organizations/${ORGANIZATION_ID}/settlements/payables/${MERCHANT_ID}/entries/${ENTRY_ID}`,
      )
      .set('Authorization', `Bearer ${token(MANAGER_ID)}`)
      .expect(200);
  });

  it('keeps approval and payout owner-only', async () => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    await request(app.getHttpServer())
      .post(
        `/organizations/${ORGANIZATION_ID}/settlements/${SETTLEMENT_ID}/approve`,
      )
      .set('Authorization', `Bearer ${token(MANAGER_ID)}`)
      .expect(403);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    await request(app.getHttpServer())
      .post(
        `/organizations/${ORGANIZATION_ID}/settlements/${SETTLEMENT_ID}/approve`,
      )
      .set('Authorization', `Bearer ${token(OWNER_ID)}`)
      .expect(200);
    const payout = {
      method: PayoutMethod.GCASH,
      referenceNumber: 'REF-1',
      paidAt: '2020-08-30T04:00:00.000Z',
    };
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    await request(app.getHttpServer())
      .post(
        `/organizations/${ORGANIZATION_ID}/settlements/${SETTLEMENT_ID}/payout`,
      )
      .set('Authorization', `Bearer ${token(OWNER_ID)}`)
      .send(payout)
      .expect(200);
  });

  it('publishes current finance routes and omits the legacy review flow', async () => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    const response = await request(app.getHttpServer())
      .get(`/${OPENAPI_JSON_PATH}`)
      .expect(200);
    expect(response.text).toContain(
      '"/organizations/{organizationId}/settlements/payables"',
    );
    expect(response.text).toContain(
      '"/organizations/{organizationId}/settlements/payables/{merchantId}/close"',
    );
    expect(response.text).not.toContain('return-to-draft');
  });
});
