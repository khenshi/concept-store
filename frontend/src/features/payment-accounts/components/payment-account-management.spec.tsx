import { render, screen, fireEvent, waitFor } from '@testing-library/react';
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
    branches: [],
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
