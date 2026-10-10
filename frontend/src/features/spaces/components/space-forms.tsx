'use client';
import { useEffect, useId, useRef, useState } from 'react';
import { useAuth } from '@/features/auth/model/auth-context';
import {
  listAssociations,
  type AssociationScope,
} from '@/features/merchant-branches/api/merchant-branch-api';
import { SelectControl } from '@/shared/components/ui/select-control';
import { FormDialog } from '@/shared/components/ui/form-dialog';
import { useSpaceTypes } from '../model/use-space-types';
import { SpaceTypeCreator } from './space-type-creator';
import { buttonStyles } from '@/shared/components/ui/button';
import {
  assignSpace,
  listSpaces,
  releaseSpace,
  saveSpace,
} from '../api/space-api';
import {
  occupancyDates,
  spaceFormSchema,
  type Occupancy,
  type SpaceListItem,
} from '../model/space.schemas';
const control =
  'min-h-11 w-full rounded-control border border-control-border bg-surface px-3 font-normal';
const message = (cause: unknown) =>
  cause instanceof Error ? cause.message : 'Could not save. Try again.';
function Actions({
  pending,
  onClose,
  label,
  disabled = false,
}: {
  pending: boolean;
  disabled?: boolean;
  onClose(): void;
  label: string;
}) {
  return (
    <div className="flex flex-wrap justify-end gap-3">
      <button
        type="button"
        className={buttonStyles({ variant: 'quiet' })}
        disabled={pending}
        onClick={onClose}
      >
        Cancel
      </button>
      <button
        type="submit"
        className={buttonStyles({ variant: 'primary' })}
        disabled={pending || disabled}
        aria-busy={pending}
      >
        {pending ? 'Saving…' : label}
      </button>
    </div>
  );
}
export function SpaceForm({
  organizationId,
  branchId,
  space,
  onClose,
  onSaved,
  onStateChange,
  onTypeCreated,
}: {
  organizationId: string;
  branchId: string;
  space?: SpaceListItem;
  onClose(): void;
  onSaved(): void;
  onTypeCreated?(): void;
  onStateChange?(state: { dirty: boolean; pending: boolean }): void;
}) {
  const { request } = useAuth();
  const [name, setName] = useState(space?.name ?? ''),
    [type, setType] = useState(space?.type ?? '');
  const {
    types,
    error: typesError,
    reload: reloadTypes,
  } = useSpaceTypes(organizationId);
  const [addingType, setAddingType] = useState(false);
  const [typePending, setTypePending] = useState(false);
  const [typeDraftDirty, setTypeDraftDirty] = useState(false);
  const [pending, setPending] = useState(false),
    [error, setError] = useState<string | null>(null);
  const lock = useRef(false);
  useEffect(() => {
    onStateChange?.({
      dirty:
        name !== (space?.name ?? '') ||
        type !== (space?.type ?? '') ||
        (addingType && typeDraftDirty),
      pending: pending || typePending,
    });
  }, [
    name,
    type,
    space,
    pending,
    typePending,
    addingType,
    typeDraftDirty,
    onStateChange,
  ]);
  const errorId = useId();
  const nameRef = useRef<HTMLInputElement>(null),
    typeRef = useRef<HTMLDivElement>(null);
  const [invalid, setInvalid] = useState<'name' | 'type' | null>(null);
  return (
    <FormDialog
      title={space ? 'Edit space' : 'Add space'}
      description="Name a physical space in this branch and give it a type, such as rack or shelf."
      pending={pending || typePending}
      onClose={onClose}
    >
      <form
        className="mt-5 grid gap-5"
        onSubmit={(event) => {
          event.preventDefault();
          if (lock.current || typePending || !types || typesError) return;
          const parsed = spaceFormSchema.safeParse({ name, type });
          if (!parsed.success) {
            const field =
              parsed.error.issues[0].path[0] === 'type' ? 'type' : 'name';
            setInvalid(field);
            setError(parsed.error.issues[0].message);
            if (field === 'name') nameRef.current?.focus();
            else typeRef.current?.querySelector('button')?.focus();
            return;
          }
          lock.current = true;
          setPending(true);
          setError(null);
          setInvalid(null);
          void saveSpace(
            request,
            organizationId,
            branchId,
            parsed.data,
            space?.id,
          )
            .then(onSaved)
            .catch((cause) => setError(message(cause)))
            .finally(() => {
              lock.current = false;
              setPending(false);
            });
        }}
      >
        {error && (
          <p id={errorId} role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
        <label className="grid gap-2 text-sm font-semibold">
          Space name
          <input
            className={control}
            required
            maxLength={120}
            disabled={pending}
            value={name}
            ref={nameRef}
            aria-invalid={invalid === 'name'}
            aria-describedby={invalid === 'name' ? errorId : undefined}
            onChange={(e) => setName(e.target.value)}
            placeholder="Rack A1"
          />
        </label>
        <div ref={typeRef} className="grid gap-3">
          <label className="grid gap-2 text-sm font-semibold">
            Space type
            <SelectControl
              aria-label="Space type"
              className={control}
              required
              value={type}
              disabled={pending || typePending || !types || !!typesError}
              onValueChange={(value) => {
                setType(value);
                setAddingType(false);
              }}
            >
              <option value="">
                {types ? 'Choose a type' : 'Loading types…'}
              </option>
              {space && !types?.some((row) => row.name === space.type) && (
                <option value={space.type}>{space.type}</option>
              )}
              {types?.map((row) => (
                <option key={row.id} value={row.name}>
                  {row.name}
                </option>
              ))}
            </SelectControl>
          </label>
          {typesError && (
            <p role="alert" className="text-sm text-danger">
              {typesError}
            </p>
          )}
          {invalid === 'type' && (
            <p className="text-sm text-danger">Choose a space type.</p>
          )}
          {!addingType && (
            <button
              type="button"
              className={buttonStyles({ variant: 'quiet' })}
              disabled={pending || typePending}
              onClick={() => setAddingType(true)}
            >
              Add type
            </button>
          )}
          {addingType && (
            <div className="grid gap-3 rounded-control border border-hairline p-4">
              <SpaceTypeCreator
                organizationId={organizationId}
                onPendingChange={setTypePending}
                onDirtyChange={setTypeDraftDirty}
                onCreated={(created) => {
                  setType(created.name);
                  setAddingType(false);
                  reloadTypes();
                  onTypeCreated?.();
                }}
              />
              <p className="text-sm text-muted">
                The type stays available even if you cancel this space.
              </p>
              <button
                type="button"
                className={buttonStyles({ variant: 'quiet' })}
                disabled={typePending}
                onClick={() => setAddingType(false)}
              >
                Cancel adding type
              </button>
            </div>
          )}
          <button
            type="button"
            className={buttonStyles({ variant: 'quiet' })}
            disabled={pending || typePending}
            onClick={reloadTypes}
          >
            Refresh types
          </button>
        </div>
        <Actions
          pending={pending || typePending}
          onClose={onClose}
          disabled={!types || !!typesError || !type || typePending}
          label={space ? 'Save space' : 'Add space'}
        />
      </form>
    </FormDialog>
  );
}
export function AssignmentForm({
  scope,
  space,
  historyOnly = false,
  onClose,
  onSaved,
  onStateChange,
}: {
  scope: AssociationScope;
  space?: SpaceListItem;
  historyOnly?: boolean;
  onClose(): void;
  onSaved(): void;
  onStateChange?(state: { dirty: boolean; pending: boolean }): void;
}) {
  const { request } = useAuth();
  const [choices, setChoices] = useState<{ id: string; name: string }[] | null>(
    null,
  );
  const [relatedId, setRelatedId] = useState(''),
    [spaceId, setSpaceId] = useState(space?.id ?? '');
  const [spaces, setSpaces] = useState<SpaceListItem[] | null>(
    space ? [space] : null,
  );
  const [historical, setHistorical] = useState(historyOnly),
    [start, setStart] = useState(''),
    [end, setEnd] = useState('');
  const [pending, setPending] = useState(false),
    [error, setError] = useState<string | null>(null),
    [readError, setReadError] = useState<string | null>(null),
    [retry, setRetry] = useState(0);
  const lock = useRef(false);
  useEffect(() => {
    onStateChange?.({
      dirty: !!relatedId || !!start || !!end || historical !== historyOnly,
      pending,
    });
  }, [relatedId, start, end, historical, historyOnly, pending, onStateChange]);
  const branchId = scope.kind === 'branch' ? scope.id : relatedId;
  const merchantId = scope.kind === 'merchant' ? scope.id : relatedId;
  useEffect(() => {
    let active = true;
    void Promise.resolve()
      .then(async () => {
        setChoices(null);
        setReadError(null);
        const rows: { id: string; name: string }[] = [];
        let page = 1;
        while (active) {
          const data = await listAssociations(
            request,
            {
              organizationId: scope.organizationId,
              kind: scope.kind,
              id: scope.id,
            },
            {
              page,
              status: 'ACTIVE',
            },
          );
          rows.push(
            ...data.items
              .filter((row) => row.merchant.status === 'ACTIVE')
              .map((row) =>
                scope.kind === 'branch' ? row.merchant : row.branch,
              ),
          );
          if (!data.hasNext) break;
          page++;
        }
        if (active) setChoices(rows);
      })
      .catch((cause) => {
        if (active) setReadError(message(cause));
      });
    return () => {
      active = false;
    };
  }, [request, scope.organizationId, scope.kind, scope.id, retry]);
  useEffect(() => {
    if (space || !branchId) return;
    let active = true;
    void Promise.resolve()
      .then(async () => {
        setSpaces(null);
        setSpaceId('');
        setReadError(null);
        const rows: SpaceListItem[] = [];
        let page = 1;
        while (active) {
          const data = await listSpaces(
            request,
            scope.organizationId,
            branchId,
            { page, status: 'ACTIVE' },
          );
          rows.push(...data.items);
          if (!data.hasNext) break;
          page++;
        }
        if (active) setSpaces(rows);
      })
      .catch((cause) => {
        if (active) setReadError(message(cause));
      });
    return () => {
      active = false;
    };
  }, [request, scope.organizationId, branchId, space, retry]);
  return (
    <FormDialog
      title={historyOnly ? 'Record past occupancy' : 'Assign space'}
      description="Choose an active merchant and branch space. Dates use your local time. Leave start blank to assign now, or enter past dates to record history."
      pending={pending}
      onClose={onClose}
    >
      <form
        className="mt-5 grid gap-5"
        onSubmit={(event) => {
          event.preventDefault();
          if (
            lock.current ||
            !spaceId ||
            !merchantId ||
            !branchId ||
            !choices ||
            readError
          )
            return;
          try {
            const dates = occupancyDates(start, historical ? end : '');
            if (historical && (!dates.startedAt || !dates.endedAt))
              throw new Error('Enter both start and end for past occupancy.');
            lock.current = true;
            setPending(true);
            setError(null);
            void assignSpace(request, scope.organizationId, branchId, spaceId, {
              merchantId,
              ...dates,
            })
              .then(onSaved)
              .catch((cause) => setError(message(cause)))
              .finally(() => {
                lock.current = false;
                setPending(false);
              });
          } catch (cause) {
            setError(message(cause));
          }
        }}
      >
        {(error || readError) && (
          <p className="text-sm text-danger" role="alert">
            {error ?? readError}
          </p>
        )}
        {readError && (
          <button
            className={buttonStyles({ variant: 'quiet' })}
            type="button"
            onClick={() => setRetry((value) => value + 1)}
          >
            Retry assignment choices
          </button>
        )}
        <label className="grid gap-2 text-sm font-semibold">
          {scope.kind === 'branch' ? 'Merchant' : 'Branch'}
          <SelectControl
            aria-label={scope.kind === 'branch' ? 'Merchant' : 'Branch'}
            className={control}
            value={relatedId}
            required
            disabled={pending || !choices || !!readError}
            onValueChange={(value) => {
              setRelatedId(value);
              if (!space) setSpaceId('');
            }}
          >
            <option value="">
              {choices ? 'Choose one' : 'Loading choices…'}
            </option>
            {choices?.map((choice) => (
              <option key={choice.id} value={choice.id}>
                {choice.name}
              </option>
            ))}
          </SelectControl>
        </label>
        {choices && !choices.length && (
          <p className="text-sm text-muted">
            No active merchant participation is available. Configure it in the
            Branches or Merchants section first.
          </p>
        )}
        <label className="flex min-h-11 items-center gap-3 text-sm">
          <input
            type="checkbox"
            checked={historical}
            disabled={pending || historyOnly}
            onChange={(e) => {
              setHistorical(e.target.checked);
              setSpaceId(space?.id ?? '');
            }}
          />
          Record a completed past occupancy
        </label>
        {space ? (
          <p className="text-sm">
            <span className="font-semibold">Space: </span>
            {space.name} · {space.type}
          </p>
        ) : (
          <label className="grid gap-2 text-sm font-semibold">
            Space
            <SelectControl
              aria-label="Space"
              className={control}
              value={spaceId}
              required
              disabled={pending || !spaces || !!readError}
              onValueChange={setSpaceId}
            >
              <option value="">
                {branchId && !spaces ? 'Loading spaces…' : 'Choose a space'}
              </option>
              {spaces?.map((row) => (
                <option
                  key={row.id}
                  value={row.id}
                  disabled={!historical && !!row.currentOccupancy}
                >
                  {row.name} · {row.type}
                  {row.currentOccupancy ? ' · Occupied' : ''}
                </option>
              ))}
            </SelectControl>
          </label>
        )}
        {spaces && !spaces.length && (
          <p className="text-sm text-muted">
            This branch has no active spaces. Add a space from its branch detail
            first.
          </p>
        )}
        <label className="grid gap-2 text-sm font-semibold">
          Start date and time
          {!historical && (
            <span className="font-normal text-muted">
              Optional; leave blank to start now.
            </span>
          )}
          <input
            className={control}
            type="datetime-local"
            step="1"
            value={start}
            required={historical}
            disabled={pending}
            onChange={(e) => setStart(e.target.value)}
          />
        </label>
        {historical && (
          <label className="grid gap-2 text-sm font-semibold">
            End date and time
            <input
              className={control}
              type="datetime-local"
              step="1"
              value={end}
              required
              disabled={pending}
              onChange={(e) => setEnd(e.target.value)}
            />
          </label>
        )}
        <Actions
          pending={pending}
          disabled={
            !choices ||
            !!readError ||
            !relatedId ||
            !spaceId ||
            (!space && !spaces)
          }
          onClose={onClose}
          label={historical ? 'Record occupancy' : 'Assign space'}
        />
      </form>
    </FormDialog>
  );
}
export function ReleaseForm({
  organizationId,
  occupancy,
  onClose,
  onSaved,
  onStateChange,
}: {
  organizationId: string;
  occupancy: Occupancy;
  onClose(): void;
  onSaved(): void;
  onStateChange?(state: { dirty: boolean; pending: boolean }): void;
}) {
  const { request } = useAuth();
  const [end, setEnd] = useState(''),
    [pending, setPending] = useState(false),
    [error, setError] = useState<string | null>(null);
  useEffect(() => {
    onStateChange?.({ dirty: !!end, pending });
  }, [end, pending, onStateChange]);
  const lock = useRef(false);
  return (
    <FormDialog
      title={`Release ${occupancy.space.name}`}
      description={`End ${occupancy.merchant.name}’s occupancy and retain its history. Leave the date blank to release now.`}
      pending={pending}
      onClose={onClose}
    >
      <form
        className="mt-5 grid gap-5"
        onSubmit={(event) => {
          event.preventDefault();
          if (lock.current) return;
          try {
            const endedAt = end ? new Date(end).toISOString() : undefined;
            if (
              endedAt &&
              (Date.parse(endedAt) > Date.now() ||
                Date.parse(endedAt) <= Date.parse(occupancy.startedAt))
            )
              throw new Error('End must be after start and no later than now.');
            lock.current = true;
            setPending(true);
            setError(null);
            void releaseSpace(request, organizationId, occupancy, endedAt)
              .then(onSaved)
              .catch((cause) => setError(message(cause)))
              .finally(() => {
                lock.current = false;
                setPending(false);
              });
          } catch (cause) {
            setError(message(cause));
          }
        }}
      >
        {error && (
          <p className="text-sm text-danger" role="alert">
            {error}
          </p>
        )}
        <label className="grid gap-2 text-sm font-semibold">
          End date and time
          <input
            type="datetime-local"
            step="1"
            className={control}
            value={end}
            disabled={pending}
            onChange={(e) => setEnd(e.target.value)}
          />
        </label>
        <Actions pending={pending} onClose={onClose} label="Release space" />
      </form>
    </FormDialog>
  );
}
