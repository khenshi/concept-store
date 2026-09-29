import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { PosCartSheet } from './pos-cart-sheet';

function CartSheetHarness() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)}>View cart</button>
      <PosCartSheet open={open} onClose={() => setOpen(false)}>
        <section className="flex h-full min-h-0 flex-col overflow-hidden">
          <h2 tabIndex={-1}>Cart</h2>
          <button>Close cart</button>
        </section>
      </PosCartSheet>
    </>
  );
}

const originalShow = Object.getOwnPropertyDescriptor(
  HTMLDialogElement.prototype,
  'showModal',
);
const originalClose = Object.getOwnPropertyDescriptor(
  HTMLDialogElement.prototype,
  'close',
);

describe('POS cart sheet', () => {
  beforeEach(() => {
    Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
      configurable: true,
      value: function (this: HTMLDialogElement) {
        this.setAttribute('open', '');
      },
    });
    Object.defineProperty(HTMLDialogElement.prototype, 'close', {
      configurable: true,
      value: function (this: HTMLDialogElement) {
        this.removeAttribute('open');
      },
    });
  });

  afterEach(() => {
    if (originalShow)
      Object.defineProperty(
        HTMLDialogElement.prototype,
        'showModal',
        originalShow,
      );
    else Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal');
    if (originalClose)
      Object.defineProperty(
        HTMLDialogElement.prototype,
        'close',
        originalClose,
      );
    else Reflect.deleteProperty(HTMLDialogElement.prototype, 'close');
  });

  it('opens as a modal sheet, focuses its heading, and restores focus on Escape', async () => {
    render(<CartSheetHarness />);
    const trigger = screen.getByRole('button', { name: 'View cart' });
    trigger.focus();
    fireEvent.click(trigger);

    const dialog = await screen.findByRole('dialog', { name: 'Cart' });
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Cart' })).toHaveFocus(),
    );
    expect(document.body.style.overflow).toBe('hidden');

    fireEvent(dialog, new Event('cancel', { cancelable: true }));

    await waitFor(() => expect(dialog).not.toHaveAttribute('open'));
    expect(document.body.style.overflow).toBe('');
    expect(trigger).toHaveFocus();
    expect(
      screen.queryByRole('heading', { name: 'Cart' }),
    ).not.toBeInTheDocument();
  });
});
