import type { AuthenticatedRequest } from '@/features/organizations/organization.types';
import {
  acceptOrganizationInvitation,
  createOrganizationInvitation,
  listOrganizationInvitations,
  previewOrganizationInvitation,
  revokeOrganizationInvitation,
} from './organization-invitation-api';

describe('organization invitation API', () => {
  const request = vi.fn() as unknown as AuthenticatedRequest;

  beforeEach(() => vi.clearAllMocks());

  it('creates and lists invitations through the organization-scoped path', async () => {
    vi.mocked(request).mockResolvedValue({});
    const input = { email: 'manager@example.com', role: 'MANAGER' as const };

    await createOrganizationInvitation(request, 'organization/id', input);
    await listOrganizationInvitations(request, 'organization/id');

    expect(request).toHaveBeenNthCalledWith(
      1,
      '/organizations/organization%2Fid/invitations',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      },
    );
    expect(request).toHaveBeenNthCalledWith(
      2,
      '/organizations/organization%2Fid/invitations',
    );
  });

  it('revokes an invitation through both scoped identifiers', async () => {
    vi.mocked(request).mockResolvedValue({});

    await revokeOrganizationInvitation(
      request,
      'organization/id',
      'invitation/id',
    );

    expect(request).toHaveBeenCalledWith(
      '/organizations/organization%2Fid/invitations/invitation%2Fid/revoke',
      { method: 'PATCH' },
    );
  });

  it('previews and accepts an encoded invitation token', async () => {
    vi.mocked(request).mockResolvedValue({});

    await previewOrganizationInvitation(request, 'token/value');
    await acceptOrganizationInvitation(request, 'token/value');

    expect(request).toHaveBeenNthCalledWith(
      1,
      '/organization-invitations/token%2Fvalue',
    );
    expect(request).toHaveBeenNthCalledWith(
      2,
      '/organization-invitations/token%2Fvalue/accept',
      { method: 'POST' },
    );
  });
});
