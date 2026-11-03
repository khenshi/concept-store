'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/features/auth/model/auth-context';
import { ApiError } from '@/features/auth/api/auth-client';
import type { OrganizationRole } from '@/features/organizations/model/organization.types';
import { RequestError } from '@/shared/components/ui/request-error';
import { usePageHeaderRequestError } from '@/shared/components/ui/page-header';
import { getPosBranch, listPosBranchOptions } from '../api/pos-api';
import { allowPosNavigation } from '../model/pos-navigation';
import { PagedOptionSelect } from '@/shared/components/ui/paged-option-select';
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
  const lookupKey = useRef<string | null>(null);
  const resumed = useRef<string | null>(null);
  useEffect(() => {
    let active = true;
    const target = branchId || preferredBranchId;
    if (!target) return () => {};
    const key = `${organizationId}:${role}:${target}:${revision}`;
    if (lookupKey.current === key) return () => {};
    lookupKey.current = key;
    setPreferredUnavailable(false);
    getPosBranch(request, { organizationId, branchId: target }, role)
      .then((result) => {
        if (!active) return;
        const option = {
          id: result.id,
          label: result.code ? `${result.name} (${result.code})` : result.name,
        };
        setSelectedBranch(option);
        if (branchId) rememberBranch?.(branchId);
      })
      .catch((error) => {
        if (!active) return;
        if (!branchId && preferredBranchId) {
          setPreferredUnavailable(true);
          return;
        }
        if (
          error instanceof ApiError &&
          (error.status === 403 || error.status === 404)
        ) {
          onAccessDenied?.();
          return;
        }
        setError('Authorized POS branches could not be loaded.');
      });
    return () => {
      active = false;
    };
  }, [
    request,
    organizationId,
    role,
    branchId,
    preferredBranchId,
    disabled,
    revision,
    onAccessDenied,
    rememberBranch,
  ]);
  const navigate = useCallback(
    (next: string) => {
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
      routerRef.current.push(href);
      return true;
    },
    [disabled, organizationId, rememberBranch, user],
  );
  useEffect(() => {
    if (
      branchId ||
      !preferredBranchId ||
      !selectedBranch ||
      selectedBranch.id !== preferredBranchId ||
      disabled ||
      resumed.current === preferredBranchId
    )
      return;
    if (navigate(preferredBranchId)) resumed.current = preferredBranchId;
  }, [branchId, disabled, navigate, preferredBranchId, selectedBranch]);
  const retry = useCallback(() => {
    setError(null);
    setSelectedBranch(null);
    setRevision((value) => value + 1);
  }, []);
  const loadBranchPage = useCallback(
    (query: string, page: number) =>
      listPosBranchOptions(request, organizationId, role, {
        search: query,
        page,
      }),
    [organizationId, request, role],
  );
  const pageHeaderError = usePageHeaderRequestError(error, retry);
  return (
    <div className={compact ? 'w-full min-w-0 max-w-56' : 'my-6 max-w-xl'}>
      <label
        htmlFor={id}
        className={
          compact
            ? 'mb-1 block text-xs font-medium text-muted'
            : 'mb-2 block text-sm font-medium text-ink'
        }
      >
        POS branch
      </label>
      <PagedOptionSelect
        id={id}
        value={branchId}
        selectedOption={selectedBranch}
        placeholder="Choose a branch"
        emptyMessage="No accessible branches. Ask an owner to check your assignments or merchant link."
        loadPage={loadBranchPage}
        disabled={disabled || Boolean(error)}
        onValueChange={(next) => {
          if (!disabled && next && next !== branchId) navigate(next);
        }}
      />
      {!branchId && preferredBranchId && preferredUnavailable && !error ? (
        <p role="status" className="mt-3 text-sm text-muted">
          The selected branch is unavailable in POS. Choose an accessible
          branch.
        </p>
      ) : null}
      {error && !pageHeaderError ? (
        <RequestError message={error} onRetry={retry} />
      ) : null}
    </div>
  );
}
