import { ExecutionContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaPg } from '@prisma/adapter-pg';
import { compare, hash } from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { Client } from 'pg';
import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaService } from '../src/infrastructure/database/prisma.service';
import { AuthGuard } from '../src/modules/auth/auth.guard';
import { AccountActionTokenService } from '../src/modules/auth/account-action-token.service';
import { AuthService } from '../src/modules/auth/auth.service';
import { SessionService } from '../src/modules/auth/sessions/session.service';

const connectionString = process.env.TEST_DATABASE_URL;
if (!connectionString)
  throw new Error(
    'TEST_DATABASE_URL must explicitly identify a parent-verified disposable PostgreSQL target',
  );
const schema = `auth_sessions_${randomUUID().replaceAll('-', '')}`;
const admin = new Client({ connectionString });
const db = new PrismaClient({
  adapter: new PrismaPg(
    { connectionString, options: `-c search_path=${schema}`, max: 12 },
    { schema },
  ),
});
const prisma = db as unknown as PrismaService;
const jwt = new JwtService({
  secret: 'auth-integration-synthetic-secret',
  signOptions: { expiresIn: '5m' },
});
const sessions = new SessionService(
  prisma,
  new ConfigService({ REFRESH_TOKEN_TTL_DAYS: 30 }),
);
const accountActions = new AccountActionTokenService(prisma);
const auth = new AuthService(prisma, jwt, sessions, accountActions);
const guard = new AuthGuard(jwt, prisma);
const password = 'original secure password';
let createdSchema = false;

function authorize(accessToken: string) {
  const request = { headers: { authorization: `Bearer ${accessToken}` } };
  return guard.canActivate({
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext);
}

async function account() {
  const email = `${randomUUID()}@example.test`;
  await db.user.create({
    data: {
      firstName: 'Test',
      lastName: 'User',
      email,
      passwordHash: await hash(password, 4),
      emailVerifiedAt: new Date(),
    },
  });
  return auth.login({ email, password });
}

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

beforeAll(async () => {
  await admin.connect();
  await admin.query(`CREATE SCHEMA "${schema}"`);
  createdSchema = true;
  await admin.query(`SET search_path TO "${schema}"`);
  const migrations = join(__dirname, '../prisma/migrations');
  for (const name of readdirSync(migrations)
    .filter((entry) => /^\d/.test(entry))
    .sort()) {
    await admin.query(
      readFileSync(join(migrations, name, 'migration.sql'), 'utf8'),
    );
  }
});

afterAll(async () => {
  await db.$disconnect();
  if (createdSchema) await admin.query(`DROP SCHEMA "${schema}" CASCADE`);
  await admin.end();
});

describe('Auth session integrity (real PostgreSQL, explicitly selected target only)', () => {
  it('rejects old sessionless JWTs while existing refresh sessions rotate into bound JWTs', async () => {
    const result = await account();
    const legacy = jwt.sign(
      { email: result.response.user.email },
      { subject: result.response.user.id },
    );
    await expect(authorize(legacy)).rejects.toMatchObject({ status: 401 });
    const refreshed = await auth.refresh(result.refreshSession.token);
    expect(
      jwt.decode<{ sid: string }>(refreshed.response.accessToken).sid,
    ).toBe(result.refreshSession.id);
    await expect(authorize(refreshed.response.accessToken)).resolves.toBe(true);
    await auth.logout(refreshed.refreshSession.token);
    await expect(
      authorize(refreshed.response.accessToken),
    ).rejects.toMatchObject({ status: 401 });
  });

  it('lists only active owned metadata, enforces foreign 404 and revokes selected access immediately', async () => {
    const own = await account();
    const foreign = await account();
    const userId = own.response.user.id;
    for (let i = 0; i < 15; i++) await sessions.issue(userId);
    const expired = await sessions.issue(userId);
    await db.userSession.update({
      where: { id: expired.id },
      data: { expiresAt: new Date(0) },
    });
    const revoked = await sessions.issue(userId);
    await sessions.revokeOwned(userId, revoked.id);
    const first = await sessions.list(userId, own.refreshSession.id, 1);
    const second = await sessions.list(userId, own.refreshSession.id, 2);
    expect(first).toMatchObject({ pageSize: 15, total: 16, totalPages: 2 });
    expect(first.items).toHaveLength(15);
    expect(second.items).toHaveLength(1);
    for (const item of [...first.items, ...second.items])
      expect(Object.keys(item).sort()).toEqual([
        'createdAt',
        'expiresAt',
        'id',
        'isCurrent',
      ]);
    expect(
      [...first.items, ...second.items]
        .filter((item) => item.isCurrent)
        .map((item) => item.id),
    ).toEqual([own.refreshSession.id]);
    await expect(
      sessions.revokeOwned(userId, foreign.refreshSession.id),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      sessions.revokeOwned(userId, randomUUID()),
    ).rejects.toMatchObject({ status: 404 });
    await sessions.revokeOwned(userId, own.refreshSession.id);
    await sessions.revokeOwned(userId, own.refreshSession.id);
    await expect(authorize(own.response.accessToken)).rejects.toMatchObject({
      status: 401,
    });
    await expect(authorize(foreign.response.accessToken)).resolves.toBe(true);
    await expect(auth.refresh(own.refreshSession.token)).rejects.toMatchObject({
      status: 401,
    });
  });

  it('preserves bcrypt legacy login/current-password behavior and rejects equivalent or over-limit replacements', async () => {
    const result = await account();
    const legacy = 'a'.repeat(72) + 'legacy suffix';
    await db.user.update({
      where: { id: result.response.user.id },
      data: { passwordHash: await hash(legacy, 4) },
    });
    const loggedIn = await auth.login({
      email: result.response.user.email,
      password: legacy,
    });
    await expect(authorize(loggedIn.response.accessToken)).resolves.toBe(true);
    await expect(
      auth.changePassword(result.response.user.id, {
        currentPassword: legacy,
        newPassword: 'a'.repeat(72),
      }),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      auth.changePassword(result.response.user.id, {
        currentPassword: legacy,
        newPassword: 'a'.repeat(73),
      }),
    ).rejects.toMatchObject({ status: 400 });
    await auth.changePassword(result.response.user.id, {
      currentPassword: legacy,
      newPassword: 'different secure password',
    });
    await expect(
      authorize(loggedIn.response.accessToken),
    ).rejects.toMatchObject({ status: 401 });
  });

  it('fails closed after concurrent rotation and selected-session revocation without resurrection', async () => {
    const result = await account();
    const outcomes = await Promise.allSettled([
      auth.refresh(result.refreshSession.token),
      sessions.revokeOwned(result.response.user.id, result.refreshSession.id),
    ]);
    expect(outcomes[1].status).toBe('fulfilled');
    const row = await db.userSession.findUniqueOrThrow({
      where: { id: result.refreshSession.id },
    });
    expect(row.revokedAt).not.toBeNull();
    await expect(authorize(result.response.accessToken)).rejects.toMatchObject({
      status: 401,
    });
    if (outcomes[0].status === 'fulfilled')
      await expect(
        authorize(outcomes[0].value.response.accessToken),
      ).rejects.toMatchObject({ status: 401 });
    await expect(
      auth.refresh(result.refreshSession.token),
    ).rejects.toMatchObject({ status: 401 });
  });

  it('rejects all existing sessions after rotation races with password change', async () => {
    const result = await account();
    const another = await auth.login({
      email: result.response.user.email,
      password,
    });
    const outcomes = await Promise.allSettled([
      auth.refresh(result.refreshSession.token),
      auth.changePassword(result.response.user.id, {
        currentPassword: password,
        newPassword: 'different secure password',
      }),
    ]);
    expect(outcomes[1].status).toBe('fulfilled');
    expect(
      await db.userSession.count({
        where: { userId: result.response.user.id, revokedAt: null },
      }),
    ).toBe(0);
    await expect(authorize(another.response.accessToken)).rejects.toMatchObject(
      { status: 401 },
    );
    if (outcomes[0].status === 'fulfilled')
      await expect(
        authorize(outcomes[0].value.response.accessToken),
      ).rejects.toMatchObject({ status: 401 });
  });

  it('rejects a login that checked the old hash before password change committed', async () => {
    const result = await account();
    const read = deferred();
    const release = deferred();
    const delayedPrisma = {
      user: {
        findUnique: async () => {
          const user = await db.user.findUnique({
            where: { email: result.response.user.email },
          });
          read.resolve();
          await release.promise;
          return user;
        },
      },
      $transaction: db.$transaction.bind(db),
    } as unknown as PrismaService;
    const delayedAuth = new AuthService(
      delayedPrisma,
      jwt,
      sessions,
      accountActions,
    );
    const login = delayedAuth.login({
      email: result.response.user.email,
      password,
    });
    const outcome = login.then(
      () => 'accepted',
      (error: unknown) => error,
    );
    try {
      await read.promise;
      await auth.changePassword(result.response.user.id, {
        currentPassword: password,
        newPassword: 'different secure password',
      });
    } finally {
      release.resolve();
    }
    expect(await outcome).toMatchObject({ status: 401 });
    expect(
      await db.userSession.count({
        where: { userId: result.response.user.id, revokedAt: null },
      }),
    ).toBe(0);
  });

  it('revokes a concurrent login that obtained the credential row lock first', async () => {
    const result = await account();
    const issuing = deferred();
    const release = deferred();
    const issue = sessions.issue.bind(sessions);
    const spy = jest
      .spyOn(sessions, 'issue')
      .mockImplementationOnce(async (...args) => {
        issuing.resolve();
        await release.promise;
        return issue(...args);
      });
    const login = auth.login({ email: result.response.user.email, password });
    let change: Promise<void> | undefined;
    try {
      await issuing.promise;
      change = auth.changePassword(result.response.user.id, {
        currentPassword: password,
        newPassword: 'different secure password',
      });
    } finally {
      release.resolve();
    }
    try {
      const loggedIn = await login;
      await change;
      await expect(
        authorize(loggedIn.response.accessToken),
      ).rejects.toMatchObject({ status: 401 });
    } finally {
      spy.mockRestore();
    }
  });

  it('revokes access after stale refresh replay and after account deletion', async () => {
    const result = await account();
    const refreshed = await auth.refresh(result.refreshSession.token);
    await expect(
      auth.refresh(result.refreshSession.token),
    ).rejects.toMatchObject({ status: 401 });
    await expect(
      authorize(refreshed.response.accessToken),
    ).rejects.toMatchObject({ status: 401 });
    const newLogin = await auth.login({
      email: result.response.user.email,
      password,
    });
    await auth.deleteCurrentUser(result.response.user.id, password);
    await expect(
      authorize(newLogin.response.accessToken),
    ).rejects.toMatchObject({ status: 401 });
    await expect(
      auth.refresh(newLogin.refreshSession.token),
    ).rejects.toMatchObject({ status: 401 });
  });

  it('rolls back the password update when session revocation fails', async () => {
    const result = await account();
    await admin.query(
      `CREATE FUNCTION "${schema}".reject_auth_revoke() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic auth revocation failure'; END; $$`,
    );
    await admin.query(
      `CREATE TRIGGER reject_auth_revoke BEFORE UPDATE ON "${schema}"."UserSession" FOR EACH ROW EXECUTE FUNCTION "${schema}".reject_auth_revoke()`,
    );
    try {
      await expect(
        auth.changePassword(result.response.user.id, {
          currentPassword: password,
          newPassword: 'different secure password',
        }),
      ).rejects.toThrow();
      const user = await db.user.findUniqueOrThrow({
        where: { id: result.response.user.id },
      });
      expect(await compare(password, user.passwordHash)).toBe(true);
      expect(
        await compare('different secure password', user.passwordHash),
      ).toBe(false);
      await expect(authorize(result.response.accessToken)).resolves.toBe(true);
    } finally {
      await admin.query(
        `DROP TRIGGER reject_auth_revoke ON "${schema}"."UserSession"`,
      );
      await admin.query(`DROP FUNCTION "${schema}".reject_auth_revoke()`);
    }
  });
});
