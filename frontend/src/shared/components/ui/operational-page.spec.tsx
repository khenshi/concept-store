import { render, screen } from '@testing-library/react';
import {
  OperationalCollection,
  OperationalPanel,
  OperationalToolbar,
} from './operational-page';

describe('OperationalCollection', () => {
  it('places collection controls below the header by default', () => {
    render(
      <OperationalCollection
        title="Inventory stock"
        controls={<div data-testid="collection-controls">Filters</div>}
      >
        <p>Content</p>
      </OperationalCollection>,
    );

    const controls = screen.getByTestId('collection-controls');
    expect(controls.parentElement).toHaveClass('bg-subtle', 'border-b');
    expect(
      screen
        .getByRole('heading', { name: 'Inventory stock' })
        .closest('section'),
    ).toHaveClass('card-surface');
  });

  it('keeps inline collection controls in the header', () => {
    render(
      <OperationalCollection
        surface="data"
        controlsPlacement="inline"
        title="Transaction history"
        controls={<div data-testid="collection-controls">Filters</div>}
      >
        <p>Content</p>
      </OperationalCollection>,
    );

    const section = screen
      .getByRole('heading', { name: 'Transaction history' })
      .closest('section');
    expect(section).toHaveClass('data-surface');
    expect(screen.getByTestId('collection-controls').parentElement).toHaveClass(
      'min-w-0',
    );
    expect(section?.querySelector('header')).toHaveClass('lg:items-center');
  });
});

describe('OperationalPanel', () => {
  it('supports an open section while keeping the shared card default', () => {
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
    ).toHaveClass('card-surface');
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
