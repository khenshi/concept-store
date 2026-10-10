import { Prisma } from '../../../generated/prisma/client';
import { requireActiveParticipation } from './merchant-branch-participation';
describe('Participation transaction boundary', () => {
  it.each([[[]], [[{ merchantId: 'm', status: 'INACTIVE' }]]])(
    'rejects missing or inactive affiliations',
    async (rows) => {
      const tx = { $queryRaw: jest.fn().mockResolvedValue(rows) };
      await expect(
        requireActiveParticipation(
          tx as unknown as Prisma.TransactionClient,
          'org',
          'branch',
          ['m'],
        ),
      ).rejects.toMatchObject({
        response: { code: 'MERCHANT_BRANCH_INACTIVE' },
      });
    },
  );
  it('locks unique merchant IDs in deterministic order using trusted tenant/branch scope', async () => {
    const tx = {
      $queryRaw: jest
        .fn()
        .mockResolvedValue([{ status: 'ACTIVE' }, { status: 'ACTIVE' }]),
    };
    await requireActiveParticipation(
      tx as unknown as Prisma.TransactionClient,
      'org',
      'branch',
      ['b', 'a', 'b'],
    );
    const calls = tx.$queryRaw.mock.calls as unknown as [Prisma.Sql][];
    const query = calls[0][0];
    expect(query.values).toEqual(['org', 'branch', 'a', 'b']);
    expect(query.sql).toContain('ORDER BY "merchantId" FOR SHARE');
  });
});
