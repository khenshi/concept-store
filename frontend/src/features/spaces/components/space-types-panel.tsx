'use client';
import { useEffect, useState } from 'react';
import { useOrganizationWorkspaceContext } from '@/features/organizations/components/organization-workspace-context';
import { RequestError } from '@/shared/components/ui/request-error';
import { useSpaceTypes } from '../model/use-space-types';
import { SpaceTypeCreator } from './space-type-creator';

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
    <section className="mt-8 grid gap-6" aria-label="Space types">
      <div>
        <h2 className="text-lg font-semibold">Types</h2>
        <p className="mt-2 text-sm text-muted">
          Organize spaces with types shared across your branches.
        </p>
      </div>
      {organization.role === 'OWNER' && (
        <div className="max-w-xl">
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
      )}
      {success && (
        <p role="status" className="text-sm text-success-ink">
          {success}
        </p>
      )}
      <label className="grid max-w-xl gap-2 text-sm font-medium">
        Search types
        <input
          type="search"
          className="min-h-11 rounded-control border border-control-border bg-surface px-3"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </label>
      {error ? (
        <RequestError message={error} onRetry={reload} />
      ) : !types ? (
        <p role="status">Loading space types…</p>
      ) : !filtered?.length ? (
        <p role="status">
          {types.length ? 'No types match your search.' : 'No space types yet.'}
        </p>
      ) : (
        <ul className="divide-y divide-hairline border-y border-hairline">
          {filtered.map((type) => (
            <li key={type.id} className="py-4 text-sm font-medium">
              {type.name}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
