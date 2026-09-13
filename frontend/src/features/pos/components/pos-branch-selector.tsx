'use client';

import { useEffect, useId, useState } from 'react';
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

export function PosBranchSelector({
  organizationId,
  branchId = '',
  role,
  disabled = false,
  onAccessDenied,
}: {
  organizationId: string;
  branchId?: string;
  role: OrganizationRole;
  disabled?: boolean;
  onAccessDenied?(): void;
}) {
  const { request, user } = useAuth();
  const router = useRouter();
  const id = useId();
  const [branches, setBranches] = useState<Awaited<
    ReturnType<typeof listPosBranches>
  > | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    listPosBranches(request, organizationId, role)
      .then((result) => {
        if (!active) return;
        setBranches(result);
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
  }, [request, organizationId, role, branchId, revision, onAccessDenied]);
  return (
    <div className="my-6 max-w-xl">
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
          const attempt =
            user &&
            getCheckoutAttempt(checkoutAttemptKey(organizationId, user.id));
          if (attempt && attempt.state !== 'completed') return;
          const href = `/app/organizations/${organizationId}/branches/${next}/pos`;
          if (allowPosNavigation(href)) router.push(href);
        }}
      >
        <option value="" disabled>
          {branches ? 'Choose a branch' : 'Loading branches…'}
        </option>
        {(branches ?? []).map((branch) => (
          <option key={branch.id} value={branch.id}>
            {branch.name} ({branch.code})
          </option>
        ))}
      </SelectControl>
      {branches?.length === 0 ? (
        <p role="status" className="mt-3 text-sm text-muted">
          No accessible branches. Ask an owner to check your branch assignments.
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
