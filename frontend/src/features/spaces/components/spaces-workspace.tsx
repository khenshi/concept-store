'use client';

import { useCallback, useRef, useState } from 'react';
import { useAuth } from '@/features/auth/model/auth-context';
import { useOrganizationWorkspaceContext } from '@/features/organizations/components/organization-workspace-context';
import { OperationalPage } from '@/shared/components/ui/operational-page';
import { PageHeader } from '@/shared/components/ui/page-header';
import { ListSkeleton } from '@/shared/components/ui/list-skeleton';
import { RequestError } from '@/shared/components/ui/request-error';
import { SpacesBranchSelector } from './spaces-branch-selector';
import { SpaceTypesPanel } from './space-types-panel';
import { SpaceManagement } from './space-management';
import { SpaceContentSkeleton } from './space-content-skeleton';

export function SpacesWorkspace(props: {
  organizationId: string;
  branchId?: string;
}) {
  const { user } = useAuth();
  const {
    organization,
    organizationStatus,
    organizationError,
    refreshOrganization,
  } = useOrganizationWorkspaceContext();
  if (!organization || organization.id !== props.organizationId)
    return (
      <OperationalPage>
        {organizationStatus === 'error' ? (
          <RequestError
            message={organizationError ?? 'Spaces access could not be loaded.'}
            onRetry={() => void refreshOrganization()}
          />
        ) : (
          <ListSkeleton label="Loading spaces access" />
        )}
      </OperationalPage>
    );
  if (organization.role === 'CASHIER')
    return (
      <OperationalPage>
        <p role="alert">Your organization role cannot view or manage spaces.</p>
      </OperationalPage>
    );
  return (
    <ScopedSpacesWorkspace
      key={`${props.organizationId}:${props.branchId}:${organization.role}:${user?.id}`}
      {...props}
    />
  );
}

function ScopedSpacesWorkspace({
  organizationId,
  branchId,
}: {
  organizationId: string;
  branchId?: string;
}) {
  const { organization, selectedBranchId, setSelectedBranchId } =
    useOrganizationWorkspaceContext();
  const [branchName, setBranchName] = useState<string | null>(null);
  const [branchLoading, setBranchLoading] = useState(Boolean(branchId));
  const [denied, setDenied] = useState(false);
  const [tab, setTab] = useState<'spaces' | 'types'>('spaces');
  const [blocked, setBlocked] = useState(false);
  const guard = useRef<() => boolean>(() => true);
  const registerGuard = useCallback((next: () => boolean) => {
    guard.current = next;
  }, []);
  const accessDenied = useCallback(() => {
    setDenied(true);
    setBranchName(null);
  }, []);
  const ready = useCallback((name: string) => {
    setDenied(false);
    setBranchName(name);
  }, []);
  if (!organization) return null;
  function changeTab(next: 'spaces' | 'types') {
    if (next === tab) return true;
    if (blocked || !guard.current()) return false;
    guard.current = () => true;
    setTab(next);
    return true;
  }
  return (
    <OperationalPage>
      <PageHeader
        className="pb-4"
        title="Spaces"
        description={
          tab === 'types'
            ? `${organization.role === 'OWNER' ? 'Manage' : 'View'} space types shared across all branches.`
            : organization.role === 'MERCHANT'
              ? 'View only your own space assignments and occupancy history.'
              : branchName
                ? `${organization.role === 'OWNER' ? 'Manage' : 'View'} physical spaces and occupancy in ${branchName}.`
                : 'Choose a branch to view its spaces and occupancy.'
        }
        action={
          tab === 'spaces' ? (
            <SpacesBranchSelector
              organizationId={organizationId}
              branchId={branchId}
              role={organization.role}
              preferredBranchId={selectedBranchId}
              rememberBranch={setSelectedBranchId}
              onReady={ready}
              onAccessDenied={accessDenied}
              onLoadingChange={setBranchLoading}
              beforeChange={() => guard.current()}
              disabled={blocked}
              compact
            />
          ) : undefined
        }
      />
      {organization.role !== 'MERCHANT' && (
        <div
          role="tablist"
          aria-label="Spaces workspace"
          className="mt-1 flex flex-wrap items-center gap-1 border-b border-hairline"
        >
          {(['spaces', 'types'] as const).map((value) => (
            <button
              key={value}
              id={`spaces-tab-${value}`}
              type="button"
              role="tab"
              aria-selected={tab === value}
              aria-controls={`spaces-panel-${value}`}
              tabIndex={tab === value ? 0 : -1}
              disabled={blocked}
              className={`min-h-11 rounded-none border-b-2 px-3 text-sm font-semibold transition-colors ${
                tab === value
                  ? 'border-ink text-ink'
                  : 'border-transparent text-muted hover:text-ink'
              }`}
              onClick={() => {
                changeTab(value);
              }}
              onKeyDown={(event) => {
                if (
                  !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(
                    event.key,
                  )
                )
                  return;
                event.preventDefault();
                const next =
                  event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>(
                    '[role="tab"]',
                  )[
                    event.key === 'Home'
                      ? 0
                      : event.key === 'End'
                        ? 1
                        : value === 'spaces'
                          ? 1
                          : 0
                  ];
                if (
                  next &&
                  !next.disabled &&
                  changeTab(next.id === 'spaces-tab-types' ? 'types' : 'spaces')
                )
                  next.focus();
              }}
            >
              {value === 'spaces' ? 'Spaces' : 'Types'}
            </button>
          ))}
        </div>
      )}
      <div
        role={organization.role === 'MERCHANT' ? undefined : 'tabpanel'}
        id={`spaces-panel-${tab}`}
        aria-labelledby={
          organization.role === 'MERCHANT' ? undefined : `spaces-tab-${tab}`
        }
      >
        {tab === 'types' ? (
          <SpaceTypesPanel
            organizationId={organizationId}
            onPendingChange={setBlocked}
            onNavigationGuard={registerGuard}
          />
        ) : denied ? (
          <p role="alert">
            This branch is unavailable. Choose an accessible branch.
          </p>
        ) : branchId && branchLoading && !branchName ? (
          <SpaceContentSkeleton
            kind="branch"
            owner={organization.role === 'OWNER'}
            own={organization.role === 'MERCHANT'}
          />
        ) : branchId && branchName ? (
          <SpaceManagement
            organizationId={organizationId}
            kind="branch"
            id={branchId}
            onInteractionChange={setBlocked}
            onNavigationGuard={registerGuard}
          />
        ) : null}
      </div>
    </OperationalPage>
  );
}
