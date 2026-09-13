import { getBranch, listBranches } from '@/features/branches/api/branch-api';
import {
  getPosBranch,
  listPosBranches,
  lookupPosCode,
  searchPosProducts,
} from './pos-api';
import { product, scope } from '../model/pos.test-fixtures';
vi.mock('@/features/branches/api/branch-api', () => ({
  getBranch: vi.fn(),
  listBranches: vi.fn(),
}));
describe('POS minimal read contracts', () => {
  it('projects authorized branches and rejects merchants and foreign tenant rows', async () => {
    const request = vi.fn();
    vi.mocked(listBranches).mockResolvedValue([
      {
        id: scope.branchId,
        organizationId: scope.organizationId,
        name: 'Makati',
        code: 'MKT',
        address: 'private',
      },
    ] as never);
    expect(
      await listPosBranches(request, scope.organizationId, 'CASHIER'),
    ).toEqual([{ id: scope.branchId, name: 'Makati', code: 'MKT' }]);
    expect(listBranches).toHaveBeenCalledWith(
      request,
      scope.organizationId,
      'CASHIER',
    );
    await expect(
      listPosBranches(request, scope.organizationId, 'MERCHANT'),
    ).rejects.toThrow('Merchants');
    vi.mocked(listBranches).mockResolvedValue([
      {
        id: scope.branchId,
        organizationId: 'foreign',
        name: 'Other',
        code: 'OTHER',
      },
    ] as never);
    await expect(
      listPosBranches(request, scope.organizationId, 'OWNER'),
    ).rejects.toThrow('scope');
  });
  const request = vi.fn();
  const path = `/organizations/${scope.organizationId}/branches/${scope.branchId}/pos/products`;
  beforeEach(() => {
    vi.resetAllMocks();
    request.mockResolvedValue([product]);
  });
  it('uses only scoped POS search/code reads and preserves barcode case/zeroes', async () => {
    expect(await searchPosProducts(request, scope, ' vase ')).toEqual([
      product,
    ]);
    expect(request).toHaveBeenLastCalledWith(path + '?q=vase');
    expect(await lookupPosCode(request, scope, ' 001Ab ')).toEqual([product]);
    expect(request).toHaveBeenLastCalledWith(path + '/code?code=001Ab');
    await searchPosProducts(request, scope);
    expect(request).toHaveBeenLastCalledWith(path);
  });
  it('strips unneeded server fields defensively', async () => {
    request.mockResolvedValue([
      { ...product, contactName: 'private', createdById: 'private' },
    ]);
    expect(await searchPosProducts(request, scope)).toEqual([product]);
  });
  it.each([
    { sellingPrice: 850 },
    { sellingPrice: '0.00' },
    { sellingPrice: '1e2' },
    { quantity: -1 },
    { quantity: 2147483648 },
    { eligible: false },
    { productId: 'invalid' },
  ])('rejects malformed product rows %j', async (extra) => {
    request.mockResolvedValue([{ ...product, ...extra }]);
    await expect(searchPosProducts(request, scope)).rejects.toThrow();
  });
  it('rejects duplicate/oversized/ambiguous contract rows', async () => {
    request.mockResolvedValue([product, product]);
    await expect(lookupPosCode(request, scope, '001Ab')).rejects.toThrow();
    request.mockResolvedValue(Array(101).fill(product));
    await expect(searchPosProducts(request, scope)).rejects.toThrow();
  });
  it('validates input before requesting', async () => {
    await expect(lookupPosCode(request, scope, 'bad code')).rejects.toThrow();
    await expect(
      searchPosProducts(request, scope, 'x'.repeat(255)),
    ).rejects.toThrow();
    expect(request).not.toHaveBeenCalled();
  });
  it('reads an authorized branch but returns identity only and rejects scope mismatch', async () => {
    vi.mocked(getBranch).mockResolvedValue({
      id: scope.branchId,
      organizationId: scope.organizationId,
      name: 'Makati',
      code: 'MKT',
      addressLine1: 'not for POS',
    } as never);
    expect(await getPosBranch(request, scope, 'CASHIER')).toEqual({
      id: scope.branchId,
      name: 'Makati',
      code: 'MKT',
    });
    vi.mocked(getBranch).mockResolvedValue({
      id: product.productId,
      name: 'Foreign',
      code: null,
    } as never);
    await expect(getPosBranch(request, scope, 'CASHIER')).rejects.toThrow(
      'scope',
    );
  });
});
