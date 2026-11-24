import {
  render,
  screen,
  fireEvent,
  waitFor,
  within,
} from '@testing-library/react';
import { useAuth } from '@/features/auth/model/auth-context';
import { useOrganizationWorkspaceContext } from '@/features/organizations/components/organization-workspace-context';
import {
  listPaymentAccounts,
  updatePaymentAccount,
} from '../api/payment-account-api';
import { PaymentAccountManagement } from './payment-account-management';

vi.mock('@/features/auth/model/auth-context', () => ({ useAuth: vi.fn() }));
vi.mock(
  '@/features/organizations/components/organization-workspace-context',
  () => ({ useOrganizationWorkspaceContext: vi.fn() }),
);
vi.mock('../api/payment-account-api', () => ({
  listPaymentAccounts: vi.fn(),
  updatePaymentAccount: vi.fn(),
  createPaymentAccount: vi.fn(),
}));
const loadBranches = vi.fn().mockResolvedValue([]);
const request = vi.fn();
const branches = [
  {
    id: '22222222-2222-4222-8222-222222222222',
    name: 'Makati',
    code: 'MKT',
  },
  {
    id: '33333333-3333-4333-8333-333333333333',
    name: 'Cebu',
    code: 'CEB',
  },
];
const account = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'GCash Main',
  enabled: true,
  systemKey: null,
  assignmentMode: 'ALL' as const,
  requiresReference: true,
  version: 2,
  branchIds: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useAuth).mockReturnValue({ request } as never);
  vi.mocked(useOrganizationWorkspaceContext).mockReturnValue({
    organization: { id: 'org', role: 'OWNER', status: 'ACTIVE' },
    organizationStatus: 'ready',
    branches,
    loadBranches,
  } as never);
  vi.mocked(listPaymentAccounts).mockResolvedValue([account]);
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
    configurable: true,
    value() {
      this.setAttribute('open', '');
    },
  });
  Object.defineProperty(HTMLDialogElement.prototype, 'close', {
    configurable: true,
    value() {
      this.removeAttribute('open');
    },
  });
});

it('denies management and avoids fetching account configuration for non-Owners', () => {
  vi.mocked(useOrganizationWorkspaceContext).mockReturnValue({
    organization: { role: 'MANAGER' },
    organizationStatus: 'ready',
  } as never);
  render(<PaymentAccountManagement organizationId="org" />);
  expect(screen.getByText('Owner access required')).toBeVisible();
  expect(listPaymentAccounts).not.toHaveBeenCalled();
});

it('requires a real valid change before submitting the versioned edit', async () => {
  vi.mocked(updatePaymentAccount).mockResolvedValue({
    ...account,
    name: 'GCash Backup',
    version: 3,
  });
  render(<PaymentAccountManagement organizationId="org" />);
  expect(
    screen.queryByPlaceholderText('Search branches'),
  ).not.toBeInTheDocument();
  fireEvent.click(await screen.findByRole('button', { name: 'Edit' }));
  expect(screen.getByRole('button', { name: 'Save account' })).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Account name'), {
    target: { value: 'Cash' },
  });
  expect(screen.getByRole('button', { name: 'Save account' })).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Account name'), {
    target: { value: 'GCash Backup' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Save account' }));
  await waitFor(() =>
    expect(updatePaymentAccount).toHaveBeenCalledWith(
      request,
      'org',
      account.id,
      expect.objectContaining({
        name: 'GCash Backup',
        version: 2,
        branchIds: [],
      }),
    ),
  );
});

it('renders availability as compact status pills', async () => {
  vi.mocked(listPaymentAccounts).mockResolvedValue([
    account,
    {
      ...account,
      id: '44444444-4444-4444-8444-444444444444',
      name: 'Maya',
      enabled: false,
    },
  ]);
  render(<PaymentAccountManagement organizationId="org" />);
  expect(
    await screen.findByText('Enabled', { selector: 'span.inline-flex' }),
  ).toHaveClass('rounded-full', 'border-success/30', 'bg-success/5');
  expect(
    screen.getByText('Disabled', { selector: 'span.inline-flex' }),
  ).toHaveClass('rounded-full', 'border-hairline', 'bg-subtle');
});

it('shows a fixed scrollable branch list and an all-branches switch', async () => {
  render(<PaymentAccountManagement organizationId="org" />);
  fireEvent.click(
    await screen.findByRole('button', { name: 'Create account' }),
  );
  const dialog = screen.getByRole('dialog');
  expect(dialog).toHaveClass('max-w-4xl');
  expect(screen.queryByLabelText('Filter branches')).not.toBeInTheDocument();
  const list = screen.getByRole('group', { name: 'Available branches' });
  expect(list).toHaveClass('h-60', 'overflow-y-auto');
  expect(
    within(list).getByRole('button', { name: 'Clear branch selection' }),
  ).toBeInTheDocument();
  expect(screen.queryByText('No branches selected')).not.toBeInTheDocument();
  expect(within(list).getByText(/Makati/)).toBeInTheDocument();
  const allBranches = within(dialog).getByRole('switch', {
    name: 'All branches',
  });
  expect(allBranches).toHaveAttribute('aria-checked', 'false');
  fireEvent.click(allBranches);
  expect(allBranches).toHaveAttribute('aria-checked', 'true');
  expect(within(list).getByRole('button', { name: /Makati/ })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
});

it('renders system Cash without an edit action', async () => {
  vi.mocked(listPaymentAccounts).mockResolvedValue([
    { ...account, name: 'Cash', systemKey: 'CASH', requiresReference: false },
  ]);
  render(<PaymentAccountManagement organizationId="org" />);
  expect(await screen.findByText('Always available')).toBeVisible();
  expect(
    screen.queryByRole('button', { name: 'Edit' }),
  ).not.toBeInTheDocument();
});
