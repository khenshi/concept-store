import {
  checkoutAttemptKey,
  getCheckoutAttempt,
  setCheckoutAttempt,
} from './checkout-attempt';
import { checkoutContent } from './checkout';
import { product, scope, completedSale } from './pos.test-fixtures';
describe('focused memory-only checkout attempt state', () => {
  it('isolates organizations and users and retains frozen commands until resolved', () => {
    const key = checkoutAttemptKey(scope.organizationId, 'actor-a');
    const lines = [{ product, quantity: 1, quantityInput: '1' }];
    const command = {
      ...checkoutContent(lines, {
        method: 'CASH',
        tender: '1000',
        reference: '',
        received: true,
      }),
      requestId: '44444444-4444-4444-8444-444444444444',
    };
    setCheckoutAttempt(key, { scope, lines, command, state: 'pending' });
    expect(
      getCheckoutAttempt(checkoutAttemptKey(scope.organizationId, 'actor-b')),
    ).toBeNull();
    expect(
      getCheckoutAttempt(checkoutAttemptKey(product.productId, 'actor-a')),
    ).toBeNull();
    setCheckoutAttempt(key, { scope, lines, command, state: 'unknown' });
    expect(getCheckoutAttempt(key)?.command).toEqual(command);
    setCheckoutAttempt(key, {
      scope,
      lines,
      command,
      state: 'completed',
      sale: completedSale,
    });
    expect(getCheckoutAttempt(key)?.sale).toEqual(completedSale);
    setCheckoutAttempt(key, null);
    expect(getCheckoutAttempt(key)).toBeNull();
  });
});
