import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { useAuth } from '@/features/auth/model/auth-context';
import { updateInventoryThreshold } from '../api/inventory-api';
import { inventory, scope } from '../model/inventory.test-fixtures';
import { InventoryThresholdForm } from './inventory-threshold-form';

vi.mock('@/features/auth/model/auth-context', () => ({ useAuth: vi.fn() }));
vi.mock('../api/inventory-api', () => ({ updateInventoryThreshold: vi.fn() }));

describe('InventoryThresholdForm', () => {
  const request = vi.fn();
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(useAuth).mockReturnValue({ request } as never);
  });
  afterEach(() => vi.useRealTimers());

  it('updates only the selected placement threshold', async () => {
    vi.mocked(updateInventoryThreshold).mockResolvedValue(inventory);
    const onSaved = vi.fn();
    render(
      <InventoryThresholdForm
        scope={scope}
        inventory={inventory}
        onSaved={onSaved}
        onPendingChange={vi.fn()}
      />,
    );
    fireEvent.change(
      screen.getByRole('textbox', { name: 'Low-stock threshold' }),
      { target: { value: '0' } },
    );
    fireEvent.click(screen.getByRole('button', { name: 'Save threshold' }));
    await waitFor(() =>
      expect(updateInventoryThreshold).toHaveBeenCalledWith(request, scope, 0),
    );
    expect(onSaved).toHaveBeenCalledOnce();
  });

  it('shows debounced live validation and clears it on blur', async () => {
    vi.useFakeTimers();
    render(
      <InventoryThresholdForm
        scope={scope}
        inventory={inventory}
        onSaved={vi.fn()}
        onPendingChange={vi.fn()}
      />,
    );
    const threshold = screen.getByRole('textbox', {
      name: 'Low-stock threshold',
    });
    fireEvent.change(threshold, { target: { value: '-1' } });
    expect(threshold).not.toHaveAttribute('aria-invalid', 'true');
    await act(() => vi.advanceTimersByTimeAsync(300));
    expect(threshold).toHaveAttribute('aria-invalid', 'true');
    fireEvent.change(threshold, { target: { value: '5' } });
    fireEvent.blur(threshold);
    expect(threshold).not.toHaveAttribute('aria-invalid', 'true');
  });
});
