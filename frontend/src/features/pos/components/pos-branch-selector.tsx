'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/features/auth/model/auth-context';
import { ApiError } from '@/features/auth/api/auth-client';
import type { OrganizationRole } from '@/features/organizations/model/organization.types';
import { RequestError } from '@/shared/components/ui/request-error';
import { SelectControl } from '@/shared/components/ui/select-control';
import { listPosBranches } from '../api/pos-api';
import { allowPosNavigation } from '../model/pos-navigation';
import {
  checkoutAttemptKey,
  getCheckoutAttempt,
} from '../model/checkout-attempt';
import {
  getRefundAttempt,
  refundAttemptKey,
} from '@/features/refunds/model/refund-attempt';

export function PosBranchSelector({
  organizationId,
  branchId = '',
  role,
  disabled = false,
  onAccessDenied,
  preferredBranchId,
  rememberBranch,
  compact = false,
}: {
  organizationId: string;
  branchId?: string;
  role: OrganizationRole;
  disabled?: boolean;
  onAccessDenied?(): void;
  preferredBranchId?: string | null;
  rememberBranch?(branchId: string): void;
  compact?: boolean;
}) {
  const { request, user } = useAuth();
  const router = useRouter();
  const id = useId();
  const [branches, setBranches] = useState<Awaited<
    ReturnType<typeof listPosBranches>
  > | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const resumed = useRef<string | null>(null);
  useEffect(() => {
    let active = true;
    listPosBranches(request, organizationId, role)
      .then((result) => {
        if (!active) return;
        setBranches(result);
        if (branchId && result.some((branch) => branch.id === branchId))
          rememberBranch?.(branchId);
        if (branchId && !result.some((branch) => branch.id === branchId))
          onAccessDenied?.();
      })
      .catch((error) => {
        if (!active) return;
        setError('Authorized POS branches could not be loaded.');
        if (
          error instanceof ApiError &&
          (error.status === 403 || error.status === 404)
        )
          onAccessDenied?.();
      });
    return () => {
      active = false;
    };
  }, [
    request,
    organizationId,
    role,
    branchId,
    revision,
    onAccessDenied,
    rememberBranch,
  ]);
  function navigate(next: string) {
    if (disabled) return false;
    const attempt =
      user && getCheckoutAttempt(checkoutAttemptKey(organizationId, user.id));
    const refund =
      user && getRefundAttempt(refundAttemptKey(organizationId, user.id));
    if (
      (attempt && attempt.state !== 'completed') ||
      (refund && refund.state !== 'completed')
    )
      return false;
    const href = `/app/organizations/${organizationId}/branches/${next}/pos`;
    if (!allowPosNavigation(href)) return false;
    resumed.current = next;
    rememberBranch?.(next);
    router.push(href);
    return true;
  }
  useEffect(() => {
    if (
      branchId ||
      !preferredBranchId ||
      !branches ||
      error ||
      disabled ||
      resumed.current === preferredBranchId
    )
      return;
    if (
      branches.some((branch) => branch.id === preferredBranchId) &&
      navigate(preferredBranchId)
    )
      resumed.current = preferredBranchId;
  });
  return (
    <div className={compact ? 'w-full min-w-56 max-w-sm' : 'my-6 max-w-xl'}>
      <label htmlFor={id} className="mb-2 block text-sm font-medium text-ink">
        POS branch
      </label>
      <SelectControl
        id={id}
        value={
          branches?.some((branch) => branch.id === branchId) ? branchId : ''
        }
        disabled={disabled || !branches?.length || Boolean(error)}
        onValueChange={(next) => {
          if (
            disabled ||
            !next ||
            next === branchId ||
            !branches?.some((branch) => branch.id === next)
          )
            return;
          navigate(next);
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
      {branches?.length === 0 ? (
        <p role="status" className="mt-3 text-sm text-muted">
          No accessible branches. Ask an owner to check your branch assignments.
        </p>
      ) : null}
      {!branchId &&
      preferredBranchId &&
      branches &&
      !error &&
      !branches.some((branch) => branch.id === preferredBranchId) ? (
        <p role="status" className="mt-3 text-sm text-muted">
          The selected branch is unavailable in POS. Choose an accessible
          branch.
        </p>
      ) : null}
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
