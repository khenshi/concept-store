'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/features/auth/model/auth-context';
import { ApiError } from '@/features/auth/api/auth-client';
import {
  getBranch,
  listBranchOptions,
} from '@/features/branches/api/branch-api';
import type { OrganizationRole } from '@/features/organizations/model/organization.types';
import { PagedOptionSelect } from '@/shared/components/ui/paged-option-select';
import { RequestError } from '@/shared/components/ui/request-error';
import { usePageHeaderRequestError } from '@/shared/components/ui/page-header';
import { allowPosNavigation } from '@/features/pos/model/pos-navigation';
import {
  getCheckoutAttempt,
  checkoutAttemptKey,
} from '@/features/pos/model/checkout-attempt';
import {
  getRefundAttempt,
  refundAttemptKey,
} from '@/features/refunds/model/refund-attempt';

export function SpacesBranchSelector({
  organizationId,
  branchId = '',
  role,
  disabled = false,
  beforeChange,
  onAccessDenied,
  preferredBranchId,
  rememberBranch,
  compact = false,
  onReady,
  onLoadingChange,
}: {
  organizationId: string;
  branchId?: string;
  role: OrganizationRole;
  disabled?: boolean;
  beforeChange?(): boolean;
  onAccessDenied?(): void;
  preferredBranchId?: string | null;
  rememberBranch?(branchId: string): void;
  compact?: boolean;
  onReady?(name: string): void;
  onLoadingChange?(loading: boolean): void;
}) {
  const { request, user } = useAuth();
  const router = useRouter();
  const routerRef = useRef(router);
  useEffect(() => {
    routerRef.current = router;
  }, [router]);
  const id = useId();
  const [selectedBranch, setSelectedBranch] = useState<{
    id: string;
    label: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preferredUnavailable, setPreferredUnavailable] = useState(false);
  const [revision, setRevision] = useState(0);
  const resumed = useRef<string | null>(null);
  const beforeChangeRef = useRef(beforeChange);
  useEffect(() => {
    beforeChangeRef.current = beforeChange;
  }, [beforeChange]);
  const navigate = useCallback(
    (next: string) => {
      if (disabled || role === 'CASHIER') return false;
      const checkout =
        user && getCheckoutAttempt(checkoutAttemptKey(organizationId, user.id));
      const refund =
        user && getRefundAttempt(refundAttemptKey(organizationId, user.id));
      if (
        (checkout && checkout.state !== 'completed') ||
        (refund && refund.state !== 'completed')
      )
        return false;
      const href = `/app/organizations/${organizationId}/branches/${next}/spaces`;
      if (
        !allowPosNavigation(href) ||
        (beforeChangeRef.current && !beforeChangeRef.current())
      )
        return false;
      resumed.current = next;
      rememberBranch?.(next);
      routerRef.current.push(href);
      return true;
    },
    [disabled, organizationId, rememberBranch, role, user],
  );
  useEffect(() => {
    if (role === 'CASHIER') return;
    let active = true;
    const target = branchId || preferredBranchId;
    if (!target) return () => {};
    onLoadingChange?.(true);
    getBranch(request, organizationId, target, role)
      .then((branch) => {
        if (!active) return;
        setPreferredUnavailable(false);
        setSelectedBranch({
          id: branch.id,
          label: branch.code ? `${branch.name} (${branch.code})` : branch.name,
        });
        if (branchId) {
          rememberBranch?.(branchId);
          onReady?.(branch.name);
        }
        if (!branchId && preferredBranchId && navigate(preferredBranchId))
          resumed.current = preferredBranchId;
      })
      .catch((cause) => {
        if (!active) return;
        if (!branchId && preferredBranchId) {
          setPreferredUnavailable(true);
          return;
        }
        const status =
          cause instanceof ApiError
            ? cause.status
            : typeof cause === 'object' && cause !== null && 'status' in cause
              ? Number(cause.status)
              : undefined;
        if (status === 403 || status === 404) {
          onAccessDenied?.();
          return;
        }
        setError('Accessible spaces branches could not be loaded.');
      })
      .finally(() => {
        if (active) onLoadingChange?.(false);
      });
    return () => {
      active = false;
    };
  }, [
    request,
    organizationId,
    role,
    revision,
    branchId,
    preferredBranchId,
    navigate,
    onAccessDenied,
    onReady,
    rememberBranch,
    onLoadingChange,
  ]);
  const retry = useCallback(() => {
    setError(null);
    setSelectedBranch(null);
    setPreferredUnavailable(false);
    setRevision((value) => value + 1);
  }, []);
  const loadBranchPage = useCallback(
    (query: string, page: number) =>
      listBranchOptions(request, organizationId, { search: query, page }),
    [organizationId, request],
  );
  const pageHeaderError = usePageHeaderRequestError(error, retry);
  return (
    <div className={compact ? 'w-full min-w-56 max-w-sm' : 'my-6 max-w-xl'}>
      <label htmlFor={id} className="mb-2 block text-sm font-medium">
        Spaces branch
      </label>
      <PagedOptionSelect
        id={id}
        value={branchId}
        selectedOption={selectedBranch}
        placeholder="Choose a branch"
        emptyMessage="No accessible branches. Ask an owner to check your assignments or merchant link."
        retryKey={revision}
        disabled={disabled || role === 'CASHIER' || Boolean(error)}
        onLoadingChange={onLoadingChange}
        loadPage={loadBranchPage}
        onValueChange={(next) => {
          if (!disabled && next && next !== branchId) navigate(next);
        }}
      />
      {!branchId && preferredBranchId && preferredUnavailable && !error ? (
        <p role="status" className="mt-3 text-sm text-muted">
          The selected branch is unavailable in Spaces. Choose an accessible
          branch.
        </p>
      ) : null}
      {error && !pageHeaderError ? (
        <RequestError message={error} onRetry={retry} />
      ) : null}
    </div>
  );
}
