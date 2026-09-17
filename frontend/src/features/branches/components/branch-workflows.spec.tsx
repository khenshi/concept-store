import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { useAuth } from '@/features/auth/model/auth-context';
import { ApiError } from '@/features/auth/api/auth-client';
import { useOrganizationWorkspaceContext } from '@/features/organizations/components/organization-workspace-context';
import { createBranch, updateBranch, getBranch } from '../api/branch-api';
import type { Branch } from '../model/branch.types';
import { BranchManagement } from './branch-management';
import { BranchDetail } from './branch-detail';
import { BranchForm } from './branch-form';
import { getInventoryHealthSummary } from '@/features/inventory/api/inventory-api';

vi.mock('@/features/auth/model/auth-context', () => ({ useAuth: vi.fn() }));
vi.mock(
  '@/features/organizations/components/organization-workspace-context',
  () => ({ useOrganizationWorkspaceContext: vi.fn() }),
);
vi.mock('../api/branch-api', () => ({
  createBranch: vi.fn(),
  updateBranch: vi.fn(),
  getBranch: vi.fn(),
}));
vi.mock('@/features/inventory/api/inventory-api', () => ({
  getInventoryHealthSummary: vi.fn(),
}));

const request = vi.fn();
const upsertBranch = vi.fn();
const loadBranches = vi.fn(async () => [branch]);
const refreshOrganization = vi.fn(async () => {});
const timestamp = '2026-09-12T00:00:00.000Z';
const branch: Branch = {
  id: 'branch-id',
  organizationId: 'org',
  name: 'Makati Main',
  code: 'MKT-01',
  addressLine1: '123 Retail Street',
  addressLine2: '2nd floor',
  city: 'Makati',
  province: 'Metro Manila',
  postalCode: '1200',
  countryCode: 'PH',
  createdAt: timestamp,
  updatedAt: timestamp,
};
const secondBranch: Branch = {
  ...branch,
  id: 'pasig-id',
  name: 'Pasig Branch',
  code: 'PAS-01',
  city: 'Pasig',
};
let workspace: ReturnType<typeof useOrganizationWorkspaceContext>;
const originalShow = Object.getOwnPropertyDescriptor(
  HTMLDialogElement.prototype,
  'showModal',
);
const originalClose = Object.getOwnPropertyDescriptor(
  HTMLDialogElement.prototype,
  'close',
);

function fill(form: HTMLElement) {
  const values = {
    'Branch name': ' Makati Main ',
    Code: 'mkt-01',
    'Address line 1': '123 Retail Street',
    City: 'Makati',
    'Province or region': 'Metro Manila',
    'Country code': 'ph',
  };
  for (const [label, value] of Object.entries(values))
    fireEvent.change(within(form).getByLabelText(new RegExp(`^${label}`)), {
      target: { value },
    });
}

it('places Add branch in the directory panel and omits the title eyebrow', () => {
  render(<BranchManagement organizationId="org" />);
  const panelHeader = screen
    .getByRole('heading', { name: 'Store locations' })
    .closest('header');
  expect(panelHeader).not.toBeNull();
  expect(
    within(panelHeader!).getByRole('button', { name: 'Add branch' }),
  ).toBeVisible();
  expect(screen.getByRole('heading', { name: 'Branches' })).toBeVisible();
  expect(screen.queryByText('North & Pine')).not.toBeInTheDocument();
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getInventoryHealthSummary).mockResolvedValue({
    inStock: 7,
    lowStock: 2,
    outOfStock: 1,
  });
  workspace = {
    organizationId: 'org',
    organization: {
      id: 'org',
      name: 'North & Pine',
      role: 'OWNER',
      createdAt: timestamp,
      updatedAt: timestamp,
    },
    organizationStatus: 'ready',
    organizationError: null,
    refreshOrganization,
    selectedBranchId: null,
    setSelectedBranchId: vi.fn(),
    branches: [branch, secondBranch],
    branchesStatus: 'ready',
    branchesError: null,
    loadBranches,
    upsertBranch,
  };
  vi.mocked(useOrganizationWorkspaceContext).mockImplementation(
    () => workspace,
  );
  vi.mocked(useAuth).mockReturnValue({ request } as unknown as ReturnType<
    typeof useAuth
  >);
  vi.mocked(getBranch).mockResolvedValue(branch);
  vi.mocked(createBranch).mockResolvedValue(branch);
  vi.mocked(updateBranch).mockResolvedValue(branch);
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
    configurable: true,
    value: function (this: HTMLDialogElement) {
      this.open = true;
    },
  });
  Object.defineProperty(HTMLDialogElement.prototype, 'close', {
    configurable: true,
    value: function (this: HTMLDialogElement) {
      this.open = false;
    },
  });
});

afterEach(() => {
  cleanup();
  if (originalShow)
    Object.defineProperty(
      HTMLDialogElement.prototype,
      'showModal',
      originalShow,
    );
  else Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal');
  if (originalClose)
    Object.defineProperty(HTMLDialogElement.prototype, 'close', originalClose);
  else Reflect.deleteProperty(HTMLDialogElement.prototype, 'close');
});

describe('BranchManagement', () => {
  it.each(['OWNER'] as const)(
    'keeps branch creation available to %s',
    (role) => {
      workspace.organization = { ...workspace.organization!, role };
      render(<BranchManagement organizationId="org" />);
      expect(
        screen.getByRole('button', { name: 'Add branch' }),
      ).toBeInTheDocument();
      const row = screen.getByRole('link', { name: /Makati Main/ });
      expect(row).toHaveAttribute(
        'href',
        '/app/organizations/org/branches/branch-id',
      );
      expect(row).toHaveClass('w-full', 'py-5', 'hover:bg-subtle');
    },
  );

  it.each(['MANAGER', 'CASHIER', 'MERCHANT'] as const)(
    'keeps %s read-only',
    (role) => {
      workspace.organization = { ...workspace.organization!, role };
      render(<BranchManagement organizationId="org" />);
      expect(
        screen.queryByRole('button', { name: 'Add branch' }),
      ).not.toBeInTheDocument();
      expect(
        screen.getByRole('link', { name: /Makati Main/ }),
      ).toBeInTheDocument();
    },
  );

  it('preserves debounced search and location filtering', async () => {
    render(<BranchManagement organizationId="org" />);
    fireEvent.change(screen.getByLabelText('Search'), {
      target: { value: 'PAS-01' },
    });
    await waitFor(() =>
      expect(
        screen.queryByRole('link', { name: /Makati Main/ }),
      ).not.toBeInTheDocument(),
    );
    expect(
      screen.getByRole('link', { name: /Pasig Branch/ }),
    ).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Search'), {
      target: { value: '' },
    });
    await screen.findByRole('link', { name: /Makati Main/ });
    fireEvent.click(screen.getByRole('combobox', { name: 'Location' }));
    fireEvent.click(
      screen.getByRole('option', { name: 'Pasig, Metro Manila' }),
    );
    expect(
      screen.queryByRole('link', { name: /Makati Main/ }),
    ).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Search'), {
      target: { value: 'No match' },
    });
    expect(
      await screen.findByText('No branches match these filters.'),
    ).toBeInTheDocument();
  });

  it('creates a branch through the modal, updates the workspace cache, and announces success', async () => {
    render(<BranchManagement organizationId="org" />);
    fireEvent.click(screen.getByRole('button', { name: 'Add branch' }));
    const form = within(
      screen.getByRole('dialog', { name: 'Add a branch' }),
    ).getByRole('form', { name: 'Add branch' });
    fill(form);
    fireEvent.submit(form);
    await waitFor(() =>
      expect(createBranch).toHaveBeenCalledWith(
        request,
        'org',
        expect.objectContaining({
          name: 'Makati Main',
          code: 'MKT-01',
          countryCode: 'PH',
        }),
      ),
    );
    expect(upsertBranch).toHaveBeenCalledWith(branch);
    expect(screen.getByRole('status')).toHaveTextContent(
      'Makati Main was added successfully.',
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('restores trigger focus and scrolling when creation is canceled', () => {
    render(<BranchManagement organizationId="org" />);
    const trigger = screen.getByRole('button', { name: 'Add branch' });
    trigger.focus();
    fireEvent.click(trigger);
    expect(screen.getByRole('heading', { name: 'Add a branch' })).toHaveFocus();
    expect(document.body.style.overflow).toBe('hidden');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(trigger).toHaveFocus();
    expect(document.body.style.overflow).not.toBe('hidden');
    expect(createBranch).not.toHaveBeenCalled();
  });

  it('distinguishes empty, loading, and failed branch lists with retry', () => {
    workspace.branches = [];
    const { rerender } = render(<BranchManagement organizationId="org" />);
    expect(screen.getByText('No branches yet')).toBeInTheDocument();
    workspace = { ...workspace, branchesStatus: 'idle' };
    rerender(<BranchManagement organizationId="org" />);
    expect(
      screen.getByRole('status', { name: 'Loading branches' }),
    ).toBeInTheDocument();
    expect(loadBranches).toHaveBeenCalledOnce();
    workspace = {
      ...workspace,
      branchesStatus: 'error',
      branchesError: 'Unavailable',
    };
    rerender(<BranchManagement organizationId="org" />);
    expect(screen.getByRole('alert')).toHaveTextContent('Unavailable');
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(loadBranches).toHaveBeenCalledWith({ refresh: true });
  });
});

describe('BranchForm', () => {
  it('dismisses on Escape/backdrop without treating modal padding as outside', () => {
    const onCancel = vi.fn();
    render(
      <BranchForm
        organizationId="org"
        branch={null}
        onSaved={vi.fn()}
        onCancel={onCancel}
      />,
    );
    const dialog = screen.getByRole('dialog');
    vi.spyOn(dialog, 'getBoundingClientRect').mockReturnValue({
      left: 50,
      right: 650,
      top: 50,
      bottom: 650,
      x: 50,
      y: 50,
      width: 600,
      height: 600,
      toJSON: () => ({}),
    });
    fireEvent.mouseDown(dialog, { clientX: 100, clientY: 100 });
    expect(onCancel).not.toHaveBeenCalled();
    fireEvent.mouseDown(dialog, { clientX: 10, clientY: 10 });
    expect(onCancel).toHaveBeenCalledOnce();
    fireEvent(dialog, new Event('cancel', { cancelable: true }));
    expect(onCancel).toHaveBeenCalledTimes(2);
  });
  it('preserves hint-before-input placement and focuses invalid fields', async () => {
    render(
      <BranchForm
        organizationId="org"
        branch={null}
        onSaved={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    const code = screen.getByLabelText(/^Code/);
    const hint = screen.getByText('Optional, for example MKT-01');
    expect(hint.nextElementSibling).toBe(code);
    expect(code).toHaveAccessibleDescription('Optional, for example MKT-01');
    fireEvent.submit(screen.getByRole('form', { name: 'Add branch' }));
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Review the highlighted fields',
    );
    await waitFor(() =>
      expect(screen.getByLabelText('Branch name')).toHaveFocus(),
    );
    expect(createBranch).not.toHaveBeenCalled();
  });

  it('keeps duplicate-code feedback actionable without losing entered data', async () => {
    vi.mocked(createBranch).mockRejectedValueOnce(
      new ApiError(409, 'Code is already in use.'),
    );
    render(
      <BranchForm
        organizationId="org"
        branch={null}
        onSaved={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    const form = screen.getByRole('form', { name: 'Add branch' });
    fill(form);
    fireEvent.submit(form);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Code is already in use.',
    );
    expect(screen.getByLabelText(/^Code/)).toHaveValue('mkt-01');
    expect(
      screen.getByRole('button', { name: 'Add branch' }),
    ).not.toBeDisabled();
  });

  it('prevents repeated writes and dismissal during submission', async () => {
    let finish!: (saved: Branch) => void;
    vi.mocked(createBranch).mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const onSaved = vi.fn();
    const onCancel = vi.fn();
    render(
      <BranchForm
        organizationId="org"
        branch={null}
        onSaved={onSaved}
        onCancel={onCancel}
      />,
    );
    const form = screen.getByRole('form', { name: 'Add branch' });
    fill(form);
    fireEvent.submit(form);
    expect(
      screen.getByRole('button', { name: 'Adding branch…' }),
    ).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    fireEvent.submit(form);
    fireEvent(
      screen.getByRole('dialog'),
      new Event('cancel', { cancelable: true }),
    );
    fireEvent.mouseDown(screen.getByRole('dialog'));
    expect(onCancel).not.toHaveBeenCalled();
    expect(createBranch).toHaveBeenCalledOnce();
    await act(async () => finish(branch));
    expect(onSaved).toHaveBeenCalledWith(branch);
  });
});

describe('BranchDetail', () => {
  it('preserves update normalization and null clearing, updates cache, and announces success', async () => {
    const saved = {
      ...branch,
      name: 'Makati Flagship',
      code: null,
      addressLine2: null,
      postalCode: null,
    };
    vi.mocked(updateBranch).mockResolvedValueOnce(saved);
    render(<BranchDetail organizationId="org" branchId="branch-id" />);
    await screen.findByRole('heading', { name: 'Makati Main' });
    expect(
      screen.getByRole('link', { name: 'Manage inventory' }),
    ).toHaveAttribute(
      'href',
      '/app/organizations/org/branches/branch-id/inventory',
    );
    const actionGrid = screen
      .getByRole('link', { name: 'Open POS cart' })
      .closest('.grid');
    expect(actionGrid).toHaveClass('xl:grid-cols-3');
    expect(actionGrid).toContainElement(
      screen.getByRole('link', { name: 'Open POS cart' }),
    );
    expect(screen.getByRole('link', { name: 'Low stock: 2' })).toHaveAttribute(
      'href',
      '/app/organizations/org/branches/branch-id/inventory?stockStatus=LOW_STOCK',
    );
    expect(
      screen.getByRole('link', { name: 'Out of stock: 1' }),
    ).toHaveAttribute(
      'href',
      '/app/organizations/org/branches/branch-id/inventory?stockStatus=OUT_OF_STOCK',
    );
    expect(actionGrid).toContainElement(
      screen.getByRole('link', { name: 'View sales history' }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Edit branch' }));
    const form = screen.getByRole('form', { name: 'Edit branch' });
    fireEvent.change(within(form).getByLabelText('Branch name'), {
      target: { value: 'Makati Flagship' },
    });
    for (const label of ['Code', 'Address line 2', 'Postal code'])
      fireEvent.change(within(form).getByLabelText(new RegExp(`^${label}`)), {
        target: { value: '' },
      });
    fireEvent.submit(form);
    await waitFor(() =>
      expect(updateBranch).toHaveBeenCalledWith(
        request,
        'org',
        'branch-id',
        expect.objectContaining({
          name: 'Makati Flagship',
          code: null,
          addressLine2: null,
          postalCode: null,
        }),
      ),
    );
    expect(upsertBranch).toHaveBeenCalledWith(saved);
    expect(screen.getByRole('status')).toHaveTextContent(
      'Makati Flagship was updated successfully.',
    );
    expect(
      screen.getByRole('heading', { name: 'Makati Flagship' }),
    ).toBeInTheDocument();
  });

  it.each(['CASHIER', 'MERCHANT'] as const)(
    'does not expose branch editing for %s',
    async (role) => {
      workspace.organization = { ...workspace.organization!, role };
      render(<BranchDetail organizationId="org" branchId="branch-id" />);
      await screen.findByRole('heading', { name: 'Makati Main' });
      expect(
        screen.queryByRole('button', { name: 'Edit branch' }),
      ).not.toBeInTheDocument();
      expect(getBranch).toHaveBeenCalledWith(request, 'org', 'branch-id', role);
      expect(
        screen.queryByRole('link', { name: 'Manage inventory' }),
      ).not.toBeInTheDocument();
      if (role === 'MERCHANT') {
        expect(screen.queryByText('Country')).not.toBeInTheDocument();
        expect(screen.queryByText('Address')).not.toBeInTheDocument();
        expect(
          screen.getByRole('link', { name: 'View own inventory' }),
        ).toHaveAttribute(
          'href',
          '/app/organizations/org/branches/branch-id/inventory',
        );
        expect(screen.getByLabelText('Your inventory health')).toBeVisible();
        expect(
          screen.getByText(
            'Counts include only your merchant’s placements in this branch.',
          ),
        ).toBeVisible();
      } else {
        expect(getInventoryHealthSummary).not.toHaveBeenCalled();
      }
    },
  );

  it('preserves scoped retrieval, unavailable feedback, and retry', async () => {
    vi.mocked(getBranch).mockRejectedValueOnce(new Error('Unavailable'));
    render(<BranchDetail organizationId="org" branchId="branch-id" />);
    expect(
      screen.getByRole('status', { name: 'Loading branch details' }),
    ).toBeInTheDocument();
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The branch details could not be loaded.',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(
      await screen.findByRole('heading', { name: 'Makati Main' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Back to branches' }),
    ).toHaveAttribute('href', '/app/organizations/org/branches');
  });

  it('keeps inventory-summary failure local and retries it', async () => {
    vi.mocked(getInventoryHealthSummary)
      .mockRejectedValueOnce(new Error('Unavailable'))
      .mockResolvedValueOnce({ inStock: 0, lowStock: 0, outOfStock: 0 });
    render(<BranchDetail organizationId="org" branchId="branch-id" />);
    await screen.findByRole('heading', { name: 'Makati Main' });
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Inventory health could not be loaded.',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(
      await screen.findByRole('link', { name: 'Low stock: 0' }),
    ).toBeVisible();
    expect(getInventoryHealthSummary).toHaveBeenCalledTimes(2);
  });

  it('does not restore an obsolete summary after inventory access is lost', async () => {
    let resolveSummary!: (value: {
      inStock: number;
      lowStock: number;
      outOfStock: number;
    }) => void;
    vi.mocked(getInventoryHealthSummary).mockReturnValueOnce(
      new Promise((resolve) => {
        resolveSummary = resolve;
      }),
    );
    const view = render(
      <BranchDetail organizationId="org" branchId="branch-id" />,
    );
    await screen.findByRole('heading', { name: 'Makati Main' });
    workspace.organization = { ...workspace.organization!, role: 'CASHIER' };
    view.rerender(<BranchDetail organizationId="org" branchId="branch-id" />);
    await screen.findByRole('heading', { name: 'Makati Main' });
    await act(async () =>
      resolveSummary({ inStock: 7, lowStock: 2, outOfStock: 1 }),
    );
    expect(
      screen.queryByLabelText('Branch inventory health'),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'Low stock: 2' }),
    ).not.toBeInTheDocument();
  });
});
