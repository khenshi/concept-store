import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useAuth } from '@/features/auth/model/auth-context';
import { ApiError } from '@/features/auth/api/auth-client';
import { getPosBranch, listPosBranchOptions } from '../api/pos-api';
import { PosBranchSelector } from './pos-branch-selector';
import { completedSale, scope } from '../model/pos.test-fixtures';
import { setCheckoutAttempt } from '../model/checkout-attempt';

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
vi.mock('@/features/auth/model/auth-context', () => ({ useAuth: vi.fn() }));
vi.mock('../api/pos-api', () => ({
  getPosBranch: vi.fn(),
  listPosBranchOptions: vi.fn(),
}));
describe('POS branch selection', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(useAuth).mockReturnValue({
      request: vi.fn(),
      user: { id: 'actor' },
    } as never);
    vi.mocked(getPosBranch).mockResolvedValue({
      id: 'branch',
      name: 'Makati',
      code: 'MKT',
    });
    vi.mocked(listPosBranchOptions).mockResolvedValue({
      items: [{ id: 'branch', label: 'Makati (MKT)' }],
      hasNext: false,
    });
  });
  afterEach(() => {
    setCheckoutAttempt('org:actor', null);
  });
  it.each(['pending', 'unknown'] as const)(
    'blocks %s checkout branch switching even without a mounted cart guard',
    async (state) => {
      setCheckoutAttempt('org:actor', {
        scope,
        lines: [],
        command: completedSale as never,
        state,
      });
      render(<PosBranchSelector organizationId="org" role="CASHIER" />);
      await screen.findByText('Choose a branch');
      fireEvent.click(screen.getByRole('combobox'));
      fireEvent.click(screen.getByRole('option', { name: 'Makati (MKT)' }));
      expect(push).not.toHaveBeenCalled();
    },
  );
  it('ignores a response after the selector unmounts', async () => {
    let finish!: (value: Awaited<ReturnType<typeof getPosBranch>>) => void;
    vi.mocked(getPosBranch).mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const denied = vi.fn();
    const view = render(
      <PosBranchSelector
        organizationId="org"
        branchId="branch"
        role="CASHIER"
        onAccessDenied={denied}
      />,
    );
    view.unmount();
    finish({ id: 'branch', name: 'Makati', code: 'MKT' });
    await Promise.resolve();
    expect(denied).not.toHaveBeenCalled();
  });
  it('requires an explicit selection even for a single assigned branch', async () => {
    render(<PosBranchSelector organizationId="org" role="CASHIER" />);
    await screen.findByRole('combobox', { name: 'POS branch' });
    expect(push).not.toHaveBeenCalled();
    await screen.findByText('Choose a branch');
    fireEvent.click(screen.getByRole('combobox'));
    fireEvent.click(screen.getByRole('option', { name: 'Makati (MKT)' }));
    expect(push).toHaveBeenCalledWith(
      '/app/organizations/org/branches/branch/pos',
    );
  });
  it('handles unassigned members without choosing a branch', async () => {
    vi.mocked(listPosBranchOptions).mockResolvedValue({
      items: [],
      hasNext: false,
    });
    render(<PosBranchSelector organizationId="org" role="MANAGER" />);
    expect(await screen.findByRole('status')).toHaveTextContent(
      'No accessible branches',
    );
    expect(screen.getByRole('combobox')).toBeDisabled();
    expect(push).not.toHaveBeenCalled();
  });
  it('reports revoked current branch access', async () => {
    const denied = vi.fn();
    vi.mocked(getPosBranch).mockRejectedValue(new ApiError(404, 'revoked'));
    render(
      <PosBranchSelector
        organizationId="org"
        branchId="branch"
        role="CASHIER"
        onAccessDenied={denied}
      />,
    );
    await waitFor(() => expect(denied).toHaveBeenCalledOnce());
  });
  it('retries a failed read without navigation', async () => {
    vi.mocked(listPosBranchOptions).mockRejectedValueOnce(new Error('offline'));
    render(<PosBranchSelector organizationId="org" role="OWNER" />);
    await screen.findByRole('alert');
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await screen.findByText('Choose a branch');
    expect(push).not.toHaveBeenCalled();
  });
});
