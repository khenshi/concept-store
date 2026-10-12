'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/features/auth/model/auth-context';
import { listBranchDirectory } from '../api/branch-api';
import { useOrganizationWorkspaceContext } from '@/features/organizations/components/organization-workspace-context';
import { BranchForm } from './branch-form';
import { Button, buttonStyles } from '@/shared/components/ui/button';
import { EmptyState } from '@/shared/components/ui/empty-state';
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
import { PaginationControls } from '@/shared/components/ui/pagination-controls';
import { RequestError } from '@/shared/components/ui/request-error';
import { SelectControl } from '@/shared/components/ui/select-control';
import { TextField } from '@/shared/components/ui/text-field';
import { useDebouncedValue } from '@/shared/hooks/use-debounced-value';
import {
  BranchTableSkeleton,
  branchDirectoryGrid,
} from './branch-table-skeleton';
import type {
  BranchDirectoryPage,
  BranchStatus,
  BranchView,
} from '../model/branch.types';

type DirectoryStatus = 'idle' | 'loading' | 'ready' | 'error';

function addressFor(branch: BranchView): string {
  if (!('addressLine1' in branch)) return '';
  return [branch.addressLine1, branch.addressLine2, branch.postalCode]
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
  const { request } = useAuth();
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
  const [statusFilter, setStatusFilter] = useState<BranchStatus | ''>('');
  const [page, setPage] = useState(1);
  const [directory, setDirectory] = useState<BranchDirectoryPage | null>(null);
  const [directoryStatus, setDirectoryStatus] =
    useState<DirectoryStatus>('idle');
  const [directoryError, setDirectoryError] = useState<string | null>(null);
  const directoryGeneration = useRef(0);
  const debouncedSearch = useDebouncedValue(search);
  const identityOnly = organization?.role === 'MERCHANT';

  const loadDirectory = useCallback(
    async (nextPage: number) => {
      const generation = ++directoryGeneration.current;
      setDirectoryStatus('loading');
      setDirectoryError(null);
      try {
        const result = await listBranchDirectory(request, organizationId, {
          search: debouncedSearch.trim() || undefined,
          status: statusFilter || undefined,
          page: nextPage,
        });
        if (generation !== directoryGeneration.current) return;
        setDirectory(result);
        setDirectoryStatus('ready');
      } catch (cause: unknown) {
        if (generation !== directoryGeneration.current) return;
        setDirectory(null);
        setDirectoryError(
          cause instanceof Error
            ? cause.message
            : 'The branches could not be loaded.',
        );
        setDirectoryStatus('error');
      }
    },
    [debouncedSearch, organizationId, request, statusFilter],
  );

  useEffect(() => {
    if (!organization || identityOnly) return;
    const timer = window.setTimeout(() => void loadDirectory(page), 0);
    return () => window.clearTimeout(timer);
  }, [identityOnly, loadDirectory, organization, page]);

  useEffect(() => {
    if (!organization || !identityOnly) return;
    void loadBranches({ refresh: true }).catch(() => undefined);
  }, [identityOnly, loadBranches, organization]);

  const merchantBranches = useMemo(() => {
    const query = debouncedSearch.trim().toLowerCase();
    return branches.filter(
      (branch) =>
        !query ||
        `${branch.name} ${branch.code ?? ''}`.toLowerCase().includes(query),
    );
  }, [branches, debouncedSearch]);

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
          className="mt-8 bg-surface py-6"
          message={organizationError ?? 'The organization could not be loaded.'}
          onRetry={() => void refreshOrganization()}
        />
      </OperationalPage>
    );

  const canManage = organization.role === 'OWNER';
  const canChangeStatus =
    organization.role === 'OWNER' || organization.role === 'MANAGER';

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
      {identityOnly ? (
        <MerchantBranchDirectory
          branches={merchantBranches}
          branchesStatus={branchesStatus}
          branchesError={branchesError}
          search={search}
          hasSearch={Boolean(search)}
          onSearchChange={(value) => {
            setSearch(value);
            setPage(1);
          }}
          onClear={() => setSearch('')}
          onRetry={() => void loadBranches({ refresh: true })}
          organizationId={organizationId}
        />
      ) : (
        <StaffBranchDirectory
          canChangeStatus={canChangeStatus}
          canManage={canManage}
          directory={directory}
          directoryError={directoryError}
          directoryStatus={directoryStatus}
          hasFilters={Boolean(search || statusFilter)}
          onClear={() => {
            setSearch('');
            setStatusFilter('');
            setPage(1);
          }}
          onPageChange={setPage}
          onRetry={() => void loadDirectory(page)}
          onSearchChange={(value) => {
            setSearch(value);
            setPage(1);
          }}
          onStatusChange={(value) => {
            setStatusFilter(value);
            setPage(1);
          }}
          organizationId={organizationId}
          search={search}
          showBranchForm={() => {
            setSuccessMessage(null);
            setShowBranchForm(true);
          }}
          statusFilter={statusFilter}
        />
      )}
      {canManage && showBranchForm ? (
        <BranchForm
          organizationId={organizationId}
          branch={null}
          onSaved={(saved) => {
            upsertBranch(saved);
            setSuccessMessage(`${saved.name} was added successfully.`);
            setShowBranchForm(false);
            setPage(1);
            void loadDirectory(1);
          }}
          onCancel={() => setShowBranchForm(false)}
        />
      ) : null}
    </OperationalPage>
  );
}

function StaffBranchDirectory({
  canChangeStatus,
  canManage,
  directory,
  directoryError,
  directoryStatus,
  hasFilters,
  onClear,
  onPageChange,
  onRetry,
  onSearchChange,
  onStatusChange,
  organizationId,
  search,
  showBranchForm,
  statusFilter,
}: {
  canChangeStatus: boolean;
  canManage: boolean;
  directory: BranchDirectoryPage | null;
  directoryError: string | null;
  directoryStatus: DirectoryStatus;
  hasFilters: boolean;
  onClear: () => void;
  onPageChange: (page: number) => void;
  onRetry: () => void;
  onSearchChange: (value: string) => void;
  onStatusChange: (value: BranchStatus | '') => void;
  organizationId: string;
  search: string;
  showBranchForm: () => void;
  statusFilter: BranchStatus | '';
}) {
  const summary = directory?.summary;
  const totalPages = directory?.totalPages ?? 0;
  const currentPage = directory?.page ?? 1;
  const total = directory?.total ?? 0;
  const start = total === 0 ? 0 : (currentPage - 1) * 10 + 1;
  const end = total === 0 ? 0 : Math.min(currentPage * 10, total);

  return (
    <>
      <BranchSummaryMetrics summary={summary} />
      <OperationalPanel
        variant="open"
        className="branch-directory-surface"
        title="Store locations"
        description="Review accessible branches, their location, and merchant coverage."
        action={
          canManage ? (
            <Button className="max-sm:w-full" onClick={showBranchForm}>
              Add branch
            </Button>
          ) : undefined
        }
      >
        <OperationalToolbar
          variant="open"
          className="branch-directory-toolbar grid items-end gap-4 sm:grid-cols-[minmax(0,1fr)_12rem_auto]"
        >
          <TextField
            id="branch-search"
            label="Search branches"
            type="search"
            value={search}
            placeholder="Name, code, or location"
            className="rounded-full px-4"
            onChange={(event) => onSearchChange(event.target.value)}
          />
          <FilterField id="branch-status" label="Status">
            <SelectControl
              id="branch-status"
              value={statusFilter}
              onValueChange={(value) =>
                onStatusChange(value as BranchStatus | '')
              }
            >
              <option value="">All statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </SelectControl>
          </FilterField>
          <Button
            variant="quiet"
            className="justify-self-start px-3 sm:mb-0.5"
            disabled={!hasFilters}
            onClick={onClear}
          >
            Clear filters
          </Button>
        </OperationalToolbar>
        {directoryStatus === 'loading' || directoryStatus === 'idle' ? (
          <BranchTableSkeleton label="Loading branches" />
        ) : directoryError ? (
          <RequestError
            className="px-5 py-8 sm:px-6"
            title="Branches unavailable"
            message={directoryError}
            onRetry={onRetry}
          />
        ) : directory && directory.items.length === 0 ? (
          <EmptyState
            className="mx-5 my-6 sm:mx-6"
            title={
              hasFilters
                ? 'No branches match these filters.'
                : 'No branches yet'
            }
            description={
              hasFilters
                ? 'Try a different search or clear the filters to see every accessible branch.'
                : canManage
                  ? 'Add the first physical store location for this organization.'
                  : 'No branches are available to your access.'
            }
            action={
              hasFilters ? (
                <Button variant="secondary" onClick={onClear}>
                  Clear filters
                </Button>
              ) : undefined
            }
          />
        ) : directory ? (
          <>
            <div className="overflow-x-auto">
              <ul
                aria-label="Accessible branches"
                className="m-0 list-none p-0"
              >
                <li
                  className={`data-column-header hidden gap-x-6 gap-y-3 lg:grid ${branchDirectoryGrid}`}
                >
                  <span>Branch</span>
                  <span>Location</span>
                  <span>Active merchants</span>
                  <span>Status</span>
                  <span>Actions</span>
                </li>
                {directory.items.map((branch) => (
                  <li
                    className={`data-row grid min-w-0 gap-x-6 gap-y-3 px-3 py-5 sm:px-4 lg:items-center ${branchDirectoryGrid}`}
                    key={branch.id}
                  >
                    <div className="min-w-0 break-words">
                      <strong className="block text-sm font-semibold text-ink">
                        {branch.name}
                      </strong>
                      <span className="mt-1 block text-xs text-muted">
                        {branch.code ?? 'No branch code'}
                      </span>
                    </div>
                    <div className="min-w-0 break-words">
                      <span className="block text-sm text-ink">
                        {branch.city}
                      </span>
                      <span className="mt-1 block text-xs text-muted">
                        {addressFor(branch) || 'No address'}
                      </span>
                    </div>
                    <span className="text-sm tabular-nums text-ink">
                      {branch.merchantCount}
                    </span>
                    <div>
                      <StatusBadge status={branch.status} />
                    </div>
                    <div
                      className="flex flex-wrap gap-x-3 gap-y-2 md:flex-nowrap md:whitespace-nowrap lg:justify-end"
                      aria-label={`${branch.name} actions`}
                    >
                      <Link
                        className={buttonStyles({
                          variant: 'quiet',
                          className: 'min-h-9 px-2 py-1 text-xs',
                        })}
                        href={`/app/organizations/${organizationId}/branches/${branch.id}`}
                      >
                        View
                        <Icon name="arrow" className="size-4" />
                        <span className="sr-only"> {branch.name}</span>
                      </Link>
                      {!canChangeStatus ? (
                        <span className="sr-only">Status is read-only.</span>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
            <PaginationControls
              ariaLabel="Branches pagination"
              currentPage={currentPage}
              totalPages={totalPages}
              hasNext={directory.hasNext}
              summary={`Showing ${start}–${end} of ${total}`}
              onPrevious={() => onPageChange(currentPage - 1)}
              onNext={() => onPageChange(currentPage + 1)}
            />
          </>
        ) : null}
      </OperationalPanel>
    </>
  );
}

function MerchantBranchDirectory({
  branches,
  branchesStatus,
  branchesError,
  hasSearch,
  onClear,
  onRetry,
  onSearchChange,
  organizationId,
  search,
}: {
  branches: BranchView[];
  branchesStatus: 'idle' | 'loading' | 'ready' | 'error';
  branchesError: string | null;
  hasSearch: boolean;
  onClear: () => void;
  onRetry: () => void;
  onSearchChange: (value: string) => void;
  organizationId: string;
  search: string;
}) {
  return (
    <OperationalPanel
      variant="card"
      className="data-surface mt-7"
      title="Store locations"
      description="Open a branch to review its identity and your own inventory."
    >
      <OperationalToolbar
        variant="card"
        className="grid items-end gap-4 sm:grid-cols-[minmax(0,1fr)_auto]"
      >
        <TextField
          id="branch-search"
          label="Search branches"
          type="search"
          value={search}
          placeholder="Name or code"
          className="rounded-full px-4"
          onChange={(event) => onSearchChange(event.target.value)}
        />
        <Button
          variant="quiet"
          className="justify-self-start px-3 sm:mb-0.5"
          disabled={!hasSearch}
          onClick={onClear}
        >
          Clear filters
        </Button>
      </OperationalToolbar>
      {branchesStatus === 'loading' || branchesStatus === 'idle' ? (
        <div className="px-5 py-8 sm:px-6">
          <ListSkeleton label="Loading branches" />
        </div>
      ) : branchesError ? (
        <RequestError
          className="px-5 py-8 sm:px-6"
          title="Branches unavailable"
          message={branchesError}
          onRetry={onRetry}
        />
      ) : branches.length === 0 ? (
        <EmptyState
          className="mx-5 my-6 sm:mx-6"
          title={
            hasSearch
              ? 'No branches match this search.'
              : 'No branches are available to your access.'
          }
        />
      ) : (
        <ul className="m-0 list-none p-0" aria-label="Branches">
          {branches.map((branch) => (
            <li className="data-row" key={branch.id}>
              <Link
                className="flex min-h-20 w-full items-center gap-4 px-4 py-4 text-ink no-underline hover:bg-subtle sm:px-6"
                href={`/app/organizations/${organizationId}/branches/${branch.id}`}
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-control border border-hairline bg-subtle text-muted">
                  <Icon name="building" />
                </span>
                <span className="min-w-0 flex-1">
                  <strong className="block break-words text-sm font-semibold">
                    {branch.name}
                  </strong>
                  <span className="mt-1 block break-words text-xs text-muted">
                    {branch.code ?? 'No branch code'}
                  </span>
                </span>
                <Icon name="arrow" className="size-4 text-muted" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </OperationalPanel>
  );
}

function BranchSummaryMetrics({
  summary,
}: {
  summary: BranchDirectoryPage['summary'] | undefined;
}) {
  const metrics = [
    ['Total branches', summary?.total],
    ['Active branches', summary?.active],
    ['Inactive branches', summary?.inactive],
  ] as const;
  return (
    <dl
      className="mt-7 grid grid-cols-3 divide-x divide-hairline border-y border-hairline bg-surface"
      aria-label="Branch summary"
    >
      {metrics.map(([label, value]) => (
        <div className="min-w-0 px-3 py-3 sm:px-5 sm:py-4" key={label}>
          <dt className="text-xs font-medium text-muted">{label}</dt>
          <dd className="mt-1 text-xl font-semibold tabular-nums text-ink">
            {value ?? '—'}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function StatusBadge({ status }: { status: BranchStatus }) {
  const active = status === 'ACTIVE';
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-compact border px-2.5 py-1 text-xs font-semibold ${active ? 'border-success/30 bg-success/5 text-success-ink' : 'border-hairline bg-subtle text-muted'}`}
    >
      <span
        aria-hidden="true"
        className={`size-1.5 rounded-full ${active ? 'bg-success' : 'bg-muted'}`}
      />
      {active ? 'Active' : 'Inactive'}
    </span>
  );
}
