'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ListSkeleton } from '@/components/ui/list-skeleton';
import { RequestError } from '@/components/ui/request-error';
import { SelectControl } from '@/components/ui/select-control';
import { ApiError } from '@/features/auth/auth-client';
import { useAuth } from '@/features/auth/auth-context';
import { OrganizationPageHeader } from '@/features/organizations/organization-page-header';
import { useOrganizationWorkspaceContext } from '@/features/organizations/organization-workspace-context';
import {
  createMerchantAgreement,
  listOrganizationAgreements,
} from './merchant-agreement-api';
import { AgreementForm } from './merchant-agreement-management';
import type {
  AgreementStatus,
  AgreementType,
  MerchantAgreement,
  MerchantAgreementInput,
} from './merchant-agreement.types';

const statusLabels: Record<AgreementStatus, string> = {
  DRAFT: 'Draft',
  ACTIVE: 'Active',
  ENDED: 'Ended',
};

function agreementType(agreement: MerchantAgreement): AgreementType {
  if (agreement.fixedRentAmount && agreement.commissionRate) return 'HYBRID';
  if (agreement.fixedRentAmount) return 'FIXED_RENT';
  if (agreement.commissionRate) return 'COMMISSION';
  return 'UNSET';
}

const typeLabels: Record<AgreementType, string> = {
  FIXED_RENT: 'Fixed rent',
  COMMISSION: 'Commission',
  HYBRID: 'Rent + commission',
  UNSET: 'Terms not set',
};

function displayDate(value: string): string {
  return new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium' }).format(
    new Date(`${value.slice(0, 10)}T00:00:00`),
  );
}

function errorMessage(cause: unknown): string {
  return cause instanceof ApiError
    ? cause.message
    : 'The agreements could not be loaded.';
}

export function OrganizationAgreementsPage({
  organizationId,
}: {
  organizationId: string;
}) {
  const searchParams = useSearchParams();
  const { request } = useAuth();
  const {
    organization,
    organizationStatus,
    merchants,
    merchantsStatus,
    loadMerchants,
  } = useOrganizationWorkspaceContext();
  const [agreements, setAgreements] = useState<MerchantAgreement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [merchantId, setMerchantId] = useState(
    searchParams.get('merchantId') ?? '',
  );
  const [status, setStatus] = useState('');
  const [type, setType] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [newMerchantId, setNewMerchantId] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      setAgreements(await listOrganizationAgreements(request, organizationId));
    } catch (cause: unknown) {
      setLoadError(errorMessage(cause));
    } finally {
      setIsLoading(false);
    }
  }, [organizationId, request]);

  useEffect(() => {
    if (merchantsStatus === 'idle') {
      void loadMerchants().catch(() => undefined);
    }
  }, [loadMerchants, merchantsStatus]);

  useEffect(() => {
    let active = true;
    void listOrganizationAgreements(request, organizationId)
      .then((result) => {
        if (active) setAgreements(result);
      })
      .catch((cause: unknown) => {
        if (active) setLoadError(errorMessage(cause));
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [organizationId, request]);

  const visibleAgreements = useMemo(
    () =>
      agreements.filter(
        (agreement) =>
          (!merchantId || agreement.merchantId === merchantId) &&
          (!status || agreement.status === status) &&
          (!type || agreementType(agreement) === type) &&
          (!fromDate || agreement.startDate.slice(0, 10) >= fromDate) &&
          (!toDate || agreement.startDate.slice(0, 10) <= toDate),
      ),
    [agreements, fromDate, merchantId, status, toDate, type],
  );

  async function handleCreate(input: MerchantAgreementInput) {
    if (!newMerchantId) {
      setActionError('Select a merchant for this agreement.');
      return;
    }
    setIsSaving(true);
    setActionError(null);
    try {
      await createMerchantAgreement(
        request,
        organizationId,
        newMerchantId,
        input,
      );
      setIsFormOpen(false);
      setNewMerchantId('');
      await load();
    } catch (cause: unknown) {
      setActionError(errorMessage(cause));
    } finally {
      setIsSaving(false);
    }
  }

  if (organizationStatus === 'loading' || !organization) {
    return (
      <p className="mt-12" role="status">
        Loading agreements…
      </p>
    );
  }

  return (
    <section className="mx-auto mt-8 w-full sm:mt-12">
      <OrganizationPageHeader
        organization={organization}
        title="Agreements"
        description="Review commercial terms across every merchant in this organization."
      />
      <section className="mt-6 rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex items-start justify-between gap-4 max-sm:grid">
          <div>
            <h2 className="text-base font-bold">Agreement register</h2>
            <p className="mt-2 text-sm text-slate-500">
              {visibleAgreements.length} matching agreements
            </p>
          </div>
          <button
            className="min-h-11 rounded-[0.65rem] border-0 bg-emerald-600 px-4 font-bold text-white"
            type="button"
            onClick={() => setIsFormOpen(true)}
          >
            Add agreement
          </button>
        </div>

        <div className="mt-5 grid items-end gap-4 border-y border-slate-200 bg-slate-50/60 py-5 sm:grid-cols-2 xl:grid-cols-5">
          <FilterSelect
            label="Merchant"
            value={merchantId}
            onChange={setMerchantId}
          >
            <option value="">All merchants</option>
            {merchants.map((merchant) => (
              <option key={merchant.id} value={merchant.id}>
                {merchant.name}
              </option>
            ))}
          </FilterSelect>
          <FilterSelect label="Status" value={status} onChange={setStatus}>
            <option value="">All statuses</option>
            {Object.entries(statusLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </FilterSelect>
          <FilterSelect label="Agreement type" value={type} onChange={setType}>
            <option value="">All types</option>
            {Object.entries(typeLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </FilterSelect>
          <DateFilter
            label="Starts from"
            value={fromDate}
            onChange={setFromDate}
          />
          <DateFilter
            label="Starts through"
            value={toDate}
            onChange={setToDate}
          />
        </div>

        {isLoading ? (
          <ListSkeleton label="Loading agreements" rowClassName="h-16" />
        ) : loadError ? (
          <RequestError
            className="py-8"
            message={loadError}
            onRetry={() => void load()}
          />
        ) : visibleAgreements.length === 0 ? (
          <p className="py-10 text-center text-slate-500">
            No agreements match these filters.
          </p>
        ) : (
          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[52rem] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs text-slate-500 uppercase">
                  <th className="px-3 py-3">Merchant</th>
                  <th className="px-3 py-3">Type</th>
                  <th className="px-3 py-3">Term</th>
                  <th className="px-3 py-3">Schedule</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {visibleAgreements.map((agreement) => (
                  <tr key={agreement.id}>
                    <td className="px-3 py-4 font-bold">
                      {agreement.merchant?.name ??
                        merchants.find(
                          (item) => item.id === agreement.merchantId,
                        )?.name ??
                        'Merchant'}
                    </td>
                    <td className="px-3 py-4">
                      {typeLabels[agreementType(agreement)]}
                    </td>
                    <td className="px-3 py-4 text-slate-600">
                      {displayDate(agreement.startDate)} –{' '}
                      {agreement.endDate
                        ? displayDate(agreement.endDate)
                        : 'Open-ended'}
                    </td>
                    <td className="px-3 py-4">
                      {agreement.settlementSchedule.replace('_', '-')}
                    </td>
                    <td className="px-3 py-4">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-bold ${agreement.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}
                      >
                        {statusLabels[agreement.status]}
                      </span>
                    </td>
                    <td className="px-3 py-4 text-right">
                      <Link
                        className="font-bold text-emerald-700 underline underline-offset-3"
                        href={`/app/organizations/${organizationId}/agreements/${agreement.id}`}
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
      </section>

      {isFormOpen ? (
        <div
          className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-950/45 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Add agreement"
        >
          <div className="w-full max-w-2xl rounded-xl bg-white p-6 shadow-xl">
            {actionError ? (
              <p
                className="mb-4 rounded-lg border border-red-600 p-3 text-sm text-red-600"
                role="alert"
              >
                {actionError}
              </p>
            ) : null}
            <div className="mb-5 grid gap-2">
              <label
                className="text-sm font-bold"
                htmlFor="new-agreement-merchant"
              >
                Merchant
              </label>
              <SelectControl
                id="new-agreement-merchant"
                value={newMerchantId}
                onValueChange={setNewMerchantId}
              >
                <option value="" disabled>
                  Select a merchant
                </option>
                {merchants.map((merchant) => (
                  <option key={merchant.id} value={merchant.id}>
                    {merchant.name}
                  </option>
                ))}
              </SelectControl>
            </div>
            <AgreementForm
              agreement={null}
              isSubmitting={isSaving}
              onSaved={handleCreate}
              onCancel={() => {
                setActionError(null);
                setIsFormOpen(false);
              }}
            />
          </div>
        </div>
      ) : null}
    </section>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange(value: string): void;
  children: React.ReactNode;
}) {
  const id = `agreement-filter-${label.toLowerCase().replaceAll(' ', '-')}`;
  return (
    <div className="grid gap-2">
      <label className="text-sm font-bold" htmlFor={id}>
        {label}
      </label>
      <SelectControl id={id} value={value} onValueChange={onChange}>
        {children}
      </SelectControl>
    </div>
  );
}

function DateFilter({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange(value: string): void;
}) {
  const id = `agreement-filter-${label.toLowerCase().replaceAll(' ', '-')}`;
  return (
    <div className="grid gap-2">
      <label className="text-sm font-bold" htmlFor={id}>
        {label}
      </label>
      <input
        className="min-h-11 rounded-[0.6rem] border border-slate-200 bg-white px-3"
        id={id}
        type="date"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}
