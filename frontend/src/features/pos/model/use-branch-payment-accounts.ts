'use client';

import { useEffect, useState } from 'react';
import { listBranchPaymentAccounts } from '@/features/payment-accounts/api/payment-account-api';
import type { PaymentAccount } from '@/features/payment-accounts/model/payment-account';
import type { AuthenticatedRequest } from '@/features/organizations/model/organization.types';

export function paymentAccountHistoryLabel(account: PaymentAccount) {
  const status = !account.enabled
    ? 'Disabled'
    : account.available === false
      ? 'No longer assigned'
      : null;
  return status ? `${account.name} (${status}, Historical)` : account.name;
}

export function useBranchPaymentAccounts(
  request: AuthenticatedRequest,
  organizationId: string,
  branchId: string,
  operation: 'SALE' | 'REFUND',
  history = false,
  active = true,
) {
  const [revision, setRevision] = useState(0);
  const key = `${organizationId}:${branchId}:${operation}:${history}:${revision}`;
  const [loaded, setLoaded] = useState<{
    key: string;
    request: AuthenticatedRequest;
    accounts: PaymentAccount[];
    error?: string;
  }>();
  useEffect(() => {
    const refresh = () => setRevision((value) => value + 1);
    window.addEventListener('focus', refresh);
    return () => window.removeEventListener('focus', refresh);
  }, []);
  useEffect(() => {
    let current = true;
    if (!active) return;
    void Promise.resolve().then(async () => {
      try {
        const accounts = await listBranchPaymentAccounts(
          request,
          organizationId,
          branchId,
          operation,
          history,
        );
        if (current)
          setLoaded({
            key,
            request,
            accounts: history
              ? accounts
              : accounts.filter(
                  (account) => account.enabled && account.available !== false,
                ),
          });
      } catch {
        if (current)
          setLoaded({
            key,
            request,
            accounts: [],
            error: 'Payment accounts could not be loaded. Retry this read.',
          });
      }
    });
    return () => {
      current = false;
    };
  }, [request, organizationId, branchId, operation, history, key, active]);
  return {
    accounts:
      active && loaded?.key === key && loaded.request === request
        ? loaded.accounts
        : null,
    error:
      active && loaded?.key === key && loaded.request === request
        ? loaded.error
        : undefined,
    refresh: () => setRevision((value) => value + 1),
  };
}
