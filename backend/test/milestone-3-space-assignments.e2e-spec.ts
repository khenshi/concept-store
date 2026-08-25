import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { OPENAPI_JSON_PATH, setupSwagger } from '../src/config/swagger';
import { OrganizationRole } from '../src/generated/prisma/client';
import { PrismaService } from '../src/infrastructure/database/prisma.service';
import { AuthGuard } from '../src/modules/auth/auth.guard';
import { OrganizationAccessGuard } from '../src/modules/organizations/authorization/organization-access.guard';
import { SpaceAssignmentsController } from '../src/modules/spaces/space-assignments/space-assignments.controller';
import { SpaceAssignmentsService } from '../src/modules/spaces/space-assignments/space-assignments.service';

const OWNER_ID = '11111111-1111-4111-8111-111111111111';
const CASHIER_ID = '33333333-3333-4333-8333-333333333333';
const ORGANIZATION_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const OTHER_ORGANIZATION_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const SPACE_ID = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const MERCHANT_ID = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
const ASSIGNMENT_ID = '99999999-9999-4999-8999-999999999999';

describe('Milestone 3 space assignment API access (e2e)', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  const service = {
    create: jest.fn().mockResolvedValue({ id: ASSIGNMENT_ID }),
    findAll: jest.fn().mockResolvedValue([]),
    end: jest.fn().mockResolvedValue({ id: ASSIGNMENT_ID }),
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
      controllers: [SpaceAssignmentsController],
      providers: [
        AuthGuard,
        OrganizationAccessGuard,
        Reflector,
        { provide: PrismaService, useValue: prismaService },
        { provide: SpaceAssignmentsService, useValue: service },
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
        `/organizations/${OTHER_ORGANIZATION_ID}/spaces/${SPACE_ID}/assignments`,
      )
      .set('Authorization', `Bearer ${token(OWNER_ID, 'owner@example.com')}`)
      .expect(404);
    expect(service.findAll).not.toHaveBeenCalled();
  });

  it('forbids a cashier from assignment management', async () => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    await request(app.getHttpServer())
      .get(`/organizations/${ORGANIZATION_ID}/spaces/${SPACE_ID}/assignments`)
      .set(
        'Authorization',
        `Bearer ${token(CASHIER_ID, 'cashier@example.com')}`,
      )
      .expect(403);
  });

  it('accepts a valid assignment request from an owner', async () => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    await request(app.getHttpServer())
      .post(`/organizations/${ORGANIZATION_ID}/spaces/${SPACE_ID}/assignments`)
      .set('Authorization', `Bearer ${token(OWNER_ID, 'owner@example.com')}`)
      .send({ merchantId: MERCHANT_ID, startDate: '2026-08-25' })
      .expect(201, { id: ASSIGNMENT_ID });
    expect(service.create).toHaveBeenCalledWith(ORGANIZATION_ID, SPACE_ID, {
      merchantId: MERCHANT_ID,
      startDate: '2026-08-25',
    });
  });

  it('rejects malformed assignment input', async () => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    await request(app.getHttpServer())
      .post(`/organizations/${ORGANIZATION_ID}/spaces/${SPACE_ID}/assignments`)
      .set('Authorization', `Bearer ${token(OWNER_ID, 'owner@example.com')}`)
      .send({ merchantId: 'not-a-uuid', startDate: '08/25/2026' })
      .expect(400);
    expect(service.create).not.toHaveBeenCalled();
  });

  it('ends an assignment using a date-only value', async () => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    await request(app.getHttpServer())
      .patch(
        `/organizations/${ORGANIZATION_ID}/space-assignments/${ASSIGNMENT_ID}/end`,
      )
      .set('Authorization', `Bearer ${token(OWNER_ID, 'owner@example.com')}`)
      .send({ endDate: '2026-09-30' })
      .expect(200, { id: ASSIGNMENT_ID });
    expect(service.end).toHaveBeenCalledWith(ORGANIZATION_ID, ASSIGNMENT_ID, {
      endDate: '2026-09-30',
    });
  });

  it('publishes assignment routes and schemas in OpenAPI', async () => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    const response = await request(app.getHttpServer())
      .get(`/${OPENAPI_JSON_PATH}`)
      .expect(200);
    expect(response.text).toContain(
      '"/organizations/{organizationId}/spaces/{spaceId}/assignments"',
    );
    expect(response.text).toContain(
      '"/organizations/{organizationId}/space-assignments/{assignmentId}/end"',
    );
    expect(response.text).toContain('"SpaceAssignmentResponseDto"');
  });
});
