import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useAuth } from '@/features/auth/model/auth-context';
import { useOrganizationWorkspaceContext } from '@/features/organizations/components/organization-workspace-context';
import { listMerchants } from '../api/merchant-api';
import { MerchantDirectory } from './merchant-directory';

vi.mock('@/features/auth/model/auth-context', () => ({ useAuth: vi.fn() }));
vi.mock(
  '@/features/organizations/components/organization-workspace-context',
  () => ({
    useOrganizationWorkspaceContext: vi.fn(),
  }),
);
vi.mock('../api/merchant-api', () => ({
  listMerchants: vi.fn(),
  createMerchant: vi.fn(),
  updateMerchant: vi.fn(),
}));

const organizationId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const merchant = {
  id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  organizationId,
  name: 'Amihan Home Studio',
  code: 'AMIHAN-HOME',
  contactName: 'Mara Santos',
  email: 'mara@amihan.example.com',
  phone: '+63 917 555 0101',
  status: 'ACTIVE' as const,
  createdAt: '2026-09-12T00:00:00.000Z',
  updatedAt: '2026-09-12T00:00:00.000Z',
};

describe('MerchantDirectory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAuth).mockReturnValue({ request: vi.fn() } as never);
    vi.mocked(useOrganizationWorkspaceContext).mockReturnValue({
      organization: {
        id: organizationId,
        name: 'Demo Store',
        role: 'OWNER',
      },
      organizationStatus: 'ready',
    } as never);
  });

  it('shows loading and empty directory states', async () => {
    let resolveRequest!: (value: []) => void;
    vi.mocked(listMerchants).mockReturnValue(
      new Promise((resolve) => {
        resolveRequest = resolve;
      }),
    );
    render(<MerchantDirectory organizationId={organizationId} />);
    expect(screen.getByLabelText('Loading merchants')).toBeInTheDocument();

    resolveRequest([]);
    expect(await screen.findByText('No merchants yet')).toBeInTheDocument();
  });

  it('shows request errors and opens creation in a modal', async () => {
    vi.mocked(listMerchants).mockRejectedValue(new Error('offline'));
    render(<MerchantDirectory organizationId={organizationId} />);
    expect(
      await screen.findByText('Merchants unavailable'),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Add merchant' }));
    expect(
      screen.getByRole('dialog', { name: 'Add a merchant' }),
    ).toBeInTheDocument();
  });

  it('debounces search and applies the exact status filter', async () => {
    vi.mocked(listMerchants).mockResolvedValue([merchant]);
    render(<MerchantDirectory organizationId={organizationId} />);
    expect(await screen.findByText(merchant.name)).toBeInTheDocument();

    fireEvent.change(screen.getByRole('searchbox', { name: 'Search' }), {
      target: { value: 'amihan' },
    });
    await waitFor(
      () =>
        expect(listMerchants).toHaveBeenLastCalledWith(
          expect.any(Function),
          organizationId,
          { q: 'amihan', status: undefined },
        ),
      { timeout: 1000 },
    );

    fireEvent.click(screen.getByRole('combobox', { name: 'Status' }));
    fireEvent.click(screen.getByRole('option', { name: 'Suspended' }));
    await waitFor(() =>
      expect(listMerchants).toHaveBeenLastCalledWith(
        expect.any(Function),
        organizationId,
        { q: 'amihan', status: 'SUSPENDED' },
      ),
    );
  });
});
