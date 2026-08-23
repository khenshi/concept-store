import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { createHash } from 'node:crypto';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { SessionService } from './session.service';

describe('SessionService', () => {
  const sessionId = '580c75b7-1050-4a08-a2c2-585171d84dc8';
  const secret = 'existing-refresh-secret';
  const token = `${sessionId}.${secret}`;
  const hashSecret = (value: string) =>
    createHash('sha256').update(value).digest('hex');
  const prisma = {
    userSession: {
      create: jest.fn(),
      findUnique: jest.fn(),
      updateMany: jest.fn(),
    },
  };
  let service: SessionService;

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date('2026-08-23T00:00:00.000Z'));
    const moduleRef = await Test.createTestingModule({
      providers: [
        SessionService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: ConfigService,
          useValue: { getOrThrow: jest.fn().mockReturnValue(30) },
        },
      ],
    }).compile();
    service = moduleRef.get(SessionService);
  });

  afterEach(() => jest.useRealTimers());

  it('stores only a hash when issuing an opaque refresh token', async () => {
    prisma.userSession.create.mockResolvedValue({});

    const issued = await service.issue('user-id');
    const [, issuedSecret] = issued.token.split('.');
    const [createArguments] = prisma.userSession.create.mock
      .calls[0] as unknown as [
      {
        data: {
          userId: string;
          refreshTokenHash: string;
        };
      },
    ];
    const storedData = createArguments.data;

    expect(storedData.userId).toBe('user-id');
    expect(storedData.refreshTokenHash).toBe(hashSecret(issuedSecret));
    expect(storedData.refreshTokenHash).not.toContain(issuedSecret);
    expect(issued.expiresAt).toEqual(new Date('2026-09-22T00:00:00.000Z'));
  });

  it('rotates the secret while retaining the fixed session expiry', async () => {
    const expiresAt = new Date('2026-09-22T00:00:00.000Z');
    prisma.userSession.findUnique.mockResolvedValue({
      refreshTokenHash: hashSecret(secret),
      expiresAt,
      revokedAt: null,
      user: { id: 'user-id', email: 'owner@example.com' },
    });
    prisma.userSession.updateMany.mockResolvedValue({ count: 1 });

    const rotated = await service.rotate(token);

    expect(rotated.refreshSession.token).toMatch(
      new RegExp(`^${sessionId}\\.`),
    );
    expect(rotated.refreshSession.token).not.toBe(token);
    expect(rotated.refreshSession.expiresAt).toEqual(expiresAt);
    const [rotationArguments] = prisma.userSession.updateMany.mock
      .calls[0] as unknown as [
      { where: { id: string; refreshTokenHash: string } },
    ];
    expect(rotationArguments.where).toMatchObject({
      id: sessionId,
      refreshTokenHash: hashSecret(secret),
    });
  });

  it('revokes an existing session when an old or altered secret is reused', async () => {
    prisma.userSession.findUnique.mockResolvedValue({
      refreshTokenHash: hashSecret('different-secret'),
      expiresAt: new Date('2026-09-22T00:00:00.000Z'),
      revokedAt: null,
      user: { id: 'user-id', email: 'owner@example.com' },
    });
    prisma.userSession.updateMany.mockResolvedValue({ count: 1 });

    await expect(service.rotate(token)).rejects.toThrow(
      new UnauthorizedException('Refresh session is invalid or expired'),
    );
    const [revokeArguments] = prisma.userSession.updateMany.mock
      .calls[0] as unknown as [
      { where: { id: string; revokedAt: null }; data: { revokedAt: Date } },
    ];
    expect(revokeArguments.where).toEqual({ id: sessionId, revokedAt: null });
    expect(revokeArguments.data.revokedAt).toBeInstanceOf(Date);
  });

  it('rejects missing, expired, or revoked sessions generically', async () => {
    await expect(service.rotate(undefined)).rejects.toThrow(
      'Refresh session is invalid or expired',
    );

    prisma.userSession.findUnique.mockResolvedValue({
      refreshTokenHash: hashSecret(secret),
      expiresAt: new Date('2026-08-22T00:00:00.000Z'),
      revokedAt: null,
      user: { id: 'user-id', email: 'owner@example.com' },
    });
    await expect(service.rotate(token)).rejects.toThrow(
      'Refresh session is invalid or expired',
    );
  });

  it('revokes only a session matching the presented secret', async () => {
    prisma.userSession.updateMany.mockResolvedValue({ count: 1 });

    await service.revoke(token);

    const [revokeArguments] = prisma.userSession.updateMany.mock
      .calls[0] as unknown as [
      {
        where: { id: string; refreshTokenHash: string; revokedAt: null };
        data: { revokedAt: Date };
      },
    ];
    expect(revokeArguments.where).toEqual({
      id: sessionId,
      refreshTokenHash: hashSecret(secret),
      revokedAt: null,
    });
    expect(revokeArguments.data.revokedAt).toBeInstanceOf(Date);
  });
});
