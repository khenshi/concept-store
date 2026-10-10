import {
  listAssociations,
  listActiveMerchantBranches,
  saveAssociation,
} from './merchant-branch-api';
const org = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  merchant = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  branch = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
export const association = {
  id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  organizationId: org,
  merchantId: merchant,
  branchId: branch,
  status: 'ACTIVE',
  createdAt: '2026-10-01T00:00:00Z',
  updatedAt: '2026-10-01T00:00:00Z',
  merchant: { id: merchant, name: 'Merchant', code: null, status: 'ACTIVE' },
  branch: { id: branch, name: 'Branch', code: null },
};
const page = {
  items: [association],
  page: 1,
  limit: 10,
  total: 1,
  totalPages: 1,
  hasNext: false,
};
describe('Merchant branch API contracts', () => {
  it('uses scoped reads with pagination/search and rejects foreign responses', async () => {
    const request = vi.fn().mockResolvedValue(page);
    await listAssociations(
      request,
      { organizationId: org, kind: 'merchant', id: merchant },
      { page: 1, q: 'Shop', status: 'ACTIVE' },
    );
    expect(request).toHaveBeenCalledWith(
      `/organizations/${org}/merchants/${merchant}/branches?page=1&q=Shop&status=ACTIVE`,
    );
    request.mockResolvedValue({
      ...page,
      items: [{ ...association, organizationId: branch }],
    });
    await expect(
      listAssociations(request, {
        organizationId: org,
        kind: 'merchant',
        id: merchant,
      }),
    ).rejects.toThrow('scope mismatch');
  });
  it('uses PUT assignment and explicit PATCH reactivation with validated identities', async () => {
    const request = vi.fn().mockResolvedValue(association);
    await saveAssociation(request, org, merchant, branch);
    expect(request).toHaveBeenLastCalledWith(
      `/organizations/${org}/merchants/${merchant}/branches/${branch}`,
      expect.objectContaining({ method: 'PUT', body: '{}' }),
    );
    await saveAssociation(request, org, merchant, branch, 'ACTIVE');
    expect(request).toHaveBeenLastCalledWith(
      `/organizations/${org}/merchants/${merchant}/branches/${branch}/status`,
      expect.objectContaining({ method: 'PATCH', body: '{"status":"ACTIVE"}' }),
    );
  });
  it('rejects identity and pagination inconsistencies', async () => {
    const request = vi.fn().mockResolvedValue({ ...page, hasNext: true });
    await expect(
      listAssociations(request, {
        organizationId: org,
        kind: 'merchant',
        id: merchant,
      }),
    ).rejects.toThrow();
    request.mockResolvedValue({
      ...page,
      items: [{ ...association, branchId: merchant }],
    });
    await expect(
      listAssociations(request, {
        organizationId: org,
        kind: 'merchant',
        id: merchant,
      }),
    ).rejects.toThrow();
  });
  it('fetches all active affiliated branch pages for opening stock', async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce({
        ...page,
        total: 11,
        totalPages: 2,
        hasNext: true,
      })
      .mockResolvedValueOnce({
        ...page,
        page: 2,
        total: 11,
        totalPages: 2,
        hasNext: false,
        items: [],
      });
    expect(await listActiveMerchantBranches(request, org, merchant)).toEqual([
      association.branch,
    ]);
    expect(request).toHaveBeenLastCalledWith(
      `/organizations/${org}/merchants/${merchant}/branches?page=2&status=ACTIVE`,
    );
  });
});
