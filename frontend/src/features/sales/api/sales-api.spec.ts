import { listSales, getSale, listSellingBranches } from './sales-api';
import {
  scope,
  product,
  completedSale,
} from '@/features/pos/model/pos.test-fixtures';
import {
  ownSale,
  ownPage,
  staffPage,
  sellingBranches,
} from '../model/sales.test-fixtures';
describe('scoped role-specific sales read API', () => {
  it.each(['OWNER', 'MANAGER', 'CASHIER'] as const)(
    'reads explicit persisted staff contracts for %s without writes',
    async (role) => {
      const request = vi
        .fn()
        .mockResolvedValueOnce(staffPage)
        .mockResolvedValueOnce(completedSale);
      expect(
        await listSales(request, scope, role, {
          page: 1,
          limit: 50,
          from: '2026-09-13T00:00:00Z',
          until: '2026-09-14T00:00:00Z',
        }),
      ).toEqual({ kind: 'staff', page: staffPage });
      expect(request.mock.calls[0][0]).toBe(
        `/organizations/${scope.organizationId}/branches/${scope.branchId}/sales?page=1&limit=50&from=2026-09-13T00%3A00%3A00Z&until=2026-09-14T00%3A00%3A00Z`,
      );
      expect(await getSale(request, scope, role, completedSale.id)).toEqual({
        kind: 'staff',
        sale: completedSale,
      });
      expect(request.mock.calls[1][0]).toBe(
        `/organizations/${scope.organizationId}/branches/${scope.branchId}/sales/${completedSale.id}`,
      );
      expect(request.mock.calls.every((call) => call.length === 1)).toBe(true);
    },
  );
  it('uses the reduced merchant contract and historical identity-only lookup', async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce(ownPage)
      .mockResolvedValueOnce(ownSale)
      .mockResolvedValueOnce(sellingBranches);
    expect(
      await listSales(request, scope, 'MERCHANT', { page: 1, limit: 50 }),
    ).toEqual({ kind: 'merchant', page: ownPage });
    expect(await getSale(request, scope, 'MERCHANT', ownSale.id)).toEqual({
      kind: 'merchant',
      sale: ownSale,
    });
    expect(await listSellingBranches(request, scope.organizationId)).toEqual(
      sellingBranches,
    );
    expect(request.mock.calls[2][0]).toBe(
      `/organizations/${scope.organizationId}/sales/branches`,
    );
  });
  it.each([
    'total',
    'cashierName',
    'paymentMethod',
    'paymentReference',
    'cashTender',
    'cashChange',
    'organizationName',
    'createdById',
    'requestId',
    'checkoutCommand',
  ])('rejects merchant responses carrying forbidden %s', async (field) => {
    const request = vi
      .fn()
      .mockResolvedValue({ ...ownSale, [field]: 'private' });
    await expect(
      getSale(request, scope, 'MERCHANT', ownSale.id),
    ).rejects.toThrow();
    request.mockResolvedValue({
      ...ownPage,
      items: [{ ...ownSale, [field]: 'private' }],
    });
    await expect(
      listSales(request, scope, 'MERCHANT', { page: 1, limit: 50 }),
    ).rejects.toThrow();
  });
  it('never falls back between role contracts after a role change', async () => {
    await expect(
      getSale(
        vi.fn().mockResolvedValue(completedSale),
        scope,
        'MERCHANT',
        completedSale.id,
      ),
    ).rejects.toThrow();
    await expect(
      getSale(vi.fn().mockResolvedValue(ownSale), scope, 'CASHIER', ownSale.id),
    ).rejects.toThrow();
  });
  it('rejects foreign scope and guessed response IDs', async () => {
    for (const change of [
      { branchId: product.productId },
      { id: product.productId },
    ]) {
      await expect(
        getSale(
          vi.fn().mockResolvedValue({ ...ownSale, ...change }),
          scope,
          'MERCHANT',
          ownSale.id,
        ),
      ).rejects.toThrow();
    }
    await expect(
      listSales(
        vi.fn().mockResolvedValue({
          ...staffPage,
          items: [{ ...completedSale, organizationId: product.productId }],
        }),
        scope,
        'OWNER',
        { page: 1, limit: 50 },
      ),
    ).rejects.toThrow();
    await expect(
      listSales(
        vi.fn().mockResolvedValue({
          ...ownPage,
          items: [{ ...ownSale, branchId: product.productId }],
        }),
        scope,
        'MERCHANT',
        { page: 1, limit: 50 },
      ),
    ).rejects.toThrow();
  });
  it('rejects forbidden nested merchant fields and inconsistent exact subtotals', async () => {
    for (const change of [
      { ownItemsSubtotal: '850.01' },
      { ownItemsSubtotal: '1e3' },
      { items: [{ ...ownSale.items[0], merchantId: 'private' }] },
      { items: [{ ...ownSale.items[0], lineTotal: '849.00' }] },
    ])
      await expect(
        getSale(
          vi.fn().mockResolvedValue({ ...ownSale, ...change }),
          scope,
          'MERCHANT',
          ownSale.id,
        ),
      ).rejects.toThrow();
  });
  it('rejects malformed pagination, branch identities and duplicate branches', async () => {
    for (const change of [
      { totalPages: 2 },
      { page: 2 },
      { limit: 101 },
      { total: 0 },
      { items: Array(101).fill(ownSale) },
    ])
      await expect(
        listSales(
          vi.fn().mockResolvedValue({ ...ownPage, ...change }),
          scope,
          'MERCHANT',
          { page: 1, limit: 50 },
        ),
      ).rejects.toThrow();
    await expect(
      listSellingBranches(
        vi
          .fn()
          .mockResolvedValue([
            { ...sellingBranches[0], addressLine1: 'private' },
          ]),
        scope.organizationId,
      ),
    ).rejects.toThrow();
    await expect(
      listSellingBranches(
        vi.fn().mockResolvedValue([...sellingBranches, ...sellingBranches]),
        scope.organizationId,
      ),
    ).rejects.toThrow();
  });
  it.each([
    { page: 0, limit: 50 },
    { page: 21474837, limit: 50 },
    { page: 1, limit: 101 },
    { page: 1, limit: 50, from: '2026-09-13T00:00:00+08:00' },
    { page: 1, limit: 50, from: '2026-02-30T00:00:00Z' },
    {
      page: 1,
      limit: 50,
      from: '2026-09-14T00:00:00Z',
      until: '2026-09-13T00:00:00Z',
    },
  ])('rejects query %j before HTTP', async (query) => {
    const request = vi.fn();
    await expect(
      listSales(request, scope, 'MERCHANT', query),
    ).rejects.toThrow();
    expect(request).not.toHaveBeenCalled();
  });
});
