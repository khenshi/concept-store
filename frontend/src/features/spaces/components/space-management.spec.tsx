import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { useAuth } from '@/features/auth/model/auth-context';
import { useOrganizationWorkspaceContext } from '@/features/organizations/components/organization-workspace-context';
import { useConfirmationDialog } from '@/shared/components/ui/confirmation-dialog';
import { listAssociations } from '@/features/merchant-branches/api/merchant-branch-api';
import {
  assignSpace,
  listOccupancies,
  listSpaces,
  listSpaceTypes,
  createSpaceType,
  releaseSpace,
  saveSpace,
  setSpaceStatus,
} from '../api/space-api';
import {
  branch,
  merchant,
  occupancy,
  org,
  page,
  space,
  timestamp,
} from '../model/space.test-fixtures';
import { SpaceManagement } from './space-management';
import { SpaceForm } from './space-forms';
vi.mock('@/features/auth/model/auth-context', () => ({ useAuth: vi.fn() }));
vi.mock(
  '@/features/organizations/components/organization-workspace-context',
  () => ({ useOrganizationWorkspaceContext: vi.fn() }),
);
vi.mock('@/shared/components/ui/confirmation-dialog', () => ({
  useConfirmationDialog: vi.fn(),
}));
vi.mock('@/features/merchant-branches/api/merchant-branch-api', () => ({
  listAssociations: vi.fn(),
}));
vi.mock('../api/space-api', () => ({
  assignSpace: vi.fn(),
  listOccupancies: vi.fn(),
  listSpaces: vi.fn(),
  listSpaceTypes: vi.fn(),
  createSpaceType: vi.fn(),
  releaseSpace: vi.fn(),
  saveSpace: vi.fn(),
  setSpaceStatus: vi.fn(),
}));
const request = vi.fn(),
  confirm = vi.fn();
let organization: { id: string; role: string };
const setup = (role = 'OWNER', kind: 'branch' | 'merchant' = 'branch') => {
  organization = { id: org, role };
  vi.mocked(useOrganizationWorkspaceContext).mockReturnValue({
    organization,
  } as never);
  return render(
    <SpaceManagement
      organizationId={org}
      kind={kind}
      id={kind === 'branch' ? branch : merchant}
    />,
  );
};
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(useAuth).mockReturnValue({
    request,
    user: { id: merchant },
  } as never);
  vi.mocked(useConfirmationDialog).mockReturnValue({
    confirm,
    confirmationDialog: null,
  });
  confirm.mockResolvedValue(true);
  vi.mocked(listSpaceTypes).mockResolvedValue([
    { id: space.id, organizationId: org, name: 'Shelf' },
    { id: merchant, organizationId: org, name: 'Rack' },
  ]);
  vi.mocked(listSpaces).mockResolvedValue(page([space]));
  vi.mocked(listOccupancies).mockResolvedValue(page([occupancy]));
  vi.mocked(saveSpace).mockResolvedValue(space);
  vi.mocked(assignSpace).mockResolvedValue(occupancy);
  vi.mocked(releaseSpace).mockResolvedValue({
    ...occupancy,
    endedAt: '2026-01-02T00:00:00Z',
    releaseReason: 'MANUAL',
  });
  vi.mocked(setSpaceStatus).mockResolvedValue({ ...space, status: 'ARCHIVED' });
  vi.mocked(listAssociations).mockResolvedValue(
    page([
      {
        id: occupancy.id,
        organizationId: org,
        branchId: branch,
        merchantId: merchant,
        status: 'ACTIVE',
        createdAt: timestamp,
        updatedAt: timestamp,
        merchant: { ...occupancy.merchant, status: 'ACTIVE' },
        branch: occupancy.branch,
      },
    ]),
  );
});
describe('Space management', () => {
  it('reports edit state only when values change, not space object identity', async () => {
    vi.mocked(useAuth).mockReturnValue({ request } as never);
    const onStateChange = vi.fn();
    const onClose = vi.fn();
    const onSaved = vi.fn();
    const view = render(
      <SpaceForm
        organizationId={org}
        branchId={branch}
        space={{ ...space }}
        onStateChange={onStateChange}
        onClose={onClose}
        onSaved={onSaved}
      />,
    );
    await waitFor(() =>
      expect(onStateChange).toHaveBeenCalledWith({
        dirty: false,
        pending: false,
      }),
    );
    onStateChange.mockClear();
    view.rerender(
      <SpaceForm
        organizationId={org}
        branchId={branch}
        space={{ ...space }}
        onStateChange={onStateChange}
        onClose={onClose}
        onSaved={onSaved}
      />,
    );
    expect(onStateChange).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('Space name'), {
      target: { value: 'Updated space' },
    });
    expect(onStateChange).toHaveBeenLastCalledWith({
      dirty: true,
      pending: false,
    });
  });
  it('creates a named space and reloads the branch catalog', async () => {
    setup();
    await screen.findByText('Rack A1');
    fireEvent.click(screen.getByRole('button', { name: 'Add space' }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByLabelText('Space name')).not.toHaveFocus();
    expect(
      within(dialog).getByRole('heading', { name: 'Create a space' }),
    ).toHaveFocus();
    fireEvent.blur(within(dialog).getByLabelText('Space name'));
    expect(within(dialog).getByText('Enter a space name.')).toBeInTheDocument();
    fireEvent.change(within(dialog).getByLabelText('Space name'), {
      target: { value: 'Shelf B2' },
    });
    expect(
      within(dialog).queryByText('Enter a space name.'),
    ).not.toBeInTheDocument();
    await waitFor(() =>
      expect(
        within(dialog).getByRole('combobox', { name: 'Space type' }),
      ).toBeEnabled(),
    );
    fireEvent.click(
      within(dialog).getByRole('combobox', { name: 'Space type' }),
    );
    fireEvent.click(within(dialog).getByRole('option', { name: 'Shelf' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add space' }));
    await screen.findByText('Space saved.');
    expect(saveSpace).toHaveBeenCalledWith(
      request,
      org,
      branch,
      { name: 'Shelf B2', type: 'Shelf' },
      undefined,
    );
  });
  it('shows a row skeleton while spaces are loading', () => {
    vi.mocked(listSpaces).mockReturnValueOnce(new Promise(() => undefined));
    setup();
    expect(
      screen.getByRole('status', { name: 'Loading spaces' }),
    ).toBeInTheDocument();
  });
  it('defaults to active spaces and exposes focused row actions', async () => {
    setup();
    await screen.findByText('Rack A1');
    expect(listSpaces).toHaveBeenLastCalledWith(
      request,
      org,
      branch,
      expect.objectContaining({ page: 1, status: 'ACTIVE' }),
    );
    expect(screen.getByText('Status')).toBeInTheDocument();
    const spaces = screen.getByRole('list', { name: 'Branch spaces' });
    expect(within(spaces).getByText('Rack A1').closest('li')).toHaveClass(
      'text-sm',
    );
    expect(within(spaces).getByText('Active')).toHaveClass(
      'text-sm',
      'font-normal',
      'text-success-ink',
    );
    expect(within(spaces).getByText('Vacant')).toHaveClass(
      'text-sm',
      'font-normal',
      'text-success-ink',
    );
    expect(screen.getByRole('button', { name: 'Assign' })).toBeInTheDocument();
    const archive = screen.getByRole('button', { name: 'Archive' });
    expect(archive).toHaveClass('text-danger');
    expect(screen.getByRole('link', { name: 'View' })).toHaveAttribute(
      'href',
      `/app/organizations/${org}/branches/${branch}/spaces/${space.id}`,
    );
  });
  it('cancels adding a space without a browser confirmation', async () => {
    setup();
    await screen.findByText('Rack A1');
    fireEvent.click(screen.getByRole('button', { name: 'Add space' }));
    const dialog = screen.getByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Space name'), {
      target: { value: 'Unfinished space' },
    });
    const confirmation = vi.spyOn(window, 'confirm').mockReturnValue(false);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(confirmation).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );
    confirmation.mockRestore();
  });
  it('assigns an affiliated merchant and preserves action-time defaults', async () => {
    setup();
    await screen.findByText('Rack A1');
    fireEvent.click(screen.getByRole('button', { name: 'Assign' }));
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveClass('max-w-2xl');
    expect(within(dialog).queryByLabelText('Start date and time')).toBeNull();
    expect(within(dialog).getByLabelText('Start date')).toHaveAttribute(
      'type',
      'date',
    );
    await waitFor(() =>
      expect(within(dialog).getByLabelText('Merchant')).toBeEnabled(),
    );
    fireEvent.click(within(dialog).getByRole('combobox', { name: 'Merchant' }));
    fireEvent.click(within(dialog).getByRole('option', { name: 'Amihan' }));
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Assign space' }),
    );
    await screen.findByText('Occupancy saved.');
    expect(assignSpace).toHaveBeenCalledWith(request, org, branch, space.id, {
      merchantId: merchant,
    });
  });
  it('uses an accessible switch for completed past occupancy', async () => {
    setup();
    await screen.findByText('Rack A1');
    fireEvent.click(screen.getByRole('button', { name: 'Assign' }));
    const dialog = screen.getByRole('dialog');
    const toggle = within(dialog).getByRole('switch', {
      name: 'Record a completed past occupancy',
    });
    expect(toggle).toHaveAttribute('aria-checked', 'false');
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-checked', 'true');
    expect(dialog.querySelectorAll('input[type="date"]')).toHaveLength(2);
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-checked', 'false');
    expect(dialog.querySelectorAll('input[type="date"]')).toHaveLength(1);
  });
  it('releases from the merchant profile and loads past occupancy with its reason', async () => {
    setup('OWNER', 'merchant');
    await screen.findByText('Rack A1');
    fireEvent.click(screen.getByRole('button', { name: 'Release space' }));
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveClass('max-w-2xl');
    expect(dialog.querySelector('input[type="date"]')).not.toBeNull();
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Release space' }),
    );
    await screen.findByText('Space released.');
    expect(releaseSpace).toHaveBeenCalledWith(
      request,
      org,
      occupancy,
      undefined,
    );
    vi.mocked(listOccupancies).mockResolvedValue(
      page([
        {
          ...occupancy,
          endedAt: '2026-01-02T00:00:00Z',
          releaseReason: 'MERCHANT_ENDED',
        },
      ]),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Past occupancy' }));
    await screen.findByText('Merchant ended');
    expect(listOccupancies).toHaveBeenLastCalledWith(
      request,
      org,
      { kind: 'merchant', id: merchant },
      { page: 1, view: 'HISTORY' },
    );
  });
  it.each(['MANAGER', 'MERCHANT'])('keeps %s views read-only', async (role) => {
    setup(role);
    await screen.findByText('Rack A1');
    for (const name of [
      'Add space',
      'Edit space',
      'Assign',
      'Archive',
      'Release space',
    ])
      expect(screen.queryByRole('button', { name })).not.toBeInTheDocument();
    const viewLink = screen.getByRole('link', { name: 'View' });
    expect(viewLink).toHaveAttribute(
      'href',
      `/app/organizations/${org}/branches/${branch}/spaces/${space.id}`,
    );
  });
  it('does not request space data for cashiers', () => {
    setup('CASHIER');
    expect(listSpaces).not.toHaveBeenCalled();
    expect(
      screen.queryByRole('region', { name: 'Space occupancy' }),
    ).not.toBeInTheDocument();
  });
  it('blocks archiving occupied spaces and confirms free-space archiving', async () => {
    vi.mocked(listSpaces).mockResolvedValue(
      page([{ ...space, currentOccupancy: occupancy }]),
    );
    const view = setup();
    expect(
      await screen.findByRole('button', { name: 'Archive' }),
    ).toBeDisabled();
    expect(
      within(screen.getByRole('list', { name: 'Branch spaces' })).getByText(
        'Occupied',
      ),
    ).toHaveClass('text-sm', 'font-normal', 'text-success-ink');
    view.unmount();
    vi.mocked(listSpaces).mockResolvedValue(page([space]));
    setup();
    fireEvent.click(await screen.findByRole('button', { name: 'Archive' }));
    await screen.findByText('Space archived.');
    expect(confirm).toHaveBeenCalled();
    expect(setSpaceStatus).toHaveBeenCalledWith(
      request,
      org,
      branch,
      space.id,
      'ARCHIVED',
    );
  });
  it('recovers failed reads and ignores a response after a scope change', async () => {
    vi.mocked(listSpaces).mockRejectedValueOnce(new Error('Read failed'));
    const view = setup();
    await screen.findByText('Read failed');
    fireEvent.click(screen.getByRole('button', { name: 'Retry spaces' }));
    await screen.findByText('Rack A1');
    let resolve!: (value: ReturnType<typeof page<typeof space>>) => void;
    vi.mocked(listSpaces).mockReturnValueOnce(
      new Promise((r) => {
        resolve = r;
      }),
    );
    fireEvent.change(screen.getByLabelText('Search spaces'), {
      target: { value: 'x' },
    });
    await waitFor(() => expect(listSpaces).toHaveBeenCalledTimes(3));
    view.unmount();
    await act(async () => resolve(page([space])));
    expect(saveSpace).not.toHaveBeenCalled();
  });
  it('shows assignment conflicts in the dialog and permits retry', async () => {
    vi.mocked(assignSpace).mockRejectedValueOnce(
      new Error('Space is occupied'),
    );
    setup();
    fireEvent.click(await screen.findByRole('button', { name: 'Assign' }));
    const dialog = screen.getByRole('dialog');
    await waitFor(() =>
      expect(within(dialog).getByLabelText('Merchant')).toBeEnabled(),
    );
    fireEvent.click(within(dialog).getByRole('combobox', { name: 'Merchant' }));
    fireEvent.click(within(dialog).getByRole('option', { name: 'Amihan' }));
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Assign space' }),
    );
    await within(dialog).findByText('Space is occupied');
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Assign space' }),
    );
    await screen.findByText('Occupancy saved.');
  });
});

it('filters occupancy on the server and hides the filter for merchants', async () => {
  const view = setup();
  await screen.findByText(space.name);
  fireEvent.click(screen.getByRole('combobox', { name: 'Occupancy' }));
  fireEvent.click(screen.getByRole('option', { name: 'Vacant' }));
  await waitFor(() =>
    expect(listSpaces).toHaveBeenLastCalledWith(
      request,
      org,
      branch,
      expect.objectContaining({ page: 1, occupancy: 'VACANT' }),
    ),
  );
  view.unmount();
  setup('MERCHANT');
  await screen.findByText(space.name);
  expect(
    screen.queryByRole('combobox', { name: 'Occupancy' }),
  ).not.toBeInTheDocument();
});

it('keeps dirty space drafts when branch navigation is cancelled and blocks pending saves', async () => {
  organization = { id: org, role: 'OWNER' };
  vi.mocked(useOrganizationWorkspaceContext).mockReturnValue({
    organization,
  } as never);
  let guard: () => boolean = () => true;
  const register = (next: () => boolean) => {
    guard = next;
  };
  const blocked = vi.fn();
  const view = render(
    <SpaceManagement
      organizationId={org}
      kind="branch"
      id={branch}
      onNavigationGuard={register}
      onInteractionChange={blocked}
    />,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Add space' }));
  fireEvent.change(screen.getByLabelText('Space name'), {
    target: { value: 'Unsaved rack' },
  });
  await waitFor(() =>
    expect(screen.getByRole('combobox', { name: 'Space type' })).toBeEnabled(),
  );
  fireEvent.click(screen.getByRole('combobox', { name: 'Space type' }));
  fireEvent.click(screen.getByRole('option', { name: 'Rack' }));
  const confirmation = vi.spyOn(window, 'confirm').mockReturnValue(false);
  expect(guard()).toBe(false);
  expect(screen.getByLabelText('Space name')).toHaveValue('Unsaved rack');
  confirmation.mockReturnValue(true);
  expect(guard()).toBe(true);
  let finish!: (value: typeof space) => void;
  vi.mocked(saveSpace).mockReturnValue(
    new Promise((resolve) => {
      finish = resolve;
    }),
  );
  fireEvent.click(
    within(screen.getByRole('dialog')).getByRole('button', {
      name: 'Add space',
    }),
  );
  await waitFor(() => expect(blocked).toHaveBeenLastCalledWith(true));
  expect(guard()).toBe(false);
  await act(async () => finish(space));
  await waitFor(() => expect(blocked).toHaveBeenLastCalledWith(false));
  confirmation.mockRestore();
  view.unmount();
});

it('creates a missing type inline, preserves the space draft, and selects the new choice', async () => {
  setup();
  await screen.findByText(space.name);
  fireEvent.click(screen.getByRole('button', { name: 'Add space' }));
  await waitFor(() =>
    expect(screen.getByRole('combobox', { name: 'Space type' })).toBeEnabled(),
  );
  fireEvent.change(screen.getByLabelText('Space name'), {
    target: { value: 'Display A' },
  });
  expect(
    screen.getByLabelText('Space name').parentElement?.parentElement,
  ).toHaveClass('md:col-span-2');
  expect(
    screen.getByRole('button', { name: 'Create a new type' }).parentElement,
  ).toHaveClass('md:grid-cols-[minmax(0,1fr)_auto]');
  fireEvent.click(screen.getByRole('button', { name: 'Create a new type' }));
  expect(
    screen.queryByRole('combobox', { name: 'Space type' }),
  ).not.toBeInTheDocument();
  expect(screen.getByLabelText('New type name')).toBeInTheDocument();
  expect(
    screen.getByRole('button', { name: 'Discard' }).parentElement,
  ).toHaveClass('md:grid-cols-[minmax(0,1fr)_auto_auto]');
  expect(
    screen.getByText('Available across all branches in this organization.'),
  ).toBeInTheDocument();
  fireEvent.blur(screen.getByLabelText('New type name'));
  expect(screen.getByText('Enter a type name.')).toBeInTheDocument();
  const created = { id: merchant, organizationId: org, name: 'Display' };
  vi.mocked(createSpaceType).mockImplementation(async () => {
    vi.mocked(listSpaceTypes).mockResolvedValue([created]);
    return created;
  });
  fireEvent.change(screen.getByLabelText('New type name'), {
    target: { value: ' Display ' },
  });
  expect(screen.queryByText('Enter a type name.')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Save type' }));
  await waitFor(() =>
    expect(
      screen.getByRole('combobox', { name: 'Space type' }),
    ).toHaveTextContent('Display'),
  );
  expect(screen.getByLabelText('Space name')).toHaveValue('Display A');
  fireEvent.click(
    within(screen.getByRole('dialog')).getByRole('button', {
      name: 'Add space',
    }),
  );
  await waitFor(() =>
    expect(saveSpace).toHaveBeenCalledWith(
      request,
      org,
      branch,
      { name: 'Display A', type: 'Display' },
      undefined,
    ),
  );
});
it('preserves inline type input after a conflict and prevents duplicate type submission', async () => {
  setup();
  await screen.findByText(space.name);
  fireEvent.click(screen.getByRole('button', { name: 'Add space' }));
  fireEvent.click(screen.getByRole('button', { name: 'Create a new type' }));
  fireEvent.change(screen.getByLabelText('New type name'), {
    target: { value: 'Rack' },
  });
  let reject!: (cause: Error) => void;
  vi.mocked(createSpaceType).mockReturnValue(
    new Promise((_, fail) => {
      reject = fail;
    }),
  );
  const save = screen.getByRole('button', { name: 'Save type' });
  fireEvent.click(save);
  fireEvent.click(save);
  expect(createSpaceType).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('button', { name: 'Discard' })).toBeDisabled();
  await act(async () => reject(new Error('This type already exists.')));
  expect(
    await screen.findByText('This type already exists.'),
  ).toBeInTheDocument();
  expect(screen.getByLabelText('New type name')).toHaveValue('Rack');
  expect(screen.getByRole('button', { name: 'Save type' })).toBeEnabled();
});
