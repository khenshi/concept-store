import { fireEvent, render, screen } from '@testing-library/react';
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

function chooseDates(...days: string[]) {
  fireEvent.click(screen.getByRole('button', { name: 'Report date filter' }));
  for (const day of days) {
    const date = new Date(`${day}T00:00:00.000Z`);
    const label = new Intl.DateTimeFormat('en-US', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(date);
    fireEvent.click(screen.getByRole('gridcell', { name: label }));
  }
}

describe('ReportDateFilter', () => {
  it('applies one selected Philippine date without reading before Apply', () => {
    const onApply = vi.fn();
    render(<Form onApply={onApply} />);
    chooseDates('2026-09-20');
    expect(
      screen.getByRole('dialog', { name: 'Choose report dates' }),
    ).toHaveClass('right-0');
    expect(onApply).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    expect(onApply).toHaveBeenCalledWith({
      fromDay: '2026-09-20',
      throughDay: '2026-09-20',
    });
  });

  it('applies an inclusive two-date period from one calendar', () => {
    const onApply = vi.fn();
    render(<Form onApply={onApply} />);
    chooseDates('2026-09-01', '2026-09-20');
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    expect(onApply).toHaveBeenCalledWith({
      fromDay: '2026-09-01',
      throughDay: '2026-09-20',
    });
  });

  it('allows a custom period longer than one year', () => {
    const onApply = vi.fn();
    render(<Form onApply={onApply} />);
    chooseDates('2026-09-01');
    for (let month = 0; month < 12; month += 1) {
      fireEvent.click(screen.getByRole('button', { name: 'Next month' }));
    }
    fireEvent.click(
      screen.getByRole('gridcell', { name: 'September 2, 2027' }),
    );
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    expect(onApply).toHaveBeenCalledWith({
      fromDay: '2026-09-01',
      throughDay: '2027-09-02',
    });
  });

  it('clears the pending report dates without applying a new period', () => {
    const onApply = vi.fn();
    render(<Form onApply={onApply} />);
    chooseDates('2026-09-20');
    fireEvent.click(screen.getByRole('button', { name: 'Clear dates' }));
    expect(
      screen.getByRole('button', { name: 'Report date filter' }),
    ).toHaveTextContent('All dates');
    expect(onApply).not.toHaveBeenCalled();
  });
});
