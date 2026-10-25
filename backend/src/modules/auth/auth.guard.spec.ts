import {
  ExecutionContext,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { AuthGuard } from './auth.guard';

describe('AuthGuard', () => {
  const sid = '580c75b7-1050-4a08-a2c2-585171d84dc8';
  const jwtService = { verifyAsync: jest.fn() };
  const prisma = { user: { findFirst: jest.fn() } };
  let guard: AuthGuard;

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthGuard,
        { provide: JwtService, useValue: jwtService },
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    guard = moduleRef.get(AuthGuard);
  });

  function contextWithAuthorization(authorization?: string): {
    context: ExecutionContext;
    request: { headers: { authorization?: string }; user?: unknown };
  } {
    const request = { headers: { authorization } };
    const context = {
      switchToHttp: () => ({ getRequest: () => request }),
    } as ExecutionContext;
    return { context, request };
  }

  it('attaches verified user identity to the request', async () => {
    const { context, request } = contextWithAuthorization('Bearer token');
    jwtService.verifyAsync.mockResolvedValue({
      sub: 'user-id',
      email: 'owner@example.com',
      sid,
    });
    prisma.user.findFirst.mockResolvedValue({ id: 'user-id' });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.user).toEqual({
      id: 'user-id',
      email: 'owner@example.com',
      sessionId: sid,
    });
    expect(prisma.user.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'user-id',
        deletedAt: null,
        sessions: {
          some: {
            id: sid,
            revokedAt: null,
            expiresAt: { gt: expect.any(Date) as unknown },
          },
        },
      },
      select: { id: true },
    });
  });

  it('rejects a request without a bearer token', async () => {
    const { context } = contextWithAuthorization();

    await expect(guard.canActivate(context)).rejects.toThrow(
      new UnauthorizedException('Authentication is required'),
    );
  });

  it('rejects an invalid token', async () => {
    const { context } = contextWithAuthorization('Bearer invalid');
    jwtService.verifyAsync.mockRejectedValue(
      Object.assign(new Error('invalid'), { name: 'JsonWebTokenError' }),
    );

    await expect(guard.canActivate(context)).rejects.toThrow(
      new UnauthorizedException('Access token is invalid or expired'),
    );
  });

  it('rejects a valid token after its account is deleted', async () => {
    const { context } = contextWithAuthorization('Bearer token');
    jwtService.verifyAsync.mockResolvedValue({
      sub: 'deleted-user-id',
      email: 'former@example.com',
      sid,
    });
    prisma.user.findFirst.mockResolvedValue(null);

    await expect(guard.canActivate(context)).rejects.toThrow(
      new UnauthorizedException('Access token is invalid or expired'),
    );
  });

  it.each([undefined, '', 123, 'not-a-session'])(
    'rejects a missing or malformed signed sid %p before querying',
    async (sessionId) => {
      const { context } = contextWithAuthorization('Bearer token');
      jwtService.verifyAsync.mockResolvedValue({
        sub: 'user-id',
        email: 'owner@example.com',
        sid: sessionId,
      });
      await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(prisma.user.findFirst).not.toHaveBeenCalled();
    },
  );

  it('fails closed with a generic 503 for database failures', async () => {
    const { context, request } = contextWithAuthorization('Bearer token');
    jwtService.verifyAsync.mockResolvedValue({
      sub: 'user-id',
      email: 'owner@example.com',
      sid,
    });
    prisma.user.findFirst.mockRejectedValue(
      new Error('private database connection'),
    );
    await expect(guard.canActivate(context)).rejects.toThrow(
      new ServiceUnavailableException(
        'Authentication is temporarily unavailable',
      ),
    );
    expect(request).not.toHaveProperty('user');
  });

  it('does not disguise unexpected JWT dependency errors as invalid credentials', async () => {
    const { context } = contextWithAuthorization('Bearer token');
    const error = new Error('dependency failure');
    jwtService.verifyAsync.mockRejectedValue(error);
    await expect(guard.canActivate(context)).rejects.toBe(error);
  });
});
