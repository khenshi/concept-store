import { Injectable, NotFoundException } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import {
  AccountActionTokenPurpose,
  Prisma,
} from '../../generated/prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export interface AccountActionTokenRecord {
  id: string;
  userId: string | null;
  pendingRegistrationId: string | null;
  purpose: AccountActionTokenPurpose;
  expiresAt: Date;
}

@Injectable()
export class AccountActionTokenService {
  constructor(private readonly prisma: PrismaService) {}

  issueForUser(
    userId: string,
    purpose: AccountActionTokenPurpose,
    ttlMs: number,
    transaction: Prisma.TransactionClient = this.prisma,
  ): Promise<{ token: string; record: AccountActionTokenRecord }> {
    return this.issue(
      { userId, pendingRegistrationId: null },
      purpose,
      ttlMs,
      transaction,
    );
  }

  issueForPendingRegistration(
    pendingRegistrationId: string,
    purpose: AccountActionTokenPurpose,
    ttlMs: number,
    transaction: Prisma.TransactionClient = this.prisma,
  ): Promise<{ token: string; record: AccountActionTokenRecord }> {
    return this.issue(
      { userId: null, pendingRegistrationId },
      purpose,
      ttlMs,
      transaction,
    );
  }

  async consume(
    token: string,
    purpose: AccountActionTokenPurpose,
    transaction: Prisma.TransactionClient = this.prisma,
  ): Promise<AccountActionTokenRecord> {
    if (!TOKEN_PATTERN.test(token)) this.throwUnavailable();

    const now = new Date();
    const record = await transaction.accountActionToken.findFirst({
      where: {
        tokenHash: this.hashToken(token),
        purpose,
        consumedAt: null,
        expiresAt: { gt: now },
      },
      select: {
        id: true,
        userId: true,
        pendingRegistrationId: true,
        purpose: true,
        expiresAt: true,
      },
    });

    if (!record) this.throwUnavailable();

    const claimed = await transaction.accountActionToken.updateMany({
      where: {
        id: record.id,
        consumedAt: null,
        expiresAt: { gt: now },
      },
      data: { consumedAt: now },
    });
    if (claimed.count !== 1) this.throwUnavailable();

    return record;
  }

  hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private async issue(
    subject: { userId: string | null; pendingRegistrationId: string | null },
    purpose: AccountActionTokenPurpose,
    ttlMs: number,
    transaction: Prisma.TransactionClient,
  ): Promise<{ token: string; record: AccountActionTokenRecord }> {
    const token = randomBytes(32).toString('base64url');
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttlMs);

    await transaction.accountActionToken.updateMany({
      where: {
        purpose,
        consumedAt: null,
        expiresAt: { gt: now },
        ...(subject.userId
          ? { userId: subject.userId }
          : { pendingRegistrationId: subject.pendingRegistrationId! }),
      },
      data: { consumedAt: now },
    });

    const record = await transaction.accountActionToken.create({
      data: {
        ...subject,
        purpose,
        tokenHash: this.hashToken(token),
        expiresAt,
      },
      select: {
        id: true,
        userId: true,
        pendingRegistrationId: true,
        purpose: true,
        expiresAt: true,
      },
    });

    return { token, record };
  }

  private throwUnavailable(): never {
    throw new NotFoundException(
      'The requested account action is invalid or unavailable',
    );
  }
}
