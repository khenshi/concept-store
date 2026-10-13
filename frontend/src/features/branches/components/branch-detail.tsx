'use client';
import { SpaceManagement } from '@/features/spaces/components/space-management';
import { MerchantBranchManagement } from '@/features/merchant-branches/components/merchant-branch-management';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { BackLink } from '@/shared/components/ui/back-link';
import { Button, buttonStyles } from '@/shared/components/ui/button';
import { useConfirmationDialog } from '@/shared/components/ui/confirmation-dialog';
import { ListSkeleton } from '@/shared/components/ui/list-skeleton';
import { Notice } from '@/shared/components/ui/notice';
import { OperationalPanel } from '@/shared/components/ui/operational-page';
import { PageHeader } from '@/shared/components/ui/page-header';
import { RequestError } from '@/shared/components/ui/request-error';
import { useAuth } from '@/features/auth/model/auth-context';
import { OrganizationPageFrame } from '@/features/organizations/components/organization-page-frame';
import { useOrganizationWorkspaceContext } from '@/features/organizations/components/organization-workspace-context';
import { getBranch, updateBranchStatus } from '../api/branch-api';
import { BranchForm } from './branch-form';
import type { BranchStatus, BranchView } from '../model/branch.types';
import { getInventoryHealthSummary } from '@/features/inventory/api/inventory-api';
import type { InventoryHealthSummary } from '@/features/inventory/model/inventory.types';

function addressFor(branch: BranchView): string {
  if (!('addressLine1' in branch))
    return 'Read-only branch identity. Your merchant’s inventory and assigned spaces are available.';
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

type BranchDetailTab =
  'overview' | 'inventory' | 'pos' | 'sales' | 'participation' | 'spaces';

const branchDetailTabs: { value: BranchDetailTab; label: string }[] = [
  { value: 'overview', label: 'Overview' },
  { value: 'inventory', label: 'Inventory' },
  { value: 'pos', label: 'POS' },
  { value: 'sales', label: 'Sales' },
  { value: 'participation', label: 'Participation' },
  { value: 'spaces', label: 'Spaces' },
];

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
  const { confirm, confirmationDialog } = useConfirmationDialog();
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
  const [statusError, setStatusError] = useState<string | null>(null);
  const [statusPending, setStatusPending] = useState(false);
  const [inventoryHealth, setInventoryHealth] =
    useState<InventoryHealthSummary | null>(null);
  const [inventoryHealthError, setInventoryHealthError] = useState(false);
  const [spaceRevision, setSpaceRevision] = useState(0);
  const [activeTab, setActiveTab] = useState<BranchDetailTab>('overview');
  const [revision, setRevision] = useState(0);
  const readGeneration = useRef(0);
  const canViewInventory =
    organization?.role === 'OWNER' ||
    organization?.role === 'MANAGER' ||
    organization?.role === 'MERCHANT';

  const load = useCallback(() => setRevision((value) => value + 1), []);

  useEffect(() => {
    let active = true;
    const generation = ++readGeneration.current;
    if (!organization) return;
    void Promise.resolve()
      .then(() => {
        if (!active) return;
        setBranch(null);
        setInventoryHealth(null);
        setInventoryHealthError(false);
        setError(null);
        setStatusError(null);
        if (canViewInventory)
          void getInventoryHealthSummary(request, {
            organizationId,
            branchId,
          })
            .then((value) => {
              if (active && generation === readGeneration.current)
                setInventoryHealth(value);
            })
            .catch(() => {
              if (active && generation === readGeneration.current)
                setInventoryHealthError(true);
            });
        return getBranch(request, organizationId, branchId, organization.role);
      })
      .then((result) => {
        if (!active || generation !== readGeneration.current || !result) return;
        setBranch(result);
      })
      .catch(() => {
        if (active && generation === readGeneration.current)
          setError('The branch details could not be loaded.');
      });
    return () => {
      active = false;
    };
  }, [
    branchId,
    canViewInventory,
    organization,
    organizationId,
    request,
    revision,
  ]);

  if (!organization)
    return (
      <OrganizationPageFrame wide>
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
      </OrganizationPageFrame>
    );
  if (!branch)
    return (
      <OrganizationPageFrame wide>
        <BackLink href={`/app/organizations/${organizationId}/branches`}>
          Back to branches
        </BackLink>
        {error ? (
          <RequestError
            className="mt-8 bg-surface py-6"
            message={error}
            onRetry={load}
          />
        ) : (
          <ListSkeleton
            className="mt-6"
            label="Loading branch details"
            rows={5}
          />
        )}
      </OrganizationPageFrame>
    );

  const canManage =
    organization.role === 'OWNER' || organization.role === 'MANAGER';
  const canChangeStatus = canManage && 'status' in branch;
  const availableTabs = branchDetailTabs.filter(({ value }) => {
    if (value === 'inventory') return canViewInventory;
    if (value === 'pos') return organization.role !== 'MERCHANT';
    if (value === 'participation' || value === 'spaces')
      return canManage || organization.role === 'MERCHANT';
    return true;
  });

  async function changeStatus() {
    if (!canChangeStatus || !('status' in branch) || statusPending) return;
    const nextStatus: BranchStatus =
      branch.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    setStatusPending(true);
    setStatusError(null);
    try {
      const accepted = await confirm({
        title: `Mark ${branch.name} ${nextStatus === 'ACTIVE' ? 'active' : 'inactive'}?`,
        description: `This will change the branch status from ${branch.status === 'ACTIVE' ? 'Active' : 'Inactive'} to ${nextStatus === 'ACTIVE' ? 'Active' : 'Inactive'}.`,
        confirmLabel: `Mark ${nextStatus === 'ACTIVE' ? 'active' : 'inactive'}`,
        tone: nextStatus === 'INACTIVE' ? 'danger' : 'primary',
      });
      if (!accepted) return;
      const saved = await updateBranchStatus(
        request,
        organizationId,
        branchId,
        nextStatus,
      );
      setBranch(saved);
      upsertBranch(saved);
      setSuccess(
        `${saved.name} is now ${saved.status === 'ACTIVE' ? 'active' : 'inactive'}.`,
      );
    } catch {
      setStatusError('The branch status could not be changed. Try again.');
    } finally {
      setStatusPending(false);
    }
  }
  return (
    <OrganizationPageFrame wide>
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
            <div className="flex flex-wrap items-center gap-3 max-sm:w-full">
              {'status' in branch ? (
                <StatusBadge status={branch.status} />
              ) : null}
              {canChangeStatus ? (
                <Button
                  className="max-sm:flex-1"
                  variant="secondary"
                  pending={statusPending}
                  pendingLabel="Saving status…"
                  onClick={() => void changeStatus()}
                >
                  {branch.status === 'ACTIVE' ? 'Mark inactive' : 'Mark active'}
                </Button>
              ) : null}
              <Button
                className="max-sm:flex-1"
                onClick={() => {
                  setSuccess(null);
                  setEditing(true);
                }}
              >
                Edit branch
              </Button>
            </div>
          ) : 'status' in branch ? (
            <StatusBadge status={branch.status} />
          ) : undefined
        }
      />
      <nav
        aria-label="Branch detail views"
        className="sticky top-17 z-20 -mx-4 mt-4 overflow-x-auto border-b border-hairline bg-canvas px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 xl:-mx-10 xl:px-10"
      >
        <div
          className="flex min-w-max gap-1"
          role="tablist"
          aria-label="Branch detail views"
        >
          {availableTabs.map((tab, index) => (
            <button
              key={tab.value}
              id={`branch-detail-tab-${tab.value}`}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.value}
              aria-controls={`branch-detail-panel-${tab.value}`}
              tabIndex={activeTab === tab.value ? 0 : -1}
              className={`min-h-11 shrink-0 rounded-none border-b-2 px-3 text-sm font-semibold transition-colors ${
                activeTab === tab.value
                  ? 'border-ink text-ink'
                  : 'border-transparent text-muted hover:text-ink'
              }`}
              onClick={() => setActiveTab(tab.value)}
              onKeyDown={(event) => {
                if (
                  !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(
                    event.key,
                  )
                )
                  return;
                event.preventDefault();
                const nextIndex =
                  event.key === 'Home'
                    ? 0
                    : event.key === 'End'
                      ? availableTabs.length - 1
                      : (index +
                          (event.key === 'ArrowRight' ? 1 : -1) +
                          availableTabs.length) %
                        availableTabs.length;
                const nextTab = availableTabs[nextIndex];
                const nextButton =
                  event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>(
                    '[role="tab"]',
                  )[nextIndex];
                if (nextTab && nextButton) {
                  setActiveTab(nextTab.value);
                  nextButton.focus();
                }
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </nav>
      {statusError ? (
        <div className="mt-6">
          <Notice tone="error">{statusError}</Notice>
        </div>
      ) : null}
      {success ? (
        <div className="mt-6">
          <Notice>{success}</Notice>
        </div>
      ) : null}
      {activeTab === 'overview' ? (
        <div
          id="branch-detail-panel-overview"
          role="tabpanel"
          aria-labelledby="branch-detail-tab-overview"
          className="mt-6"
        >
          <OperationalPanel className="mt-0" title="Branch information">
            <dl className="grid gap-6 px-5 py-5 sm:grid-cols-2 sm:px-6 sm:py-6">
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
                    <dd className="mt-2 text-sm text-ink">
                      {branch.countryCode}
                    </dd>
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
        </div>
      ) : null}
      {activeTab === 'inventory' && canViewInventory ? (
        <div
          id="branch-detail-panel-inventory"
          role="tabpanel"
          aria-labelledby="branch-detail-tab-inventory"
          className="mt-6"
        >
          <OperationalPanel
            className="mt-0"
            title="Branch inventory"
            description={
              canManage
                ? 'Maintain this branch’s independent product prices, stock, and movement history.'
                : 'Read only your merchant’s placements, prices, quantities, and movement history.'
            }
          >
            <div className="flex min-h-56 flex-col gap-5 py-6">
              {inventoryHealthError ? (
                <RequestError
                  message="Inventory health could not be loaded."
                  onRetry={load}
                />
              ) : inventoryHealth ? (
                <dl
                  className="grid grid-cols-3 gap-3"
                  aria-label={
                    organization.role === 'MERCHANT'
                      ? 'Your inventory health'
                      : 'Branch inventory health'
                  }
                >
                  <InventoryHealthCount
                    label="In stock"
                    count={inventoryHealth.inStock}
                    href={`/app/organizations/${organizationId}/branches/${branchId}/inventory?stockStatus=IN_STOCK`}
                    tone="success"
                  />
                  <InventoryHealthCount
                    label="Low stock"
                    count={inventoryHealth.lowStock}
                    href={`/app/organizations/${organizationId}/branches/${branchId}/inventory?stockStatus=LOW_STOCK`}
                    tone="warning"
                  />
                  <InventoryHealthCount
                    label="Out of stock"
                    count={inventoryHealth.outOfStock}
                    href={`/app/organizations/${organizationId}/branches/${branchId}/inventory?stockStatus=OUT_OF_STOCK`}
                    tone="danger"
                  />
                </dl>
              ) : (
                <ListSkeleton label="Loading inventory health" rows={1} />
              )}
              <p className="text-xs text-muted">
                {organization.role === 'MERCHANT'
                  ? 'Counts include only your merchant’s placements in this branch.'
                  : 'Counts reflect all placements visible in this branch.'}
              </p>
              <Link
                className={buttonStyles({
                  variant: 'secondary',
                  className: 'mt-auto w-fit',
                })}
                href={`/app/organizations/${organizationId}/branches/${branchId}/inventory`}
              >
                {canManage ? 'Manage inventory' : 'View own inventory'}
              </Link>
            </div>
          </OperationalPanel>
        </div>
      ) : null}
      {activeTab === 'pos' && organization.role !== 'MERCHANT' ? (
        <div
          id="branch-detail-panel-pos"
          role="tabpanel"
          aria-labelledby="branch-detail-tab-pos"
          className="mt-6"
        >
          <OperationalPanel
            className="mt-0"
            title="Point of sale"
            description="Build a branch cart using SKU/barcode input or product search, then record cash or manual GCash/card payment."
          >
            <div className="flex min-h-56 flex-col py-6">
              <Link
                className={buttonStyles({
                  variant: 'primary',
                  className: 'mt-auto w-fit',
                })}
                href={`/app/organizations/${organizationId}/branches/${branchId}/pos`}
              >
                Open POS cart
              </Link>
            </div>
          </OperationalPanel>
        </div>
      ) : null}
      {activeTab === 'sales' ? (
        <div
          id="branch-detail-panel-sales"
          role="tabpanel"
          aria-labelledby="branch-detail-tab-sales"
          className="mt-6"
        >
          <OperationalPanel
            className="mt-0"
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
            <div className="flex min-h-56 flex-col py-6">
              <Link
                className={buttonStyles({
                  variant: 'secondary',
                  className: 'mt-auto w-fit',
                })}
                href={`/app/organizations/${organizationId}/branches/${branchId}/sales`}
              >
                {organization.role === 'MERCHANT'
                  ? 'View own sales'
                  : 'View sales history'}
              </Link>
            </div>
          </OperationalPanel>
        </div>
      ) : null}
      {activeTab === 'participation' &&
      (canManage || organization.role === 'MERCHANT') ? (
        <div
          id="branch-detail-panel-participation"
          role="tabpanel"
          aria-labelledby="branch-detail-tab-participation"
          className="mt-6"
        >
          <MerchantBranchManagement
            organizationId={organizationId}
            kind="branch"
            id={branchId}
            onChanged={() => setSpaceRevision((value) => value + 1)}
          />
        </div>
      ) : null}
      {activeTab === 'spaces' &&
      (canManage || organization.role === 'MERCHANT') ? (
        <div
          id="branch-detail-panel-spaces"
          role="tabpanel"
          aria-labelledby="branch-detail-tab-spaces"
          className="mt-6"
        >
          <SpaceManagement
            organizationId={organizationId}
            kind="branch"
            id={branchId}
            revision={spaceRevision}
          />
        </div>
      ) : null}
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
      {confirmationDialog}
    </OrganizationPageFrame>
  );
}

function InventoryHealthCount({
  label,
  count,
  href,
  tone,
}: {
  label: string;
  count: number;
  href: string;
  tone: 'success' | 'warning' | 'danger';
}) {
  const toneClass = {
    success: 'border-success/20 bg-success/5 text-success',
    warning: 'border-warning/20 bg-warning/5 text-warning',
    danger: 'border-danger/20 bg-danger/5 text-danger',
  }[tone];
  return (
    <div className={`min-w-0 rounded-control border p-3 ${toneClass}`}>
      <dt className="break-words text-xs font-medium">{label}</dt>
      <dd className="mt-1 text-xl font-semibold tabular-nums">
        <Link
          className="text-inherit"
          href={href}
          aria-label={`${label}: ${count}`}
        >
          {count.toLocaleString()}
        </Link>
      </dd>
    </div>
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
