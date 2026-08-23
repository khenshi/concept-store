import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createHash,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from 'node:crypto';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import type { RefreshSession } from '../auth.types';
import type { RotatedSession, SessionPersistenceClient } from './session.types';

const SESSION_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const INVALID_SESSION_MESSAGE = 'Refresh session is invalid or expired';

@Injectable()
export class SessionService {
  private readonly ttlMilliseconds: number;

  constructor(
    private readonly prisma: PrismaService,
    configService: ConfigService,
  ) {
    this.ttlMilliseconds =
      configService.getOrThrow<number>('REFRESH_TOKEN_TTL_DAYS') *
      24 *
      60 *
      60 *
      1000;
  }

  async issue(
    userId: string,
    client: SessionPersistenceClient = this.prisma,
  ): Promise<RefreshSession> {
    const id = randomUUID();
    const secret = this.createSecret();
    const expiresAt = new Date(Date.now() + this.ttlMilliseconds);

    await client.userSession.create({
      data: {
        id,
        userId,
        refreshTokenHash: this.hashSecret(secret),
        expiresAt,
      },
    });

    return { token: `${id}.${secret}`, expiresAt };
  }

  async rotate(token: string | undefined): Promise<RotatedSession> {
    const parsed = this.parseToken(token);
    const session = await this.prisma.userSession.findUnique({
      where: { id: parsed.id },
      select: {
        refreshTokenHash: true,
        expiresAt: true,
        revokedAt: true,
        user: { select: { id: true, email: true } },
      },
    });

    if (!session || session.revokedAt || session.expiresAt <= new Date()) {
      throw new UnauthorizedException(INVALID_SESSION_MESSAGE);
    }

    const presentedHash = this.hashSecret(parsed.secret);
    if (!this.hashesMatch(presentedHash, session.refreshTokenHash)) {
      await this.prisma.userSession.updateMany({
        where: { id: parsed.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException(INVALID_SESSION_MESSAGE);
    }

    const nextSecret = this.createSecret();
    const rotated = await this.prisma.userSession.updateMany({
      where: {
        id: parsed.id,
        refreshTokenHash: presentedHash,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      data: { refreshTokenHash: this.hashSecret(nextSecret) },
    });

    if (rotated.count !== 1) {
      await this.prisma.userSession.updateMany({
        where: { id: parsed.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException(INVALID_SESSION_MESSAGE);
    }

    return {
      user: session.user,
      refreshSession: {
        token: `${parsed.id}.${nextSecret}`,
        expiresAt: session.expiresAt,
      },
    };
  }

  async revoke(token: string | undefined): Promise<void> {
    const parsed = this.tryParseToken(token);
    if (!parsed) return;

    await this.prisma.userSession.updateMany({
      where: {
        id: parsed.id,
        refreshTokenHash: this.hashSecret(parsed.secret),
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    });
  }

  private createSecret(): string {
    return randomBytes(32).toString('base64url');
  }

  private hashSecret(secret: string): string {
    return createHash('sha256').update(secret).digest('hex');
  }

  private hashesMatch(left: string, right: string): boolean {
    const leftBuffer = Buffer.from(left, 'hex');
    const rightBuffer = Buffer.from(right, 'hex');
    return (
      leftBuffer.length === rightBuffer.length &&
      timingSafeEqual(leftBuffer, rightBuffer)
    );
  }

  private parseToken(token: string | undefined): {
    id: string;
    secret: string;
  } {
    const parsed = this.tryParseToken(token);
    if (!parsed) {
      throw new UnauthorizedException(INVALID_SESSION_MESSAGE);
    }
    return parsed;
  }

  private tryParseToken(
    token: string | undefined,
  ): { id: string; secret: string } | undefined {
    if (!token) return undefined;
    const parts = token.split('.');
    if (parts.length !== 2 || !SESSION_ID_PATTERN.test(parts[0]) || !parts[1]) {
      return undefined;
    }
    return { id: parts[0], secret: parts[1] };
  }
}
