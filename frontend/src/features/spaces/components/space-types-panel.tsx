'use client';
import { useEffect, useState } from 'react';
import { useOrganizationWorkspaceContext } from '@/features/organizations/components/organization-workspace-context';
import { EmptyState } from '@/shared/components/ui/empty-state';
import { RequestError } from '@/shared/components/ui/request-error';
import { useSpaceTypes } from '../model/use-space-types';
import { SpaceTypeCreator } from './space-type-creator';
import { Icon } from '@/shared/components/ui/icon';

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
  const { types, error, reload } = useSpaceTypes(
    organizationId,
    0,
    !!organization && ['OWNER', 'MANAGER'].includes(organization.role),
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
  if (!organization || !['OWNER', 'MANAGER'].includes(organization.role))
    return null;
  const filtered = types?.filter((type) =>
    type.name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()),
  );
  return (
    <section className="mt-4 min-w-0 bg-surface py-4" aria-label="Space types">
      <div className="border-b border-hairline pb-4">
        <div className="min-w-0">
          <h2 className="text-xl font-semibold tracking-tight">Space types</h2>
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
              <li className="data-column-header grid grid-cols-[minmax(0,1fr)_auto] gap-4">
                <span>Type</span>
                <span>Scope</span>
              </li>
              {filtered.map((type) => (
                <li
                  key={type.id}
                  className="data-row grid grid-cols-[minmax(0,1fr)_auto] gap-4 px-3 py-4 text-sm sm:px-4"
                >
                  <span className="font-semibold">{type.name}</span>
                  <span className="text-muted">All branches</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
