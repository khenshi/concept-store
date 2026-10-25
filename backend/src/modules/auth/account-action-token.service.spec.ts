import { NotFoundException } from '@nestjs/common';
import { AccountActionTokenPurpose } from '../../generated/prisma/client';
import { AccountActionTokenService } from './account-action-token.service';

describe('AccountActionTokenService', () => {
  type TokenRecord = {
    id: string;
    userId: string | null;
    pendingRegistrationId: string | null;
    purpose: AccountActionTokenPurpose;
    expiresAt: Date;
  };
  const prisma = {
    accountActionToken: {
      updateMany: jest.fn<Promise<{ count: number }>, [unknown]>(),
      create: jest.fn<Promise<TokenRecord>, [unknown]>(),
      findFirst: jest.fn<Promise<TokenRecord | null>, [unknown]>(),
    },
  };
  const service = new AccountActionTokenService(prisma as never);

  beforeEach(() => jest.clearAllMocks());

  it('stores only a hash and invalidates active tokens for the same subject and purpose', async () => {
    prisma.accountActionToken.updateMany.mockResolvedValue({ count: 1 });
    prisma.accountActionToken.create.mockResolvedValue({
      id: 'token-id',
      userId: 'user-id',
      pendingRegistrationId: null,
      purpose: AccountActionTokenPurpose.RESET_PASSWORD,
      expiresAt: new Date(Date.now() + 30_000),
    });

    const result = await service.issueForUser(
      'user-id',
      AccountActionTokenPurpose.RESET_PASSWORD,
      30_000,
    );

    expect(result.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(prisma.accountActionToken.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: 'user-id',
          purpose: AccountActionTokenPurpose.RESET_PASSWORD,
          consumedAt: null,
        }) as unknown,
      }),
    );
    expect(prisma.accountActionToken.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'user-id',
          pendingRegistrationId: null,
          purpose: AccountActionTokenPurpose.RESET_PASSWORD,
          tokenHash: expect.any(String) as unknown,
        }) as unknown,
      }),
    );
  });

  it('claims a usable token once and rejects malformed or raced claims', async () => {
    const record = {
      id: 'token-id',
      userId: 'user-id',
      pendingRegistrationId: null,
      purpose: AccountActionTokenPurpose.VERIFY_EMAIL,
      expiresAt: new Date(Date.now() + 30_000),
    };
    prisma.accountActionToken.findFirst.mockResolvedValue(record);
    prisma.accountActionToken.updateMany.mockResolvedValue({ count: 1 });

    await expect(
      service.consume('invalid', AccountActionTokenPurpose.VERIFY_EMAIL),
    ).rejects.toThrow(NotFoundException);
    await expect(
      service.consume('a'.repeat(43), AccountActionTokenPurpose.VERIFY_EMAIL),
    ).resolves.toEqual(record);

    prisma.accountActionToken.updateMany.mockResolvedValueOnce({ count: 0 });
    await expect(
      service.consume('b'.repeat(43), AccountActionTokenPurpose.VERIFY_EMAIL),
    ).rejects.toThrow(NotFoundException);
  });
});
