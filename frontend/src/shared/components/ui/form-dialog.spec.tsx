import { fireEvent, render, screen } from '@testing-library/react';
import { FormDialog } from './form-dialog';

describe('FormDialog', () => {
  it.each([
    ['compact', 'max-w-xl'],
    ['medium', 'max-w-4xl'],
    ['large', 'max-w-5xl'],
    ['confirmation', 'max-w-md'],
  ] as const)('preserves the %s width', (size, width) => {
    render(
      <FormDialog title="Form" size={size} onClose={vi.fn()}>
        Content
      </FormDialog>,
    );
    expect(screen.getByRole('dialog')).toHaveClass(width);
  });

  it('focuses the initial field, then a changed success heading without releasing the scroll lock', () => {
    const initialFocusRef = { current: null as HTMLInputElement | null };
    const content = <input aria-label="Email" ref={initialFocusRef} />;
    const { rerender } = render(
      <FormDialog
        title="Invite a member"
        initialFocusRef={initialFocusRef}
        onClose={vi.fn()}
      >
        {content}
      </FormDialog>,
    );
    expect(screen.getByRole('textbox')).toHaveFocus();
    rerender(
      <FormDialog
        title="Invitation ready"
        initialFocusRef={initialFocusRef}
        onClose={vi.fn()}
      >
        Success
      </FormDialog>,
    );
    expect(
      screen.getByRole('heading', { name: 'Invitation ready' }),
    ).toHaveFocus();
    expect(document.body.style.overflow).toBe('hidden');
  });

  it.each(['body', 'removed'])(
    'restores the trigger when previous focus is %s',
    (previous) => {
      const trigger = document.createElement('button');
      const focused = document.createElement('button');
      document.body.append(trigger, focused);
      if (previous === 'removed') focused.focus();
      const { unmount } = render(
        <FormDialog
          title="Delete account"
          role="alertdialog"
          returnFocusRef={{ current: trigger }}
          onClose={vi.fn()}
        >
          Password form
        </FormDialog>,
      );
      expect(screen.getByRole('alertdialog')).toHaveAttribute(
        'aria-modal',
        'true',
      );
      focused.remove();
      unmount();
      expect(trigger).toHaveFocus();
      trigger.remove();
    },
  );

  it('can disable backdrop dismissal while preserving Escape', () => {
    const onClose = vi.fn();
    render(
      <FormDialog
        title="Delete account"
        role="alertdialog"
        dismissOnBackdrop={false}
        onClose={onClose}
      >
        Password form
      </FormDialog>,
    );
    const dialog = screen.getByRole('alertdialog');
    fireEvent.mouseDown(dialog, { clientX: -1, clientY: -1 });
    expect(onClose).not.toHaveBeenCalled();
    fireEvent(dialog, new Event('cancel', { cancelable: true }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('focuses its heading, connects context, restores focus and scrolling on unmount', () => {
    const trigger = document.createElement('button');
    document.body.append(trigger);
    trigger.focus();
    const { unmount } = render(
      <FormDialog
        title="Add product"
        description="Record identity"
        headerAside={<span>Branch: Makati</span>}
        onClose={vi.fn()}
      >
        <button>Cancel</button>
      </FormDialog>,
    );
    const dialog = screen.getByRole('dialog', { name: 'Add product' });
    expect(dialog).toHaveAccessibleDescription('Record identity');
    expect(screen.getByText('Branch: Makati')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Add product' })).toHaveClass(
      'min-w-0',
      'break-words',
    );
    expect(dialog).toHaveClass('max-w-3xl');
    expect(screen.getByText('Branch: Makati').parentElement).toHaveClass(
      'mt-3',
      'justify-start',
    );
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
