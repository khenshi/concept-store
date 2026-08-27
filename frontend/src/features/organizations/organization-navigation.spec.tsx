import { render, screen } from '@testing-library/react';
import { usePathname } from 'next/navigation';
import { OrganizationNavigation } from './organization-navigation';

vi.mock('next/navigation', () => ({ usePathname: vi.fn() }));

describe('OrganizationNavigation', () => {
  it('marks the active destination and renders only authorized sections', () => {
    vi.mocked(usePathname).mockReturnValue(
      '/app/organizations/organization-id/products',
    );
    render(
      <OrganizationNavigation
        organizationId="organization-id"
        showMerchants
        showProducts
      />,
    );

    expect(screen.getByRole('link', { name: 'Products' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getByRole('link', { name: 'Merchants' })).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'Spaces' }),
    ).not.toBeInTheDocument();
    expect(screen.getByText('Operations')).toBeInTheDocument();
    expect(screen.getByText('Business')).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'Members' }),
    ).not.toBeInTheDocument();
  });
});
