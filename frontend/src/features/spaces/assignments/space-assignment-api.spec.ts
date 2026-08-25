import type { AuthenticatedRequest } from '@/features/organizations/organization.types';
import {
  createSpaceAssignment,
  endSpaceAssignment,
  listSpaceAssignments,
} from './space-assignment-api';

describe('space assignment API', () => {
  const request = vi.fn() as unknown as AuthenticatedRequest;

  beforeEach(() => vi.clearAllMocks());

  it('lists assignment history through the scoped path', async () => {
    vi.mocked(request).mockResolvedValue([]);
    await listSpaceAssignments(request, 'organization/id', 'space/id');
    expect(request).toHaveBeenCalledWith(
      '/organizations/organization%2Fid/spaces/space%2Fid/assignments',
    );
  });

  it('creates a current assignment', async () => {
    vi.mocked(request).mockResolvedValue({});
    const input = {
      merchantId: '62e6c0c0-a55f-4d8e-bf42-f90c78fd28e5',
      startDate: '2026-08-25',
    };
    await createSpaceAssignment(request, 'organization-id', 'space-id', input);
    expect(request).toHaveBeenCalledWith(
      '/organizations/organization-id/spaces/space-id/assignments',
      expect.objectContaining({ method: 'POST', body: JSON.stringify(input) }),
    );
  });

  it('ends an assignment through its scoped path', async () => {
    vi.mocked(request).mockResolvedValue({});
    const input = { endDate: '2026-09-30' };
    await endSpaceAssignment(
      request,
      'organization-id',
      'assignment/id',
      input,
    );
    expect(request).toHaveBeenCalledWith(
      '/organizations/organization-id/space-assignments/assignment%2Fid/end',
      expect.objectContaining({ method: 'PATCH', body: JSON.stringify(input) }),
    );
  });
});
