import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/features/auth/auth-context';
import { createOrganization, listOrganizations } from './organization-api';
import { OrganizationEntry } from './organization-entry';

vi.mock('next/navigation', () => ({ useRouter: vi.fn() }));
vi.mock('@/features/auth/auth-context', () => ({ useAuth: vi.fn() }));
vi.mock('./organization-api', () => ({
  createOrganization: vi.fn(),
  listOrganizations: vi.fn(),
}));

describe('OrganizationEntry', () => {
  const push = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useRouter).mockReturnValue({ push } as unknown as ReturnType<
      typeof useRouter
    >);
    vi.mocked(useAuth).mockReturnValue({
      request: vi.fn(),
      user: { id: 'user-id', email: 'owner@example.com' },
    } as unknown as ReturnType<typeof useAuth>);
    vi.mocked(listOrganizations).mockResolvedValue([
      {
        id: 'north-pine-id',
        name: 'North & Pine',
        role: 'OWNER',
        createdAt: '2026-08-01T00:00:00.000Z',
        updatedAt: '2026-08-01T00:00:00.000Z',
      },
      {
        id: 'harbor-id',
        name: 'Harbor Collective',
        role: 'MANAGER',
        createdAt: '2026-08-01T00:00:00.000Z',
        updatedAt: '2026-08-01T00:00:00.000Z',
      },
    ]);
    HTMLDialogElement.prototype.showModal = vi.fn(function (
      this: HTMLDialogElement,
    ) {
      this.open = true;
    });
  });

  it('filters organizations by name', async () => {
    render(<OrganizationEntry />);
    expect(await screen.findByText('North & Pine')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Search organizations'), {
      target: { value: 'harbor' },
    });

    expect(screen.getByText('Harbor Collective')).toBeInTheDocument();
    expect(screen.queryByText('North & Pine')).not.toBeInTheDocument();
  });

  it('creates an organization from the dialog and opens its overview', async () => {
    vi.mocked(createOrganization).mockResolvedValue({
      id: 'new-organization-id',
      name: 'New Store',
      role: 'OWNER',
      createdAt: '2026-08-25T00:00:00.000Z',
      updatedAt: '2026-08-25T00:00:00.000Z',
    });
    render(<OrganizationEntry />);
    await screen.findByText('North & Pine');

    fireEvent.click(
      screen.getByRole('button', { name: 'Create organization' }),
    );
    const dialog = screen.getByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Organization name'), {
      target: { value: 'New Store' },
    });
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Create organization' }),
    );

    await waitFor(() =>
      expect(createOrganization).toHaveBeenCalledWith(
        expect.any(Function),
        'New Store',
      ),
    );
    expect(push).toHaveBeenCalledWith('/app/organizations/new-organization-id');
  });
});
