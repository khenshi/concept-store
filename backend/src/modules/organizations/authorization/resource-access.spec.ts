import {
  branchScope,
  inventoryScope,
  merchantScope,
  productScope,
} from './resource-access';

describe('Resource query scopes', () => {
  const base = { organizationId: 'tenant', userId: 'user' };
  it('keeps owner scopes tenant-wide, not platform-wide', () => {
    const context = { ...base, role: 'OWNER' as const };
    expect(branchScope(context)).toEqual({ organizationId: 'tenant' });
    expect(productScope(context)).toEqual({ organizationId: 'tenant' });
    expect(merchantScope(context)).toEqual({ organizationId: 'tenant' });
  });
  it('limits managers through branch memberships without lifecycle or stock predicates', () => {
    const context = { ...base, role: 'MANAGER' as const };
    expect(branchScope(context)).toEqual({
      organizationId: 'tenant',
      memberships: { some: base },
    });
    expect(JSON.stringify(productScope(context))).toContain('memberships');
    expect(JSON.stringify(merchantScope(context))).toContain('products');
    expect(JSON.stringify(inventoryScope(context))).not.toContain('status');
    expect(JSON.stringify(inventoryScope(context))).not.toContain('quantity');
  });
  it('requires a linked profile and never grants another merchant access through assignments', () => {
    const unlinked = { ...base, role: 'MERCHANT' as const, merchantId: null };
    expect(branchScope(unlinked)).toEqual({
      organizationId: 'tenant',
      id: { in: [] },
    });
    expect(productScope(unlinked)).toEqual({
      organizationId: 'tenant',
      id: { in: [] },
    });
    const linked = { ...unlinked, merchantId: 'merchant' };
    expect(productScope(linked)).toEqual({
      organizationId: 'tenant',
      merchantId: 'merchant',
    });
    expect(merchantScope(linked)).toEqual({
      organizationId: 'tenant',
      id: 'merchant',
    });
    expect(inventoryScope(linked).product).toEqual(productScope(linked));
  });
  it('allows cashier branch assignments but not catalog discovery', () => {
    const context = { ...base, role: 'CASHIER' as const };
    expect(branchScope(context)).toEqual({
      organizationId: 'tenant',
      memberships: { some: base },
    });
    expect(productScope(context)).toEqual({
      organizationId: 'tenant',
      id: { in: [] },
    });
  });
});
