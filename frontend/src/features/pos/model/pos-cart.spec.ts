import {
  addPosProduct,
  posCartTotal,
  posLineTotal,
  quantityError,
} from './pos-cart';
import { product, secondProduct } from './pos.test-fixtures';
describe('POS cart rules and exact arithmetic', () => {
  it('merges repeated placements without adding another line', () => {
    const cart = addPosProduct(addPosProduct([], product), product);
    expect(cart).toHaveLength(1);
    expect(cart[0].quantity).toBe(2);
    expect(cart[0].quantityInput).toBe('2');
    expect(posLineTotal(cart[0])).toBe('1700.00');
    expect(posCartTotal(addPosProduct(cart, secondProduct))).toBe('1950.00');
  });
  it('uses exact cents for fractional prices and the approved maximum cart capacity', () => {
    const small = addPosProduct([], { ...product, sellingPrice: '0.01' });
    expect(posCartTotal([{ ...small[0], quantity: 3 }])).toBe('0.03');
    const maximum = {
      ...small[0],
      product: { ...product, sellingPrice: '9999999999.99' },
      quantity: 2147483647,
    };
    expect(posCartTotal(Array(100).fill(maximum))).toBe(
      '2147483646997852516353.00',
    );
    expect(posCartTotal([])).toBe('0.00');
  });
  it('rejects unavailable stock, over-quantity additions and silent price changes', () => {
    expect(() =>
      addPosProduct([], { ...product, quantity: 0, eligible: false }),
    ).toThrow('out of stock');
    const cart = addPosProduct([], { ...product, quantity: 1 });
    expect(() => addPosProduct(cart, { ...product, quantity: 1 })).toThrow(
      'Only 1',
    );
    expect(() =>
      addPosProduct(cart, { ...product, sellingPrice: '900.00' }),
    ).toThrow('price');
  });
  it('caps distinct lines at 100 but allows repeating an existing line', () => {
    const cart = Array.from({ length: 100 }, (_, index) => ({
      product: { ...product, branchInventoryId: String(index) },
      quantity: 1,
      quantityInput: '1',
    }));
    expect(() => addPosProduct(cart, product)).toThrow('100');
    expect(addPosProduct(cart, cart[0].product)[0].quantity).toBe(2);
  });
  it.each(['0', '-1', '1.5', '1e2', '', '2147483648', '11'])(
    'validates each whole-unit quantity %s against stock',
    (value) => {
      expect(quantityError(value, 10)).toBeTruthy();
    },
  );
  it('blocks additions while another cart quantity is invalid', () => {
    const cart = [{ product, quantity: 1, quantityInput: '' }];
    expect(() => addPosProduct(cart, secondProduct)).toThrow(
      'Fix cart quantities',
    );
    expect(quantityError(' 2 ', 10)).toBeUndefined();
  });
});
