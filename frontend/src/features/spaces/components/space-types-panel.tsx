'use client';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useAuth } from '@/features/auth/model/auth-context';
import { useOrganizationWorkspaceContext } from '@/features/organizations/components/organization-workspace-context';
import { EmptyState } from '@/shared/components/ui/empty-state';
import { RequestError } from '@/shared/components/ui/request-error';
import { useSpaceTypes } from '../model/use-space-types';
import { SpaceTypeCreator } from './space-type-creator';
import { Icon } from '@/shared/components/ui/icon';
import { FormDialog } from '@/shared/components/ui/form-dialog';
import { ModalActionRow } from '@/shared/components/ui/modal-action-row';
import { InputControl } from '@/shared/components/ui/input-control';
import { buttonStyles } from '@/shared/components/ui/button';
import { useConfirmationDialog } from '@/shared/components/ui/confirmation-dialog';
import { updateSpaceType } from '../api/space-api';
import type { SpaceType } from '../model/space.schemas';

export function SpaceTypesPanel({
  organizationId,
  onPendingChange,
  onNavigationGuard,
}: {
  organizationId: string;
  onPendingChange?(pending: boolean): void;
  onNavigationGuard?(guard: () => boolean): void;
}) {
  const { organization } = useOrganizationWorkspaceContext();
  const { request } = useAuth();
  const { types, error, reload } = useSpaceTypes(
    organizationId,
    0,
    !!organization && ['OWNER', 'MANAGER'].includes(organization.role),
    { includeArchived: organization?.role === 'OWNER' },
  );
  const [dirty, setDirty] = useState(false);
  const [pending, setPending] = useState(false);
  useEffect(() => {
    onNavigationGuard?.(
      () =>
        !pending && (!dirty || window.confirm('Discard unsaved type changes?')),
    );
  }, [onNavigationGuard, pending, dirty]);
  const [search, setSearch] = useState('');
  const [success, setSuccess] = useState<string | null>(null);
  const [editing, setEditing] = useState<SpaceType | null>(null);
  const { confirm, confirmationDialog } = useConfirmationDialog();
  const [actionPending, setActionPending] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  async function setArchived(type: SpaceType, archived: boolean) {
    if (
      !(await confirm({
        title: `${archived ? 'Archive' : 'Reactivate'} ${type.name}?`,
        description: archived
          ? 'Existing spaces keep this type, but new spaces cannot select it until it is reactivated.'
          : 'This type will be available for new spaces and type changes again.',
        confirmLabel: archived ? 'Archive type' : 'Reactivate type',
        tone: archived ? 'danger' : 'primary',
      }))
    )
      return;
    setActionPending(true);
    setActionError(null);
    try {
      await updateSpaceType(request, organizationId, type.id, {
        archived,
        expectedVersion: type.version,
      });
      setSuccess(`${type.name} ${archived ? 'archived' : 'reactivated'}.`);
      reload();
    } catch (cause) {
      setSuccess(null);
      setActionError(
        cause instanceof Error ? cause.message : 'Type could not be updated.',
      );
    } finally {
      setActionPending(false);
    }
  }
  if (!organization || !['OWNER', 'MANAGER'].includes(organization.role))
    return null;
  const filtered = types?.filter((type) =>
    type.name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()),
  );
  return (
    <>
      {confirmationDialog}
      {editing ? (
        <SpaceTypeEditor
          organizationId={organizationId}
          type={editing}
          onClose={() => setEditing(null)}
          onSaved={(updated) => {
            setEditing(null);
            setSuccess(`${updated.name} updated.`);
            reload();
          }}
        />
      ) : null}
      <section
        className="mt-5 min-w-0 card-surface p-5 sm:p-6"
        aria-label="Space types"
      >
        <div className="border-b border-hairline pb-4">
          <div className="min-w-0">
            <h2 className="text-xl font-semibold tracking-tight">
              Space types
            </h2>
            <p className="mt-1.5 max-w-2xl text-sm leading-6 text-muted">
              Organize spaces with types shared across your branches.
            </p>
          </div>
        </div>
        <div
          className={`mt-5 grid gap-8 ${organization.role === 'OWNER' ? 'lg:grid-cols-[minmax(16rem,0.75fr)_minmax(0,1.5fr)]' : ''}`}
        >
          {organization.role === 'OWNER' && (
            <div className="border-b border-hairline pb-6 lg:border-r lg:border-b-0 lg:pr-8 lg:pb-0">
              <h3 className="text-sm font-semibold">Add a type</h3>
              <p className="mt-1.5 text-sm leading-6 text-muted">
                Create a shared label once, then use it across every branch.
              </p>
              <div className="mt-5">
                <SpaceTypeCreator
                  organizationId={organizationId}
                  onDirtyChange={setDirty}
                  onPendingChange={(value) => {
                    setPending(value);
                    onPendingChange?.(value);
                  }}
                  onCreated={(type) => {
                    setSuccess(`${type.name} added.`);
                    reload();
                  }}
                />
              </div>
            </div>
          )}
          <div className="min-w-0">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h3 className="text-sm font-semibold">Type catalog</h3>
                <p className="mt-1 text-sm text-muted">
                  {types
                    ? `${types.length} ${types.length === 1 ? 'type' : 'types'} available`
                    : 'Loading types…'}
                </p>
              </div>
              <label className="grid w-full max-w-sm gap-2 text-sm font-medium sm:w-72">
                <span className="sr-only">Search types</span>
                <span className="relative">
                  <Icon
                    name="search"
                    className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted"
                  />
                  <input
                    type="search"
                    className="min-h-11 w-full rounded-full border border-control-border bg-subtle py-2 pr-4 pl-10"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search types"
                  />
                </span>
              </label>
            </div>
            {success && (
              <p role="status" className="mt-4 text-sm text-success-ink">
                {success}
              </p>
            )}
            {actionError && (
              <p role="alert" className="mt-4 text-sm text-danger">
                {actionError}
              </p>
            )}
            {error ? (
              <RequestError message={error} onRetry={reload} />
            ) : !types ? (
              <p role="status" className="mt-5">
                Loading space types…
              </p>
            ) : !filtered?.length ? (
              <EmptyState
                className="mt-5"
                title={
                  types.length
                    ? 'No types match your search.'
                    : 'No space types yet.'
                }
              />
            ) : (
              <ul className="mt-5 divide-y divide-hairline border-y border-hairline">
                <li className="data-column-header grid grid-cols-[minmax(0,1fr)_auto_auto] gap-4">
                  <span>Type</span>
                  <span>Status</span>
                  {organization.role === 'OWNER' ? <span>Action</span> : null}
                </li>
                {filtered.map((type) => (
                  <li
                    key={type.id}
                    className="data-row grid grid-cols-[minmax(0,1fr)_auto_auto] gap-4 px-3 py-4 text-sm sm:px-4"
                  >
                    <div className="min-w-0">
                      <span className="font-semibold">{type.name}</span>
                      <p className="mt-1 text-xs text-muted">All branches</p>
                    </div>
                    <span
                      className={
                        type.archived ? 'text-danger' : 'text-success-ink'
                      }
                    >
                      {type.archived ? 'Archived' : 'Active'}
                    </span>
                    {organization.role === 'OWNER' ? (
                      <div className="flex flex-wrap justify-start gap-2">
                        <button
                          type="button"
                          className={buttonStyles({
                            variant: 'quiet',
                            className: 'text-sm font-semibold',
                          })}
                          disabled={actionPending}
                          onClick={() => setEditing(type)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className={buttonStyles({
                            variant: 'quiet',
                            className: type.archived
                              ? 'text-sm font-semibold'
                              : 'text-sm font-semibold text-danger hover:text-danger',
                          })}
                          disabled={actionPending}
                          onClick={() => void setArchived(type, !type.archived)}
                        >
                          {type.archived ? 'Reactivate' : 'Archive'}
                        </button>
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>
    </>
  );
}

function SpaceTypeEditor({
  organizationId,
  type,
  onClose,
  onSaved,
}: {
  organizationId: string;
  type: SpaceType;
  onClose(): void;
  onSaved(type: SpaceType): void;
}) {
  const { request } = useAuth();
  const [name, setName] = useState(type.name);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  async function save(event: FormEvent) {
    event.preventDefault();
    const value = name.trim();
    if (!value || value.length > 80) {
      setError('Enter a type name with 1–80 characters.');
      return;
    }
    setPending(true);
    setError(null);
    try {
      const updated = await updateSpaceType(request, organizationId, type.id, {
        name: value,
        expectedVersion: type.version,
      });
      onSaved(updated);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Type could not be updated.',
      );
    } finally {
      setPending(false);
    }
  }
  return (
    <FormDialog
      title={`Edit ${type.name}`}
      description="Renaming updates the label everywhere while preserving existing spaces and occupancy history."
      size="compact"
      initialFocusRef={inputRef}
      pending={pending}
      onClose={onClose}
    >
      <form className="mt-6 grid gap-6" onSubmit={save}>
        <label
          className="grid gap-2 text-sm font-medium"
          htmlFor="space-type-name"
        >
          Type name
          <InputControl
            ref={inputRef}
            id="space-type-name"
            icon="tag"
            placeholder="e.g. Wall rack"
            maxLength={80}
            value={name}
            disabled={pending}
            aria-invalid={Boolean(error)}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <ModalActionRow
          feedback={
            error ? (
              <p role="alert" className="text-sm text-danger">
                {error}
              </p>
            ) : null
          }
        >
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
            disabled={pending || !name.trim()}
          >
            {pending ? 'Saving…' : 'Save changes'}
          </button>
        </ModalActionRow>
      </form>
    </FormDialog>
  );
}
