'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useAuth } from '@/features/auth/model/auth-context';
import { ApiError } from '@/features/auth/api/auth-client';
import { useOrganizationWorkspaceContext } from '@/features/organizations/components/organization-workspace-context';
import { Button, buttonStyles } from '@/shared/components/ui/button';
import { BackLink } from '@/shared/components/ui/back-link';
import { ListSkeleton } from '@/shared/components/ui/list-skeleton';
import {
  OperationalPage,
  OperationalPanel,
} from '@/shared/components/ui/operational-page';
import { PageHeader } from '@/shared/components/ui/page-header';
import { RequestError } from '@/shared/components/ui/request-error';
import { listSellingBranches } from '../api/sales-api';
import { SalesAccess } from './sales-access';

export function MerchantSalesBranches({
  organizationId,
}: {
  organizationId: string;
}) {
  return (
    <SalesAccess organizationId={organizationId}>
      {(role, key) =>
        role === 'MERCHANT' ? (
          <ScopedMerchantSalesBranches
            key={key}
            organizationId={organizationId}
          />
        ) : (
          <OperationalPage>
            <p>
              Open an accessible branch to view sales permitted by your role.
            </p>
            <BackLink href={`/app/organizations/${organizationId}/branches`}>
              Choose a branch
            </BackLink>
          </OperationalPage>
        )
      }
    </SalesAccess>
  );
}
function ScopedMerchantSalesBranches({
  organizationId,
}: {
  organizationId: string;
}) {
  const { request } = useAuth();
  const { refreshOrganization } = useOrganizationWorkspaceContext();
  const [branches, setBranches] = useState<Awaited<
    ReturnType<typeof listSellingBranches>
  > | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    void Promise.resolve().then(async () => {
      if (!active) return;
      setBranches(null);
      setError(null);
      try {
        const rows = await listSellingBranches(request, organizationId);
        if (active) setBranches(rows);
      } catch (cause) {
        if (active)
          setError(
            cause instanceof ApiError
              ? cause.message
              : 'Own selling branches could not be loaded. Retry the read or refresh access.',
          );
      }
    });
    return () => {
      active = false;
    };
  }, [request, organizationId, revision]);
  return (
    <OperationalPage>
      <PageHeader
        title="Your sales"
        description="Read only sales involving your linked merchant business. Historical selling branches remain available even if products are no longer placed there."
      />
      <OperationalPanel
        className="data-surface"
        title="Selling branches"
        description="Only branches with your own historical sale items. No other-merchant sales or branch addresses."
        action={
          <Button
            variant="quiet"
            onClick={() => setRevision((value) => value + 1)}
          >
            Refresh branches
          </Button>
        }
      >
        {error ? (
          <RequestError
            className="p-6"
            message={error}
            onRetry={() => setRevision((value) => value + 1)}
          />
        ) : branches === null ? (
          <ListSkeleton className="p-6" label="Loading your selling branches" />
        ) : !branches.length ? (
          <p className="p-6 text-sm text-muted">
            No sales involving your linked business yet. If you are not linked
            to a merchant profile, ask an owner to configure your merchant
            access.
          </p>
        ) : (
          <ul className="m-0 list-none p-0">
            <li className="data-column-header hidden grid-cols-[minmax(0,1.4fr)_minmax(10rem,auto)] gap-x-6 gap-y-3 sm:grid">
              <span>Branch</span>
              <span>Action</span>
            </li>
            {branches.map((branch) => (
              <li
                key={branch.id}
                className="data-row grid min-w-0 gap-x-6 gap-y-3 px-4 py-4 sm:grid-cols-[minmax(0,1.4fr)_minmax(10rem,auto)] sm:items-center"
              >
                <div className="min-w-0 break-words">
                  <h2 className="font-semibold">{branch.name}</h2>
                  <p className="text-sm text-muted">
                    {branch.code ?? 'No branch code'}
                  </p>
                </div>
                <Link
                  aria-label={`View own sales in ${branch.name}`}
                  className={buttonStyles({ variant: 'secondary' })}
                  href={`/app/organizations/${organizationId}/branches/${branch.id}/sales`}
                >
                  View own sales
                  <span className="sr-only"> in {branch.name}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </OperationalPanel>
      <Button
        variant="quiet"
        className="mt-4"
        onClick={() => void refreshOrganization()}
      >
        Refresh access
      </Button>
    </OperationalPage>
  );
}
