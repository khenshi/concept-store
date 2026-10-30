import { ConflictException } from '@nestjs/common';
import { BranchStatus } from '../../generated/prisma/client';
import {
  assertBranchWriteAllowed,
  assertBranchesActive,
  lockBranches,
} from './branch-lifecycle';

describe('branch lifecycle write guards', () => {
  const tx = {
    $queryRaw: jest.fn(),
    branch: { findUnique: jest.fn() },
  };

  beforeEach(() => jest.resetAllMocks());

  it('returns a stable conflict for inactive new-operation writes', async () => {
    tx.$queryRaw.mockResolvedValue([
      {
        id: 'branch',
        status: BranchStatus.INACTIVE,
        updatedAt: new Date('2026-10-30T00:00:00.000Z'),
      },
    ]);

    await expect(
      assertBranchWriteAllowed(tx as never, 'org', 'branch'),
    ).rejects.toMatchObject({
      response: {
        code: 'BRANCH_INACTIVE',
      },
    });
  });

  it('locks branch IDs in stable order for multi-branch writes', async () => {
    tx.$queryRaw.mockImplementation((query: { values?: string[] }) => {
      const branchId = query.values?.at(-1) ?? '';
      return [
        {
          id: branchId,
          status: BranchStatus.ACTIVE,
          updatedAt: new Date('2026-10-30T00:00:00.000Z'),
        },
      ];
    });

    const branches = await lockBranches(tx as never, 'org', [
      'branch-b',
      'branch-a',
      'branch-b',
    ]);

    expect([...branches.keys()]).toEqual(['branch-a', 'branch-b']);
  });

  it('allows explicitly permitted closure operations', async () => {
    tx.$queryRaw.mockResolvedValue([
      {
        id: 'branch',
        status: BranchStatus.INACTIVE,
        updatedAt: new Date('2026-10-30T00:00:00.000Z'),
      },
    ]);

    await expect(
      assertBranchWriteAllowed(tx as never, 'org', 'branch', {
        allowInactive: true,
      }),
    ).resolves.toMatchObject({ status: BranchStatus.INACTIVE });

    expect(() =>
      assertBranchesActive(
        new Map([
          [
            'branch',
            {
              id: 'branch',
              status: BranchStatus.INACTIVE,
              updatedAt: new Date(),
            },
          ],
        ]),
        ['branch'],
      ),
    ).toThrow(ConflictException);
  });
});
