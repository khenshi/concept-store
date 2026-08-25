import { render, screen } from '@testing-library/react';
import { OrganizationNavigation } from './organization-navigation';

describe('OrganizationNavigation', () => {
  it('marks the active destination and renders only authorized sections', () => {
    render(
      <OrganizationNavigation
        organizationId="organization-id"
        active="spaces"
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
