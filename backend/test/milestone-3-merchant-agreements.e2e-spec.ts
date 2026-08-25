import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { OPENAPI_JSON_PATH, setupSwagger } from '../src/config/swagger';
import {
  OrganizationRole,
  SettlementSchedule,
} from '../src/generated/prisma/client';
import { PrismaService } from '../src/infrastructure/database/prisma.service';
import { AuthGuard } from '../src/modules/auth/auth.guard';
import { MerchantAgreementsController } from '../src/modules/merchant-agreements/merchant-agreements.controller';
import { MerchantAgreementsService } from '../src/modules/merchant-agreements/merchant-agreements.service';
import { OrganizationAccessGuard } from '../src/modules/organizations/authorization/organization-access.guard';

const OWNER_ID = '11111111-1111-4111-8111-111111111111';
const CASHIER_ID = '33333333-3333-4333-8333-333333333333';
const ORGANIZATION_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const OTHER_ORGANIZATION_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const MERCHANT_ID = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
const AGREEMENT_ID = '99999999-9999-4999-8999-999999999999';

describe('Milestone 3 merchant agreement API access (e2e)', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  const service = {
    create: jest.fn().mockResolvedValue({ id: AGREEMENT_ID }),
    findAll: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue({ id: AGREEMENT_ID }),
    update: jest.fn().mockResolvedValue({ id: AGREEMENT_ID }),
    activate: jest.fn().mockResolvedValue({ id: AGREEMENT_ID }),
    end: jest.fn().mockResolvedValue({ id: AGREEMENT_ID }),
  };
  const rolesByUserId: Record<string, OrganizationRole> = {
    [OWNER_ID]: OrganizationRole.OWNER,
    [CASHIER_ID]: OrganizationRole.CASHIER,
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
          secret: 'milestone-3-e2e-secret-at-least-32-characters',
        }),
      ],
      controllers: [MerchantAgreementsController],
      providers: [
        AuthGuard,
        OrganizationAccessGuard,
        Reflector,
        { provide: PrismaService, useValue: prismaService },
        { provide: MerchantAgreementsService, useValue: service },
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

  it('conceals an organization without membership', async () => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    await request(app.getHttpServer())
      .get(
        `/organizations/${OTHER_ORGANIZATION_ID}/merchants/${MERCHANT_ID}/agreements`,
      )
      .set('Authorization', `Bearer ${token(OWNER_ID, 'owner@example.com')}`)
      .expect(404);
    expect(service.findAll).not.toHaveBeenCalled();
  });

  it('forbids a cashier from agreement management', async () => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    await request(app.getHttpServer())
      .get(
        `/organizations/${ORGANIZATION_ID}/merchants/${MERCHANT_ID}/agreements`,
      )
      .set(
        'Authorization',
        `Bearer ${token(CASHIER_ID, 'cashier@example.com')}`,
      )
      .expect(403);
  });

  it('creates a normalized draft agreement', async () => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    await request(app.getHttpServer())
      .post(
        `/organizations/${ORGANIZATION_ID}/merchants/${MERCHANT_ID}/agreements`,
      )
      .set('Authorization', `Bearer ${token(OWNER_ID, 'owner@example.com')}`)
      .send({
        startDate: '2026-09-01',
        fixedRentAmount: ' 2500.00 ',
        commissionRate: ' 5.00 ',
        settlementSchedule: SettlementSchedule.MONTHLY,
      })
      .expect(201, { id: AGREEMENT_ID });
    expect(service.create).toHaveBeenCalledWith(ORGANIZATION_ID, MERCHANT_ID, {
      startDate: '2026-09-01',
      fixedRentAmount: '2500.00',
      commissionRate: '5.00',
      settlementSchedule: SettlementSchedule.MONTHLY,
    });
  });

  it('rejects zero and over-limit commercial values', async () => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    await request(app.getHttpServer())
      .post(
        `/organizations/${ORGANIZATION_ID}/merchants/${MERCHANT_ID}/agreements`,
      )
      .set('Authorization', `Bearer ${token(OWNER_ID, 'owner@example.com')}`)
      .send({
        startDate: '2026-09-01',
        fixedRentAmount: '0.00',
        commissionRate: '100.01',
        settlementSchedule: SettlementSchedule.MONTHLY,
      })
      .expect(400);
    expect(service.create).not.toHaveBeenCalled();
  });

  it('activates an agreement without accepting client lifecycle state', async () => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    await request(app.getHttpServer())
      .patch(
        `/organizations/${ORGANIZATION_ID}/merchant-agreements/${AGREEMENT_ID}/activate`,
      )
      .set('Authorization', `Bearer ${token(OWNER_ID, 'owner@example.com')}`)
      .send({})
      .expect(200, { id: AGREEMENT_ID });
    expect(service.activate).toHaveBeenCalledWith(
      ORGANIZATION_ID,
      AGREEMENT_ID,
    );
  });

  it('ends an agreement using a date-only value', async () => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    await request(app.getHttpServer())
      .patch(
        `/organizations/${ORGANIZATION_ID}/merchant-agreements/${AGREEMENT_ID}/end`,
      )
      .set('Authorization', `Bearer ${token(OWNER_ID, 'owner@example.com')}`)
      .send({ endDate: '2026-08-25' })
      .expect(200, { id: AGREEMENT_ID });
    expect(service.end).toHaveBeenCalledWith(ORGANIZATION_ID, AGREEMENT_ID, {
      endDate: '2026-08-25',
    });
  });

  it('publishes agreement routes and schema in OpenAPI', async () => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    const response = await request(app.getHttpServer())
      .get(`/${OPENAPI_JSON_PATH}`)
      .expect(200);
    expect(response.text).toContain(
      '"/organizations/{organizationId}/merchants/{merchantId}/agreements"',
    );
    expect(response.text).toContain(
      '"/organizations/{organizationId}/merchant-agreements/{agreementId}/activate"',
    );
    expect(response.text).toContain('"MerchantAgreementResponseDto"');
  });
});
