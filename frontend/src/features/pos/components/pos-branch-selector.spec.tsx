import { fireEvent, render, screen } from '@testing-library/react';
import { useAuth } from '@/features/auth/model/auth-context';
import { listPosBranches } from '../api/pos-api';
import { PosBranchSelector } from './pos-branch-selector';
import { completedSale, scope } from '../model/pos.test-fixtures';
import { setCheckoutAttempt } from '../model/checkout-attempt';

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
vi.mock('@/features/auth/model/auth-context', () => ({ useAuth: vi.fn() }));
vi.mock('../api/pos-api', () => ({ listPosBranches: vi.fn() }));
describe('POS branch selection', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(useAuth).mockReturnValue({
      request: vi.fn(),
      user: { id: 'actor' },
    } as never);
    vi.mocked(listPosBranches).mockResolvedValue([
      { id: 'branch', name: 'Makati', code: 'MKT' },
    ]);
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
    let finish!: (value: Awaited<ReturnType<typeof listPosBranches>>) => void;
    vi.mocked(listPosBranches).mockReturnValue(
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
    finish([]);
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
    vi.mocked(listPosBranches).mockResolvedValue([]);
    render(<PosBranchSelector organizationId="org" role="MANAGER" />);
    expect(await screen.findByRole('status')).toHaveTextContent(
      'No accessible branches',
    );
    expect(screen.getByRole('combobox')).toBeDisabled();
    expect(push).not.toHaveBeenCalled();
  });
  it('reports revoked current branch access', async () => {
    const denied = vi.fn();
    vi.mocked(listPosBranches).mockResolvedValue([]);
    render(
      <PosBranchSelector
        organizationId="org"
        branchId="branch"
        role="CASHIER"
        onAccessDenied={denied}
      />,
    );
    await screen.findByRole('status');
    expect(denied).toHaveBeenCalledOnce();
  });
  it('retries a failed read without navigation', async () => {
    vi.mocked(listPosBranches).mockRejectedValueOnce(new Error('offline'));
    render(<PosBranchSelector organizationId="org" role="OWNER" />);
    await screen.findByRole('alert');
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await screen.findByText('Choose a branch');
    expect(push).not.toHaveBeenCalled();
  });
});
