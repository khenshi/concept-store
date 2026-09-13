import { render, screen } from '@testing-library/react';
import { usePathname } from 'next/navigation';
import { OrganizationNavigation } from './organization-navigation';

vi.mock('next/navigation', () => ({ usePathname: vi.fn() }));

describe('OrganizationNavigation', () => {
  it('marks branch checkout as POS instead of Branches and hides unauthorized POS', () => {
    vi.mocked(usePathname).mockReturnValue(
      '/app/organizations/org/branches/branch/pos',
    );
    const view = render(
      <OrganizationNavigation organizationId="org" showPos collapsed />,
    );
    expect(screen.getByRole('link', { name: 'POS' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getByRole('link', { name: 'Branches' })).not.toHaveAttribute(
      'aria-current',
    );
    view.rerender(<OrganizationNavigation organizationId="org" showSales />);
    expect(screen.queryByRole('link', { name: 'POS' })).not.toBeInTheDocument();
  });
  it('shows merchant sales navigation only when allowed, including collapsed active detail destinations', () => {
    vi.mocked(usePathname).mockReturnValue('/app/organizations/org/sales');
    const view = render(<OrganizationNavigation organizationId="org" />);
    expect(
      screen.queryByRole('link', { name: 'Sales' }),
    ).not.toBeInTheDocument();
    view.rerender(
      <OrganizationNavigation organizationId="org" showSales collapsed />,
    );
    expect(screen.getByRole('link', { name: 'Sales' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getByRole('link', { name: 'Sales' })).toHaveAttribute(
      'title',
      'Sales',
    );
    vi.mocked(usePathname).mockReturnValue(
      '/app/organizations/org/branches/branch/sales/sale',
    );
    view.rerender(<OrganizationNavigation organizationId="org" showSales />);
    expect(screen.getByRole('link', { name: 'Sales' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getByRole('link', { name: 'Branches' })).not.toHaveAttribute(
      'aria-current',
    );
  });
  it('shows product navigation only when allowed and marks profiles active', () => {
    vi.mocked(usePathname).mockReturnValue(
      '/app/organizations/organization-id/products/product-id',
    );
    const { rerender } = render(
      <OrganizationNavigation organizationId="organization-id" />,
    );
    expect(
      screen.queryByRole('link', { name: 'Products' }),
    ).not.toBeInTheDocument();
    rerender(
      <OrganizationNavigation organizationId="organization-id" showProducts />,
    );
    expect(screen.getByRole('link', { name: 'Products' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });
  it('shows only foundation destinations and marks the active route', () => {
    vi.mocked(usePathname).mockReturnValue(
      '/app/organizations/organization-id/branches',
    );
    render(
      <OrganizationNavigation organizationId="organization-id" showMembers />,
    );
    expect(screen.getByRole('link', { name: 'Branches' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getByRole('link', { name: 'Members' })).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'Products' }),
    ).not.toBeInTheDocument();
  });

  it('keeps collapsed navigation accessible', () => {
    vi.mocked(usePathname).mockReturnValue(
      '/app/organizations/organization-id',
    );
    render(
      <OrganizationNavigation collapsed organizationId="organization-id" />,
    );
    expect(screen.getByRole('link', { name: 'Overview' })).toHaveAttribute(
      'title',
      'Overview',
    );
    expect(
      screen.queryByRole('link', { name: 'Members' }),
    ).not.toBeInTheDocument();
  });

  it('shows merchant navigation only when merchant management is allowed', () => {
    vi.mocked(usePathname).mockReturnValue(
      '/app/organizations/organization-id/merchants',
    );
    const { rerender } = render(
      <OrganizationNavigation organizationId="organization-id" />,
    );
    expect(
      screen.queryByRole('link', { name: 'Merchants' }),
    ).not.toBeInTheDocument();

    rerender(
      <OrganizationNavigation organizationId="organization-id" showMerchants />,
    );
    expect(screen.getByRole('link', { name: 'Merchants' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('marks detail routes active without matching unrelated prefix routes', () => {
    vi.mocked(usePathname).mockReturnValue(
      '/app/organizations/organization-id/branches/branch-id',
    );
    const { rerender } = render(
      <OrganizationNavigation organizationId="organization-id" />,
    );
    expect(screen.getByRole('link', { name: 'Branches' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    vi.mocked(usePathname).mockReturnValue(
      '/app/organizations/organization-id/branches-other',
    );
    rerender(<OrganizationNavigation organizationId="organization-id" />);
    expect(screen.getByRole('link', { name: 'Branches' })).not.toHaveAttribute(
      'aria-current',
    );
  });
});
