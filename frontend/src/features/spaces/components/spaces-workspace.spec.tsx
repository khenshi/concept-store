import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { useAuth } from '@/features/auth/model/auth-context';
import { useOrganizationWorkspaceContext } from '@/features/organizations/components/organization-workspace-context';
import { listBranches } from '@/features/branches/api/branch-api';
import { listSpaceTypes, createSpaceType } from '../api/space-api';
import { org, space } from '../model/space.test-fixtures';
import { SpacesWorkspace } from './spaces-workspace';
const { push, manage } = vi.hoisted(() => ({ push: vi.fn(), manage: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
vi.mock('@/features/auth/model/auth-context', () => ({ useAuth: vi.fn() }));
vi.mock(
  '@/features/organizations/components/organization-workspace-context',
  () => ({ useOrganizationWorkspaceContext: vi.fn() }),
);
vi.mock('@/features/branches/api/branch-api', () => ({
  listBranches: vi.fn(),
}));
vi.mock('../api/space-api', () => ({
  listSpaceTypes: vi.fn(),
  createSpaceType: vi.fn(),
}));
vi.mock('./space-management', () => ({
  SpaceManagement: (props: unknown) => {
    manage(props);
    return <p>Space rows</p>;
  },
}));
const remember = vi.fn();
const main = { id: 'main', name: 'Main', code: null };
function context(role = 'OWNER', selectedBranchId: string | null = null) {
  vi.mocked(useOrganizationWorkspaceContext).mockReturnValue({
    organization: { id: 'org', role },
    selectedBranchId,
    setSelectedBranchId: remember,
  } as never);
}
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(useAuth).mockReturnValue({
    request: vi.fn(),
    user: { id: 'user' },
  } as never);
  vi.mocked(listBranches).mockResolvedValue([main] as never);
  vi.mocked(listSpaceTypes).mockResolvedValue([
    { id: space.id, organizationId: org, name: 'Shelf' },
  ]);
  context();
});
it('denies cashiers before making branch or spaces requests', () => {
  context('CASHIER');
  render(<SpacesWorkspace organizationId="org" branchId="main" />);
  expect(screen.getByRole('alert')).toHaveTextContent('cannot view');
  expect(listBranches).not.toHaveBeenCalled();
  expect(manage).not.toHaveBeenCalled();
});
it('waits for branch access and gives the URL precedence over remembered selection', async () => {
  context('OWNER', 'other');
  let resolve!: (value: never) => void;
  vi.mocked(listBranches).mockReturnValue(
    new Promise((done) => {
      resolve = done;
    }),
  );
  render(<SpacesWorkspace organizationId="org" branchId="main" />);
  expect(manage).not.toHaveBeenCalled();
  await act(async () => resolve([main] as never));
  expect(await screen.findByText('Space rows')).toBeInTheDocument();
  expect(remember).toHaveBeenCalledWith('main');
  expect(push).not.toHaveBeenCalled();
});
it('does not request spaces for inaccessible branches and allows another choice', async () => {
  render(<SpacesWorkspace organizationId="org" branchId="foreign" />);
  expect(await screen.findByRole('alert')).toHaveTextContent('unavailable');
  expect(manage).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('combobox', { name: 'Spaces branch' }));
  fireEvent.click(screen.getByRole('option', { name: 'Main' }));
  expect(push).toHaveBeenCalledWith(
    '/app/organizations/org/branches/main/spaces',
  );
});
it('resumes only an accessible remembered branch', async () => {
  context('OWNER', 'main');
  render(<SpacesWorkspace organizationId="org" />);
  await waitFor(() =>
    expect(push).toHaveBeenCalledWith(
      '/app/organizations/org/branches/main/spaces',
    ),
  );
});
it('explains unavailable remembered branches without arbitrary navigation', async () => {
  context('MERCHANT', 'foreign');
  render(<SpacesWorkspace organizationId="org" />);
  expect(
    await screen.findByText(/selected branch is unavailable/),
  ).toBeInTheDocument();
  expect(screen.getByText(/View only your own/)).toBeInTheDocument();
  expect(push).not.toHaveBeenCalled();
});
it('retries failed branch reads', async () => {
  vi.mocked(listBranches).mockRejectedValueOnce(new Error('Offline'));
  render(<SpacesWorkspace organizationId="org" branchId="main" />);
  expect(
    await screen.findByText('Accessible spaces branches could not be loaded.'),
  ).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /Try again/ }));
  expect(await screen.findByText('Space rows')).toBeInTheDocument();
});

it('opens organization Types without a branch and preserves dirty drafts when tab changes are cancelled', async () => {
  render(<SpacesWorkspace organizationId="org" />);
  fireEvent.click(screen.getByRole('tab', { name: 'Types' }));
  expect(await screen.findByText('Shelf')).toBeInTheDocument();
  expect(
    screen.queryByRole('combobox', { name: 'Spaces branch' }),
  ).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('New type name'), {
    target: { value: 'Unsaved' },
  });
  const confirmation = vi.spyOn(window, 'confirm').mockReturnValue(false);
  fireEvent.click(screen.getByRole('tab', { name: 'Spaces' }));
  expect(screen.getByRole('tab', { name: 'Types' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  expect(screen.getByLabelText('New type name')).toHaveValue('Unsaved');
  confirmation.mockReturnValue(true);
  fireEvent.click(screen.getByRole('tab', { name: 'Spaces' }));
  expect(screen.getByRole('tab', { name: 'Spaces' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  confirmation.mockRestore();
});
it('lets owners add organization types and shows managers a read-only catalog', async () => {
  const view = render(<SpacesWorkspace organizationId="org" />);
  fireEvent.click(screen.getByRole('tab', { name: 'Types' }));
  await screen.findByText('Shelf');
  vi.mocked(createSpaceType).mockResolvedValue({
    id: space.id,
    organizationId: org,
    name: 'Display',
  });
  vi.mocked(listSpaceTypes).mockResolvedValue([
    { id: space.id, organizationId: org, name: 'Display' },
  ]);
  fireEvent.change(screen.getByLabelText('New type name'), {
    target: { value: ' Display ' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Save type' }));
  expect(await screen.findByText('Display added.')).toBeInTheDocument();
  expect(createSpaceType).toHaveBeenCalledWith(
    expect.any(Function),
    'org',
    'Display',
  );
  view.unmount();
  context('MANAGER');
  render(<SpacesWorkspace organizationId="org" />);
  fireEvent.click(screen.getByRole('tab', { name: 'Types' }));
  expect(await screen.findByText('Display')).toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: 'Save type' }),
  ).not.toBeInTheDocument();
});
it('keeps merchant space access without revealing the organization Types tab', () => {
  context('MERCHANT');
  render(<SpacesWorkspace organizationId="org" />);
  expect(screen.queryByRole('tab', { name: 'Types' })).not.toBeInTheDocument();
  expect(listSpaceTypes).not.toHaveBeenCalled();
});

it('moves keyboard focus and selection together between tabs', async () => {
  render(<SpacesWorkspace organizationId="org" />);
  const spaces = screen.getByRole('tab', { name: 'Spaces' });
  spaces.focus();
  fireEvent.keyDown(spaces, { key: 'ArrowRight' });
  const types = screen.getByRole('tab', { name: 'Types' });
  expect(types).toHaveAttribute('aria-selected', 'true');
  expect(types).toHaveFocus();
  await screen.findByText('Shelf');
  fireEvent.keyDown(types, { key: 'Home' });
  expect(spaces).toHaveAttribute('aria-selected', 'true');
  expect(spaces).toHaveFocus();
});
