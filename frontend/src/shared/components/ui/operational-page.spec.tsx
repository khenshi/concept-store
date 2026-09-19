import { render, screen } from '@testing-library/react';
import { OperationalPanel, OperationalToolbar } from './operational-page';

describe('OperationalPanel', () => {
  it('supports an unboxed section without changing the legacy card default', () => {
    const { rerender } = render(
      <OperationalPanel title="Work areas" variant="open">
        <p>Content</p>
      </OperationalPanel>,
    );
    const open = screen
      .getByRole('heading', { name: 'Work areas' })
      .closest('section');
    expect(open).not.toHaveClass('border-y');
    expect(open).not.toHaveClass('rounded-panel');
    rerender(
      <OperationalPanel title="Existing panel">
        <p>Content</p>
      </OperationalPanel>,
    );
    expect(
      screen
        .getByRole('heading', { name: 'Existing panel' })
        .closest('section'),
    ).toHaveClass('rounded-panel');
  });
});

describe('OperationalToolbar', () => {
  it('keeps open filters on the paper surface without changing the card default', () => {
    const { rerender } = render(
      <OperationalToolbar variant="open">Filters</OperationalToolbar>,
    );
    expect(screen.getByText('Filters')).toHaveClass('bg-surface');
    expect(screen.getByText('Filters')).not.toHaveClass('bg-subtle');
    expect(screen.getByText('Filters')).not.toHaveClass('border-b');
    rerender(<OperationalToolbar>Filters</OperationalToolbar>);
    expect(screen.getByText('Filters')).toHaveClass('bg-subtle');
  });
});
