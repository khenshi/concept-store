import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { AuthGuard } from './auth.guard';

describe('AuthGuard', () => {
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
    });
    prisma.user.findFirst.mockResolvedValue({ id: 'user-id' });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.user).toEqual({
      id: 'user-id',
      email: 'owner@example.com',
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
    jwtService.verifyAsync.mockRejectedValue(new Error('invalid'));

    await expect(guard.canActivate(context)).rejects.toThrow(
      new UnauthorizedException('Access token is invalid or expired'),
    );
  });

  it('rejects a valid token after its account is deleted', async () => {
    const { context } = contextWithAuthorization('Bearer token');
    jwtService.verifyAsync.mockResolvedValue({
      sub: 'deleted-user-id',
      email: 'former@example.com',
    });
    prisma.user.findFirst.mockResolvedValue(null);

    await expect(guard.canActivate(context)).rejects.toThrow(
      new UnauthorizedException('Access token is invalid or expired'),
    );
  });
});
