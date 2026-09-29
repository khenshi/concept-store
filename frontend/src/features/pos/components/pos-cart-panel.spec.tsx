import { fireEvent, render, screen, within } from '@testing-library/react';
import { addPosProduct } from '../model/pos-cart';
import { product } from '../model/pos.test-fixtures';
import { PosCartPanel } from './pos-cart-panel';

describe('POS cart panel', () => {
  const line = addPosProduct([], product)[0];
  const actions = () => ({
    onClear: vi.fn(),
    onRemove: vi.fn(),
    onQuantityChange: vi.fn(),
    onQuantityBlur: vi.fn(),
    onAdjustQuantity: vi.fn(),
    onReviewPayment: vi.fn(),
  });

  it('keeps cart header and checkout footer outside the scrollable item region', () => {
    const panel = render(
      <PosCartPanel
        lines={Array.from({ length: 24 }, (_, index) => ({
          ...line,
          product: {
            ...line.product,
            branchInventoryId: `cart-item-${index}`,
          },
        }))}
        locked={false}
        invalid={false}
        reviewDisabled={false}
        {...actions()}
      />,
    );

    const cart = screen.getByRole('region', { name: 'Cart' });
    const items = within(cart).getByRole('region', { name: 'Cart items' });
    const header = cart.querySelector('header');
    const footer = cart.querySelector('footer');
    expect(cart).toHaveClass('flex', 'overflow-hidden');
    expect(items).toHaveClass('flex-1', 'overflow-y-auto');
    expect(cart.firstElementChild).toBe(header);
    expect(cart.lastElementChild).toBe(footer);
    expect(within(footer!).getByText('Estimated total')).toBeInTheDocument();
    expect(
      within(footer!).getByRole('button', { name: 'Review payment' }),
    ).toBeInTheDocument();
    expect(within(items).getAllByRole('listitem')).toHaveLength(24);
    panel.unmount();
  });

  it('uses quick quantity controls and removal while respecting stock bounds', () => {
    const controls = actions();
    render(
      <PosCartPanel
        lines={[line]}
        locked={false}
        invalid={false}
        reviewDisabled={false}
        {...controls}
      />,
    );

    fireEvent.click(
      screen.getByRole('button', { name: `Increase ${product.name} quantity` }),
    );
    expect(controls.onAdjustQuantity).toHaveBeenCalledWith(line, 1);
    expect(
      screen.getByRole('button', { name: `Decrease ${product.name} quantity` }),
    ).toBeDisabled();
    fireEvent.click(
      screen.getByRole('button', { name: `Remove ${product.name}` }),
    );
    expect(controls.onRemove).toHaveBeenCalledWith(line);
  });
});
