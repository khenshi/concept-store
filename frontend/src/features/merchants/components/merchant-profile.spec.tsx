import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useAuth } from '@/features/auth/model/auth-context';
import { useOrganizationWorkspaceContext } from '@/features/organizations/components/organization-workspace-context';
import { useConfirmationDialog } from '@/shared/components/ui/confirmation-dialog';
import { getMerchant, updateMerchantStatus } from '../api/merchant-api';
import { MerchantProfile } from './merchant-profile';

vi.mock('@/features/auth/model/auth-context', () => ({ useAuth: vi.fn() }));
vi.mock(
  '@/features/organizations/components/organization-workspace-context',
  () => ({
    useOrganizationWorkspaceContext: vi.fn(),
  }),
);
vi.mock('@/shared/components/ui/confirmation-dialog', () => ({
  useConfirmationDialog: vi.fn(),
}));
vi.mock('../api/merchant-api', () => ({
  getMerchant: vi.fn(),
  updateMerchantStatus: vi.fn(),
  createMerchant: vi.fn(),
  updateMerchant: vi.fn(),
}));

const merchant = {
  id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  organizationId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  name: 'Amihan Home Studio',
  code: 'AMIHAN-HOME',
  contactName: 'Mara Santos',
  email: 'mara@amihan.example.com',
  phone: '+63 917 555 0101',
  status: 'ACTIVE' as const,
  createdAt: '2026-09-12T00:00:00.000Z',
  updatedAt: '2026-09-12T00:00:00.000Z',
};

describe('MerchantProfile', () => {
  const request = vi.fn();
  const confirm = vi.fn().mockResolvedValue(true);

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAuth).mockReturnValue({ request } as never);
    vi.mocked(useOrganizationWorkspaceContext).mockReturnValue({
      organization: { id: merchant.organizationId, role: 'MANAGER' },
      organizationStatus: 'ready',
    } as never);
    vi.mocked(useConfirmationDialog).mockReturnValue({
      confirm,
      confirmationDialog: null,
    });
    vi.mocked(getMerchant).mockResolvedValue(merchant);
  });

  it('displays profile information and opens profile editing', async () => {
    render(
      <MerchantProfile
        merchantId={merchant.id}
        organizationId={merchant.organizationId}
      />,
    );
    expect(await screen.findByText(merchant.contactName)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Edit profile' }));
    expect(
      screen.getByRole('heading', { name: 'Edit profile' }),
    ).toBeInTheDocument();
  });

  it('confirms before changing lifecycle status', async () => {
    vi.mocked(updateMerchantStatus).mockResolvedValue({
      ...merchant,
      status: 'ENDED',
    });
    render(
      <MerchantProfile
        merchantId={merchant.id}
        organizationId={merchant.organizationId}
      />,
    );
    await screen.findByText(merchant.contactName);

    fireEvent.click(screen.getByRole('combobox', { name: 'Status' }));
    fireEvent.click(screen.getByRole('option', { name: 'Ended' }));
    fireEvent.click(screen.getByRole('button', { name: 'Change status' }));

    await waitFor(() => expect(confirm).toHaveBeenCalledOnce());
    expect(updateMerchantStatus).toHaveBeenCalledWith(
      request,
      merchant.organizationId,
      merchant.id,
      'ENDED',
    );
    expect(
      await screen.findByText(`${merchant.name} is now ended.`),
    ).toBeInTheDocument();
  });
});
