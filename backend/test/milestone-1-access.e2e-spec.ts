import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { OrganizationRole } from '../src/generated/prisma/client';
import { OPENAPI_JSON_PATH, setupSwagger } from '../src/config/swagger';
import { PrismaService } from '../src/infrastructure/database/prisma.service';
import { AuthGuard } from '../src/modules/auth/auth.guard';
import { OrganizationAccessGuard } from '../src/modules/organizations/authorization/organization-access.guard';
import { BranchesController } from '../src/modules/organizations/branches/branches.controller';
import { BranchesService } from '../src/modules/organizations/branches/branches.service';
import { OrganizationMembershipsController } from '../src/modules/organizations/memberships/organization-memberships.controller';
import { OrganizationMembershipsService } from '../src/modules/organizations/memberships/organization-memberships.service';

const OWNER_ID = '11111111-1111-4111-8111-111111111111';
const CASHIER_ID = '22222222-2222-4222-8222-222222222222';
const ORGANIZATION_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const OTHER_ORGANIZATION_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const BRANCH_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

describe('Milestone 1 organization access (e2e)', () => {
  let app: INestApplication;
  let jwtService: JwtService;

  const branchesService = {
    create: jest.fn().mockResolvedValue({ id: BRANCH_ID }),
    findAll: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue({ id: BRANCH_ID }),
    update: jest.fn().mockResolvedValue({ id: BRANCH_ID }),
  };
  const membershipsService = {
    findAll: jest.fn().mockResolvedValue([]),
    add: jest.fn().mockResolvedValue({ id: CASHIER_ID }),
    updateRole: jest.fn().mockResolvedValue({ id: CASHIER_ID }),
    remove: jest.fn().mockResolvedValue(undefined),
  };
  const prismaService = {
    user: {
      findFirst: jest.fn(
        ({ where }: { where: { id: string; deletedAt: null } }) =>
          Promise.resolve(
            (where.id === OWNER_ID || where.id === CASHIER_ID) &&
              where.deletedAt === null
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

          if (organizationId !== ORGANIZATION_ID) return Promise.resolve(null);
          if (userId === OWNER_ID) {
            return Promise.resolve({ role: OrganizationRole.OWNER });
          }
          if (userId === CASHIER_ID) {
            return Promise.resolve({ role: OrganizationRole.CASHIER });
          }

          return Promise.resolve(null);
        },
      ),
    },
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        JwtModule.register({
          secret: 'milestone-1-e2e-secret-at-least-32-characters',
        }),
      ],
      controllers: [BranchesController, OrganizationMembershipsController],
      providers: [
        AuthGuard,
        OrganizationAccessGuard,
        Reflector,
        { provide: PrismaService, useValue: prismaService },
        { provide: BranchesService, useValue: branchesService },
        {
          provide: OrganizationMembershipsService,
          useValue: membershipsService,
        },
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

  it('rejects an unauthenticated organization request', async () => {
    // Nest's adapter is intentionally framework-agnostic; supertest accepts it.
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    await request(app.getHttpServer())
      .get(`/organizations/${ORGANIZATION_ID}/branches`)
      .expect(401);

    expect(branchesService.findAll).not.toHaveBeenCalled();
  });

  it('publishes an OpenAPI document for the assembled organization routes', async () => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    const response = await request(app.getHttpServer())
      .get(`/${OPENAPI_JSON_PATH}`)
      .expect(200);

    expect(response.body).toMatchObject({
      info: { title: 'Concept Store Management System API', version: '1.0' },
      components: {
        securitySchemes: {
          'access-token': { type: 'http', scheme: 'bearer' },
        },
      },
    });
    expect(response.text).toContain(
      '"/organizations/{organizationId}/branches"',
    );
    expect(response.text).toContain(
      '"/organizations/{organizationId}/members"',
    );
  });

  it('hides an organization from a user without membership', async () => {
    const token = accessToken(OWNER_ID, 'owner@example.com');

    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    await request(app.getHttpServer())
      .get(`/organizations/${OTHER_ORGANIZATION_ID}/branches`)
      .set('Authorization', `Bearer ${token}`)
      .expect(404);

    expect(branchesService.findAll).not.toHaveBeenCalled();
  });

  it('allows a cashier to read branches in their organization', async () => {
    const token = accessToken(CASHIER_ID, 'cashier@example.com');

    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    await request(app.getHttpServer())
      .get(`/organizations/${ORGANIZATION_ID}/branches`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200, []);

    expect(branchesService.findAll).toHaveBeenCalledWith(ORGANIZATION_ID);
  });

  it('forbids a cashier from creating a branch', async () => {
    const token = accessToken(CASHIER_ID, 'cashier@example.com');

    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    await request(app.getHttpServer())
      .post(`/organizations/${ORGANIZATION_ID}/branches`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Main Branch',
        addressLine1: '1 Market Street',
        city: 'Makati',
        province: 'Metro Manila',
        countryCode: 'PH',
      })
      .expect(403);

    expect(branchesService.create).not.toHaveBeenCalled();
  });

  it('allows an owner to create a validated branch', async () => {
    const token = accessToken(OWNER_ID, 'owner@example.com');

    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    await request(app.getHttpServer())
      .post(`/organizations/${ORGANIZATION_ID}/branches`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: '  Main Branch  ',
        code: ' main-01 ',
        addressLine1: '  1 Market Street  ',
        city: '  Makati  ',
        province: '  Metro Manila  ',
        countryCode: 'ph',
      })
      .expect(201, { id: BRANCH_ID });

    expect(branchesService.create).toHaveBeenCalledWith(ORGANIZATION_ID, {
      name: 'Main Branch',
      code: 'MAIN-01',
      addressLine1: '1 Market Street',
      city: 'Makati',
      province: 'Metro Manila',
      countryCode: 'PH',
    });
  });

  it('allows a manager to list members but reserves membership changes for owners', async () => {
    prismaService.organizationMembership.findUnique.mockResolvedValueOnce({
      role: OrganizationRole.MANAGER,
    });
    const token = accessToken(OWNER_ID, 'manager@example.com');

    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    await request(app.getHttpServer())
      .get(`/organizations/${ORGANIZATION_ID}/members`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200, []);

    prismaService.organizationMembership.findUnique.mockResolvedValueOnce({
      role: OrganizationRole.MANAGER,
    });

    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    await request(app.getHttpServer())
      .post(`/organizations/${ORGANIZATION_ID}/members`)
      .set('Authorization', `Bearer ${token}`)
      .send({ email: 'new@example.com', role: OrganizationRole.CASHIER })
      .expect(403);

    expect(membershipsService.findAll).toHaveBeenCalledWith(ORGANIZATION_ID);
    expect(membershipsService.add).not.toHaveBeenCalled();
  });
});
