import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { OPENAPI_JSON_PATH, setupSwagger } from '../src/config/swagger';
import { OrganizationRole, SpaceType } from '../src/generated/prisma/client';
import { PrismaService } from '../src/infrastructure/database/prisma.service';
import { AuthGuard } from '../src/modules/auth/auth.guard';
import { OrganizationAccessGuard } from '../src/modules/organizations/authorization/organization-access.guard';
import { SpacesController } from '../src/modules/spaces/spaces.controller';
import { SpacesService } from '../src/modules/spaces/spaces.service';

const OWNER_ID = '11111111-1111-4111-8111-111111111111';
const MANAGER_ID = '22222222-2222-4222-8222-222222222222';
const CASHIER_ID = '33333333-3333-4333-8333-333333333333';
const ORGANIZATION_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const OTHER_ORGANIZATION_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const BRANCH_ID = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const SPACE_ID = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';

describe('Milestone 3 space API access (e2e)', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  const spacesService = {
    create: jest.fn().mockResolvedValue({ id: SPACE_ID }),
    findAll: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue({ id: SPACE_ID }),
    update: jest.fn().mockResolvedValue({ id: SPACE_ID }),
  };
  const rolesByUserId: Record<string, OrganizationRole> = {
    [OWNER_ID]: OrganizationRole.OWNER,
    [MANAGER_ID]: OrganizationRole.MANAGER,
    [CASHIER_ID]: OrganizationRole.CASHIER,
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
          secret: 'milestone-3-e2e-secret-at-least-32-characters',
        }),
      ],
      controllers: [SpacesController],
      providers: [
        AuthGuard,
        OrganizationAccessGuard,
        Reflector,
        { provide: PrismaService, useValue: prismaService },
        { provide: SpacesService, useValue: spacesService },
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

  it('rejects an unauthenticated request', async () => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    await request(app.getHttpServer())
      .get(`/organizations/${ORGANIZATION_ID}/branches/${BRANCH_ID}/spaces`)
      .expect(401);
  });

  it('conceals an organization without membership', async () => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    await request(app.getHttpServer())
      .get(
        `/organizations/${OTHER_ORGANIZATION_ID}/branches/${BRANCH_ID}/spaces`,
      )
      .set('Authorization', `Bearer ${token(OWNER_ID, 'owner@example.com')}`)
      .expect(404);
    expect(spacesService.findAll).not.toHaveBeenCalled();
  });

  it('forbids a cashier from space management', async () => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    await request(app.getHttpServer())
      .get(`/organizations/${ORGANIZATION_ID}/branches/${BRANCH_ID}/spaces`)
      .set(
        'Authorization',
        `Bearer ${token(CASHIER_ID, 'cashier@example.com')}`,
      )
      .expect(403);
  });

  it('allows a manager to list spaces in the trusted branch', async () => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    await request(app.getHttpServer())
      .get(`/organizations/${ORGANIZATION_ID}/branches/${BRANCH_ID}/spaces`)
      .set(
        'Authorization',
        `Bearer ${token(MANAGER_ID, 'manager@example.com')}`,
      )
      .expect(200, []);
    expect(spacesService.findAll).toHaveBeenCalledWith(
      ORGANIZATION_ID,
      BRANCH_ID,
    );
  });

  it('normalizes a space create request', async () => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    await request(app.getHttpServer())
      .post(`/organizations/${ORGANIZATION_ID}/branches/${BRANCH_ID}/spaces`)
      .set('Authorization', `Bearer ${token(OWNER_ID, 'owner@example.com')}`)
      .send({ code: ' rack-a01 ', name: ' Front display rack ', type: 'RACK' })
      .expect(201, { id: SPACE_ID });
    expect(spacesService.create).toHaveBeenCalledWith(
      ORGANIZATION_ID,
      BRANCH_ID,
      {
        code: 'RACK-A01',
        name: 'Front display rack',
        type: SpaceType.RACK,
      },
    );
  });

  it('rejects an invalid space type', async () => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    await request(app.getHttpServer())
      .post(`/organizations/${ORGANIZATION_ID}/branches/${BRANCH_ID}/spaces`)
      .set('Authorization', `Bearer ${token(OWNER_ID, 'owner@example.com')}`)
      .send({ code: 'RACK-A01', name: 'Front display rack', type: 'ROOM' })
      .expect(400);
    expect(spacesService.create).not.toHaveBeenCalled();
  });

  it('publishes space routes and schema in OpenAPI', async () => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    const response = await request(app.getHttpServer())
      .get(`/${OPENAPI_JSON_PATH}`)
      .expect(200);
    expect(response.text).toContain(
      '"/organizations/{organizationId}/branches/{branchId}/spaces"',
    );
    expect(response.text).toContain(
      '"/organizations/{organizationId}/spaces/{spaceId}"',
    );
    expect(response.text).toContain('"SpaceResponseDto"');
  });
});
