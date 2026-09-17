import { render, screen } from '@testing-library/react';
import { OperationalPanel } from './operational-page';

describe('OperationalPanel', () => {
  it('supports an open divided section without changing the legacy card default', () => {
    const { rerender } = render(
      <OperationalPanel title="Work areas" variant="open">
        <p>Content</p>
      </OperationalPanel>,
    );
    const open = screen
      .getByRole('heading', { name: 'Work areas' })
      .closest('section');
    expect(open).toHaveClass('border-y');
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
