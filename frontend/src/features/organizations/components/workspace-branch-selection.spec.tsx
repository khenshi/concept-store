import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { useEffect } from 'react';
import { useAuth } from '@/features/auth/model/auth-context';
import { listBranches } from '@/features/branches/api/branch-api';
import { listPosBranches } from '@/features/pos/api/pos-api';
import { listReportBranches } from '@/features/reports/api/report-api';
import { PosEntry } from '@/features/pos/components/pos-entry';
import { InventoryEntry } from '@/features/inventory/components/inventory-entry';
import { ReportsEntry } from '@/features/reports/components/reports-entry';
import { PosBranchSelector } from '@/features/pos/components/pos-branch-selector';
import { InventoryBranchSelector } from '@/features/inventory/components/inventory-branch-selector';
import { setCheckoutAttempt } from '@/features/pos/model/checkout-attempt';
import { setRefundAttempt } from '@/features/refunds/model/refund-attempt';
import { POS_NAVIGATION_EVENT } from '@/features/pos/model/pos-navigation';
import {
  command,
  refundScope,
} from '@/features/refunds/model/refund.test-fixtures';
import { completedSale } from '@/features/pos/model/pos.test-fixtures';
import { getOrganization } from '../api/organization-api';
import {
  OrganizationWorkspaceProvider,
  useOrganizationWorkspaceContext,
} from './organization-workspace-context';
vi.mock('@/features/auth/model/auth-context', () => ({ useAuth: vi.fn() }));
vi.mock('@/features/branches/api/branch-api', () => ({
  listBranches: vi.fn(),
}));
vi.mock('@/features/pos/api/pos-api', () => ({ listPosBranches: vi.fn() }));
vi.mock('@/features/reports/api/report-api', () => ({
  listReportBranches: vi.fn(),
}));
vi.mock('../api/organization-api', () => ({ getOrganization: vi.fn() }));
const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
const request = vi.fn();
const a = {
  id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  name: 'Main',
  code: 'MAIN',
};
const b = {
  id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  name: 'South',
  code: 'SOUTH',
};
type Page = 'pos' | 'inventory' | 'reports' | 'direct-pos' | 'direct-inventory';
let retainedSetter: (id: string) => void;
function Consumer({
  org,
  page,
  branchId = a.id,
  beforeChange,
}: {
  org: string;
  page: Page;
  branchId?: string;
  beforeChange?: () => boolean;
}) {
  const context = useOrganizationWorkspaceContext();
  useEffect(() => {
    retainedSetter = context.setSelectedBranchId;
  }, [context.setSelectedBranchId]);
  return (
    <>
      <output aria-label="Remembered branch">
        {context.selectedBranchId ?? 'none'}
      </output>
      <button onClick={() => void context.refreshOrganization()}>
        Reload access
      </button>
      {page === 'pos' ? (
        <PosEntry organizationId={org} />
      ) : page === 'inventory' ? (
        <InventoryEntry organizationId={org} />
      ) : page === 'reports' ? (
        <ReportsEntry organizationId={org} />
      ) : context.organization ? (
        page === 'direct-pos' ? (
          <PosBranchSelector
            organizationId={org}
            branchId={branchId}
            role={context.organization.role}
            rememberBranch={context.setSelectedBranchId}
          />
        ) : (
          <InventoryBranchSelector
            organizationId={org}
            branchId={branchId}
            role={context.organization.role}
            beforeChange={beforeChange}
            rememberBranch={context.setSelectedBranchId}
          />
        )
      ) : null}
    </>
  );
}
function tree(page: Page, org = 'org', beforeChange?: () => boolean) {
  return (
    <OrganizationWorkspaceProvider organizationId={org}>
      <Consumer org={org} page={page} beforeChange={beforeChange} />
    </OrganizationWorkspaceProvider>
  );
}
async function choose(name: string) {
  const picker = await screen.findByRole('combobox');
  await waitFor(() => expect(picker).toBeEnabled());
  fireEvent.click(picker);
  fireEvent.click(screen.getByRole('option', { name }));
}
describe('shared organization workspace branch selection', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(useAuth).mockReturnValue({
      request,
      user: { id: 'actor' },
    } as never);
    vi.mocked(getOrganization).mockImplementation(async (_request, id) => ({
      id,
      name: 'Store',
      role: 'OWNER',
      createdAt: '2026-09-14T00:00:00Z',
      updatedAt: '2026-09-14T00:00:00Z',
    }));
    vi.mocked(listPosBranches).mockResolvedValue([a, b]);
    vi.mocked(listBranches).mockImplementation(
      async (_request, org) =>
        [a, b].map((branch) => ({ ...branch, organizationId: org })) as never,
    );
    vi.mocked(listReportBranches).mockResolvedValue([a, b]);
  });
  afterEach(() => {
    setCheckoutAttempt('org:actor', null);
    setRefundAttempt('org:actor', null);
  });
  it('carries the POS branch through Inventory and Reports, then reuses an Inventory change in POS', async () => {
    const view = render(tree('pos'));
    await choose('South (SOUTH)');
    expect(screen.getByLabelText('Remembered branch')).toHaveTextContent(b.id);
    expect(push).toHaveBeenCalledTimes(1);
    view.rerender(tree('inventory'));
    await waitFor(() =>
      expect(push).toHaveBeenLastCalledWith(
        `/app/organizations/org/branches/${b.id}/inventory`,
      ),
    );
    view.rerender(tree('reports'));
    await waitFor(() =>
      expect(push).toHaveBeenLastCalledWith(
        `/app/organizations/org/branches/${b.id}/reports`,
      ),
    );
    expect(push).toHaveBeenCalledTimes(3);
    view.rerender(tree('direct-inventory'));
    await waitFor(() =>
      expect(screen.getByLabelText('Remembered branch')).toHaveTextContent(
        a.id,
      ),
    );
    view.rerender(tree('pos'));
    await waitFor(() =>
      expect(push).toHaveBeenLastCalledWith(
        `/app/organizations/org/branches/${a.id}/pos`,
      ),
    );
    expect(push).toHaveBeenCalledTimes(4);
  });
  it.each(['pos', 'inventory', 'reports'] as const)(
    'does not choose a default branch in %s without a remembered choice',
    async (page) => {
      render(tree(page));
      await waitFor(() => expect(screen.getByRole('combobox')).toBeEnabled());
      expect(push).not.toHaveBeenCalled();
      expect(screen.getByLabelText('Remembered branch')).toHaveTextContent(
        'none',
      );
    },
  );
  it('updates the common choice after explicit Reports selection, without a duplicate redirect', async () => {
    const view = render(tree('reports'));
    await choose('South (SOUTH)');
    expect(screen.getByLabelText('Remembered branch')).toHaveTextContent(b.id);
    expect(push).toHaveBeenCalledTimes(1);
    view.rerender(tree('inventory'));
    await waitFor(() =>
      expect(push).toHaveBeenLastCalledWith(
        `/app/organizations/org/branches/${b.id}/inventory`,
      ),
    );
  });
  it.each(['pos', 'inventory', 'reports'] as const)(
    'keeps feature-inaccessible remembered branch and shows an explicit %s picker without falling back',
    async (page) => {
      const view = render(tree('direct-pos'));
      await waitFor(() =>
        expect(screen.getByLabelText('Remembered branch')).toHaveTextContent(
          a.id,
        ),
      );
      vi.mocked(listPosBranches).mockResolvedValue([b]);
      vi.mocked(listBranches).mockResolvedValue([
        { ...b, organizationId: 'org' },
      ] as never);
      vi.mocked(listReportBranches).mockResolvedValue([b]);
      view.rerender(tree(page));
      await screen.findByText(/selected branch is unavailable/);
      expect(push).not.toHaveBeenCalled();
      expect(screen.getByLabelText('Remembered branch')).toHaveTextContent(
        a.id,
      );
      expect(screen.getByRole('combobox')).toHaveTextContent('Choose a branch');
    },
  );
  it('explicit authorized branch URLs override the shared choice', async () => {
    const view = render(tree('reports'));
    await choose('South (SOUTH)');
    push.mockClear();
    view.rerender(tree('direct-pos'));
    await waitFor(() =>
      expect(screen.getByLabelText('Remembered branch')).toHaveTextContent(
        a.id,
      ),
    );
    expect(push).not.toHaveBeenCalled();
  });
  it('clears the choice when switching organizations, including returning to the original one', async () => {
    const view = render(tree('pos'));
    await choose('South (SOUTH)');
    view.rerender(tree('inventory', 'other'));
    await waitFor(() => expect(screen.getByRole('combobox')).toBeEnabled());
    expect(screen.getByLabelText('Remembered branch')).toHaveTextContent(
      'none',
    );
    view.rerender(tree('reports'));
    await waitFor(() => expect(screen.getByRole('combobox')).toBeEnabled());
    expect(screen.getByLabelText('Remembered branch')).toHaveTextContent(
      'none',
    );
    expect(push).toHaveBeenCalledTimes(1);
  });
  it('clears selection and workspace data on user changes and sign-out', async () => {
    const view = render(tree('pos'));
    await choose('South (SOUTH)');
    vi.mocked(useAuth).mockReturnValue({
      request,
      user: { id: 'another-user' },
    } as never);
    view.rerender(tree('pos'));
    expect(screen.getByLabelText('Remembered branch')).toHaveTextContent(
      'none',
    );
    await choose('South (SOUTH)');
    vi.mocked(useAuth).mockReturnValue({ request, user: null } as never);
    view.rerender(tree('pos'));
    expect(screen.getByLabelText('Remembered branch')).toHaveTextContent(
      'none',
    );
  });
  it('access refresh retains same-role preference but invalidates older remembered-branch callbacks', async () => {
    const view = render(tree('direct-pos'));
    await waitFor(() =>
      expect(screen.getByLabelText('Remembered branch')).toHaveTextContent(
        a.id,
      ),
    );
    const old = retainedSetter;
    view.rerender(tree('reports'));
    await waitFor(() => expect(push).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole('button', { name: 'Reload access' }));
    await waitFor(() => expect(screen.getByRole('combobox')).toBeEnabled());
    act(() => old(b.id));
    expect(screen.getByLabelText('Remembered branch')).toHaveTextContent(a.id);
  });
  it('clears role-scoped preference permanently on a changed role, even if the original role returns', async () => {
    const view = render(tree('pos'));
    await choose('South (SOUTH)');
    vi.mocked(getOrganization).mockResolvedValue({
      id: 'org',
      name: 'Store',
      role: 'MANAGER',
    } as never);
    fireEvent.click(screen.getByRole('button', { name: 'Reload access' }));
    await waitFor(() => expect(screen.getByRole('combobox')).toBeEnabled());
    expect(screen.getByLabelText('Remembered branch')).toHaveTextContent(
      'none',
    );
    vi.mocked(getOrganization).mockResolvedValue({
      id: 'org',
      name: 'Store',
      role: 'OWNER',
    } as never);
    fireEvent.click(screen.getByRole('button', { name: 'Reload access' }));
    await waitFor(() => expect(screen.getByRole('combobox')).toBeEnabled());
    expect(screen.getByLabelText('Remembered branch')).toHaveTextContent(
      'none',
    );
    view.unmount();
  });
  it('keeps original branch and drafts when an inventory form cancels switching', async () => {
    const cancel = vi.fn(() => false);
    render(tree('direct-inventory', 'org', cancel));
    await waitFor(() =>
      expect(screen.getByLabelText('Remembered branch')).toHaveTextContent(
        a.id,
      ),
    );
    await choose('South (SOUTH)');
    expect(cancel).toHaveBeenCalledOnce();
    expect(push).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Remembered branch')).toHaveTextContent(a.id);
  });
  it('cancelled programmatic navigation preserves selection in Reports', async () => {
    render(tree('reports'));
    const cancel = (event: Event) => event.preventDefault();
    window.addEventListener(POS_NAVIGATION_EVENT, cancel);
    try {
      await choose('South (SOUTH)');
    } finally {
      window.removeEventListener(POS_NAVIGATION_EVENT, cancel);
    }
    expect(push).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Remembered branch')).toHaveTextContent(
      'none',
    );
  });
  it.each(['pos', 'inventory', 'reports'] as const)(
    'does not automatically resume %s across an unresolved refund',
    async (page) => {
      const view = render(tree('direct-pos'));
      await waitFor(() =>
        expect(screen.getByLabelText('Remembered branch')).toHaveTextContent(
          a.id,
        ),
      );
      setRefundAttempt('org:actor', {
        scope: refundScope,
        command,
        state: 'unknown',
      });
      view.rerender(tree(page));
      await waitFor(() => expect(screen.getByRole('combobox')).toBeEnabled());
      expect(push).not.toHaveBeenCalled();
      await choose('South (SOUTH)');
      expect(push).not.toHaveBeenCalled();
      expect(screen.getByLabelText('Remembered branch')).toHaveTextContent(
        a.id,
      );
    },
  );
  it('keeps uncertain checkout identity when entering Inventory or Reports through browser history', async () => {
    const view = render(tree('direct-pos'));
    await waitFor(() =>
      expect(screen.getByLabelText('Remembered branch')).toHaveTextContent(
        a.id,
      ),
    );
    setCheckoutAttempt('org:actor', {
      scope: refundScope,
      command: completedSale as never,
      lines: [],
      state: 'unknown',
    });
    for (const page of ['inventory', 'reports'] as const) {
      view.rerender(tree(page));
      await waitFor(() => expect(screen.getByRole('combobox')).toBeEnabled());
      await choose('South (SOUTH)');
      expect(push).not.toHaveBeenCalled();
      expect(screen.getByLabelText('Remembered branch')).toHaveTextContent(
        a.id,
      );
    }
  });
  it('ignores a late branch lookup after switching organizations', async () => {
    let resolve!: (value: Awaited<ReturnType<typeof listPosBranches>>) => void;
    vi.mocked(listPosBranches).mockReturnValueOnce(
      new Promise((done) => {
        resolve = done;
      }),
    );
    const view = render(tree('direct-pos'));
    await waitFor(() => expect(listPosBranches).toHaveBeenCalledOnce());
    view.rerender(tree('reports', 'other'));
    await waitFor(() => expect(screen.getByRole('combobox')).toBeEnabled());
    await act(async () => {
      resolve([a, b]);
    });
    expect(screen.getByLabelText('Remembered branch')).toHaveTextContent(
      'none',
    );
    expect(push).not.toHaveBeenCalled();
  });
  it('does not remember an inaccessible direct branch route', async () => {
    vi.mocked(listPosBranches).mockResolvedValue([b]);
    render(tree('direct-pos'));
    await waitFor(() => expect(screen.getByRole('combobox')).toBeEnabled());
    expect(screen.getByLabelText('Remembered branch')).toHaveTextContent(
      'none',
    );
  });
  it('keeps historical merchant Reports preference from granting Inventory or POS access', async () => {
    vi.mocked(getOrganization).mockResolvedValue({
      id: 'org',
      name: 'Store',
      role: 'MERCHANT',
    } as never);
    vi.mocked(listBranches).mockResolvedValue([b] as never);
    const view = render(tree('reports'));
    await choose('Main (MAIN)');
    push.mockClear();
    view.rerender(tree('inventory'));
    await screen.findByText(/selected branch is unavailable in Inventory/);
    expect(push).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Remembered branch')).toHaveTextContent(a.id);
    vi.mocked(listPosBranches).mockClear();
    view.rerender(tree('pos'));
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Merchants cannot access POS',
    );
    expect(listPosBranches).not.toHaveBeenCalled();
  });
});
