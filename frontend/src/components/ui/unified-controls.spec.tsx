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
});
