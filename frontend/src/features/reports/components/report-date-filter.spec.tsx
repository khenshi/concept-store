import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { useState } from 'react';
import { ReportDateFilter } from './report-date-filter';
import type { ReportDateRange } from '../model/report-dates';

function Form({ onApply }: { onApply(value: ReportDateRange): void }) {
  const [value, onChange] = useState({
    fromDay: '2026-09-14',
    throughDay: '2026-09-14',
  });
  return (
    <ReportDateFilter value={value} onChange={onChange} onApply={onApply} />
  );
}
describe('live report date validation', () => {
  afterEach(() => vi.useRealTimers());
  it('debounces each input by 300ms and clears feedback after a valid change', () => {
    vi.useFakeTimers();
    const onApply = vi.fn();
    render(<Form onApply={onApply} />);
    const through = screen.getByLabelText('Through (PH, inclusive)');
    fireEvent.change(through, { target: { value: '2026-09-13' } });
    act(() => vi.advanceTimersByTime(299));
    expect(through).not.toHaveAttribute('aria-invalid', 'true');
    act(() => vi.advanceTimersByTime(1));
    expect(through).toHaveAttribute('aria-invalid', 'true');
    expect(
      screen.getByText('Through date must be on or after From date.'),
    ).toBeInTheDocument();
    fireEvent.change(through, { target: { value: '2026-09-14' } });
    act(() => vi.advanceTimersByTime(300));
    expect(through).not.toHaveAttribute('aria-invalid', 'true');
    expect(onApply).not.toHaveBeenCalled();
  });
  it('validates immediately on blur without reading', () => {
    const onApply = vi.fn();
    render(<Form onApply={onApply} />);
    const from = screen.getByLabelText('From (PH, inclusive)');
    fireEvent.change(from, { target: { value: '' } });
    fireEvent.blur(from);
    expect(from).toHaveAttribute('aria-invalid', 'true');
    expect(onApply).not.toHaveBeenCalled();
  });
  it('blocks invalid Apply, focuses the first invalid field, then applies a valid range', async () => {
    const onApply = vi.fn();
    render(<Form onApply={onApply} />);
    const from = screen.getByLabelText('From (PH, inclusive)');
    fireEvent.change(from, { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply period' }));
    await waitFor(() => expect(from).toHaveFocus());
    expect(onApply).not.toHaveBeenCalled();
    fireEvent.change(from, { target: { value: '2026-09-14' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply period' }));
    expect(onApply).toHaveBeenCalledWith({
      fromDay: '2026-09-14',
      throughDay: '2026-09-14',
    });
  });
  it('cancels pending validation when unmounted', () => {
    vi.useFakeTimers();
    const view = render(<Form onApply={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('From (PH, inclusive)'), {
      target: { value: '' },
    });
    view.unmount();
    expect(() => act(() => vi.advanceTimersByTime(300))).not.toThrow();
  });
});
