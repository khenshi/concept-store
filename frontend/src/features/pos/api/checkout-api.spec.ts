import { completeCheckout } from './checkout-api';
import { checkoutContent } from '../model/checkout';
import { scope, product, completedSale } from '../model/pos.test-fixtures';
const command = {
  ...checkoutContent([{ product, quantity: 1, quantityInput: '1' }], {
    method: 'CASH',
    tender: '1000',
    reference: '',
    received: true,
  }),
  requestId: '44444444-4444-4444-8444-444444444444',
};
describe('checkout API', () => {
  it('posts the explicit command once and returns the validated persisted receipt', async () => {
    const request = vi
      .fn()
      .mockResolvedValue({ ...completedSale, canonicalCommand: 'private' });
    expect(await completeCheckout(request, scope, command)).toEqual(
      completedSale,
    );
    expect(request).toHaveBeenCalledExactlyOnceWith(
      `/organizations/${scope.organizationId}/branches/${scope.branchId}/sales`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(command),
      },
    );
  });
  it('never auto-retries a lost response, malformed receipt or foreign scope', async () => {
    for (const value of [
      null,
      { ...completedSale, organizationId: product.productId },
      { ...completedSale, branchId: product.productId },
    ]) {
      const request = vi.fn().mockResolvedValue(value);
      await expect(completeCheckout(request, scope, command)).rejects.toThrow();
      expect(request).toHaveBeenCalledTimes(1);
    }
    const request = vi.fn().mockRejectedValue(new TypeError('network'));
    await expect(completeCheckout(request, scope, command)).rejects.toThrow(
      'network',
    );
    expect(request).toHaveBeenCalledTimes(1);
  });
});
