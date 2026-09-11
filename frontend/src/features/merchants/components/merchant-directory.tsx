'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
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
import type { Merchant, MerchantStatus } from '../model/merchant.types';
import { MerchantForm } from './merchant-form';
import { MerchantStatusBadge } from './merchant-status-badge';

function errorMessage(cause: unknown): string {
  return cause instanceof ApiError
    ? cause.message
    : 'The merchant directory could not be loaded.';
}

export function MerchantDirectory({
  organizationId,
}: {
  organizationId: string;
}) {
  const { request } = useAuth();
  const { organization, organizationStatus } =
    useOrganizationWorkspaceContext();
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<MerchantStatus | ''>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const debouncedSearch = useDebouncedValue(search);

  const load = useCallback(async () => {
    await Promise.resolve();
    setLoading(true);
    setError(null);
    try {
      setMerchants(
        await listMerchants(request, organizationId, {
          q: debouncedSearch.trim() || undefined,
          status: status || undefined,
        }),
      );
    } catch (cause: unknown) {
      setError(errorMessage(cause));
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, organizationId, request, status]);

  useEffect(() => {
    if (!organization || !['OWNER', 'MANAGER'].includes(organization.role))
      return;
    let active = true;
    void listMerchants(request, organizationId, {
      q: debouncedSearch.trim() || undefined,
      status: status || undefined,
    })
      .then((result) => {
        if (!active) return;
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
  }, [debouncedSearch, organization, organizationId, request, status]);

  if (organizationStatus === 'loading') {
    return (
      <ListSkeleton
        className="mx-auto mt-6 max-w-7xl"
        label="Loading merchant directory"
      />
    );
  }
  if (!organization || !['OWNER', 'MANAGER'].includes(organization.role)) {
    return (
      <section className="mx-auto mt-8 max-w-3xl" role="alert">
        <h1 className="text-3xl font-bold">Merchant directory unavailable</h1>
        <p className="mt-3 text-slate-500">
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
        description="Maintain the business and contact identities for merchants in this organization."
      />
      {success ? <StatusNotice>{success}</StatusNotice> : null}
      <OperationalPanel
        title="Merchant directory"
        description={`${merchants.length} matching merchant${merchants.length === 1 ? '' : 's'}`}
        action={
          <button
            className="min-h-11 cursor-pointer rounded-lg border-0 bg-emerald-600 px-4 font-bold text-white hover:bg-emerald-700"
            onClick={() => {
              setSuccess(null);
              setShowCreate(true);
            }}
            type="button"
          >
            Add merchant
          </button>
        }
      >
        <OperationalToolbar className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(12rem,0.35fr)]">
          <FilterField id="merchant-search" label="Search">
            <input
              className="min-h-11 rounded-lg border border-slate-200 bg-white px-3"
              id="merchant-search"
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Business, code, contact, email, or phone"
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
            <p className="mx-auto mt-2 max-w-md text-slate-500">
              {search || status
                ? 'Try a different search or lifecycle status.'
                : 'Add the first merchant business profile for this organization.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[48rem] border-collapse text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-6 py-3">Merchant</th>
                  <th className="px-4 py-3">Contact</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-6 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {merchants.map((merchant) => (
                  <tr key={merchant.id}>
                    <td className="px-6 py-4">
                      <p className="font-bold text-slate-950">
                        {merchant.name}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {merchant.code ?? 'No code'}
                      </p>
                    </td>
                    <td className="px-4 py-4">
                      <p>{merchant.contactName}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {merchant.email ?? merchant.phone}
                      </p>
                    </td>
                    <td className="px-4 py-4">
                      <MerchantStatusBadge status={merchant.status} />
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link
                        className="font-bold text-emerald-700 no-underline"
                        href={`/app/organizations/${organizationId}/merchants/${merchant.id}`}
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </OperationalPanel>
      {showCreate ? (
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

  useEffect(() => {
    headingRef.current?.focus();
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') onCancel();
    }
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [onCancel]);

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-950/40 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
      role="presentation"
    >
      <section
        aria-labelledby="create-merchant-title"
        aria-modal="true"
        className="my-auto max-h-[calc(100vh-2rem)] w-full max-w-3xl overflow-y-auto rounded-xl border border-slate-200 bg-white p-6 shadow-xl sm:p-8"
        role="dialog"
      >
        <p className="text-xs font-bold tracking-wider text-emerald-700 uppercase">
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
        <p className="mt-2 text-slate-500">
          Record the business and primary contact information. New merchants
          start as active.
        </p>
        <MerchantForm
          organizationId={organizationId}
          onCancel={onCancel}
          onSaved={onSaved}
        />
      </section>
    </div>
  );
}
