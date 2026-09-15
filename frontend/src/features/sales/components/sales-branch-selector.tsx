'use client';

import { useEffect, useId, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/features/auth/model/auth-context';
import { ApiError } from '@/features/auth/api/auth-client';
import { useOrganizationWorkspaceContext } from '@/features/organizations/components/organization-workspace-context';
import { SelectControl } from '@/shared/components/ui/select-control';
import { RequestError } from '@/shared/components/ui/request-error';
import { allowPosNavigation } from '@/features/pos/model/pos-navigation';
import {
  checkoutAttemptKey,
  getCheckoutAttempt,
} from '@/features/pos/model/checkout-attempt';
import {
  getRefundAttempt,
  refundAttemptKey,
} from '@/features/refunds/model/refund-attempt';
import { listSellingBranches } from '../api/sales-api';

export function SalesBranchSelector({
  organizationId,
  branchId,
}: {
  organizationId: string;
  branchId: string;
}) {
  const { request, user } = useAuth();
  const { setSelectedBranchId } = useOrganizationWorkspaceContext();
  const router = useRouter();
  const id = useId();
  const [branches, setBranches] = useState<Awaited<
    ReturnType<typeof listSellingBranches>
  > | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    listSellingBranches(request, organizationId)
      .then((items) => {
        if (!active) return;
        setBranches(items);
        if (items.some((branch) => branch.id === branchId))
          setSelectedBranchId(branchId);
      })
      .catch((cause) => {
        if (active)
          setError(
            cause instanceof ApiError
              ? cause.message
              : 'Sales branches could not be loaded.',
          );
      });
    return () => {
      active = false;
    };
  }, [request, organizationId, branchId, revision, setSelectedBranchId]);
  return (
    <div className="w-full min-w-56 max-w-sm">
      <label htmlFor={id} className="mb-2 block text-sm font-medium text-ink">
        Sales branch
      </label>
      <SelectControl
        id={id}
        value={
          branches?.some((branch) => branch.id === branchId) ? branchId : ''
        }
        disabled={!branches?.length || Boolean(error)}
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
          router.push(href);
        }}
      >
        <option value="" disabled>
          {branches ? 'Choose a branch' : 'Loading branches…'}
        </option>
        {(branches ?? []).map((branch) => (
          <option key={branch.id} value={branch.id}>
            {branch.name}
            {branch.code ? ` (${branch.code})` : ''}
          </option>
        ))}
      </SelectControl>
      {error ? (
        <RequestError
          message={error}
          onRetry={() => {
            setError(null);
            setBranches(null);
            setRevision((value) => value + 1);
          }}
        />
      ) : null}
    </div>
  );
}
