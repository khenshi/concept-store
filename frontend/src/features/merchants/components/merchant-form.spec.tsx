import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { ApiError } from '@/features/auth/api/auth-client';
import { useAuth } from '@/features/auth/model/auth-context';
import { createMerchant, updateMerchant } from '../api/merchant-api';
import { MerchantForm } from './merchant-form';

vi.mock('@/features/auth/model/auth-context', () => ({ useAuth: vi.fn() }));
vi.mock('../api/merchant-api', () => ({
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

describe('MerchantForm', () => {
  const request = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAuth).mockReturnValue({ request } as never);
  });

  afterEach(() => vi.useRealTimers());

  it('shows and clears field validation 300ms after input', async () => {
    vi.useFakeTimers();
    render(
      <MerchantForm
        organizationId={merchant.organizationId}
        onSaved={vi.fn()}
      />,
    );
    const phone = screen.getByRole('textbox', { name: 'Phone' });

    fireEvent.change(phone, { target: { value: '123' } });
    expect(
      screen.queryByText('Phone must contain at least 7 characters.'),
    ).not.toBeInTheDocument();
    await act(() => vi.advanceTimersByTimeAsync(300));
    expect(
      screen.getByText('Phone must contain at least 7 characters.'),
    ).toBeInTheDocument();

    fireEvent.change(phone, { target: { value: '(02) 8555 0102' } });
    await act(() => vi.advanceTimersByTimeAsync(300));
    expect(
      screen.queryByText('Phone must contain at least 7 characters.'),
    ).not.toBeInTheDocument();
  });

  it('normalizes and creates a merchant successfully', async () => {
    vi.mocked(createMerchant).mockResolvedValue(merchant);
    const onSaved = vi.fn();
    render(
      <MerchantForm
        organizationId={merchant.organizationId}
        onSaved={onSaved}
      />,
    );

    fireEvent.change(screen.getByRole('textbox', { name: 'Business name' }), {
      target: { value: ` ${merchant.name} ` },
    });
    fireEvent.change(screen.getByRole('textbox', { name: /Code/ }), {
      target: { value: ' amihan-home ' },
    });
    fireEvent.change(screen.getByRole('textbox', { name: 'Contact name' }), {
      target: { value: ` ${merchant.contactName} ` },
    });
    fireEvent.change(screen.getByRole('textbox', { name: /^Email/ }), {
      target: { value: ` ${merchant.email?.toUpperCase()} ` },
    });
    fireEvent.change(screen.getByRole('textbox', { name: 'Phone' }), {
      target: { value: merchant.phone },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create merchant' }));

    await waitFor(() =>
      expect(createMerchant).toHaveBeenCalledWith(
        request,
        merchant.organizationId,
        {
          name: merchant.name,
          code: merchant.code,
          contactName: merchant.contactName,
          email: merchant.email,
          phone: merchant.phone,
        },
      ),
    );
    expect(onSaved).toHaveBeenCalledWith(merchant);
  });

  it('reports an edit request failure without closing the form', async () => {
    vi.mocked(updateMerchant).mockRejectedValue(
      new ApiError(409, 'Merchant code already exists in this organization'),
    );
    render(
      <MerchantForm
        merchant={merchant}
        organizationId={merchant.organizationId}
        onSaved={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(
      await screen.findByText(
        'Merchant code already exists in this organization',
      ),
    ).toBeInTheDocument();
  });
});
