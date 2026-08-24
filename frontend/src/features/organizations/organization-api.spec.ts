import {
  createOrganization,
  getOrganization,
  listOrganizations,
} from './organization-api';
import type { AuthenticatedRequest } from './organization.types';

describe('organization API', () => {
  const request = vi.fn() as unknown as AuthenticatedRequest;

  beforeEach(() => vi.clearAllMocks());

  it('lists organizations through the authenticated request client', async () => {
    vi.mocked(request).mockResolvedValue([]);

    await listOrganizations(request);

    expect(request).toHaveBeenCalledWith('/organizations');
  });

  it('creates an organization with JSON content', async () => {
    vi.mocked(request).mockResolvedValue({});

    await createOrganization(request, 'Concept Collective');

    expect(request).toHaveBeenCalledWith('/organizations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Concept Collective' }),
    });
  });

  it('encodes an organization identifier in the detail path', async () => {
    vi.mocked(request).mockResolvedValue({});

    await getOrganization(request, 'organization/id');

    expect(request).toHaveBeenCalledWith('/organizations/organization%2Fid');
  });
});
