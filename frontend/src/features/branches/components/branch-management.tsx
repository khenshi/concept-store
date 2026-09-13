'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Icon } from '@/shared/components/ui/icon';
import { ListSkeleton } from '@/shared/components/ui/list-skeleton';
import {
  FilterField,
  OperationalPage,
  OperationalPanel,
  OperationalToolbar,
  StatusNotice,
} from '@/shared/components/ui/operational-page';
import { PageHeader } from '@/shared/components/ui/page-header';
import { RequestError } from '@/shared/components/ui/request-error';
import { SelectControl } from '@/shared/components/ui/select-control';
import { TextField } from '@/shared/components/ui/text-field';
import { useDebouncedValue } from '@/shared/hooks/use-debounced-value';
import { useOrganizationWorkspaceContext } from '@/features/organizations/components/organization-workspace-context';
import { BranchForm } from './branch-form';
import type { BranchView } from '../model/branch.types';

function addressFor(branch: BranchView): string {
  if (!('addressLine1' in branch)) return '';
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

export function BranchManagement(props: { organizationId: string }) {
  const { organization } = useOrganizationWorkspaceContext();
  return (
    <ScopedBranchManagement
      key={`${props.organizationId}:${organization?.role}`}
      {...props}
    />
  );
}

function ScopedBranchManagement({
  organizationId,
}: {
  organizationId: string;
}) {
  const {
    organization,
    organizationStatus,
    organizationError,
    refreshOrganization,
    branches,
    branchesStatus,
    branchesError,
    loadBranches,
    upsertBranch,
  } = useOrganizationWorkspaceContext();
  const [showBranchForm, setShowBranchForm] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [location, setLocation] = useState('');
  const debouncedSearch = useDebouncedValue(search);

  useEffect(() => {
    if (!organization) return;
    void loadBranches({ refresh: true }).catch(() => undefined);
  }, [organization, loadBranches]);
  const locations = useMemo(
    () =>
      [
        ...new Set(
          branches.flatMap((branch) =>
            'city' in branch ? [`${branch.city}, ${branch.province}`] : [],
          ),
        ),
      ].sort(),
    [branches],
  );
  const visibleBranches = useMemo(() => {
    const query = debouncedSearch.trim().toLowerCase();
    return branches.filter(
      (branch) =>
        (!location ||
          ('city' in branch &&
            `${branch.city}, ${branch.province}` === location)) &&
        (!query ||
          `${branch.name} ${branch.code ?? ''} ${addressFor(branch)}`
            .toLowerCase()
            .includes(query)),
    );
  }, [branches, debouncedSearch, location]);

  if (organizationStatus === 'loading')
    return (
      <OperationalPage>
        <ListSkeleton label="Loading organization" />
      </OperationalPage>
    );
  if (organizationStatus === 'error' || !organization)
    return (
      <OperationalPage>
        <PageHeader
          title="We could not load the organization."
          description="Try again to open this workspace."
        />
        <RequestError
          className="mt-6 rounded-panel border border-hairline bg-surface p-6"
          message={organizationError ?? 'The organization could not be loaded.'}
          onRetry={() => void refreshOrganization()}
        />
      </OperationalPage>
    );

  const canManage = organization.role === 'OWNER';
  const identityOnly = organization.role === 'MERCHANT';
  return (
    <OperationalPage>
      <PageHeader
        title="Branches"
        description={
          identityOnly
            ? 'Read branch identities where you are assigned or your merchant sells products.'
            : 'View the store locations available to your role and branch assignments.'
        }
      />
      {successMessage ? <StatusNotice>{successMessage}</StatusNotice> : null}
      <OperationalPanel
        title="Store locations"
        description={`${visibleBranches.length} matching accessible branches · Open a branch to review its ${identityOnly ? 'identity and own inventory' : 'identity and address'}.`}
        action={
          canManage ? (
            <Button
              className="max-sm:w-full"
              onClick={() => {
                setSuccessMessage(null);
                setShowBranchForm(true);
              }}
            >
              Add branch
            </Button>
          ) : undefined
        }
      >
        {branchesStatus === 'loading' || branchesStatus === 'idle' ? (
          <div className="px-5 pb-5 sm:px-6">
            <ListSkeleton label="Loading branches" />
          </div>
        ) : branchesError ? (
          <RequestError
            className="px-5 py-8 sm:px-6"
            title="Branches unavailable"
            message={branchesError}
            onRetry={() => void loadBranches({ refresh: true })}
          />
        ) : branches.length === 0 ? (
          <div className="px-5 py-12 text-center sm:px-6">
            <Icon name="building" className="mx-auto mb-4 size-6 text-muted" />
            <h3 className="font-semibold text-ink">No branches yet</h3>
            <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-muted">
              {canManage
                ? 'Add the first physical store location for this organization.'
                : 'No branches are available to your access. Ask an owner to configure your branch assignments or merchant link.'}
            </p>
          </div>
        ) : (
          <>
            <OperationalToolbar className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(12rem,0.4fr)]">
              <TextField
                id="branch-search"
                label="Search"
                type="search"
                value={search}
                placeholder={
                  identityOnly ? 'Name or code' : 'Name, code, or address'
                }
                onChange={(event) => setSearch(event.target.value)}
              />
              {!identityOnly ? (
                <FilterField id="branch-location" label="Location">
                  <SelectControl
                    id="branch-location"
                    value={location}
                    onValueChange={setLocation}
                  >
                    <option value="">All locations</option>
                    {locations.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </SelectControl>
                </FilterField>
              ) : null}
            </OperationalToolbar>
            {visibleBranches.length === 0 ? (
              <p className="px-5 py-12 text-center text-sm text-muted sm:px-6">
                No branches match these filters.
              </p>
            ) : (
              <ul
                className="m-0 list-none divide-y divide-hairline p-0"
                aria-label="Branches"
              >
                {visibleBranches.map((branch) => (
                  <li key={branch.id}>
                    <Link
                      className="flex min-h-24 w-full items-start gap-4 px-5 py-5 text-ink no-underline hover:bg-subtle sm:items-center sm:px-6"
                      href={`/app/organizations/${organizationId}/branches/${branch.id}`}
                    >
                      <span className="grid size-11 shrink-0 place-items-center rounded-control border border-hairline bg-subtle text-muted">
                        <Icon name="building" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-2">
                          <strong className="break-words text-sm font-semibold">
                            {branch.name}
                          </strong>
                          {branch.code ? (
                            <span className="rounded-compact border border-hairline bg-subtle px-2 py-0.5 text-xs text-muted">
                              {branch.code}
                            </span>
                          ) : null}
                        </span>
                        <span className="mt-2 block break-words text-sm leading-6 text-muted">
                          {identityOnly
                            ? 'Read-only branch identity'
                            : addressFor(branch)}
                        </span>
                      </span>
                      <Icon
                        name="arrow"
                        className="mt-3 size-4 text-muted sm:mt-0"
                      />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </OperationalPanel>
      {canManage && showBranchForm ? (
        <BranchForm
          organizationId={organizationId}
          branch={null}
          onSaved={(saved) => {
            upsertBranch(saved);
            setSuccessMessage(`${saved.name} was added successfully.`);
            setShowBranchForm(false);
          }}
          onCancel={() => setShowBranchForm(false)}
        />
      ) : null}
    </OperationalPage>
  );
}
