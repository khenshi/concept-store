import { act, fireEvent, render, screen } from '@testing-library/react';
import { allowPosNavigation } from '@/features/pos/model/pos-navigation';
import { useRefundNavigationGuard } from './refund-navigation';
import {
  getRefundAttempt,
  refundAttemptKey,
  setRefundAttempt,
} from './refund-attempt';
import { command, refundScope, staffRefund } from './refund.test-fixtures';
describe('actor-scoped refund locks and navigation', () => {
  const key = refundAttemptKey(refundScope.organizationId, 'actor');
  const destination = '/app/organizations/other/reports';
  function Guard({ scope = refundScope }) {
    useRefundNavigationGuard(key, scope);
    return <a href={destination}>Leave sale</a>;
  }
  beforeEach(() => {
    setRefundAttempt(key, null);
    vi.spyOn(window, 'alert').mockImplementation(() => {});
  });
  afterEach(() => {
    setRefundAttempt(key, null);
    vi.restoreAllMocks();
  });
  it('isolates frozen commands by organization and actor', () => {
    setRefundAttempt(key, { scope: refundScope, command, state: 'unknown' });
    expect(
      getRefundAttempt(
        refundAttemptKey(refundScope.organizationId, 'another-actor'),
      ),
    ).toBeNull();
    expect(
      getRefundAttempt(refundAttemptKey(staffRefund.id, 'actor')),
    ).toBeNull();
    expect(getRefundAttempt(key)?.command).toEqual(command);
  });
  it.each(['pending', 'unknown'] as const)(
    'blocks link, programmatic and unload navigation while %s',
    (state) => {
      render(<Guard />);
      act(() => setRefundAttempt(key, { scope: refundScope, command, state }));
      expect(allowPosNavigation(destination)).toBe(false);
      expect(fireEvent.click(screen.getByRole('link'))).toBe(false);
      expect(
        window.dispatchEvent(new Event('beforeunload', { cancelable: true })),
      ).toBe(false);
      expect(window.alert).toHaveBeenCalledTimes(2);
    },
  );
  it('allows only original-sale recovery from another sale and releases confirmed completions', () => {
    setRefundAttempt(key, { scope: refundScope, command, state: 'unknown' });
    render(<Guard scope={{ ...refundScope, saleId: staffRefund.id }} />);
    expect(
      allowPosNavigation(
        `/app/organizations/${refundScope.organizationId}/branches/${refundScope.branchId}/pos/sales/${refundScope.saleId}`,
      ),
    ).toBe(true);
    expect(allowPosNavigation(destination)).toBe(false);
    act(() =>
      setRefundAttempt(key, {
        scope: refundScope,
        command,
        state: 'completed',
        refund: staffRefund,
      }),
    );
    expect(allowPosNavigation(destination)).toBe(true);
  });
});
