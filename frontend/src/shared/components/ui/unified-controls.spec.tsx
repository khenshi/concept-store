import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { useConfirmationDialog } from './confirmation-dialog';
import { SelectControl } from './select-control';

describe('SelectControl', () => {
  it('uses the shared listbox and submits the selected value', () => {
    render(
      <form data-testid="form">
        <SelectControl name="status" defaultValue="ACTIVE" aria-label="Status">
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
        </SelectControl>
      </form>,
    );

    fireEvent.click(screen.getByRole('combobox', { name: 'Status' }));
    fireEvent.click(screen.getByRole('option', { name: 'Inactive' }));

    expect(screen.getByRole('combobox', { name: 'Status' })).toHaveTextContent(
      'Inactive',
    );
    expect(
      new FormData(screen.getByTestId('form') as HTMLFormElement).get('status'),
    ).toBe('INACTIVE');
  });

  it('supports keyboard navigation, skips disabled options, and restores trigger focus', () => {
    render(
      <SelectControl aria-label="Status" defaultValue="ACTIVE">
        <option value="ACTIVE">Active</option>
        <option value="BLOCKED" disabled>
          Blocked
        </option>
        <option value="INACTIVE">Inactive</option>
      </SelectControl>,
    );
    const trigger = screen.getByRole('combobox', { name: 'Status' });
    fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    expect(screen.getByRole('option', { name: 'Active' })).toHaveFocus();
    fireEvent.keyDown(screen.getByRole('option', { name: 'Active' }), {
      key: 'ArrowDown',
    });
    expect(screen.getByRole('option', { name: 'Inactive' })).toHaveFocus();
    fireEvent.click(screen.getByRole('option', { name: 'Inactive' }));
    expect(trigger).toHaveTextContent('Inactive');
    expect(trigger).toHaveFocus();
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(trigger);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(trigger).toHaveFocus();
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('resets uncontrolled form values and excludes disabled fields from submission', () => {
    render(
      <form data-testid="reset-form">
        <SelectControl name="status" aria-label="Status" defaultValue="ACTIVE">
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
        </SelectControl>
        <SelectControl
          name="disabled"
          aria-label="Disabled status"
          disabled
          defaultValue="ACTIVE"
        >
          <option value="ACTIVE">Active</option>
        </SelectControl>
      </form>,
    );
    fireEvent.click(screen.getByRole('combobox', { name: 'Status' }));
    fireEvent.click(screen.getByRole('option', { name: 'Inactive' }));
    const form = screen.getByTestId('reset-form') as HTMLFormElement;
    fireEvent.reset(form);
    expect(screen.getByRole('combobox', { name: 'Status' })).toHaveTextContent(
      'Active',
    );
    expect(new FormData(form).has('disabled')).toBe(false);
  });

  it('dismisses its popup without also dismissing a surrounding dialog', () => {
    const onParentKeyDown = vi.fn();
    render(
      <div onKeyDown={onParentKeyDown}>
        <SelectControl aria-label="Role" defaultValue="OWNER">
          <option value="OWNER">Owner</option>
        </SelectControl>
      </div>,
    );
    fireEvent.click(screen.getByRole('combobox', { name: 'Role' }));
    fireEvent.keyDown(screen.getByRole('option', { name: 'Owner' }), {
      key: 'Escape',
    });
    expect(onParentKeyDown).not.toHaveBeenCalled();
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Role' })).toHaveFocus();
  });
});

function ConfirmationHarness() {
  const [result, setResult] = useState('');
  const { confirm, confirmationDialog } = useConfirmationDialog();
  return (
    <>
      <button
        type="button"
        onClick={() =>
          void confirm({
            title: 'Remove member?',
            description: 'Access will be removed.',
            confirmLabel: 'Remove',
            tone: 'danger',
          }).then((confirmed) => setResult(String(confirmed)))
        }
      >
        Open confirmation
      </button>
      <output>{result}</output>
      {confirmationDialog}
    </>
  );
}

describe('useConfirmationDialog', () => {
  it('returns the confirmed action without using a browser-native prompt', async () => {
    render(<ConfirmationHarness />);
    fireEvent.click(screen.getByRole('button', { name: 'Open confirmation' }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    expect(await screen.findByText('true')).toBeInTheDocument();
  });

  it('focuses the safe action, traps keyboard focus, and restores it on cancellation', async () => {
    render(<ConfirmationHarness />);
    const trigger = screen.getByRole('button', { name: 'Open confirmation' });
    trigger.focus();
    fireEvent.click(trigger);
    expect(
      screen.getByRole('alertdialog', { name: 'Remove member?' }),
    ).toHaveAccessibleDescription('Access will be removed.');
    const cancel = screen.getByRole('button', { name: 'Cancel' });
    const remove = screen.getByRole('button', { name: 'Remove' });
    expect(cancel).toHaveFocus();
    expect(document.body.style.overflow).toBe('hidden');
    fireEvent.keyDown(cancel, { key: 'Tab', shiftKey: true });
    expect(remove).toHaveFocus();
    fireEvent.keyDown(remove, { key: 'Tab' });
    expect(cancel).toHaveFocus();
    fireEvent.keyDown(cancel, { key: 'Escape' });
    expect(await screen.findByText('false')).toBeInTheDocument();
    expect(trigger).toHaveFocus();
    expect(document.body.style.overflow).not.toBe('hidden');
  });
});
