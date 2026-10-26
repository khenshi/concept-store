import {
  listBranchPaymentAccounts,
  updatePaymentAccount,
} from './payment-account-api';

const account = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'GCash Main',
  enabled: true,
  systemKey: null,
  assignmentMode: 'ALL' as const,
  requiresReference: true,
  version: 2,
};

it('accepts the branch-safe account projection without organization assignment details', async () => {
  const request = vi.fn().mockResolvedValue([{ ...account, available: true }]);
  const rows = await listBranchPaymentAccounts(
    request,
    'org',
    'branch',
    'REFUND',
  );
  expect(request).toHaveBeenCalledWith(
    '/organizations/org/branches/branch/payment-accounts?operation=REFUND',
  );
  expect(rows[0]).toMatchObject({
    id: account.id,
    available: true,
    branchIds: [],
  });
});

it('sends the expected version and branch assignment atomically', async () => {
  const input = {
    name: 'GCash Main',
    enabled: false,
    assignmentMode: 'SELECTED' as const,
    requiresReference: false,
    branchIds: ['22222222-2222-4222-8222-222222222222'],
    version: 2,
  };
  const request = vi
    .fn()
    .mockResolvedValue({ ...account, ...input, version: 3 });
  const result = await updatePaymentAccount(request, 'org', account.id, input);
  expect(request).toHaveBeenCalledWith(
    `/organizations/org/payment-accounts/${account.id}`,
    expect.objectContaining({ method: 'PATCH', body: JSON.stringify(input) }),
  );
  expect(result.version).toBe(3);
});
