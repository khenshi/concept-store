'use client';
import { useEffect, useId, useRef, useState } from 'react';
import { useAuth } from '@/features/auth/model/auth-context';
import {
  listAssociations,
  type AssociationScope,
} from '@/features/merchant-branches/api/merchant-branch-api';
import { SelectControl } from '@/shared/components/ui/select-control';
import { FormDialog } from '@/shared/components/ui/form-dialog';
import { InputControl } from '@/shared/components/ui/input-control';
import { TextField } from '@/shared/components/ui/text-field';
import { useSpaceTypes } from '../model/use-space-types';
import { SpaceTypeCreator } from './space-type-creator';
import { buttonStyles } from '@/shared/components/ui/button';
import { ModalActionRow } from '@/shared/components/ui/modal-action-row';
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
  'min-h-11 w-full rounded-full border border-control-border bg-surface px-3 font-normal';
const message = (cause: unknown) =>
  cause instanceof Error ? cause.message : 'Could not save. Try again.';
function Actions({
  pending,
  onClose,
  label,
  disabled = false,
  feedback,
}: {
  pending: boolean;
  disabled?: boolean;
  onClose(): void;
  label: string;
  feedback?: string | null;
}) {
  return (
    <ModalActionRow
      feedback={
        feedback ? (
          <p role="alert" className="text-sm text-danger">
            {feedback}
          </p>
        ) : null
      }
    >
      <button
        type="button"
        className={buttonStyles({
          variant: 'quiet',
          className: 'w-full sm:w-auto',
        })}
        disabled={pending}
        onClick={onClose}
      >
        Cancel
      </button>
      <button
        type="submit"
        className={`${buttonStyles({ variant: 'primary' })} order-1 w-full sm:order-2 sm:w-auto`}
        disabled={pending || disabled}
        aria-busy={pending}
      >
        {pending ? 'Saving…' : label}
      </button>
    </ModalActionRow>
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
  const [validation, setValidation] = useState<{
    name?: string;
    type?: string;
  }>({});
  const [nameTouched, setNameTouched] = useState(false);
  const initialName = space?.name ?? '';
  const initialType = space?.type ?? '';
  const dirty =
    name !== initialName ||
    type !== initialType ||
    (addingType && typeDraftDirty);
  function close() {
    if (dirty && !window.confirm('Discard unsaved space changes?')) return;
    onClose();
  }
  return (
    <FormDialog
      title={space ? 'Edit space' : 'Create a space'}
      description="Add a named location to this branch. Choose an existing type or create one for the organization."
      initialFocusRef={nameRef}
      size="form"
      pending={pending || typePending}
      onClose={close}
    >
      <form
        className="mt-6 grid gap-6"
        onSubmit={(event) => {
          event.preventDefault();
          if (lock.current || typePending || !types || typesError) return;
          const parsed = spaceFormSchema.safeParse({ name, type });
          if (!parsed.success) {
            const field =
              parsed.error.issues[0].path[0] === 'type' ? 'type' : 'name';
            setValidation({ [field]: parsed.error.issues[0].message });
            if (field === 'name') setNameTouched(true);
            setError(null);
            if (field === 'name') nameRef.current?.focus();
            else typeRef.current?.querySelector('button')?.focus();
            return;
          }
          lock.current = true;
          setPending(true);
          setError(null);
          setValidation({});
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
        <div className="grid gap-5 md:grid-cols-2 md:items-start">
          <TextField
            label="Space name"
            hint="Name people can recognize quickly"
            containerClassName="md:col-span-2"
            required
            maxLength={120}
            disabled={pending}
            value={name}
            ref={nameRef}
            error={validation.name}
            autoComplete="off"
            placeholder="e.g. Rack A1"
            onBlur={() => {
              setNameTouched(true);
              setValidation((current) => ({
                ...current,
                name: name.trim() ? undefined : 'Enter a space name.',
              }));
            }}
            onChange={(event) => {
              const value = event.target.value;
              setName(value);
              setError(null);
              setValidation((current) => ({
                ...current,
                name:
                  nameTouched && !value.trim()
                    ? 'Enter a space name.'
                    : undefined,
              }));
            }}
          />
          <div ref={typeRef} className="grid min-w-0 gap-3 md:col-span-2">
            {addingType ? (
              <SpaceTypeCreator
                compact
                organizationId={organizationId}
                onPendingChange={setTypePending}
                onDirtyChange={setTypeDraftDirty}
                onDiscard={() => setAddingType(false)}
                onCreated={(created) => {
                  setType(created.name);
                  setAddingType(false);
                  setError(null);
                  setValidation({});
                  reloadTypes();
                  onTypeCreated?.();
                }}
              />
            ) : (
              <>
                <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
                  <label htmlFor="space-type" className="grid gap-2">
                    <span className="text-label font-semibold text-ink">
                      Space type
                    </span>
                    <SelectControl
                      id="space-type"
                      aria-label="Space type"
                      aria-invalid={Boolean(validation.type)}
                      aria-describedby={`${errorId}-type-hint${validation.type ? ` ${errorId}-type-error` : ''}`}
                      className={control}
                      required
                      value={type}
                      disabled={
                        pending || typePending || !types || !!typesError
                      }
                      onValueChange={(value) => {
                        setType(value);
                        setError(null);
                        setValidation((current) => ({
                          ...current,
                          type: undefined,
                        }));
                        setAddingType(false);
                      }}
                    >
                      <option value="">
                        {types ? 'Choose a type' : 'Loading types…'}
                      </option>
                      {space &&
                        !types?.some((row) => row.name === space.type) && (
                          <option value={space.type}>{space.type}</option>
                        )}
                      {types?.map((row) => (
                        <option key={row.id} value={row.name}>
                          {row.name}
                        </option>
                      ))}
                    </SelectControl>
                  </label>
                  <button
                    type="button"
                    className={buttonStyles({
                      variant: 'secondary',
                      className: 'w-full md:w-fit',
                    })}
                    disabled={pending || typePending}
                    onClick={() => setAddingType(true)}
                  >
                    Create a new type
                  </button>
                </div>
                <p
                  id={`${errorId}-type-hint`}
                  className="text-xs leading-5 text-muted"
                >
                  Shared across branches.
                </p>
              </>
            )}
            {typesError && (
              <div className="grid gap-2" role="alert">
                <p className="text-sm text-danger">{typesError}</p>
                <button
                  type="button"
                  className={buttonStyles({ variant: 'quiet' })}
                  disabled={pending || typePending}
                  onClick={reloadTypes}
                >
                  Retry loading types
                </button>
              </div>
            )}
            {validation.type && (
              <p
                id={`${errorId}-type-error`}
                className="text-sm text-danger"
                role="alert"
              >
                {validation.type}
              </p>
            )}
          </div>
        </div>
        <Actions
          pending={pending || typePending}
          onClose={space ? close : onClose}
          disabled={!types || !!typesError || !type || typePending}
          feedback={error}
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
      description="Choose an active merchant and branch space. Leave start blank to use today, or enable past occupancy to record a completed date range."
      pending={pending}
      size="form"
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
        {readError && (
          <button
            className={buttonStyles({ variant: 'quiet' })}
            type="button"
            onClick={() => setRetry((value) => value + 1)}
          >
            Retry assignment choices
          </button>
        )}
        <div className="flex items-center justify-between gap-4 rounded-control border border-control-border bg-subtle px-3 py-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold">
              Record a completed past occupancy
            </p>
            <p className="mt-1 text-xs leading-5 text-muted">
              Turn this on to enter a completed date range.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-label="Record a completed past occupancy"
            aria-checked={historical}
            disabled={pending || historyOnly}
            className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-60 ${historical ? 'border-ink bg-ink' : 'border-control-border bg-surface'}`}
            onClick={() => {
              setHistorical(!historical);
              setSpaceId(space?.id ?? '');
            }}
          >
            <span
              aria-hidden="true"
              className={`size-5 rounded-full border border-control-border bg-surface transition-transform ${historical ? 'translate-x-6' : 'translate-x-1'}`}
            />
          </button>
        </div>
        <div className="grid gap-5 md:grid-cols-2">
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
          {space ? (
            <div className="grid content-end gap-2 text-sm">
              <span className="font-semibold">Space</span>
              <p className="min-h-11 rounded-full border border-control-border bg-subtle px-4 py-2.5 font-normal text-muted">
                {space.name} · {space.type}
              </p>
            </div>
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
        </div>
        {choices && !choices.length && (
          <p className="text-sm text-muted">
            No active merchant participation is available. Configure it in the
            Branches or Merchants section first.
          </p>
        )}
        {spaces && !spaces.length && (
          <p className="text-sm text-muted">
            This branch has no active spaces. Add a space from its branch detail
            first.
          </p>
        )}
        <div className={historical ? 'grid gap-5 md:grid-cols-2' : undefined}>
          <label className="grid gap-2 text-sm font-semibold">
            Start date
            {!historical && (
              <span className="font-normal text-muted">
                Optional; leave blank to use today.
              </span>
            )}
            <InputControl
              icon="calendar"
              className="font-normal text-muted"
              type="date"
              placeholder="e.g. 2026-10-20"
              value={start}
              required={historical}
              disabled={pending}
              onChange={(e) => setStart(e.target.value)}
            />
          </label>
          {historical && (
            <label className="grid gap-2 text-sm font-semibold">
              End date
              <InputControl
                icon="calendar"
                className="font-normal text-muted"
                type="date"
                placeholder="e.g. 2026-10-20"
                value={end}
                required
                disabled={pending}
                onChange={(e) => setEnd(e.target.value)}
              />
            </label>
          )}
        </div>
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
          feedback={error}
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
      description={`End ${occupancy.merchant.name}’s occupancy and retain its history. Leave the date blank to release today.`}
      pending={pending}
      size="form"
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
              throw new Error(
                'End date must be after start and no later than today.',
              );
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
        <label className="grid gap-2 text-sm font-semibold">
          End date
          <InputControl
            icon="calendar"
            type="date"
            className="font-normal text-muted"
            placeholder="e.g. 2026-10-20"
            value={end}
            disabled={pending}
            onChange={(e) => setEnd(e.target.value)}
          />
        </label>
        <Actions
          pending={pending}
          onClose={onClose}
          feedback={error}
          label="Release space"
        />
      </form>
    </FormDialog>
  );
}
