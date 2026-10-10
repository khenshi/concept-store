'use client';
import { useEffect, useRef, useState } from 'react';
import { useSpaceTypes } from '../model/use-space-types';
import { useAuth } from '@/features/auth/model/auth-context';
import { useOrganizationWorkspaceContext } from '@/features/organizations/components/organization-workspace-context';
import type { AssociationScope } from '@/features/merchant-branches/api/merchant-branch-api';
import { buttonStyles } from '@/shared/components/ui/button';
import { useConfirmationDialog } from '@/shared/components/ui/confirmation-dialog';
import { SelectControl } from '@/shared/components/ui/select-control';
import { FormDialog } from '@/shared/components/ui/form-dialog';
import { listOccupancies, listSpaces, setSpaceStatus } from '../api/space-api';
import {
  releaseLabels,
  type Occupancy,
  type OccupancyPage,
  type SpaceListItem,
  type SpacePage,
} from '../model/space.schemas';
import { AssignmentForm, ReleaseForm, SpaceForm } from './space-forms';
const quiet = buttonStyles({ variant: 'quiet' });
const control =
  'min-h-11 w-full min-w-0 rounded-control border border-control-border bg-surface px-3';
const message = (cause: unknown) =>
  cause instanceof Error
    ? cause.message
    : 'Spaces could not be loaded. Try again.';
function date(value: string) {
  return new Date(value).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}
function Pagination({
  data,
  pending,
  onPage,
}: {
  data: { page: number; total: number; totalPages: number; hasNext: boolean };
  pending: boolean;
  onPage(page: number): void;
}) {
  return (
    <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-muted">
        {data.total} records · Page {data.page} of{' '}
        {Math.max(1, data.totalPages)}
      </p>
      <div className="flex gap-2">
        <button
          className={quiet}
          type="button"
          disabled={pending || data.page <= 1}
          onClick={() => onPage(data.page - 1)}
        >
          Previous spaces
        </button>
        <button
          className={quiet}
          type="button"
          disabled={pending || !data.hasNext}
          onClick={() => onPage(data.page + 1)}
        >
          Next spaces
        </button>
      </div>
    </div>
  );
}
function OccupancyRows({
  rows,
  owner,
  onRelease,
}: {
  rows: Occupancy[];
  owner: boolean;
  onRelease?(row: Occupancy): void;
}) {
  return (
    <ul className="list-none p-0">
      {rows.map((row) => (
        <li
          key={row.id}
          className="data-row grid min-w-0 gap-3 py-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]"
        >
          <div className="min-w-0 break-words">
            <p className="font-semibold">{row.space.name}</p>
            <p className="mt-1 text-sm text-muted">
              {row.space.type} · {row.branch.name}
            </p>
            <p className="mt-1 text-sm">{row.merchant.name}</p>
          </div>
          <div className="text-sm">
            <p>From {date(row.startedAt)}</p>
            <p className="mt-1">
              {row.endedAt
                ? `Until ${date(row.endedAt)}`
                : 'Currently occupied'}
            </p>
            {row.releaseReason && (
              <p className="mt-1 text-muted">
                {releaseLabels[row.releaseReason]}
              </p>
            )}
          </div>
          {owner && !row.endedAt && onRelease && (
            <button
              className={`${quiet} self-start`}
              type="button"
              onClick={() => onRelease(row)}
            >
              Release space
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}
function SpaceHistory({
  scope,
  space,
  onClose,
}: {
  scope: AssociationScope;
  space: SpaceListItem;
  onClose(): void;
}) {
  const { request } = useAuth();
  const { organization } = useOrganizationWorkspaceContext();
  const [data, setData] = useState<OccupancyPage | null>(null),
    [page, setPage] = useState(1),
    [error, setError] = useState<string | null>(null),
    [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    void Promise.resolve()
      .then(() => {
        if (active) {
          setData(null);
          setError(null);
        }
        return listOccupancies(
          request,
          scope.organizationId,
          { kind: 'space', id: space.id, branchId: space.branchId },
          { page },
        );
      })
      .then((rows) => {
        if (active) setData(rows);
      })
      .catch((cause) => {
        if (active) setError(message(cause));
      });
    return () => {
      active = false;
    };
  }, [
    request,
    organization,
    scope.organizationId,
    space.id,
    space.branchId,
    page,
    revision,
  ]);
  return (
    <FormDialog
      title={`${space.name} occupancy history`}
      description="Current and completed assignments, with dates and release reasons."
      onClose={onClose}
    >
      <div className="mt-5">
        {error && (
          <div role="alert">
            <p className="text-danger">{error}</p>
            <button
              type="button"
              className={quiet}
              onClick={() => setRevision((value) => value + 1)}
            >
              Retry space history
            </button>
          </div>
        )}
        {!data && !error && <p role="status">Loading occupancy history…</p>}
        {data && (
          <>
            <OccupancyRows rows={data.items} owner={false} />
            {!data.items.length && (
              <p className="text-sm text-muted">
                No occupancy history for this space.
              </p>
            )}
            <Pagination data={data} pending={false} onPage={setPage} />
          </>
        )}
        <button type="button" className={`${quiet} mt-5`} onClick={onClose}>
          Close history
        </button>
      </div>
    </FormDialog>
  );
}
export function SpaceManagement(
  props: AssociationScope & {
    revision?: number;
    onInteractionChange?(blocked: boolean): void;
    onNavigationGuard?(guard: () => boolean): void;
  },
) {
  const { organization } = useOrganizationWorkspaceContext();
  const { user } = useAuth();
  if (
    !organization ||
    !['OWNER', 'MANAGER', 'MERCHANT'].includes(organization.role)
  )
    return null;
  return (
    <ScopedSpaces
      key={`${props.organizationId}:${props.kind}:${props.id}:${organization.role}:${user?.id}:${props.revision ?? 0}`}
      {...props}
    />
  );
}
function ScopedSpaces(
  scope: AssociationScope & {
    onInteractionChange?(blocked: boolean): void;
    onNavigationGuard?(guard: () => boolean): void;
  },
) {
  const { organization } = useOrganizationWorkspaceContext();
  const { request } = useAuth();
  const owner = organization?.role === 'OWNER',
    own = organization?.role === 'MERCHANT';
  const [spaces, setSpaces] = useState<SpacePage | null>(null),
    [occupancies, setOccupancies] = useState<OccupancyPage | null>(null);
  const [page, setPage] = useState(1),
    [q, setQ] = useState(''),
    [type, setType] = useState(''),
    [status, setStatus] = useState(''),
    [occupancy, setOccupancy] = useState<'' | 'OCCUPIED' | 'VACANT'>(''),
    [view, setView] = useState<'CURRENT' | 'HISTORY'>('CURRENT');
  const [revision, setRevision] = useState(0),
    [error, setError] = useState<string | null>(null),
    [success, setSuccess] = useState<string | null>(null),
    [pending, setPending] = useState(false);
  const [edit, setEdit] = useState<SpaceListItem | 'new' | null>(null),
    [assign, setAssign] = useState<{
      space?: SpaceListItem;
      historyOnly?: boolean;
    } | null>(null),
    [release, setRelease] = useState<Occupancy | null>(null),
    [history, setHistory] = useState<SpaceListItem | null>(null);
  const {
    types,
    error: typesError,
    reload: reloadTypes,
  } = useSpaceTypes(scope.organizationId, revision, scope.kind === 'branch');
  const [formState, setFormState] = useState({ dirty: false, pending: false });
  const formOpen = !!edit || !!assign || !!release;
  const formPending = formOpen && formState.pending;
  const formDirty = formOpen && formState.dirty;
  const { onNavigationGuard, onInteractionChange } = scope;
  useEffect(() => {
    onNavigationGuard?.(
      () =>
        !pending &&
        !formPending &&
        (!formDirty ||
          window.confirm('Discard unsaved space changes and switch branches?')),
    );
  }, [onNavigationGuard, pending, formPending, formDirty]);
  useEffect(() => {
    onInteractionChange?.(pending || formPending);
  }, [onInteractionChange, pending, formPending]);
  const generation = useRef(0),
    lock = useRef(false);
  const { confirm, confirmationDialog } = useConfirmationDialog();
  useEffect(() => {
    const read = ++generation.current;
    void Promise.resolve()
      .then(async () => {
        if (read !== generation.current) return;
        setSpaces(null);
        setOccupancies(null);
        setError(null);
        if (scope.kind === 'branch') {
          const rows = await listSpaces(
            request,
            scope.organizationId,
            scope.id,
            { page, q, type, status, occupancy: occupancy || undefined },
          );
          if (read === generation.current) setSpaces(rows);
        } else {
          const rows = await listOccupancies(
            request,
            scope.organizationId,
            { kind: 'merchant', id: scope.id },
            { page, view },
          );
          if (read === generation.current) setOccupancies(rows);
        }
      })
      .catch((cause) => {
        if (read === generation.current) setError(message(cause));
      });
    return () => {
      generation.current = read + 1;
    };
  }, [
    request,
    organization,
    scope.organizationId,
    scope.kind,
    scope.id,
    page,
    q,
    type,
    status,
    occupancy,
    view,
    revision,
  ]);
  function saved(text: string) {
    setEdit(null);
    setAssign(null);
    setRelease(null);
    setSuccess(text);
    setPage(1);
    setRevision((value) => value + 1);
  }
  async function archive(row: SpaceListItem) {
    if (!owner || lock.current) return;
    lock.current = true;
    const read = generation.current;
    try {
      const next = row.status === 'ACTIVE' ? 'ARCHIVED' : 'ACTIVE';
      if (
        !(await confirm({
          title:
            next === 'ARCHIVED'
              ? `Archive ${row.name}?`
              : `Reactivate ${row.name}?`,
          description:
            next === 'ARCHIVED'
              ? 'The space must be free. Its occupancy history will remain available.'
              : 'The space will be available for new assignments.',
          confirmLabel:
            next === 'ARCHIVED' ? 'Archive space' : 'Reactivate space',
        }))
      )
        return;
      if (read !== generation.current) return;
      setPending(true);
      setError(null);
      await setSpaceStatus(
        request,
        scope.organizationId,
        row.branchId,
        row.id,
        next,
      );
      if (read === generation.current)
        saved(next === 'ARCHIVED' ? 'Space archived.' : 'Space reactivated.');
    } catch (cause) {
      if (read === generation.current) setError(message(cause));
    } finally {
      lock.current = false;
      if (read === generation.current) setPending(false);
    }
  }
  const data = scope.kind === 'branch' ? spaces : occupancies;
  return (
    <section
      className="mt-8 min-w-0 bg-surface py-6"
      aria-label="Space occupancy"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold">
          {own ? 'Your spaces' : 'Spaces'}
        </h2>
        {owner && (
          <button
            type="button"
            className={buttonStyles({ variant: 'secondary' })}
            disabled={pending}
            onClick={() =>
              scope.kind === 'branch' ? setEdit('new') : setAssign({})
            }
          >
            {scope.kind === 'branch' ? 'Add space' : 'Assign space'}
          </button>
        )}
      </div>
      <p className="mt-2 text-sm text-muted">
        {own
          ? 'Your current spaces and past occupancy records.'
          : 'Track physical space occupancy. Space assignments are optional.'}
      </p>
      {scope.kind === 'branch' ? (
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="grid min-w-0 flex-1 gap-2 text-sm">
            Search spaces
            <input
              className={control}
              maxLength={120}
              value={q}
              disabled={pending}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
            />
          </label>
          <div className="grid min-w-0 gap-2 text-sm">
            <label className="grid gap-2">
              Type
              <SelectControl
                aria-label="Type"
                className={control}
                value={type}
                disabled={pending || !types || !!typesError}
                onValueChange={(value) => {
                  setType(value);
                  setPage(1);
                }}
              >
                <option value="">All types</option>
                {types?.map((row) => (
                  <option key={row.id} value={row.name}>
                    {row.name}
                  </option>
                ))}
              </SelectControl>
            </label>
            {typesError && (
              <>
                <p role="alert" className="text-danger">
                  {typesError}
                </p>
                <button
                  type="button"
                  className={buttonStyles({ variant: 'quiet' })}
                  onClick={reloadTypes}
                >
                  Retry types
                </button>
              </>
            )}
          </div>
          <label className="grid gap-2 text-sm">
            Space status
            <SelectControl
              aria-label="Space status"
              className={control}
              value={status}
              disabled={pending}
              onValueChange={(value) => {
                setStatus(value);
                setPage(1);
              }}
            >
              <option value="">All spaces</option>
              <option value="ACTIVE">Active</option>
              <option value="ARCHIVED">Archived</option>
            </SelectControl>
          </label>
          {!own && (
            <label className="grid gap-2 text-sm">
              Occupancy
              <SelectControl
                aria-label="Occupancy"
                className={control}
                value={occupancy}
                disabled={pending}
                onValueChange={(value) => {
                  setOccupancy(value as typeof occupancy);
                  setPage(1);
                }}
              >
                <option value="">All</option>
                <option value="OCCUPIED">Occupied</option>
                <option value="VACANT">Vacant</option>
              </SelectControl>
            </label>
          )}
        </div>
      ) : (
        <div
          className="mt-5 flex gap-2"
          role="group"
          aria-label="Occupancy period"
        >
          {(['CURRENT', 'HISTORY'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              className={buttonStyles({
                variant: view === tab ? 'secondary' : 'quiet',
              })}
              aria-pressed={view === tab}
              onClick={() => {
                setView(tab);
                setPage(1);
              }}
            >
              {tab === 'CURRENT' ? 'Current spaces' : 'Past occupancy'}
            </button>
          ))}
        </div>
      )}
      {success && (
        <p className="mt-4 text-sm text-success-ink" role="status">
          {success}
        </p>
      )}
      {error && (
        <div className="mt-4" role="alert">
          <p className="text-danger">{error}</p>
          <button
            className={quiet}
            type="button"
            disabled={pending}
            onClick={() => setRevision((value) => value + 1)}
          >
            Retry spaces
          </button>
        </div>
      )}
      {!data && !error && (
        <p className="mt-5 text-sm text-muted" role="status">
          Loading spaces…
        </p>
      )}
      {spaces && (
        <ul className="mt-5 list-none p-0">
          {spaces.items.map((row) => (
            <li
              className="data-row grid min-w-0 gap-x-6 gap-y-3 py-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.6fr)]"
              key={row.id}
            >
              <div className="min-w-0 break-words">
                <p className="font-semibold">{row.name}</p>
                <p className="mt-1 text-sm text-muted">
                  {row.type} · {row.status === 'ACTIVE' ? 'Active' : 'Archived'}
                </p>
              </div>
              <div className="min-w-0 break-words text-sm">
                {row.currentOccupancy ? (
                  <>
                    <p>{row.currentOccupancy.merchant.name}</p>
                    <p className="mt-1 text-muted">
                      Since {date(row.currentOccupancy.startedAt)}
                    </p>
                  </>
                ) : (
                  <p className="text-muted">
                    {own
                      ? 'No current assignment for you'
                      : row.status === 'ARCHIVED'
                        ? 'Retired space'
                        : 'Available'}
                  </p>
                )}
              </div>
              <div className="flex flex-wrap items-start gap-2">
                <button
                  type="button"
                  className={quiet}
                  disabled={pending}
                  onClick={() => setHistory(row)}
                >
                  History
                </button>
                {owner && (
                  <>
                    <button
                      type="button"
                      className={quiet}
                      disabled={pending}
                      onClick={() => setEdit(row)}
                    >
                      Edit space
                    </button>
                    {row.status === 'ACTIVE' && (
                      <button
                        type="button"
                        className={quiet}
                        disabled={pending}
                        onClick={() =>
                          setAssign({
                            space: row,
                            historyOnly: !!row.currentOccupancy,
                          })
                        }
                      >
                        {row.currentOccupancy
                          ? 'Record history'
                          : 'Assign space'}
                      </button>
                    )}
                    {row.currentOccupancy && (
                      <button
                        type="button"
                        className={quiet}
                        disabled={pending}
                        onClick={() => setRelease(row.currentOccupancy)}
                      >
                        Release space
                      </button>
                    )}
                    <button
                      type="button"
                      className={quiet}
                      disabled={pending || !!row.currentOccupancy}
                      onClick={() => void archive(row)}
                    >
                      {row.status === 'ACTIVE'
                        ? 'Archive space'
                        : 'Reactivate space'}
                    </button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      {occupancies && (
        <div className="mt-5">
          <OccupancyRows
            rows={occupancies.items}
            owner={owner}
            onRelease={setRelease}
          />
        </div>
      )}
      {data && !data.items.length && (
        <p className="mt-5 text-sm text-muted">
          {scope.kind === 'merchant'
            ? view === 'CURRENT'
              ? 'This merchant has no current space assignments.'
              : 'This merchant has no past occupancy records.'
            : q || type || status || occupancy
              ? 'No spaces match these filters.'
              : own
                ? 'You have no space assignments in this branch.'
                : 'No spaces are configured in this branch. Add spaces when you want to track occupancy.'}
        </p>
      )}
      {data && <Pagination data={data} pending={pending} onPage={setPage} />}
      {edit && owner && (
        <SpaceForm
          onStateChange={setFormState}
          onTypeCreated={reloadTypes}
          organizationId={scope.organizationId}
          branchId={scope.id}
          space={edit === 'new' ? undefined : edit}
          onClose={() => setEdit(null)}
          onSaved={() => saved('Space saved.')}
        />
      )}
      {assign && owner && (
        <AssignmentForm
          onStateChange={setFormState}
          scope={scope}
          {...assign}
          onClose={() => setAssign(null)}
          onSaved={() => saved('Occupancy saved.')}
        />
      )}
      {release && owner && (
        <ReleaseForm
          onStateChange={setFormState}
          organizationId={scope.organizationId}
          occupancy={release}
          onClose={() => setRelease(null)}
          onSaved={() => saved('Space released.')}
        />
      )}
      {history && (
        <SpaceHistory
          scope={scope}
          space={history}
          onClose={() => setHistory(null)}
        />
      )}
      {confirmationDialog}
    </section>
  );
}
