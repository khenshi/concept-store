'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { BackLink } from '@/shared/components/ui/back-link';
import { Button, buttonStyles } from '@/shared/components/ui/button';
import { ListSkeleton } from '@/shared/components/ui/list-skeleton';
import { Notice } from '@/shared/components/ui/notice';
import {
  OperationalPage,
  OperationalPanel,
} from '@/shared/components/ui/operational-page';
import { PageHeader } from '@/shared/components/ui/page-header';
import { RequestError } from '@/shared/components/ui/request-error';
import { useAuth } from '@/features/auth/model/auth-context';
import { useOrganizationWorkspaceContext } from '@/features/organizations/components/organization-workspace-context';
import { getBranch } from '../api/branch-api';
import { BranchForm } from './branch-form';
import type { BranchView } from '../model/branch.types';

function addressFor(branch: BranchView): string {
  if (!('addressLine1' in branch))
    return 'Read-only branch identity. Only your merchant’s inventory is available.';
  return [
    branch.addressLine1,
    branch.addressLine2,
    branch.city,
    branch.province,
    branch.postalCode,
    branch.countryCode,
  ]
    .filter(Boolean)
    .join(', ');
}

export function BranchDetail(props: {
  organizationId: string;
  branchId: string;
}) {
  const { organization } = useOrganizationWorkspaceContext();
  return (
    <ScopedBranchDetail
      key={`${props.organizationId}:${props.branchId}:${organization?.role}`}
      {...props}
    />
  );
}

function ScopedBranchDetail({
  organizationId,
  branchId,
}: {
  organizationId: string;
  branchId: string;
}) {
  const { request } = useAuth();
  const {
    organization,
    organizationStatus,
    organizationError,
    refreshOrganization,
    upsertBranch,
  } = useOrganizationWorkspaceContext();
  const [branch, setBranch] = useState<BranchView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setBranch(null);
    try {
      setBranch(
        await getBranch(request, organizationId, branchId, organization?.role),
      );
    } catch {
      setError('The branch details could not be loaded.');
    }
  }, [branchId, organization, organizationId, request]);

  useEffect(() => {
    let active = true;
    if (!organization) return;
    void Promise.resolve()
      .then(() => {
        if (!active) return;
        setBranch(null);
        setError(null);
        return getBranch(request, organizationId, branchId, organization.role);
      })
      .then((result) => {
        if (active && result) setBranch(result);
      })
      .catch(() => {
        if (active) setError('The branch details could not be loaded.');
      });
    return () => {
      active = false;
    };
  }, [branchId, organization, organizationId, request]);

  if (!organization)
    return (
      <OperationalPage>
        {organizationStatus === 'error' ? (
          <RequestError
            message={
              organizationError ?? 'The organization could not be loaded.'
            }
            onRetry={() => void refreshOrganization()}
          />
        ) : (
          <ListSkeleton label="Loading branch" />
        )}
      </OperationalPage>
    );
  if (!branch)
    return (
      <OperationalPage>
        <BackLink href={`/app/organizations/${organizationId}/branches`}>
          Back to branches
        </BackLink>
        {error ? (
          <RequestError
            className="mt-6 rounded-panel border border-hairline bg-surface p-6"
            message={error}
            onRetry={() => void load()}
          />
        ) : (
          <ListSkeleton
            className="mt-6"
            label="Loading branch details"
            rows={5}
          />
        )}
      </OperationalPage>
    );

  const canManage =
    organization.role === 'OWNER' || organization.role === 'MANAGER';
  return (
    <OperationalPage>
      <div className="mb-6">
        <BackLink href={`/app/organizations/${organizationId}/branches`}>
          Back to branches
        </BackLink>
      </div>
      <PageHeader
        eyebrow={branch.code ?? 'Branch'}
        title={branch.name}
        description={
          organization.role === 'MERCHANT'
            ? 'Read-only branch identity. Only your merchant’s inventory and own sales are available.'
            : addressFor(branch)
        }
        action={
          canManage ? (
            <Button
              className="max-sm:w-full"
              onClick={() => {
                setSuccess(null);
                setEditing(true);
              }}
            >
              Edit branch
            </Button>
          ) : undefined
        }
      />
      {success ? (
        <div className="mt-6">
          <Notice>{success}</Notice>
        </div>
      ) : null}
      <OperationalPanel title="Branch information">
        <dl className="grid gap-6 p-5 sm:grid-cols-2 sm:p-6">
          <div>
            <dt className="text-xs font-medium text-muted">Code</dt>
            <dd className="mt-2 text-sm text-ink">
              {branch.code ?? 'Not set'}
            </dd>
          </div>
          {organization.role !== 'MERCHANT' && 'countryCode' in branch ? (
            <>
              <div>
                <dt className="text-xs font-medium text-muted">Country</dt>
                <dd className="mt-2 text-sm text-ink">{branch.countryCode}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-xs font-medium text-muted">Address</dt>
                <dd className="mt-2">
                  <address className="break-words text-sm leading-6 not-italic text-ink">
                    {addressFor(branch)}
                  </address>
                </dd>
              </div>
            </>
          ) : null}
        </dl>
      </OperationalPanel>
      <div className="grid min-w-0 gap-x-5 xl:grid-cols-3">
        {canManage || organization.role === 'MERCHANT' ? (
          <OperationalPanel
            title="Branch inventory"
            description={
              canManage
                ? 'Maintain this branch’s independent product prices, stock, and movement history.'
                : 'Read only your merchant’s placements, prices, quantities, and movement history.'
            }
          >
            <div className="p-6">
              <Link
                className={buttonStyles({ variant: 'secondary' })}
                href={`/app/organizations/${organizationId}/branches/${branchId}/inventory`}
              >
                {canManage ? 'Manage inventory' : 'View own inventory'}
              </Link>
            </div>
          </OperationalPanel>
        ) : null}
        {organization.role !== 'MERCHANT' ? (
          <OperationalPanel
            title="Point of sale"
            description="Build a branch cart using SKU/barcode input or product search, then record cash or manual GCash/card payment."
          >
            <div className="p-6">
              <Link
                className={buttonStyles({ variant: 'primary' })}
                href={`/app/organizations/${organizationId}/branches/${branchId}/pos`}
              >
                Open POS cart
              </Link>
            </div>
          </OperationalPanel>
        ) : null}
        <OperationalPanel
          title={
            organization.role === 'MERCHANT' ? 'Your sales' : 'Sales history'
          }
          description={
            organization.role === 'MERCHANT'
              ? 'Read only sales involving your linked business in this branch.'
              : organization.role === 'CASHIER'
                ? 'Review your own completed sales and internal receipts in this assigned branch.'
                : 'Review completed branch sales and internal receipts.'
          }
        >
          <div className="p-6">
            <Link
              className={buttonStyles({ variant: 'secondary' })}
              href={`/app/organizations/${organizationId}/branches/${branchId}/sales`}
            >
              {organization.role === 'MERCHANT'
                ? 'View own sales'
                : 'View sales history'}
            </Link>
          </div>
        </OperationalPanel>
      </div>
      {editing && canManage && 'addressLine1' in branch ? (
        <BranchForm
          branch={branch}
          organizationId={organizationId}
          onCancel={() => setEditing(false)}
          onSaved={(saved) => {
            upsertBranch(saved);
            setBranch(saved);
            setSuccess(`${saved.name} was updated successfully.`);
            setEditing(false);
          }}
        />
      ) : null}
    </OperationalPage>
  );
}
