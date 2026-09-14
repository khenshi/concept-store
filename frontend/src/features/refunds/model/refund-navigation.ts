'use client';
import { useEffect } from 'react';
import { POS_NAVIGATION_EVENT } from '@/features/pos/model/pos-navigation';
import { getRefundAttempt } from './refund-attempt';
import type { RefundScope } from '../api/refund-api';
// Mount beside sale access, not refund data: denied reads must not drop the lock.
export function useRefundNavigationGuard(key: string, scope: RefundScope) {
  const { organizationId, branchId, saleId } = scope;
  useEffect(() => {
    const target = (href: string) => {
      const retained = getRefundAttempt(key);
      if (!retained || retained.state === 'completed') return true;
      const url = new URL(href, window.location.href);
      const recovery = `/app/organizations/${organizationId}/branches/${retained.scope.branchId}/pos/sales/${retained.scope.saleId}`;
      const belongs =
        retained.scope.branchId === branchId &&
        retained.scope.saleId === saleId;
      if (
        !belongs &&
        url.origin === window.location.origin &&
        url.pathname === recovery
      )
        return true;
      window.alert(
        'Refund is pending or unresolved. Retry the same refund before leaving this sale.',
      );
      return false;
    };
    const navigation = (event: Event) => {
      const href = (event as CustomEvent<{ href: string }>).detail?.href;
      if (typeof href === 'string' && !target(href)) event.preventDefault();
    };
    const click = (event: MouseEvent) => {
      const anchor =
        event.target instanceof Element
          ? event.target.closest<HTMLAnchorElement>('a[href]')
          : null;
      if (
        anchor &&
        !event.defaultPrevented &&
        event.button === 0 &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.shiftKey &&
        !event.altKey &&
        (!anchor.target || anchor.target === '_self') &&
        !anchor.download &&
        !target(anchor.href)
      ) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    };
    const unload = (event: BeforeUnloadEvent) => {
      const retained = getRefundAttempt(key);
      if (retained && retained.state !== 'completed') {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    window.addEventListener(POS_NAVIGATION_EVENT, navigation, true);
    document.addEventListener('click', click, true);
    window.addEventListener('beforeunload', unload);
    return () => {
      window.removeEventListener(POS_NAVIGATION_EVENT, navigation, true);
      document.removeEventListener('click', click, true);
      window.removeEventListener('beforeunload', unload);
    };
  }, [key, organizationId, branchId, saleId]);
}
