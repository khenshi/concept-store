'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/features/auth/model/auth-context';
import { useOrganizationWorkspaceContext } from '@/features/organizations/components/organization-workspace-context';
import { buttonStyles } from '@/shared/components/ui/button';
import { BackLink } from '@/shared/components/ui/back-link';
import { EmptyState } from '@/shared/components/ui/empty-state';
import { ListSkeleton } from '@/shared/components/ui/list-skeleton';
import {
  OperationalCollection,
  OperationalPanel,
  StatusNotice,
} from '@/shared/components/ui/operational-page';
import { OperationalTableFrame } from '@/shared/components/ui/operational-table';
import { OrganizationPageFrame } from '@/features/organizations/components/organization-page-frame';
import { PageHeader } from '@/shared/components/ui/page-header';
import { PaginationControls } from '@/shared/components/ui/pagination-controls';
import { RequestError } from '@/shared/components/ui/request-error';
import { useConfirmationDialog } from '@/shared/components/ui/confirmation-dialog';
import { TextField } from '@/shared/components/ui/text-field';
import { SpacesBranchSelector } from './spaces-branch-selector';
import { AssignmentForm, ReleaseForm, SpaceForm } from './space-forms';
import { getSpace, listOccupancies, setSpaceStatus } from '../api/space-api';
import type { AssociationScope } from '@/features/merchant-branches/api/merchant-branch-api';
import {
  releaseLabels,
  type Occupancy,
  type OccupancyPage,
  type Space,
  type SpaceListItem,
} from '../model/space.schemas';

const quiet = buttonStyles({ variant: 'quiet' });
const archiveAction = buttonStyles({
  variant: 'quiet',
  className: 'text-danger hover:text-danger',
});
const historyGrid =
  'grid min-w-0 grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-[minmax(0,1.2fr)_minmax(10rem,0.8fr)_minmax(10rem,0.8fr)_minmax(12rem,0.9fr)]';

function date(value: string) {
  return new Date(value).toLocaleString(undefined, {
    dateStyle: 'medium',
  });
}

function historyDateBoundary(value: string, end = false) {
  const result = new Date(`${value}T00:00:00.000Z`);
  if (end) result.setUTCDate(result.getUTCDate() + 1);
  return result.toISOString();
}

function statusBadge(status: Space['status']) {
  return (
    <span
      className={`inline-flex w-fit rounded-full border px-2.5 py-1 text-xs font-semibold ${status === 'ACTIVE' ? 'border-success/20 bg-success/5 text-success-ink' : 'border-danger/20 bg-danger/5 text-danger'}`}
    >
      {status === 'ACTIVE' ? 'Active' : 'Archived'}
    </span>
  );
}

function SpaceDetailSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading space detail"
      className="mt-7 grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(18rem,0.65fr)]"
    >
      <div className="grid gap-6">
        <div className="h-52 animate-pulse rounded-panel bg-selected" />
        <div className="h-80 animate-pulse rounded-panel bg-selected" />
      </div>
      <div className="h-72 animate-pulse rounded-panel bg-selected" />
    </div>
  );
}

function HistoryList({ data }: { data: OccupancyPage }) {
  if (!data.items.length) return null;

  return (
    <div>
      <div className={`data-column-header ${historyGrid}`} role="row">
        <span>Merchant</span>
        <span>From date</span>
        <span>Until date</span>
        <span>Released by</span>
      </div>
      <ol className="m-0 list-none p-0">
        {data.items.map((row) => (
          <li
            key={row.id}
            className={`data-row ${historyGrid} px-4 py-4 sm:items-center`}
          >
            <div className="min-w-0 break-words sm:justify-self-start">
              <p className="font-semibold">{row.merchant.name}</p>
              {row.merchant.code ? (
                <p className="mt-1 text-sm text-muted">{row.merchant.code}</p>
              ) : null}
            </div>
            <div className="text-sm sm:justify-self-start">
              <p>{date(row.startedAt)}</p>
            </div>
            <div className="text-sm sm:justify-self-start">
              <p>{row.endedAt ? date(row.endedAt) : '—'}</p>
            </div>
            <div className="text-sm sm:justify-self-start">
              <p>{row.releasedBy?.name ?? '—'}</p>
              <p className="mt-1 text-muted">
                {row.releaseReason
                  ? releaseLabels[row.releaseReason]
                  : 'Not released'}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function SpaceDetail({
  organizationId,
  branchId,
  spaceId,
}: {
  organizationId: string;
  branchId: string;
  spaceId: string;
}) {
  const { user } = useAuth();
  const { organization } = useOrganizationWorkspaceContext();
  return (
    <ScopedSpaceDetail
      key={`${organizationId}:${branchId}:${spaceId}:${organization?.role}:${user?.id}`}
      organizationId={organizationId}
      branchId={branchId}
      spaceId={spaceId}
    />
  );
}

function ScopedSpaceDetail({
  organizationId,
  branchId,
  spaceId,
}: {
  organizationId: string;
  branchId: string;
  spaceId: string;
}) {
  const { request } = useAuth();
  const { organization, organizationStatus, setSelectedBranchId } =
    useOrganizationWorkspaceContext();
  const owner = organization?.role === 'OWNER';
  const allowed = ['OWNER', 'MANAGER', 'MERCHANT'].includes(
    organization?.role ?? '',
  );
  const [space, setSpace] = useState<Space | null>(null);
  const [current, setCurrent] = useState<Occupancy | null>(null);
  const [history, setHistory] = useState<OccupancyPage | null>(null);
  const [branchName, setBranchName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const [historyPage, setHistoryPage] = useState(1);
  const [historySearch, setHistorySearch] = useState('');
  const [historyFrom, setHistoryFrom] = useState('');
  const [historyUntil, setHistoryUntil] = useState('');
  const [pending, setPending] = useState(false);
  const [edit, setEdit] = useState(false);
  const [assign, setAssign] = useState(false);
  const [release, setRelease] = useState<Occupancy | null>(null);
  const [formState, setFormState] = useState({ dirty: false, pending: false });
  const generation = useRef(0);
  const hasLoaded = useRef(false);
  const lock = useRef(false);
  const { confirm, confirmationDialog } = useConfirmationDialog();

  const reload = useCallback(() => setRevision((value) => value + 1), []);
  const accessLost = useCallback(() => {
    generation.current++;
    setSpace(null);
    setCurrent(null);
    setHistory(null);
    hasLoaded.current = false;
    setError(
      'This space is unavailable. Choose another accessible branch or return to Spaces.',
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!allowed) return;
    const read = ++generation.current;
    let active = true;
    void Promise.resolve()
      .then(() => {
        if (!active || read !== generation.current) return null;
        setLoading(!hasLoaded.current);
        setError(null);
        return Promise.all([
          getSpace(request, organizationId, branchId, spaceId),
          listOccupancies(
            request,
            organizationId,
            { kind: 'space', id: spaceId, branchId },
            { view: 'CURRENT' },
          ),
          listOccupancies(
            request,
            organizationId,
            { kind: 'space', id: spaceId, branchId },
            {
              page: historyPage,
              view: 'HISTORY',
              q: historySearch.trim() || undefined,
              dateFrom: historyFrom
                ? historyDateBoundary(historyFrom)
                : undefined,
              dateTo: historyUntil
                ? historyDateBoundary(historyUntil, true)
                : undefined,
            },
          ),
        ]);
      })
      .then((result) => {
        if (!result) return;
        const [row, currentPage, historyPageData] = result;
        if (!active || read !== generation.current) return;
        setSpace(row);
        setCurrent(currentPage.items[0] ?? null);
        setHistory(historyPageData);
        hasLoaded.current = true;
      })
      .catch((cause) => {
        if (active && read === generation.current)
          setError(
            cause instanceof Error
              ? cause.message
              : 'The space detail could not be loaded.',
          );
      })
      .finally(() => {
        if (active && read === generation.current) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [
    allowed,
    branchId,
    historyFrom,
    historyPage,
    historySearch,
    historyUntil,
    organizationId,
    request,
    revision,
    spaceId,
  ]);

  const closeForms = () => {
    setEdit(false);
    setAssign(false);
    setRelease(null);
  };
  const saved = (text: string) => {
    closeForms();
    setSuccess(text);
    setHistoryPage(1);
    reload();
  };
  async function changeStatus() {
    if (!owner || !space || lock.current) return;
    if (space.status === 'ACTIVE' && current) return;
    const next = space.status === 'ACTIVE' ? 'ARCHIVED' : 'ACTIVE';
    if (
      !(await confirm({
        title:
          next === 'ARCHIVED'
            ? `Archive ${space.name}?`
            : `Reactivate ${space.name}?`,
        description:
          next === 'ARCHIVED'
            ? 'The space must be free. Its occupancy history will remain available.'
            : 'The space will be available for new assignments.',
        confirmLabel:
          next === 'ARCHIVED' ? 'Archive space' : 'Reactivate space',
      }))
    )
      return;
    lock.current = true;
    setPending(true);
    setError(null);
    try {
      await setSpaceStatus(request, organizationId, branchId, space.id, next);
      saved(next === 'ARCHIVED' ? 'Space archived.' : 'Space reactivated.');
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Space status could not be updated.',
      );
    } finally {
      lock.current = false;
      setPending(false);
    }
  }

  if (organizationStatus === 'loading')
    return (
      <OrganizationPageFrame wide>
        <ListSkeleton label="Loading space" />
      </OrganizationPageFrame>
    );
  if (!allowed)
    return (
      <OrganizationPageFrame wide>
        <p role="alert" className="mt-8">
          Your organization role cannot view this space.
        </p>
      </OrganizationPageFrame>
    );

  const back = (
    <BackLink
      className="min-h-9 min-w-0 px-3 py-1 text-xs"
      href={`/app/organizations/${organizationId}/branches/${branchId}/spaces`}
    >
      Back to spaces
    </BackLink>
  );
  const formOpen = edit || assign || !!release;
  const formPending = formOpen && formState.pending;
  const formDirty = formOpen && formState.dirty;
  const beforeBranchChange = () => {
    if (pending || formPending) return false;
    if (formDirty && !window.confirm('Discard unsaved space changes?'))
      return false;
    return true;
  };
  const branchSelector = (
    <SpacesBranchSelector
      organizationId={organizationId}
      branchId={branchId}
      role={organization!.role}
      preferredBranchId={branchId}
      rememberBranch={setSelectedBranchId}
      onReady={setBranchName}
      onAccessDenied={accessLost}
      beforeChange={beforeBranchChange}
      disabled={pending || formPending}
      compact
    />
  );
  if (loading)
    return (
      <OrganizationPageFrame wide>
        <div className="mb-4">{back}</div>
        <PageHeader
          title="Loading space"
          description="Preparing space details and occupancy history."
          action={branchSelector}
        />
        <SpaceDetailSkeleton />
      </OrganizationPageFrame>
    );
  if (error || !space || !history)
    return (
      <OrganizationPageFrame wide>
        <div className="mb-4">{back}</div>
        <PageHeader
          title={space?.name ?? 'Space unavailable'}
          description="The selected space could not be displayed."
          action={branchSelector}
        />
        <RequestError
          message={error ?? 'Space unavailable.'}
          onRetry={reload}
        />
      </OrganizationPageFrame>
    );

  const spaceItem: SpaceListItem = { ...space, currentOccupancy: current };
  return (
    <OrganizationPageFrame wide>
      <div className="mb-4">{back}</div>
      <PageHeader
        eyebrow={branchName ? `Spaces / ${branchName}` : 'Space detail'}
        title={space.name}
        description={`${space.type} space${branchName ? ` in ${branchName}` : ''}. Review occupancy, history, and available actions.`}
        action={branchSelector}
      />
      {success ? <StatusNotice>{success}</StatusNotice> : null}
      <div className="mt-7 grid min-w-0 gap-7">
        <div className="grid min-w-0 gap-7 lg:grid-cols-[minmax(0,1.35fr)_minmax(18rem,0.65fr)]">
          <OperationalPanel
            className="!mt-0"
            title="Space overview"
            description="Current identity and availability for this branch space."
          >
            <dl className="grid gap-5 border-y border-hairline py-5 sm:grid-cols-2">
              <div>
                <dt className="text-xs text-muted">Type</dt>
                <dd className="mt-1 font-semibold">{space.type}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Status</dt>
                <dd className="mt-2">{statusBadge(space.status)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Current occupancy</dt>
                <dd className="mt-1 font-semibold">
                  {current ? current.merchant.name : 'Vacant'}
                </dd>
                {current ? (
                  <p className="mt-1 text-sm text-muted">
                    Since {date(current.startedAt)}
                  </p>
                ) : null}
              </div>
              <div>
                <dt className="text-xs text-muted">Created</dt>
                <dd className="mt-1 text-sm">{date(space.createdAt)}</dd>
              </div>
            </dl>
          </OperationalPanel>
          <aside className="min-w-0">
            <OperationalPanel
              variant="card"
              className="!mt-0"
              title={owner ? 'Space actions' : 'Space access'}
              description={
                owner
                  ? 'Manage this space without leaving its detail view.'
                  : 'Managers and merchants can review this space and its occupancy history.'
              }
            >
              {owner ? (
                <div className="grid gap-2 p-5 sm:grid-cols-2 lg:grid-cols-1">
                  {space.status === 'ACTIVE' ? (
                    <button
                      type="button"
                      className={buttonStyles({ variant: 'primary' })}
                      disabled={pending}
                      onClick={() => setAssign(true)}
                    >
                      {current ? 'Record past occupancy' : 'Assign space'}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className={buttonStyles({ variant: 'secondary' })}
                    disabled={pending}
                    onClick={() => setEdit(true)}
                  >
                    Edit space
                  </button>
                  {current ? (
                    <button
                      type="button"
                      className={buttonStyles({ variant: 'secondary' })}
                      disabled={pending}
                      onClick={() => setRelease(current)}
                    >
                      Release space
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className={
                      space.status === 'ACTIVE' ? archiveAction : quiet
                    }
                    disabled={
                      pending || (space.status === 'ACTIVE' && !!current)
                    }
                    onClick={() => void changeStatus()}
                  >
                    {space.status === 'ACTIVE'
                      ? 'Archive space'
                      : 'Reactivate space'}
                  </button>
                </div>
              ) : (
                <p className="border-t border-hairline p-5 text-sm text-muted">
                  This view is read-only for your organization role.
                </p>
              )}
            </OperationalPanel>
          </aside>
        </div>
        <OperationalCollection
          className="!mt-0"
          title="Occupancy history"
          description="Current and completed assignments recorded for this space."
        >
          <div className="border-t border-hairline">
            <div className="border-b border-hairline px-4 py-4 sm:px-5">
              <div
                className="grid gap-3 sm:grid-cols-[minmax(0,1.4fr)_minmax(10rem,0.7fr)_minmax(10rem,0.7fr)]"
                role="search"
                aria-label="Filter occupancy history"
              >
                <TextField
                  label="Search merchant"
                  icon="search"
                  placeholder="Search by merchant"
                  value={historySearch}
                  maxLength={120}
                  onChange={(event) => {
                    setHistorySearch(event.target.value);
                    setHistoryPage(1);
                  }}
                />
                <TextField
                  label="From date"
                  icon="calendar"
                  type="date"
                  value={historyFrom}
                  onChange={(event) => {
                    setHistoryFrom(event.target.value);
                    setHistoryPage(1);
                  }}
                />
                <TextField
                  label="Until date"
                  icon="calendar"
                  type="date"
                  value={historyUntil}
                  onChange={(event) => {
                    setHistoryUntil(event.target.value);
                    setHistoryPage(1);
                  }}
                />
              </div>
              <p className="mt-3 text-xs text-muted">
                All dates are shown by default. Date filters include occupancy
                periods that overlap the selected range.
              </p>
            </div>
            <OperationalTableFrame
              empty={
                !history.items.length ? (
                  <EmptyState
                    className="mt-6"
                    title="No occupancy history yet."
                    description="Completed occupancy periods will appear here."
                  />
                ) : undefined
              }
              footer={
                <PaginationControls
                  className="px-4 pt-4 pb-1 sm:px-5"
                  ariaLabel="Occupancy history pagination"
                  currentPage={history.page}
                  totalPages={history.totalPages}
                  pending={pending}
                  hasNext={history.hasNext}
                  summary={`${history.total} records`}
                  onPrevious={() => setHistoryPage((value) => value - 1)}
                  onNext={() => setHistoryPage((value) => value + 1)}
                />
              }
            >
              <HistoryList data={history} />
            </OperationalTableFrame>
          </div>
        </OperationalCollection>
      </div>
      {edit && owner ? (
        <SpaceForm
          onStateChange={setFormState}
          organizationId={organizationId}
          branchId={branchId}
          space={spaceItem}
          onClose={() => setEdit(false)}
          onSaved={() => saved('Space saved.')}
        />
      ) : null}
      {assign && owner ? (
        <AssignmentForm
          onStateChange={setFormState}
          scope={
            {
              organizationId,
              kind: 'branch',
              id: branchId,
            } satisfies AssociationScope
          }
          space={spaceItem}
          historyOnly={!!current}
          onClose={() => setAssign(false)}
          onSaved={() => saved('Occupancy saved.')}
        />
      ) : null}
      {release && owner ? (
        <ReleaseForm
          onStateChange={setFormState}
          organizationId={organizationId}
          occupancy={release}
          onClose={() => setRelease(null)}
          onSaved={() => saved('Space released.')}
        />
      ) : null}
      {confirmationDialog}
    </OrganizationPageFrame>
  );
}
