import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { hash } from 'bcryptjs';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { AuthService } from './auth.service';
import { SessionService } from './sessions/session.service';

describe('AuthService', () => {
  const user = { id: 'user-id', email: 'owner@example.com' };
  const refreshSession = {
    token: 'session-id.refresh-secret',
    expiresAt: new Date('2026-09-22T00:00:00.000Z'),
  };
  const transaction = { user: { create: jest.fn() } };
  const prisma = {
    $transaction: jest.fn(),
    user: { findUnique: jest.fn() },
  };
  const jwtService = { signAsync: jest.fn() };
  const sessionService = {
    issue: jest.fn(),
    rotate: jest.fn(),
    revoke: jest.fn(),
  };
  let service: AuthService;

  beforeEach(async () => {
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation(
      (callback: (client: typeof transaction) => unknown) =>
        callback(transaction),
    );
    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwtService },
        { provide: SessionService, useValue: sessionService },
      ],
    }).compile();
    service = moduleRef.get(AuthService);
    jwtService.signAsync.mockResolvedValue('signed-token');
    sessionService.issue.mockResolvedValue(refreshSession);
  });

  it('registers the user and session atomically without returning password data', async () => {
    transaction.user.create.mockImplementation(
      ({ data }: { data: { email: string; passwordHash: string } }) => {
        expect(data.email).toBe(user.email);
        expect(data.passwordHash).not.toBe('correct horse battery staple');
        return user;
      },
    );

    const result = await service.register({
      email: user.email,
      password: 'correct horse battery staple',
    });

    expect(result).toEqual({
      response: { accessToken: 'signed-token', user },
      refreshSession,
    });
    expect(sessionService.issue).toHaveBeenCalledWith(user.id, transaction);
    expect(jwtService.signAsync).toHaveBeenCalledWith(
      { email: user.email },
      { subject: user.id },
    );
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
    expect(sessionService.issue).toHaveBeenCalledWith(user.id);
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
});
