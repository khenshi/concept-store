'use client';

import { useCallback, useEffect, useId, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/features/auth/model/auth-context';
import { useOrganizationWorkspaceContext } from '@/features/organizations/components/organization-workspace-context';
import { PagedOptionSelect } from '@/shared/components/ui/paged-option-select';
import { allowPosNavigation } from '@/features/pos/model/pos-navigation';
import {
  checkoutAttemptKey,
  getCheckoutAttempt,
} from '@/features/pos/model/checkout-attempt';
import {
  getRefundAttempt,
  refundAttemptKey,
} from '@/features/refunds/model/refund-attempt';
import { listSellingBranchOptions } from '../api/sales-api';

export function SalesBranchSelector({
  organizationId,
  branchId,
  branchLabel,
}: {
  organizationId: string;
  branchId: string;
  branchLabel?: string;
}) {
  const { request, user } = useAuth();
  const { setSelectedBranchId } = useOrganizationWorkspaceContext();
  const router = useRouter();
  const id = useId();
  const routerRef = useRef(router);
  useEffect(() => {
    routerRef.current = router;
  }, [router]);
  useEffect(() => {
    setSelectedBranchId(branchId);
  }, [branchId, setSelectedBranchId]);
  const loadBranchPage = useCallback(
    (query: string, page: number) =>
      listSellingBranchOptions(request, organizationId, {
        search: query,
        page,
      }),
    [organizationId, request],
  );
  return (
    <div className="w-full min-w-56 max-w-sm">
      <label htmlFor={id} className="mb-2 block text-sm font-medium text-ink">
        Sales branch
      </label>
      <PagedOptionSelect
        id={id}
        value={branchId}
        selectedOption={{
          id: branchId,
          label: branchLabel ?? 'Current branch',
        }}
        placeholder="Choose a branch"
        emptyMessage="No historical selling branches are available."
        loadPage={loadBranchPage}
        onValueChange={(next) => {
          if (!next || next === branchId) return;
          const checkout =
            user &&
            getCheckoutAttempt(checkoutAttemptKey(organizationId, user.id));
          const refund =
            user && getRefundAttempt(refundAttemptKey(organizationId, user.id));
          if (
            (checkout && checkout.state !== 'completed') ||
            (refund && refund.state !== 'completed')
          )
            return;
          const href = `/app/organizations/${organizationId}/branches/${next}/sales`;
          if (!allowPosNavigation(href)) return;
          setSelectedBranchId(next);
          routerRef.current.push(href);
        }}
      />
    </div>
  );
}
