import { redirect } from 'next/navigation';
import ReportsPage from '@/app/(protected)/app/organizations/[organizationId]/branches/[branchId]/reports/page';

vi.mock('next/navigation', () => ({
  redirect: vi.fn(() => {
    throw new Error('redirect');
  }),
}));

describe('existing branch Reports link', () => {
  beforeEach(() => vi.clearAllMocks());
  it('redirects to nested Overview while preserving applied dates and tab filters', async () => {
    await expect(
      ReportsPage({
        params: Promise.resolve({ organizationId: 'org', branchId: 'branch' }),
        searchParams: Promise.resolve({
          preset: 'CUSTOM',
          fromDay: '2026-10-01',
          throughDay: '2026-10-21',
          transactionQ: 'REF + 1',
        }),
      }),
    ).rejects.toThrow('redirect');
    const destination = vi.mocked(redirect).mock.calls[0][0];
    const url = new URL(String(destination), 'http://localhost');
    expect(url.pathname).toBe(
      '/app/organizations/org/branches/branch/reports/overview',
    );
    expect(Object.fromEntries(url.searchParams)).toEqual({
      preset: 'CUSTOM',
      fromDay: '2026-10-01',
      throughDay: '2026-10-21',
      transactionQ: 'REF + 1',
    });
  });
  it('keeps the unfiltered entry link working without inventing query parameters', async () => {
    await expect(
      ReportsPage({
        params: Promise.resolve({ organizationId: 'org', branchId: 'branch' }),
        searchParams: Promise.resolve({}),
      }),
    ).rejects.toThrow('redirect');
    expect(redirect).toHaveBeenCalledWith(
      '/app/organizations/org/branches/branch/reports/overview',
    );
  });
});
