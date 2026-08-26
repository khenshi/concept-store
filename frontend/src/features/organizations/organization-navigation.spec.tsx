import { render, screen } from '@testing-library/react';
import { usePathname } from 'next/navigation';
import { OrganizationNavigation } from './organization-navigation';

vi.mock('next/navigation', () => ({ usePathname: vi.fn() }));

describe('OrganizationNavigation', () => {
  it('marks the active destination and renders only authorized sections', () => {
    vi.mocked(usePathname).mockReturnValue(
      '/app/organizations/organization-id/spaces',
    );
    render(
      <OrganizationNavigation
        organizationId="organization-id"
        showSpaces
        showMerchants
      />,
    );

    expect(screen.getByRole('link', { name: 'Spaces' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getByRole('link', { name: 'Merchants' })).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'Members' }),
    ).not.toBeInTheDocument();
  });
});
