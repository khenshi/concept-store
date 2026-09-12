import { fireEvent, render, screen } from '@testing-library/react';
import { Button } from './button';

describe('Button', () => {
  it('defaults to a non-submitting button and preserves handlers', () => {
    const onClick = vi.fn();
    render(
      <Button variant="secondary" onClick={onClick}>
        Cancel
      </Button>,
    );
    const button = screen.getByRole('button', { name: 'Cancel' });
    expect(button).toHaveAttribute('type', 'button');
    expect(button).toHaveClass('ui-button-secondary');
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('announces pending state and prevents repeat submissions', () => {
    const onClick = vi.fn();
    render(
      <Button type="submit" pending pendingLabel="Saving…" onClick={onClick}>
        Save
      </Button>,
    );
    const button = screen.getByRole('button', { name: 'Saving…' });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
    expect(button).toHaveAttribute('type', 'submit');
    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });
});
