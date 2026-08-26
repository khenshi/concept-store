import { fireEvent, render, screen } from '@testing-library/react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/features/auth/auth-context';
import { listOrganizations } from './organization-api';
import { OrganizationSwitcher } from './organization-switcher';

vi.mock('next/navigation', () => ({ useRouter: vi.fn() }));
vi.mock('@/features/auth/auth-context', () => ({ useAuth: vi.fn() }));
vi.mock('./organization-api', () => ({ listOrganizations: vi.fn() }));

describe('OrganizationSwitcher', () => {
  const push = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useRouter).mockReturnValue({ push } as unknown as ReturnType<
      typeof useRouter
    >);
    vi.mocked(useAuth).mockReturnValue({
      request: vi.fn(),
    } as unknown as ReturnType<typeof useAuth>);
    vi.mocked(listOrganizations).mockResolvedValue([
      {
        id: 'current-id',
        name: 'North & Pine',
        role: 'OWNER',
        createdAt: '2026-08-01T00:00:00.000Z',
        updatedAt: '2026-08-01T00:00:00.000Z',
      },
      {
        id: 'another-id',
        name: 'Harbor Collective',
        role: 'MANAGER',
        createdAt: '2026-08-01T00:00:00.000Z',
        updatedAt: '2026-08-01T00:00:00.000Z',
      },
    ]);
  });

  it('switches organizations and returns to the organization list', async () => {
    render(
      <OrganizationSwitcher
        organizationId="current-id"
        organizationName="North & Pine"
      />,
    );
    const trigger = await screen.findByRole('button', { name: /North & Pine/ });
    fireEvent.click(trigger);

    fireEvent.click(
      await screen.findByRole('menuitem', { name: /Harbor Collective/ }),
    );
    expect(push).toHaveBeenCalledWith('/app/organizations/another-id');

    fireEvent.click(trigger);
    fireEvent.click(
      screen.getByRole('menuitem', { name: 'All organizations' }),
    );
    expect(push).toHaveBeenCalledWith('/app');
  });
});
