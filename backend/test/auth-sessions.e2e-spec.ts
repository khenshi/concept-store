import { UnauthorizedException, ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../src/infrastructure/database/prisma.service';
import { AuthController } from '../src/modules/auth/auth.controller';
import { AuthGuard } from '../src/modules/auth/auth.guard';
import { AuthService } from '../src/modules/auth/auth.service';
import { RefreshCookieService } from '../src/modules/auth/sessions/refresh-cookie.service';
import { SessionService } from '../src/modules/auth/sessions/session.service';
import type { ActiveSessionUserQuery } from './auth-session-fixtures';

type Session = {
  id: string;
  userId: string;
  createdAt: Date;
  expiresAt: Date;
  revokedAt: Date | null;
};

describe('Auth session and sensitive-route boundaries (HTTP)', () => {
  let app: NestExpressApplication;
  let jwt: JwtService;
  const owner = randomUUID();
  const sessions = new Map<string, Session>();
  let current: Session;
  const auth = {
    register: jest.fn(),
    changePassword: jest.fn(),
    deleteCurrentUser: jest.fn(),
    listSessions: jest.fn(),
    revokeSession: jest.fn(),
  };
  const prisma = {
    $transaction: jest.fn(),
    user: { findFirst: jest.fn() },
    userSession: {
      count: jest.fn(),
      findMany: jest.fn(),
      updateMany: jest.fn(),
    },
  };

  function addSession(
    userId = owner,
    overrides: Partial<Session> = {},
  ): Session {
    const session = {
      id: randomUUID(),
      userId,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 3600000),
      revokedAt: null,
      ...overrides,
    };
    sessions.set(session.id, session);
    return session;
  }

  const http = () => request(app.getHttpServer());
  const token = (session = current) =>
    jwt.sign(
      { email: 'test@example.test', sid: session.id },
      { subject: session.userId },
    );

  beforeEach(async () => {
    jest.resetAllMocks();
    sessions.clear();
    current = addSession();
    prisma.user.findFirst.mockImplementation(
      ({ where }: { where: ActiveSessionUserQuery }) => {
        const session = sessions.get(where.sessions.some.id);
        return Promise.resolve(
          session &&
            session.userId === where.id &&
            !session.revokedAt &&
            session.expiresAt > where.sessions.some.expiresAt.gt
            ? { id: where.id }
            : null,
        );
      },
    );
    prisma.$transaction.mockImplementation(
      (operation: (client: typeof prisma) => unknown) => operation(prisma),
    );
    const active = (where: { userId: string; expiresAt: { gt: Date } }) =>
      [...sessions.values()].filter(
        (session) =>
          session.userId === where.userId &&
          session.revokedAt === null &&
          session.expiresAt > where.expiresAt.gt,
      );
    prisma.userSession.count.mockImplementation(
      ({ where }: { where: { userId: string; expiresAt: { gt: Date } } }) =>
        Promise.resolve(active(where).length),
    );
    prisma.userSession.findMany.mockImplementation(
      ({
        where,
        skip,
        take,
      }: {
        where: { userId: string; expiresAt: { gt: Date } };
        skip: number;
        take: number;
      }) =>
        Promise.resolve(
          active(where)
            .sort(
              (a, b) =>
                b.createdAt.getTime() - a.createdAt.getTime() ||
                b.id.localeCompare(a.id),
            )
            .slice(skip, skip + take)
            .map(({ id, createdAt, expiresAt }) => ({
              id,
              createdAt,
              expiresAt,
            })),
        ),
    );
    prisma.userSession.updateMany.mockImplementation(
      ({
        where,
        data,
      }: {
        where: { id: string; userId: string };
        data: { revokedAt: Date };
      }) => {
        const session = sessions.get(where.id);
        if (!session || session.userId !== where.userId)
          return Promise.resolve({ count: 0 });
        session.revokedAt = data.revokedAt;
        return Promise.resolve({ count: 1 });
      },
    );
    auth.changePassword.mockRejectedValue(
      new UnauthorizedException('Current password is incorrect'),
    );
    auth.deleteCurrentUser.mockRejectedValue(
      new UnauthorizedException('Password is incorrect'),
    );
    const module = await Test.createTestingModule({
      imports: [
        JwtModule.register({
          secret: 'auth-http-synthetic-test-secret',
          signOptions: { expiresIn: '5m' },
        }),
        ThrottlerModule.forRoot([{ ttl: 60000, limit: 300 }]),
      ],
      controllers: [AuthController],
      providers: [
        AuthGuard,
        SessionService,
        RefreshCookieService,
        { provide: APP_GUARD, useClass: ThrottlerGuard },
        {
          provide: ConfigService,
          useValue: new ConfigService({
            NODE_ENV: 'test',
            REFRESH_TOKEN_TTL_DAYS: 30,
          }),
        },
        { provide: PrismaService, useValue: prisma },
        { provide: AuthService, useValue: auth },
      ],
    }).compile();
    const service = module.get(SessionService);
    auth.listSessions.mockImplementation(
      (userId: string, sid: string, page: number) =>
        service.list(userId, sid, page),
    );
    auth.revokeSession.mockImplementation((userId: string, sid: string) =>
      service.revokeOwned(userId, sid),
    );
    app = module.createNestApplication<NestExpressApplication>();
    app.set('trust proxy', false);
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
    jwt = module.get(JwtService);
  });

  afterEach(async () => app?.close());

  it('requires signed sid and active owned session state before listing', async () => {
    await http().get('/auth/sessions').expect(401);
    const legacy = jwt.sign({ email: 'test@example.test' }, { subject: owner });
    await http()
      .get('/auth/sessions')
      .auth(legacy, { type: 'bearer' })
      .expect(401);
    const foreign = addSession(randomUUID());
    const wrongOwner = jwt.sign(
      { email: 'test@example.test', sid: foreign.id },
      { subject: owner },
    );
    await http()
      .get('/auth/sessions')
      .auth(wrongOwner, { type: 'bearer' })
      .expect(401);
    current.expiresAt = new Date(0);
    await http()
      .get('/auth/sessions')
      .auth(token(), { type: 'bearer' })
      .expect(401);
    expect(auth.listSessions).not.toHaveBeenCalled();
  });

  it('paginates safe active-session metadata and rejects caller ownership fields', async () => {
    for (let i = 0; i < 15; i++)
      addSession(owner, { createdAt: new Date(Date.now() - 1000 - i) });
    addSession(owner, { revokedAt: new Date() });
    addSession(owner, { expiresAt: new Date(0) });
    addSession(randomUUID());
    const response = await http()
      .get('/auth/sessions')
      .auth(token(), { type: 'bearer' })
      .expect(200);
    expect(response.body).toMatchObject({
      page: 1,
      pageSize: 15,
      total: 16,
      totalPages: 2,
    });
    const body = response.body as { items: Record<string, unknown>[] };
    expect(body.items).toHaveLength(15);
    expect(body.items[0]).toMatchObject({ id: current.id, isCurrent: true });
    expect(Object.keys(body.items[0]).sort()).toEqual([
      'createdAt',
      'expiresAt',
      'id',
      'isCurrent',
    ]);
    const next = await http()
      .get('/auth/sessions?page=2')
      .auth(token(), { type: 'bearer' })
      .expect(200);
    expect((next.body as { items: unknown[] }).items).toHaveLength(1);
    for (const query of [
      'page=0',
      'page=1.5',
      'page=no',
      'page=1000001',
      'userId=foreign',
      'pageSize=100',
    ])
      await http()
        .get(`/auth/sessions?${query}`)
        .auth(token(), { type: 'bearer' })
        .expect(400);
  });

  it('returns idempotent 204 only for owned IDs and clears cookies only for the current session', async () => {
    const other = addSession();
    const foreign = addSession(randomUUID());
    for (const id of [foreign.id, randomUUID()]) {
      const response = await http()
        .delete(`/auth/sessions/${id}`)
        .auth(token(), { type: 'bearer' })
        .expect(404);
      expect(response.headers['set-cookie']).toBeUndefined();
    }
    for (let i = 0; i < 2; i++) {
      const response = await http()
        .delete(`/auth/sessions/${other.id}`)
        .auth(token(), { type: 'bearer' })
        .expect(204);
      expect(response.headers['set-cookie']).toBeUndefined();
    }
    const response = await http()
      .delete(`/auth/sessions/${current.id.toUpperCase()}`)
      .auth(token(), { type: 'bearer' })
      .expect(204);
    expect(response.headers['set-cookie']).toEqual([
      expect.stringContaining('concept_store_refresh=;'),
    ]);
    await http()
      .get('/auth/sessions')
      .auth(token(), { type: 'bearer' })
      .expect(401);
    expect(foreign.revokedAt).toBeNull();
  });

  it('returns generic 503 rather than 401 when the authentication DB is unavailable', async () => {
    prisma.user.findFirst.mockRejectedValue(new Error('PRIVATE_DATABASE_URL'));
    const response = await http()
      .get('/auth/sessions')
      .auth(token(), { type: 'bearer' })
      .expect(503);
    expect(response.body).toEqual({
      statusCode: 503,
      error: 'Service Unavailable',
      message: 'Authentication is temporarily unavailable',
    });
    expect(auth.listSessions).not.toHaveBeenCalled();
  });

  it.each(['change-password', 'delete-account'] as const)(
    'keeps direct-mode %s IP limits despite forged X-Forwarded-For',
    async (operation) => {
      for (let i = 0; i < 6; i++) {
        const call =
          operation === 'change-password'
            ? http().post('/auth/change-password').send({
                currentPassword: 'incorrect',
                newPassword: 'different password',
              })
            : http().delete('/auth/me').send({ password: 'incorrect' });
        const response = await call
          .auth(token(), { type: 'bearer' })
          .set('X-Forwarded-For', `198.51.100.${i + 1}`)
          .expect(i < 5 ? 401 : 429);
        if (i === 5)
          expect(Number(response.headers['retry-after'])).toBeGreaterThan(0);
      }
      expect(
        operation === 'change-password'
          ? auth.changePassword
          : auth.deleteCurrentUser,
      ).toHaveBeenCalledTimes(5);
    },
  );

  it('rejects an oversized password at the HTTP boundary before invoking registration', async () => {
    await http()
      .post('/auth/register')
      .send({
        firstName: 'Test',
        lastName: 'User',
        email: 'test@example.test',
        password: 'é'.repeat(37),
      })
      .expect(400);
    expect(auth.register).not.toHaveBeenCalled();
  });
});
