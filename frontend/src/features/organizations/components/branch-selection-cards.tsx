'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import type { BranchView } from '@/features/branches/model/branch.types';
import { useOrganizationWorkspaceContext } from './organization-workspace-context';
import { EmptyState } from '@/shared/components/ui/empty-state';
import { RequestError } from '@/shared/components/ui/request-error';

export function BranchSelectionCards({
  description,
  hrefForBranch,
}: {
  description: string;
  hrefForBranch(branchId: string): string;
}) {
  const {
    branches = [],
    branchesStatus = 'idle',
    branchesError = null,
    loadBranches,
    setSelectedBranchId,
  } = useOrganizationWorkspaceContext();

  useEffect(() => {
    if (branchesStatus !== 'idle' || typeof loadBranches !== 'function') return;
    void loadBranches().catch(() => undefined);
  }, [branchesStatus, loadBranches]);

  return (
    <section className="mt-8" aria-labelledby="branch-selection-heading">
      <header>
        <h2 id="branch-selection-heading" className="text-lg font-semibold">
          Choose a branch
        </h2>
        <p className="mt-1 text-sm text-muted">{description}</p>
      </header>
      {branchesStatus === 'idle' || branchesStatus === 'loading' ? (
        <div
          role="status"
          aria-label="Loading branches"
          className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          {Array.from({ length: 3 }, (_, index) => (
            <div
              key={index}
              className="card-surface min-h-32 animate-pulse p-5"
            >
              <div className="h-4 w-2/3 rounded bg-subtle" />
              <div className="mt-3 h-3 w-1/3 rounded bg-subtle" />
              <div className="mt-8 h-3 w-1/2 rounded bg-subtle" />
            </div>
          ))}
        </div>
      ) : branchesError ? (
        <RequestError
          className="mt-5"
          message={branchesError}
          onRetry={() => {
            if (typeof loadBranches === 'function')
              void loadBranches({ refresh: true }).catch(() => undefined);
          }}
        />
      ) : branches.length ? (
        <div
          role="list"
          aria-label="Available branches"
          className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          {branches.map((branch: BranchView) => (
            <Link
              key={branch.id}
              href={hrefForBranch(branch.id)}
              onClick={() => setSelectedBranchId(branch.id)}
              className="group card-surface flex min-h-32 flex-col justify-between p-5 no-underline transition-colors hover:bg-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            >
              <span>
                <span className="block text-lg font-semibold text-ink">
                  {branch.name}
                </span>
                {branch.code ? (
                  <span className="mt-1 block text-sm text-muted">
                    {branch.code}
                  </span>
                ) : null}
              </span>
              <span className="mt-6 text-sm font-semibold text-action group-hover:underline">
                Open branch <span aria-hidden="true">→</span>
              </span>
            </Link>
          ))}
        </div>
      ) : (
        <EmptyState
          className="mt-5"
          title="No accessible branches"
          description="Ask an owner to check your branch access or merchant link."
        />
      )}
    </section>
  );
}
