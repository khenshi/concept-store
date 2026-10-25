import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { assertActiveOrganization } from './organization-state';

describe('assertActiveOrganization', () => {
  const transaction = {
    $queryRaw: jest.fn(),
  } as unknown as Prisma.TransactionClient;

  beforeEach(() => jest.clearAllMocks());

  it('locks an active organization', async () => {
    (transaction.$queryRaw as jest.Mock).mockResolvedValue([
      { id: 'organization', status: 'ACTIVE' },
    ]);

    await expect(
      assertActiveOrganization(transaction, 'organization'),
    ).resolves.toBeUndefined();
  });

  it('rejects a missing organization', async () => {
    (transaction.$queryRaw as jest.Mock).mockResolvedValue([]);

    await expect(
      assertActiveOrganization(transaction, 'organization'),
    ).rejects.toThrow(new NotFoundException('Organization not found'));
  });

  it('rejects an inactive organization', async () => {
    (transaction.$queryRaw as jest.Mock).mockResolvedValue([
      { id: 'organization', status: 'INACTIVE' },
    ]);

    await expect(
      assertActiveOrganization(transaction, 'organization'),
    ).rejects.toThrow(
      new ForbiddenException(
        'This organization is inactive and currently read-only',
      ),
    );
  });
});
