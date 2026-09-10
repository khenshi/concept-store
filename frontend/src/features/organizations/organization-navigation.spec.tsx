import { render, screen } from '@testing-library/react';
import { usePathname } from 'next/navigation';
import { OrganizationNavigation } from './organization-navigation';

vi.mock('next/navigation', () => ({ usePathname: vi.fn() }));

describe('OrganizationNavigation', () => {
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
});
