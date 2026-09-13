'use client';

import { useEffect, useId, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/features/auth/model/auth-context';
import { ApiError } from '@/features/auth/api/auth-client';
import { listBranches } from '@/features/branches/api/branch-api';
import type { OrganizationRole } from '@/features/organizations/model/organization.types';
import { SelectControl } from '@/shared/components/ui/select-control';
import { RequestError } from '@/shared/components/ui/request-error';

export function InventoryBranchSelector({
  organizationId,
  branchId = '',
  role,
  disabled = false,
  beforeChange,
  onAccessDenied,
}: {
  organizationId: string;
  branchId?: string;
  role: OrganizationRole;
  disabled?: boolean;
  beforeChange?(): boolean;
  onAccessDenied?(): void;
}) {
  const { request } = useAuth();
  const router = useRouter();
  const id = useId();
  const [branches, setBranches] = useState<Array<{
    id: string;
    name: string;
    code: string | null;
  }> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (role === 'CASHIER') return;
    let active = true;
    listBranches(request, organizationId, role)
      .then((result) => {
        if (!active) return;
        if (
          result.some(
            (branch) =>
              'organizationId' in branch &&
              branch.organizationId !== organizationId,
          )
        )
          throw new Error('Invalid branch scope.');
        setBranches(result.map(({ id, name, code }) => ({ id, name, code })));
        if (branchId && !result.some((branch) => branch.id === branchId))
          onAccessDenied?.();
      })
      .catch((cause) => {
        if (active)
          setError('Accessible inventory branches could not be loaded.');
        if (
          active &&
          cause instanceof ApiError &&
          [403, 404].includes(cause.status)
        )
          onAccessDenied?.();
      });
    return () => {
      active = false;
    };
  }, [request, organizationId, role, revision, branchId, onAccessDenied]);
  return (
    <div className="my-6 max-w-xl">
      <label htmlFor={id} className="mb-2 block text-sm font-medium">
        Inventory branch
      </label>
      <SelectControl
        id={id}
        value={
          branches?.some((branch) => branch.id === branchId) ? branchId : ''
        }
        disabled={
          disabled || role === 'CASHIER' || !branches?.length || Boolean(error)
        }
        onValueChange={(next) => {
          if (
            disabled ||
            !next ||
            next === branchId ||
            !branches?.some((branch) => branch.id === next) ||
            (beforeChange && !beforeChange())
          )
            return;
          router.push(
            `/app/organizations/${organizationId}/branches/${next}/inventory`,
          );
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
          No accessible branches. Ask an owner to check your assignments or
          merchant link.
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
