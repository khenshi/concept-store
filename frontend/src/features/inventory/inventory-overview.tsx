'use client';

import { useEffect, useState } from 'react';
import { ListSkeleton } from '@/components/ui/list-skeleton';
import { RequestError } from '@/components/ui/request-error';
import { ApiError } from '@/features/auth/auth-client';
import { useAuth } from '@/features/auth/auth-context';
import { OrganizationPageHeader } from '@/features/organizations/organization-page-header';
import { useOrganizationWorkspaceContext } from '@/features/organizations/organization-workspace-context';
import { listInventory } from './inventory-api';
import type { InventoryPage } from './inventory.types';

function message(cause: unknown): string {
  return cause instanceof ApiError
    ? cause.message
    : 'Inventory could not be loaded. Please try again.';
}

export function InventoryOverview({
  organizationId,
}: {
  organizationId: string;
}) {
  const { request } = useAuth();
  const { organization, organizationStatus } =
    useOrganizationWorkspaceContext();
  const [page, setPage] = useState<InventoryPage>({
    items: [],
    total: 0,
    offset: 0,
    limit: 50,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load(): Promise<void> {
    setIsLoading(true);
    setError(null);
    try {
      setPage(await listInventory(request, organizationId));
    } catch (cause: unknown) {
      setError(message(cause));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    if (!organization) return;
    if (organization.role !== 'OWNER' && organization.role !== 'MANAGER') {
      return;
    }
    let active = true;
    void listInventory(request, organizationId)
      .then((result) => {
        if (active) setPage(result);
      })
      .catch((cause: unknown) => {
        if (active) setError(message(cause));
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [organization, organizationId, request]);

  if (organizationStatus === 'loading')
    return <ListSkeleton label="Loading inventory" />;
  if (!organization) return null;
  const canManage =
    organization.role === 'OWNER' || organization.role === 'MANAGER';

  return (
    <section className="mx-auto mt-8 w-full max-w-5xl sm:mt-12">
      <OrganizationPageHeader
        organization={organization}
        title="Inventory"
        description="Review current product quantities across store branches."
      />
      <section className="mt-6 rounded-xl border border-slate-200 bg-white p-6">
        {!canManage ? (
          <p className="leading-7 text-slate-500">
            Inventory access is currently limited to owners and managers.
          </p>
        ) : (
          <>
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-bold">Current stock</h2>
                <p className="mt-2 text-sm text-slate-500">
                  {page.total} product and branch records
                </p>
              </div>
              <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-bold text-emerald-700">
                Live quantity
              </span>
            </div>
            {error ? (
              <RequestError
                className="mt-5 rounded-lg border border-red-600 bg-white p-3 text-sm text-red-600"
                message={error}
                onRetry={() => void load()}
              />
            ) : null}
            {isLoading ? (
              <ListSkeleton label="Loading inventory" rowClassName="h-20" />
            ) : page.items.length === 0 ? (
              <div className="py-10 text-center">
                <h3 className="text-base font-bold">No inventory yet</h3>
                <p className="mt-2 text-slate-500">
                  Stock-in creates the first branch inventory record for a
                  product.
                </p>
              </div>
            ) : (
              <ul className="mt-5 list-none p-0">
                {page.items.map((item) => (
                  <li
                    className="flex items-center justify-between gap-4 border-b border-slate-200 py-4 last:border-0"
                    key={`${item.productId}:${item.branchId}`}
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <strong>{item.product.name}</strong>
                        <span className="rounded bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600">
                          {item.product.sku}
                        </span>
                      </div>
                      <p className="mt-1 truncate text-sm text-slate-500">
                        {item.product.merchant.name} · {item.branch.name}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <strong
                        className={
                          item.quantity < 0 ? 'text-red-600' : 'text-slate-950'
                        }
                      >
                        {item.quantity}
                      </strong>
                      <span className="mt-1 block text-xs text-slate-500">
                        on hand
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </section>
    </section>
  );
}
