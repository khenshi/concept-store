import { fireEvent, render, screen } from '@testing-library/react';
import { useAuth } from '@/features/auth/model/auth-context';
import { listOrganizations } from '../api/organization-api';
import { OrganizationEntry } from './organization-entry';

vi.mock('@/features/auth/model/auth-context', () => ({ useAuth: vi.fn() }));
vi.mock('../api/organization-api', () => ({ listOrganizations: vi.fn() }));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useAuth).mockReturnValue({
    request: vi.fn(),
    user: { id: 'user-id', email: 'owner@example.com' },
  } as unknown as ReturnType<typeof useAuth>);
  vi.mocked(listOrganizations).mockResolvedValue([
    {
      id: 'north-pine-id',
      name: 'North & Pine',
      role: 'OWNER',
      status: 'ACTIVE',
      createdAt: '2026-08-01T00:00:00.000Z',
      updatedAt: '2026-08-01T00:00:00.000Z',
    },
    {
      id: 'harbor-id',
      name: 'Harbor Collective',
      role: 'MANAGER',
      status: 'INACTIVE',
      createdAt: '2026-08-01T00:00:00.000Z',
      updatedAt: '2026-08-01T00:00:00.000Z',
    },
  ]);
});

it('renders accessible organizations without public creation controls', async () => {
  render(<OrganizationEntry />);
  const row = await screen.findByRole('link', { name: /North & Pine/ });
  expect(row).toHaveClass('min-h-40', 'card-surface');
  expect(
    screen.queryByRole('button', { name: /create organization/i }),
  ).not.toBeInTheDocument();
  expect(screen.getByText('Owner')).toBeInTheDocument();
});

it('filters organizations by name', async () => {
  render(<OrganizationEntry />);
  await screen.findByText('North & Pine');

  fireEvent.change(screen.getByLabelText('Search organizations'), {
    target: { value: 'harbor' },
  });

  expect(screen.getByText('Harbor Collective')).toBeInTheDocument();
  expect(screen.queryByText('North & Pine')).not.toBeInTheDocument();
});

it('shows the operator-provisioned empty state', async () => {
  vi.mocked(listOrganizations).mockResolvedValueOnce([]);
  render(<OrganizationEntry />);

  expect(await screen.findByText('No organizations yet')).toBeInTheDocument();
  expect(screen.getAllByText(/platform operator/i).length).toBeGreaterThan(0);
});
