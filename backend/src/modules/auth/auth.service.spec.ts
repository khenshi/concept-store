import {
  BadRequestException,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { hash } from 'bcryptjs';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { AccountActionTokenService } from './account-action-token.service';
import { AuthService } from './auth.service';
import { SessionService } from './sessions/session.service';

describe('AuthService', () => {
  const user = {
    id: 'user-id',
    email: 'owner@example.com',
    firstName: 'Maria',
    lastName: 'Santos',
    phone: null,
    colorTheme: 'GRAPHITE',
  };
  const refreshSession = {
    id: '580c75b7-1050-4a08-a2c2-585171d84dc8',
    token: 'session-id.refresh-secret',
    expiresAt: new Date('2026-09-22T00:00:00.000Z'),
  };
  const transaction = {
    user: {
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      findUnique: jest.fn(),
    },
    pendingRegistration: {
      upsert: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      delete: jest.fn(),
    },
    userSession: { deleteMany: jest.fn(), updateMany: jest.fn() },
    organizationMembership: {
      findMany: jest.fn(),
      deleteMany: jest.fn(),
    },
  };
  const prisma = {
    $transaction: jest.fn(),
    user: {
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      update: jest.fn(),
    },
    pendingRegistration: { findUnique: jest.fn() },
    userSession: { updateMany: jest.fn() },
  };
  const jwtService = { signAsync: jest.fn() };
  const sessionService = {
    issue: jest.fn(),
    rotate: jest.fn(),
    revoke: jest.fn(),
  };
  const accountActionTokenService = {
    issueForUser: jest.fn(),
    issueForPendingRegistration: jest.fn(),
    consume: jest.fn(),
  };
  let service: AuthService;

  beforeEach(async () => {
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation(
      (operation: ((client: typeof transaction) => unknown) | unknown[]) =>
        Array.isArray(operation)
          ? Promise.all(operation)
          : operation(transaction),
    );
    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwtService },
        { provide: SessionService, useValue: sessionService },
        {
          provide: AccountActionTokenService,
          useValue: accountActionTokenService,
        },
      ],
    }).compile();
    service = moduleRef.get(AuthService);
    jwtService.signAsync.mockResolvedValue('signed-token');
    sessionService.issue.mockResolvedValue(refreshSession);
    transaction.user.updateMany.mockResolvedValue({ count: 1 });
    transaction.userSession.updateMany.mockResolvedValue({ count: 2 });
  });

  it('stores a pending registration without creating a session or password', async () => {
    transaction.pendingRegistration.upsert.mockResolvedValue({
      id: 'pending-id',
    });

    const result = await service.register({
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
    });

    expect(result).toEqual({ status: 'accepted' });
    expect(transaction.pendingRegistration.upsert).toHaveBeenCalled();
    expect(
      accountActionTokenService.issueForPendingRegistration,
    ).toHaveBeenCalledWith(
      'pending-id',
      'VERIFY_EMAIL',
      expect.any(Number),
      transaction,
    );
    expect(sessionService.issue).not.toHaveBeenCalled();
  });

  it('logs in a user and creates a refresh session', async () => {
    prisma.user.findUnique.mockResolvedValue({
      ...user,
      passwordHash: await hash('correct horse battery staple', 4),
    });

    await expect(
      service.login({
        email: user.email,
        password: 'correct horse battery staple',
      }),
    ).resolves.toEqual({
      response: { accessToken: 'signed-token', user },
      refreshSession,
    });
    expect(sessionService.issue).toHaveBeenCalledWith(user.id, transaction);
  });

  it('uses the same generic error for an unknown email or wrong password', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(
      service.login({
        email: 'unknown@example.com',
        password: 'incorrect password',
      }),
    ).rejects.toThrow(new UnauthorizedException('Invalid email or password'));
  });

  it('rejects a wrong password', async () => {
    prisma.user.findUnique.mockResolvedValue({
      ...user,
      passwordHash: await hash('correct horse battery staple', 4),
    });

    await expect(
      service.login({
        email: user.email,
        password: 'incorrect password',
      }),
    ).rejects.toThrow(new UnauthorizedException('Invalid email or password'));
  });

  it('rotates a refresh session and returns a new access token', async () => {
    sessionService.rotate.mockResolvedValue({ user, refreshSession });

    await expect(service.refresh('refresh-token')).resolves.toEqual({
      response: { accessToken: 'signed-token', user },
      refreshSession,
    });
  });

  it('delegates logout revocation', async () => {
    sessionService.revoke.mockResolvedValue(undefined);

    await expect(service.logout('refresh-token')).resolves.toBeUndefined();
    expect(sessionService.revoke).toHaveBeenCalledWith('refresh-token');
  });

  it('loads current personal details from the database', async () => {
    prisma.user.findUniqueOrThrow.mockResolvedValue(user);

    await expect(service.getCurrentUser(user.id)).resolves.toEqual(user);
    expect(prisma.user.findUniqueOrThrow).toHaveBeenCalledWith({
      where: { id: user.id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        colorTheme: true,
        emailVerifiedAt: true,
      },
    });
  });

  it('updates only the authenticated user personal details', async () => {
    const updated = { ...user, firstName: 'Mia', phone: '+63 900 000 0000' };
    prisma.user.update.mockResolvedValue(updated);

    await expect(
      service.updateCurrentUser(user.id, {
        firstName: updated.firstName,
        lastName: updated.lastName,
        phone: updated.phone,
      }),
    ).resolves.toEqual(updated);
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: user.id },
      data: {
        firstName: updated.firstName,
        lastName: updated.lastName,
        phone: updated.phone,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        colorTheme: true,
        emailVerifiedAt: true,
      },
    });
  });

  it('updates only the authenticated user color theme', async () => {
    const updated = { ...user, colorTheme: 'OCEAN' };
    prisma.user.update.mockResolvedValue(updated);

    await expect(service.updateColorTheme(user.id, 'OCEAN')).resolves.toEqual(
      updated,
    );
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: user.id },
      data: { colorTheme: 'OCEAN' },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        colorTheme: true,
        emailVerifiedAt: true,
      },
    });
  });

  it('changes the password and revokes every active refresh session', async () => {
    prisma.user.findUniqueOrThrow.mockResolvedValue({
      passwordHash: await hash('current secure password', 4),
    });
    prisma.user.update.mockResolvedValue({});
    prisma.userSession.updateMany.mockResolvedValue({ count: 2 });

    await expect(
      service.changePassword(user.id, {
        currentPassword: 'current secure password',
        newPassword: 'different secure password',
      }),
    ).resolves.toBeUndefined();

    expect(transaction.user.updateMany).toHaveBeenCalledWith({
      where: {
        id: user.id,
        passwordHash: expect.any(String) as unknown,
        deletedAt: null,
      },
      data: { passwordHash: expect.any(String) as unknown },
    });
    expect(transaction.userSession.updateMany).toHaveBeenCalledWith({
      where: { userId: user.id, revokedAt: null },
      data: { revokedAt: expect.any(Date) as unknown },
    });
  });

  it('rejects an incorrect current password without changing sessions', async () => {
    prisma.user.findUniqueOrThrow.mockResolvedValue({
      passwordHash: await hash('current secure password', 4),
    });

    await expect(
      service.changePassword(user.id, {
        currentPassword: 'incorrect password',
        newPassword: 'different secure password',
      }),
    ).rejects.toThrow(
      new UnauthorizedException('Current password is incorrect'),
    );
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('rejects reusing the current password', async () => {
    prisma.user.findUniqueOrThrow.mockResolvedValue({
      passwordHash: await hash('current secure password', 4),
    });

    await expect(
      service.changePassword(user.id, {
        currentPassword: 'current secure password',
        newPassword: 'current secure password',
      }),
    ).rejects.toThrow(
      new BadRequestException(
        'New password must be different from the current password',
      ),
    );
  });

  it('anonymizes an eligible account while preserving its audit identity', async () => {
    prisma.user.findUniqueOrThrow.mockResolvedValue({
      passwordHash: await hash('current secure password', 4),
    });
    transaction.organizationMembership.findMany.mockResolvedValue([]);
    transaction.organizationMembership.deleteMany.mockResolvedValue({
      count: 2,
    });
    transaction.userSession.deleteMany.mockResolvedValue({ count: 2 });
    transaction.user.update.mockResolvedValue({});

    await expect(
      service.deleteCurrentUser(user.id, 'current secure password'),
    ).resolves.toBeUndefined();

    expect(transaction.organizationMembership.deleteMany).toHaveBeenCalledWith({
      where: { userId: user.id },
    });
    expect(transaction.userSession.deleteMany).toHaveBeenCalledWith({
      where: { userId: user.id },
    });
    expect(transaction.user.update).toHaveBeenCalledWith({
      where: { id: user.id, deletedAt: null },
      data: expect.objectContaining({
        firstName: 'Deleted',
        lastName: 'User',
        phone: null,
        email: `deleted+${user.id}@deleted.invalid`,
        deletedAt: expect.any(Date) as unknown,
      }) as unknown,
    });
  });

  it('blocks deletion when the user is an organization sole owner', async () => {
    prisma.user.findUniqueOrThrow.mockResolvedValue({
      passwordHash: await hash('current secure password', 4),
    });
    transaction.organizationMembership.findMany.mockResolvedValue([
      { organizationId: 'organization-id' },
    ]);

    await expect(
      service.deleteCurrentUser(user.id, 'current secure password'),
    ).rejects.toThrow(
      new ConflictException(
        'Transfer ownership or add another owner before deleting your account',
      ),
    );
    expect(transaction.user.update).not.toHaveBeenCalled();
  });

  it('requires the account password before deletion', async () => {
    prisma.user.findUniqueOrThrow.mockResolvedValue({
      passwordHash: await hash('current secure password', 4),
    });

    await expect(
      service.deleteCurrentUser(user.id, 'incorrect password'),
    ).rejects.toThrow(new UnauthorizedException('Password is incorrect'));
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects oversized replacement passwords even without DTO validation', async () => {
    await expect(
      service.changePassword(user.id, {
        currentPassword: 'old password',
        newPassword: 'é'.repeat(37),
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.user.findUniqueOrThrow).not.toHaveBeenCalled();
  });

  it('allows a legacy long login input and binds its token to the issued session', async () => {
    const password = 'a'.repeat(72) + 'legacy suffix';
    prisma.user.findUnique.mockResolvedValue({
      ...user,
      passwordHash: await hash(password, 4),
    });
    await service.login({ email: user.email, password });
    expect(jwtService.signAsync).toHaveBeenCalledWith(
      { email: user.email, sid: refreshSession.id },
      { subject: user.id },
    );
  });

  it('rejects a stale login credential check before issuing a new session', async () => {
    prisma.user.findUnique.mockResolvedValue({
      ...user,
      passwordHash: await hash('current password', 4),
    });
    transaction.user.updateMany.mockResolvedValue({ count: 0 });
    await expect(
      service.login({ email: user.email, password: 'current password' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(sessionService.issue).not.toHaveBeenCalled();
  });

  it('rejects a competing password change without revoking sessions outside its transaction', async () => {
    prisma.user.findUniqueOrThrow.mockResolvedValue({
      passwordHash: await hash('current password', 4),
    });
    transaction.user.updateMany.mockResolvedValue({ count: 0 });
    await expect(
      service.changePassword(user.id, {
        currentPassword: 'current password',
        newPassword: 'different password',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(transaction.userSession.updateMany).not.toHaveBeenCalled();
  });

  it('retains legacy current-password input and rejects bcrypt-equivalent unchanged replacements', async () => {
    prisma.user.findUniqueOrThrow.mockResolvedValue({
      passwordHash: await hash('a'.repeat(72) + 'legacy suffix', 4),
    });
    await expect(
      service.changePassword(user.id, {
        currentPassword: 'a'.repeat(72) + 'legacy suffix',
        newPassword: 'a'.repeat(72),
      }),
    ).rejects.toThrow('New password must be different');
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
