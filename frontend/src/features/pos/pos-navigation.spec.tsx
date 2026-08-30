import { render, screen } from '@testing-library/react';
import { usePathname } from 'next/navigation';
import { PosNavigation } from './pos-navigation';

vi.mock('next/navigation', () => ({ usePathname: vi.fn() }));

describe('PosNavigation', () => {
  it('marks a new sale as the exact POS destination', () => {
    vi.mocked(usePathname).mockReturnValue(
      '/app/organizations/organization-id/pos',
    );
    render(<PosNavigation organizationId="organization-id" />);

    expect(screen.getByRole('link', { name: 'New sale' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(
      screen.getByRole('link', { name: 'Sales history' }),
    ).not.toHaveAttribute('aria-current');
  });

  it('keeps sales history active for details and receipts', () => {
    vi.mocked(usePathname).mockReturnValue(
      '/app/organizations/organization-id/pos/sales/sale-id/receipt',
    );
    render(<PosNavigation organizationId="organization-id" />);

    expect(screen.getByRole('link', { name: 'Sales history' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });
});
