import { fireEvent, render, screen } from '@testing-library/react';
import { FormDialog } from './form-dialog';

describe('FormDialog', () => {
  it('focuses its heading, connects context, restores focus and scrolling on unmount', () => {
    const trigger = document.createElement('button');
    document.body.append(trigger);
    trigger.focus();
    const { unmount } = render(
      <FormDialog
        title="Add product"
        description="Record identity"
        onClose={vi.fn()}
      >
        <button>Cancel</button>
      </FormDialog>,
    );
    const dialog = screen.getByRole('dialog', { name: 'Add product' });
    expect(dialog).toHaveAccessibleDescription('Record identity');
    expect(screen.getByRole('heading', { name: 'Add product' })).toHaveFocus();
    expect(document.body.style.overflow).toBe('hidden');
    unmount();
    expect(trigger).toHaveFocus();
    expect(document.body.style.overflow).toBe('');
    trigger.remove();
  });
  it('blocks Escape and backdrop dismissal while pending', () => {
    const onClose = vi.fn();
    const { rerender } = render(
      <FormDialog
        title="Add product"
        description="Record identity"
        pending
        onClose={onClose}
      >
        Form
      </FormDialog>,
    );
    const dialog = screen.getByRole('dialog');
    fireEvent(
      dialog,
      new Event('cancel', { bubbles: false, cancelable: true }),
    );
    fireEvent.mouseDown(dialog, { clientX: -1, clientY: -1 });
    expect(onClose).not.toHaveBeenCalled();
    rerender(
      <FormDialog
        title="Add product"
        description="Record identity"
        onClose={onClose}
      >
        Form
      </FormDialog>,
    );
    fireEvent(
      dialog,
      new Event('cancel', { bubbles: false, cancelable: true }),
    );
    expect(onClose).toHaveBeenCalledOnce();
  });
});
