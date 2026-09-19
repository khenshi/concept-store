'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { buttonStyles } from '@/shared/components/ui/button';
import { Icon } from '@/shared/components/ui/icon';
import { ApiError } from '@/features/auth/api/auth-client';
import { useAuth } from '@/features/auth/model/auth-context';
import { OrganizationPageHeader } from '@/features/organizations/components/organization-page-header';
import { useOrganizationWorkspaceContext } from '@/features/organizations/components/organization-workspace-context';
import { ListSkeleton } from '@/shared/components/ui/list-skeleton';
import {
  FilterField,
  OperationalPage,
  OperationalPanel,
  OperationalToolbar,
  StatusNotice,
} from '@/shared/components/ui/operational-page';
import { RequestError } from '@/shared/components/ui/request-error';
import { SelectControl } from '@/shared/components/ui/select-control';
import { useDebouncedValue } from '@/shared/hooks/use-debounced-value';
import { listMerchants } from '../api/merchant-api';
import type {
  Merchant,
  MerchantView,
  MerchantStatus,
} from '../model/merchant.types';
import { MerchantForm } from './merchant-form';
import { MerchantStatusBadge } from './merchant-status-badge';

function errorMessage(cause: unknown): string {
  return cause instanceof ApiError
    ? cause.message
    : 'The merchant directory could not be loaded.';
}

export function MerchantDirectory(props: { organizationId: string }) {
  const { organization } = useOrganizationWorkspaceContext();
  return (
    <ScopedMerchantDirectory
      key={`${props.organizationId}:${organization?.role}`}
      {...props}
    />
  );
}

function ScopedMerchantDirectory({
  organizationId,
}: {
  organizationId: string;
}) {
  const { request } = useAuth();
  const { organization, organizationStatus } =
    useOrganizationWorkspaceContext();
  const canEdit = organization?.role === 'OWNER';
  const [merchants, setMerchants] = useState<MerchantView[]>([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<MerchantStatus | ''>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const debouncedSearch = useDebouncedValue(search);
  const [revision, setRevision] = useState(0);
  const load = () => setRevision((value) => value + 1);

  useEffect(() => {
    if (
      !organization ||
      !['OWNER', 'MANAGER', 'MERCHANT'].includes(organization.role)
    )
      return;
    let active = true;
    void Promise.resolve()
      .then(() => {
        if (!active) return;
        setLoading(true);
        setMerchants([]);
        setError(null);
        return listMerchants(
          request,
          organizationId,
          {
            q: debouncedSearch.trim() || undefined,
            status: status || undefined,
          },
          organization.role,
        );
      })
      .then((result) => {
        if (!active || !result) return;
        setMerchants(result);
        setError(null);
        setLoading(false);
      })
      .catch((cause: unknown) => {
        if (!active) return;
        setError(errorMessage(cause));
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [
    debouncedSearch,
    organization,
    organizationId,
    request,
    status,
    revision,
  ]);

  if (organizationStatus === 'loading') {
    return (
      <ListSkeleton
        className="mx-auto mt-6 max-w-7xl"
        label="Loading merchant directory"
      />
    );
  }
  if (
    !organization ||
    !['OWNER', 'MANAGER', 'MERCHANT'].includes(organization.role)
  ) {
    return (
      <section className="mx-auto mt-8 max-w-3xl" role="alert">
        <h1 className="text-3xl font-bold">Merchant directory unavailable</h1>
        <p className="mt-3 text-muted">
          Your organization role cannot manage merchant profiles.
        </p>
      </section>
    );
  }

  return (
    <OperationalPage>
      <OrganizationPageHeader
        organization={organization}
        title="Merchants"
        description={
          canEdit
            ? 'Maintain the business and contact identities for merchants in this organization.'
            : organization.role === 'MERCHANT'
              ? 'Read your linked merchant profile. Ask an owner to update your access or profile.'
              : 'Read merchant identities represented in your assigned branches. Contact details and catalog edits are owner-only.'
        }
      />
      {success ? <StatusNotice>{success}</StatusNotice> : null}
      <OperationalPanel
        variant="open"
        className="data-surface"
        title="Merchant directory"
        description={`${merchants.length} matching merchant${merchants.length === 1 ? '' : 's'}`}
        action={
          canEdit ? (
            <button
              className={buttonStyles({ variant: 'accent' })}
              onClick={() => {
                setSuccess(null);
                setShowCreate(true);
              }}
              type="button"
            >
              Add merchant
            </button>
          ) : undefined
        }
      >
        <OperationalToolbar
          variant="open"
          className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(12rem,0.35fr)]"
        >
          <FilterField id="merchant-search" label="Search">
            <input
              className="min-h-11 min-w-0 rounded-control border border-control-border bg-surface px-3 text-sm placeholder:text-faint"
              id="merchant-search"
              onChange={(event) => setSearch(event.target.value)}
              placeholder={
                organization.role === 'MANAGER'
                  ? 'Business or code'
                  : 'Business, code, contact, email, or phone'
              }
              type="search"
              value={search}
            />
          </FilterField>
          <FilterField id="merchant-status" label="Status">
            <SelectControl
              id="merchant-status"
              onValueChange={(value) => setStatus(value as MerchantStatus | '')}
              value={status}
            >
              <option value="">All statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
              <option value="SUSPENDED">Suspended</option>
              <option value="ENDED">Ended</option>
            </SelectControl>
          </FilterField>
        </OperationalToolbar>

        {loading ? (
          <div className="px-5 py-6 sm:px-6">
            <ListSkeleton label="Loading merchants" />
          </div>
        ) : error ? (
          <RequestError
            className="px-6 py-10"
            message={error}
            onRetry={() => void load()}
            title="Merchants unavailable"
          />
        ) : merchants.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <h3 className="font-bold">
              {search || status
                ? 'No merchants match these filters'
                : 'No merchants yet'}
            </h3>
            <p className="mx-auto mt-2 max-w-md text-muted">
              {search || status
                ? 'Try a different search or lifecycle status.'
                : canEdit
                  ? 'Add the first merchant business profile for this organization.'
                  : 'No merchant profiles are available to your access. Ask an owner to configure your merchant link or branch placements.'}
            </p>
          </div>
        ) : (
          <ul aria-label="Merchant directory" className="m-0 list-none p-0">
            <li className="data-column-header hidden grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(10rem,0.8fr)] gap-x-6 gap-y-3 sm:grid">
              <span>Merchant</span>
              <span>Contact</span>
              <span>Status</span>
            </li>
            {merchants.map((merchant) => (
              <li className="data-row" key={merchant.id}>
                <Link
                  className="grid min-w-0 gap-x-6 gap-y-3 px-4 py-4 text-ink no-underline sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(10rem,0.8fr)] sm:items-center"
                  href={`/app/organizations/${organizationId}/merchants/${merchant.id}`}
                  aria-label={`View ${merchant.name}`}
                >
                  <div className="min-w-0 flex-1 break-words">
                    <strong className="block text-sm font-semibold">
                      {merchant.name}
                    </strong>
                    <span className="mt-1 block text-xs text-muted">
                      {merchant.code ?? 'No code'}
                    </span>
                  </div>
                  {organization.role !== 'MANAGER' &&
                  'contactName' in merchant ? (
                    <div className="min-w-0 flex-1 break-words text-sm">
                      <span className="block">{merchant.contactName}</span>
                      <span className="mt-1 block text-xs text-muted">
                        {merchant.email ?? merchant.phone}
                      </span>
                    </div>
                  ) : (
                    <span className="text-xs text-muted">
                      Contact details restricted
                    </span>
                  )}
                  <div className="flex items-center justify-between gap-4 lg:justify-end">
                    <MerchantStatusBadge status={merchant.status} />
                    <span
                      className="flex items-center gap-2 text-xs font-medium text-muted"
                      aria-hidden="true"
                    >
                      View profile <Icon name="arrow" className="size-4" />
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </OperationalPanel>
      {showCreate && canEdit ? (
        <CreateMerchantModal
          organizationId={organizationId}
          onCancel={() => setShowCreate(false)}
          onSaved={(merchant) => {
            setShowCreate(false);
            setSuccess(`${merchant.name} was created successfully.`);
            void load();
          }}
        />
      ) : null}
    </OperationalPage>
  );
}

function CreateMerchantModal({
  organizationId,
  onCancel,
  onSaved,
}: {
  organizationId: string;
  onCancel(): void;
  onSaved(merchant: Merchant): void;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    dialog?.showModal();
    headingRef.current?.focus();
    document.body.style.overflow = 'hidden';
    return () => {
      dialog?.close();
      document.body.style.overflow = previousOverflow;
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected)
        previousFocus.focus();
    };
  }, []);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="create-merchant-title"
      aria-describedby="create-merchant-description"
      className="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%_-_2rem)] max-w-5xl overflow-y-auto rounded-panel border border-hairline bg-surface p-6 text-ink shadow-overlay backdrop:bg-ink/40 sm:p-8"
      onCancel={(event) => {
        event.preventDefault();
        if (!pending) onCancel();
      }}
      onMouseDown={(event) => {
        const bounds = event.currentTarget.getBoundingClientRect();
        if (
          !pending &&
          event.target === event.currentTarget &&
          (event.clientX < bounds.left ||
            event.clientX > bounds.right ||
            event.clientY < bounds.top ||
            event.clientY > bounds.bottom)
        )
          onCancel();
      }}
    >
      <section className="min-w-0">
        <p className="text-xs font-bold tracking-wider text-ink uppercase">
          Merchant identity
        </p>
        <h2
          className="mt-2 text-2xl font-bold outline-none"
          id="create-merchant-title"
          ref={headingRef}
          tabIndex={-1}
        >
          Add a merchant
        </h2>
        <p
          className="mt-2 text-sm leading-6 text-muted"
          id="create-merchant-description"
        >
          Record the business and primary contact information. New merchants
          start as active.
        </p>
        <MerchantForm
          organizationId={organizationId}
          onCancel={onCancel}
          onSaved={onSaved}
          onPendingChange={setPending}
        />
      </section>
    </dialog>
  );
}
