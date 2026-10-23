import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { SpaceDetail } from './space-detail';
import { listOccupancies } from '../api/space-api';
import { space, occupancy, org, branch } from '../model/space.test-fixtures';

vi.mock(
  '@/features/organizations/components/organization-workspace-context',
  () => ({
    useOrganizationWorkspaceContext: () => ({
      organization: { role: 'OWNER' },
      organizationStatus: 'ready',
      setSelectedBranchId: vi.fn(),
    }),
  }),
);
vi.mock('./spaces-branch-selector', () => ({
  SpacesBranchSelector: () => null,
}));
vi.mock('../api/space-api', () => ({
  getSpace: vi.fn(),
  listOccupancies: vi.fn(),
  setSpaceStatus: vi.fn(),
}));

import { getSpace } from '../api/space-api';
const request = vi.fn();
vi.mock('@/features/auth/model/auth-context', () => ({
  useAuth: () => ({ request }),
}));

it('shows a history skeleton while searching, with custom calendar filters', async () => {
  vi.mocked(getSpace).mockResolvedValue(space);
  vi.mocked(listOccupancies).mockResolvedValue({
    items: [occupancy],
    total: 1,
    page: 1,
    limit: 15,
    totalPages: 1,
    hasNext: false,
  });
  render(
    <SpaceDetail organizationId={org} branchId={branch} spaceId={space.id} />,
  );
  const search = await screen.findByRole('textbox', {
    name: 'Search merchant',
  });
  expect(
    screen.getByRole('button', { name: 'Occupancy date filter' }),
  ).toBeInTheDocument();
  fireEvent.change(search, { target: { value: 'Amihan' } });
  expect(
    screen.getByRole('status', { name: 'Loading occupancy history' }),
  ).toBeInTheDocument();
  await waitFor(() =>
    expect(listOccupancies).toHaveBeenCalledWith(
      request,
      org,
      { kind: 'space', id: space.id, branchId: branch },
      expect.objectContaining({ view: 'HISTORY', q: 'Amihan' }),
    ),
  );
  await waitFor(() =>
    expect(
      screen.queryByRole('status', { name: 'Loading occupancy history' }),
    ).not.toBeInTheDocument(),
  );
});
