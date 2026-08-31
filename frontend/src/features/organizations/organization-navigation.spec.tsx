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

  it('shows finance only to roles whose shell enables it', () => {
    vi.mocked(usePathname).mockReturnValue(
      '/app/organizations/organization-id/settlements',
    );
    const { rerender } = render(
      <OrganizationNavigation organizationId="organization-id" />,
    );
    expect(
      screen.queryByRole('link', { name: 'Settlements' }),
    ).not.toBeInTheDocument();

    rerender(
      <OrganizationNavigation organizationId="organization-id" showFinance />,
    );
    expect(screen.getByRole('link', { name: 'Settlements' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('shows reporting only when the organization shell enables it', () => {
    vi.mocked(usePathname).mockReturnValue(
      '/app/organizations/organization-id/reports',
    );
    render(
      <OrganizationNavigation organizationId="organization-id" showReports />,
    );

    expect(screen.getByRole('link', { name: 'Reports' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('shows agreements as a permanent business destination', () => {
    vi.mocked(usePathname).mockReturnValue(
      '/app/organizations/organization-id/agreements',
    );
    render(
      <OrganizationNavigation organizationId="organization-id" showMerchants />,
    );

    expect(screen.getByRole('link', { name: 'Agreements' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(
      screen.queryByRole('link', { name: 'Merchant profile' }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Merchants' })).not.toHaveAttribute(
      'aria-current',
    );
  });
});
