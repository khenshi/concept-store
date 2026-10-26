import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import {
  DateRangePicker,
  type DateRangePickerValue,
} from './date-range-picker';

function Picker({ initialDay }: { initialDay: string }) {
  const [value, setValue] = useState<DateRangePickerValue>({
    fromDay: initialDay,
    throughDay: initialDay,
  });
  return (
    <DateRangePicker
      id="test-date-picker"
      value={value}
      onChange={setValue}
      onApply={setValue}
      onClear={() => setValue({ fromDay: '', throughDay: '' })}
    />
  );
}

function openPicker() {
  fireEvent.click(screen.getByRole('button', { name: 'Date filter' }));
}

describe('DateRangePicker keyboard navigation', () => {
  it('moves focus with arrow keys, including across month boundaries', async () => {
    render(<Picker initialDay="2026-09-30" />);
    openPicker();

    const September30 = screen.getByRole('gridcell', {
      name: 'September 30, 2026',
    });
    September30.focus();
    fireEvent.keyDown(September30, { key: 'ArrowRight' });

    await waitFor(() =>
      expect(
        screen.getByRole('gridcell', { name: 'October 1, 2026' }),
      ).toHaveFocus(),
    );
  });

  it('moves to the first and last day with Home and End', () => {
    render(<Picker initialDay="2026-09-14" />);
    openPicker();

    const September14 = screen.getByRole('gridcell', {
      name: 'September 14, 2026',
    });
    September14.focus();
    fireEvent.keyDown(September14, { key: 'Home' });
    expect(
      screen.getByRole('gridcell', { name: 'September 1, 2026' }),
    ).toHaveFocus();

    const September1 = screen.getByRole('gridcell', {
      name: 'September 1, 2026',
    });
    fireEvent.keyDown(September1, { key: 'End' });
    expect(
      screen.getByRole('gridcell', { name: 'September 30, 2026' }),
    ).toHaveFocus();
  });
});
