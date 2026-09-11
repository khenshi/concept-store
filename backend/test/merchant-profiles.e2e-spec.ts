import {
  INestApplication,
  NotFoundException,
  ValidationPipe,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import {
  MerchantStatus,
  OrganizationRole,
} from '../src/generated/prisma/client';
import { PrismaService } from '../src/infrastructure/database/prisma.service';
import { AuthGuard } from '../src/modules/auth/auth.guard';
import { OrganizationAccessGuard } from '../src/modules/organizations/authorization/organization-access.guard';
import { MerchantsController } from '../src/modules/organizations/merchants/merchants.controller';
import { MerchantsService } from '../src/modules/organizations/merchants/merchants.service';

const OWNER_ID = '11111111-1111-4111-8111-111111111111';
const MANAGER_ID = '22222222-2222-4222-8222-222222222222';
const CASHIER_ID = '33333333-3333-4333-8333-333333333333';
const MERCHANT_MEMBER_ID = '44444444-4444-4444-8444-444444444444';
const ORGANIZATION_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const OTHER_ORGANIZATION_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const MERCHANT_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const FOREIGN_MERCHANT_ID = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

describe('Merchant profiles (e2e)', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let storedMerchant: Record<string, unknown> | undefined;

  const roles = new Map([
    [OWNER_ID, OrganizationRole.OWNER],
    [MANAGER_ID, OrganizationRole.MANAGER],
    [CASHIER_ID, OrganizationRole.CASHIER],
    [MERCHANT_MEMBER_ID, OrganizationRole.MERCHANT],
  ]);
  const prismaService = {
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
          const { organizationId, userId } = where.organizationId_userId;
          const role = roles.get(userId);
          return Promise.resolve(
            organizationId === ORGANIZATION_ID && role ? { role } : null,
          );
        },
      ),
    },
  };
  const merchantsService = {
    create: jest.fn((organizationId: string, dto: Record<string, unknown>) => {
      storedMerchant = {
        id: MERCHANT_ID,
        organizationId,
        ...dto,
        status: MerchantStatus.ACTIVE,
      };
      return Promise.resolve(storedMerchant);
    }),
    findAll: jest.fn((organizationId: string) =>
      Promise.resolve(
        storedMerchant?.organizationId === organizationId
          ? [storedMerchant]
          : [],
      ),
    ),
    findOne: jest.fn((organizationId: string, merchantId: string) => {
      if (
        !storedMerchant ||
        storedMerchant.organizationId !== organizationId ||
        storedMerchant.id !== merchantId
      ) {
        return Promise.reject(new NotFoundException('Merchant not found'));
      }
      return Promise.resolve(storedMerchant);
    }),
    update: jest.fn(
      (
        organizationId: string,
        merchantId: string,
        dto: Record<string, unknown>,
      ) => {
        if (merchantId === FOREIGN_MERCHANT_ID) {
          return Promise.reject(new NotFoundException('Merchant not found'));
        }
        storedMerchant = { ...storedMerchant, ...dto, organizationId };
        return Promise.resolve(storedMerchant);
      },
    ),
    updateStatus: jest.fn(
      (
        organizationId: string,
        merchantId: string,
        dto: { status: MerchantStatus },
      ) => {
        if (merchantId === FOREIGN_MERCHANT_ID) {
          return Promise.reject(new NotFoundException('Merchant not found'));
        }
        storedMerchant = {
          ...storedMerchant,
          status: dto.status,
          organizationId,
        };
        return Promise.resolve(storedMerchant);
      },
    ),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        JwtModule.register({
          secret: 'merchant-e2e-secret-at-least-32-characters',
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
    await app.init();
    jwtService = moduleRef.get(JwtService);
  });

  afterAll(async () => app.close());

  beforeEach(() => {
    jest.clearAllMocks();
    storedMerchant = undefined;
  });

  function token(userId: string): string {
    return jwtService.sign(
      { email: `${userId}@example.com` },
      { subject: userId },
    );
  }

  function merchantPath(merchantId = ''): string {
    return `/organizations/${ORGANIZATION_ID}/merchants${merchantId ? `/${merchantId}` : ''}`;
  }

  it.each([
    ['owner', OWNER_ID],
    ['manager', MANAGER_ID],
  ])('allows an %s to list merchants', async (_label, userId) => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    await request(app.getHttpServer())
      .get(merchantPath())
      .set('Authorization', `Bearer ${token(userId)}`)
      .query({ q: ' amihan ', status: MerchantStatus.ACTIVE })
      .expect(200, []);

    expect(merchantsService.findAll).toHaveBeenCalledWith(ORGANIZATION_ID, {
      q: 'amihan',
      status: MerchantStatus.ACTIVE,
    });
  });

  it.each([
    ['cashier', CASHIER_ID],
    ['merchant member', MERCHANT_MEMBER_ID],
  ])('forbids a %s from listing merchants', async (_label, userId) => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    await request(app.getHttpServer())
      .get(merchantPath())
      .set('Authorization', `Bearer ${token(userId)}`)
      .expect(403);

    expect(merchantsService.findAll).not.toHaveBeenCalled();
  });

  it('rejects malformed organization and merchant IDs', async () => {
    const authorization = `Bearer ${token(OWNER_ID)}`;

    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    await request(app.getHttpServer())
      .get('/organizations/not-a-uuid/merchants')
      .set('Authorization', authorization)
      .expect(400);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    await request(app.getHttpServer())
      .get(merchantPath('not-a-uuid'))
      .set('Authorization', authorization)
      .expect(400);
  });

  it('hides every merchant route from a user outside the organization', async () => {
    const authorization = `Bearer ${token(OWNER_ID)}`;
    const base = `/organizations/${OTHER_ORGANIZATION_ID}/merchants`;

    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    await request(app.getHttpServer())
      .get(base)
      .set('Authorization', authorization)
      .expect(404);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    await request(app.getHttpServer())
      .get(`${base}/${MERCHANT_ID}`)
      .set('Authorization', authorization)
      .expect(404);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    await request(app.getHttpServer())
      .patch(`${base}/${MERCHANT_ID}`)
      .set('Authorization', authorization)
      .send({ name: 'Hidden' })
      .expect(404);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    await request(app.getHttpServer())
      .patch(`${base}/${MERCHANT_ID}/status`)
      .set('Authorization', authorization)
      .send({ status: MerchantStatus.ENDED })
      .expect(404);

    expect(merchantsService.findAll).not.toHaveBeenCalled();
    expect(merchantsService.findOne).not.toHaveBeenCalled();
    expect(merchantsService.update).not.toHaveBeenCalled();
    expect(merchantsService.updateStatus).not.toHaveBeenCalled();
  });

  it('returns the same not-found response for a foreign merchant ID', async () => {
    const authorization = `Bearer ${token(OWNER_ID)}`;

    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    await request(app.getHttpServer())
      .get(merchantPath(FOREIGN_MERCHANT_ID))
      .set('Authorization', authorization)
      .expect(404, {
        message: 'Merchant not found',
        error: 'Not Found',
        statusCode: 404,
      });
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    await request(app.getHttpServer())
      .patch(merchantPath(FOREIGN_MERCHANT_ID))
      .set('Authorization', authorization)
      .send({ name: 'Hidden' })
      .expect(404);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    await request(app.getHttpServer())
      .patch(`${merchantPath(FOREIGN_MERCHANT_ID)}/status`)
      .set('Authorization', authorization)
      .send({ status: MerchantStatus.ENDED })
      .expect(404);
  });

  it('rejects unknown and invalid create, query, update, and status values', async () => {
    const authorization = `Bearer ${token(OWNER_ID)}`;
    const validProfile = {
      name: 'Amihan Home Studio',
      contactName: 'Mara Santos',
      phone: '+63 917 555 0101',
    };

    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    await request(app.getHttpServer())
      .post(merchantPath())
      .set('Authorization', authorization)
      .send({ ...validProfile, status: MerchantStatus.ENDED })
      .expect(400);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    await request(app.getHttpServer())
      .post(merchantPath())
      .set('Authorization', authorization)
      .send({ ...validProfile, code: 'bad code', email: 'invalid' })
      .expect(400);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    await request(app.getHttpServer())
      .get(merchantPath())
      .set('Authorization', authorization)
      .query({ status: 'ARCHIVED' })
      .expect(400);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    await request(app.getHttpServer())
      .patch(merchantPath(MERCHANT_ID))
      .set('Authorization', authorization)
      .send({ status: MerchantStatus.ENDED })
      .expect(400);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    await request(app.getHttpServer())
      .patch(`${merchantPath(MERCHANT_ID)}/status`)
      .set('Authorization', authorization)
      .send({ status: 'ARCHIVED' })
      .expect(400);
  });

  it('completes create, read, edit, and confirmed-status API operations', async () => {
    const authorization = `Bearer ${token(MANAGER_ID)}`;

    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    await request(app.getHttpServer())
      .post(merchantPath())
      .set('Authorization', authorization)
      .send({
        name: ' Amihan Home Studio ',
        code: ' amihan-home ',
        contactName: ' Mara Santos ',
        email: ' MARA@AMIHAN.EXAMPLE.COM ',
        phone: ' +63 917 555 0101 ',
      })
      .expect(201)
      .expect(({ body }) =>
        expect(body).toMatchObject({
          id: MERCHANT_ID,
          status: MerchantStatus.ACTIVE,
        }),
      );

    expect(merchantsService.create).toHaveBeenCalledWith(ORGANIZATION_ID, {
      name: 'Amihan Home Studio',
      code: 'AMIHAN-HOME',
      contactName: 'Mara Santos',
      email: 'mara@amihan.example.com',
      phone: '+63 917 555 0101',
    });

    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    await request(app.getHttpServer())
      .get(merchantPath(MERCHANT_ID))
      .set('Authorization', authorization)
      .expect(200);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    await request(app.getHttpServer())
      .patch(merchantPath(MERCHANT_ID))
      .set('Authorization', authorization)
      .send({ name: ' Amihan Studio ', email: '' })
      .expect(200);
    expect(merchantsService.update).toHaveBeenCalledWith(
      ORGANIZATION_ID,
      MERCHANT_ID,
      { name: 'Amihan Studio', email: null },
    );

    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    await request(app.getHttpServer())
      .patch(`${merchantPath(MERCHANT_ID)}/status`)
      .set('Authorization', authorization)
      .send({ status: MerchantStatus.ENDED })
      .expect(200);
    expect(merchantsService.updateStatus).toHaveBeenCalledWith(
      ORGANIZATION_ID,
      MERCHANT_ID,
      { status: MerchantStatus.ENDED },
    );
  });
});
