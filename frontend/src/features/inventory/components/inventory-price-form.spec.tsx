import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { useAuth } from '@/features/auth/model/auth-context';
import { updateInventoryPrice } from '../api/inventory-api';
import { inventory, scope } from '../model/inventory.test-fixtures';
import { InventoryPriceForm } from './inventory-price-form';

vi.mock('@/features/auth/model/auth-context', () => ({ useAuth: vi.fn() }));
vi.mock('../api/inventory-api', () => ({ updateInventoryPrice: vi.fn() }));
describe('InventoryPriceForm', () => {
  const request = vi.fn();
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(useAuth).mockReturnValue({ request } as never);
  });
  afterEach(() => vi.useRealTimers());
  it('submits the precise string price for only the selected branch', async () => {
    vi.mocked(updateInventoryPrice).mockResolvedValue(inventory);
    const onSaved = vi.fn();
    render(
      <InventoryPriceForm
        scope={scope}
        inventory={inventory}
        onSaved={onSaved}
        onPendingChange={vi.fn()}
      />,
    );
    fireEvent.change(
      screen.getByRole('textbox', { name: 'Selling price (PHP)' }),
      { target: { value: '9999999999.99' } },
    );
    fireEvent.click(screen.getByRole('button', { name: 'Save branch price' }));
    await waitFor(() =>
      expect(updateInventoryPrice).toHaveBeenCalledWith(
        request,
        scope,
        '9999999999.99',
      ),
    );
    expect(onSaved).toHaveBeenCalledOnce();
  });
  it('validates each price edit after debounce and clears errors on blur', async () => {
    vi.useFakeTimers();
    render(
      <InventoryPriceForm
        scope={scope}
        inventory={inventory}
        onSaved={vi.fn()}
        onPendingChange={vi.fn()}
      />,
    );
    const price = screen.getByRole('textbox', { name: 'Selling price (PHP)' });
    fireEvent.change(price, { target: { value: '1e2' } });
    expect(price).not.toHaveAttribute('aria-invalid', 'true');
    await act(() => vi.advanceTimersByTimeAsync(300));
    expect(price).toHaveAttribute('aria-invalid', 'true');
    fireEvent.change(price, { target: { value: '0.01' } });
    fireEvent.blur(price);
    expect(price).not.toHaveAttribute('aria-invalid', 'true');
  });
});
