import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { OPENAPI_JSON_PATH, setupSwagger } from '../src/config/swagger';
import {
  OrganizationRole,
  SettlementStatus,
} from '../src/generated/prisma/client';
import { PrismaService } from '../src/infrastructure/database/prisma.service';
import { AuthGuard } from '../src/modules/auth/auth.guard';
import { OrganizationAccessGuard } from '../src/modules/organizations/authorization/organization-access.guard';
import { SettlementsController } from '../src/modules/settlements/settlements.controller';
import { SettlementsService } from '../src/modules/settlements/settlements.service';

const OWNER_ID = '11111111-1111-4111-8111-111111111111';
const MANAGER_ID = '22222222-2222-4222-8222-222222222222';
const CASHIER_ID = '33333333-3333-4333-8333-333333333333';
const MERCHANT_USER_ID = '44444444-4444-4444-8444-444444444444';
const ORGANIZATION_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const OTHER_ORGANIZATION_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const MERCHANT_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const SETTLEMENT_ID = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

describe('Milestone 6 settlement read and generation API (e2e)', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  const settlementsService = {
    generateDraft: jest.fn().mockResolvedValue({ id: SETTLEMENT_ID }),
    findAll: jest
      .fn()
      .mockResolvedValue({ items: [], total: 0, offset: 0, limit: 30 }),
    findOne: jest.fn().mockResolvedValue({ id: SETTLEMENT_ID }),
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
          secret: 'milestone-6-e2e-secret-at-least-32-characters',
        }),
      ],
      controllers: [SettlementsController],
      providers: [
        AuthGuard,
        OrganizationAccessGuard,
        Reflector,
        { provide: PrismaService, useValue: prismaService },
        { provide: SettlementsService, useValue: settlementsService },
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

  it('rejects unauthenticated settlement access', async () => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    await request(app.getHttpServer())
      .get(`/organizations/${ORGANIZATION_ID}/settlements`)
      .expect(401);
  });

  it('conceals an organization without membership', async () => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    await request(app.getHttpServer())
      .get(`/organizations/${OTHER_ORGANIZATION_ID}/settlements`)
      .set('Authorization', `Bearer ${token(OWNER_ID, 'owner@example.com')}`)
      .expect(404);
    expect(settlementsService.findAll).not.toHaveBeenCalled();
  });

  it.each([
    [CASHIER_ID, 'cashier@example.com'],
    [MERCHANT_USER_ID, 'merchant@example.com'],
  ])('forbids non-finance role access', async (userId, email) => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    await request(app.getHttpServer())
      .get(`/organizations/${ORGANIZATION_ID}/settlements`)
      .set('Authorization', `Bearer ${token(userId, email)}`)
      .expect(403);
    expect(settlementsService.findAll).not.toHaveBeenCalled();
  });

  it('generates a draft with validated dates and the trusted actor', async () => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    await request(app.getHttpServer())
      .post(`/organizations/${ORGANIZATION_ID}/settlements`)
      .set(
        'Authorization',
        `Bearer ${token(MANAGER_ID, 'manager@example.com')}`,
      )
      .send({
        merchantId: MERCHANT_ID,
        periodStart: '2026-07-01',
        periodEnd: '2026-07-31',
      })
      .expect(201, { id: SETTLEMENT_ID });
    expect(settlementsService.generateDraft).toHaveBeenCalledWith(
      ORGANIZATION_ID,
      MERCHANT_ID,
      MANAGER_ID,
      '2026-07-01',
      '2026-07-31',
    );
  });

  it('rejects malformed or client-calculated settlement input', async () => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    await request(app.getHttpServer())
      .post(`/organizations/${ORGANIZATION_ID}/settlements`)
      .set('Authorization', `Bearer ${token(OWNER_ID, 'owner@example.com')}`)
      .send({
        merchantId: MERCHANT_ID,
        periodStart: '07/01/2026',
        periodEnd: '2026-07-31',
        netPayout: '999999.00',
      })
      .expect(400);
    expect(settlementsService.generateDraft).not.toHaveBeenCalled();
  });

  it('validates and forwards organization settlement filters', async () => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    await request(app.getHttpServer())
      .get(`/organizations/${ORGANIZATION_ID}/settlements`)
      .query({
        merchantId: MERCHANT_ID,
        status: SettlementStatus.DRAFT,
        periodFrom: '2026-01-01',
        periodTo: '2026-07-31',
        offset: '10',
        limit: '20',
      })
      .set('Authorization', `Bearer ${token(OWNER_ID, 'owner@example.com')}`)
      .expect(200);
    expect(settlementsService.findAll).toHaveBeenCalledWith(ORGANIZATION_ID, {
      merchantId: MERCHANT_ID,
      status: SettlementStatus.DRAFT,
      periodFrom: '2026-01-01',
      periodTo: '2026-07-31',
      offset: 10,
      limit: 20,
    });
  });

  it('rejects invalid filters before querying settlements', async () => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    await request(app.getHttpServer())
      .get(`/organizations/${ORGANIZATION_ID}/settlements`)
      .query({ status: 'FINAL', limit: '1000' })
      .set('Authorization', `Bearer ${token(OWNER_ID, 'owner@example.com')}`)
      .expect(400);
    expect(settlementsService.findAll).not.toHaveBeenCalled();
  });

  it('routes settlement detail through trusted tenant context', async () => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    await request(app.getHttpServer())
      .get(`/organizations/${ORGANIZATION_ID}/settlements/${SETTLEMENT_ID}`)
      .set('Authorization', `Bearer ${token(OWNER_ID, 'owner@example.com')}`)
      .expect(200, { id: SETTLEMENT_ID });
    expect(settlementsService.findOne).toHaveBeenCalledWith(
      ORGANIZATION_ID,
      SETTLEMENT_ID,
    );
  });

  it('publishes settlement routes and response contracts in OpenAPI', async () => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    const response = await request(app.getHttpServer())
      .get(`/${OPENAPI_JSON_PATH}`)
      .expect(200);
    expect(response.text).toContain(
      '"/organizations/{organizationId}/settlements"',
    );
    expect(response.text).toContain(
      '"/organizations/{organizationId}/settlements/{settlementId}"',
    );
    expect(response.text).toContain('"SettlementResponseDto"');
    expect(response.text).toContain('"SettlementPageResponseDto"');
  });
});
