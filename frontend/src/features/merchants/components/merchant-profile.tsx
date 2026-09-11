'use client';

import { useCallback, useEffect, useState } from 'react';
import { ApiError } from '@/features/auth/api/auth-client';
import { useAuth } from '@/features/auth/model/auth-context';
import { useOrganizationWorkspaceContext } from '@/features/organizations/components/organization-workspace-context';
import { BackLink } from '@/shared/components/ui/back-link';
import { useConfirmationDialog } from '@/shared/components/ui/confirmation-dialog';
import { ListSkeleton } from '@/shared/components/ui/list-skeleton';
import { StatusNotice } from '@/shared/components/ui/operational-page';
import { RequestError } from '@/shared/components/ui/request-error';
import { SelectControl } from '@/shared/components/ui/select-control';
import { getMerchant, updateMerchantStatus } from '../api/merchant-api';
import type { Merchant, MerchantStatus } from '../model/merchant.types';
import { MerchantForm } from './merchant-form';
import { MerchantStatusBadge } from './merchant-status-badge';

function errorMessage(cause: unknown, fallback: string): string {
  return cause instanceof ApiError ? cause.message : fallback;
}

export function MerchantProfile({
  organizationId,
  merchantId,
}: {
  organizationId: string;
  merchantId: string;
}) {
  const { request } = useAuth();
  const { organization, organizationStatus } =
    useOrganizationWorkspaceContext();
  const { confirm, confirmationDialog } = useConfirmationDialog();
  const [merchant, setMerchant] = useState<Merchant | null>(null);
  const [status, setStatus] = useState<MerchantStatus>('ACTIVE');
  const [editing, setEditing] = useState(false);
  const [changingStatus, setChangingStatus] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    await Promise.resolve();
    setError(null);
    try {
      const result = await getMerchant(request, organizationId, merchantId);
      setMerchant(result);
      setStatus(result.status);
    } catch (cause: unknown) {
      setError(
        errorMessage(cause, 'The merchant profile could not be loaded.'),
      );
    }
  }, [merchantId, organizationId, request]);

  useEffect(() => {
    let active = true;
    void getMerchant(request, organizationId, merchantId)
      .then((result) => {
        if (!active) return;
        setMerchant(result);
        setStatus(result.status);
      })
      .catch((cause: unknown) => {
        if (active)
          setError(
            errorMessage(cause, 'The merchant profile could not be loaded.'),
          );
      });
    return () => {
      active = false;
    };
  }, [merchantId, organizationId, request]);

  async function changeStatus() {
    if (!merchant || status === merchant.status) return;
    const accepted = await confirm({
      title: `Change ${merchant.name} to ${status.toLowerCase()}?`,
      description:
        'This changes the merchant lifecycle state but preserves the profile and its history.',
      confirmLabel: 'Change status',
      tone: status === 'ENDED' || status === 'SUSPENDED' ? 'danger' : 'primary',
    });
    if (!accepted) return;
    setChangingStatus(true);
    setError(null);
    try {
      const saved = await updateMerchantStatus(
        request,
        organizationId,
        merchant.id,
        status,
      );
      setMerchant(saved);
      setSuccess(`${saved.name} is now ${saved.status.toLowerCase()}.`);
    } catch (cause: unknown) {
      setError(
        errorMessage(cause, 'The merchant status could not be changed.'),
      );
    } finally {
      setChangingStatus(false);
    }
  }

  if (organizationStatus === 'loading' || (!merchant && !error))
    return (
      <ListSkeleton
        className="mx-auto mt-6 max-w-4xl"
        label="Loading merchant profile"
        rows={5}
      />
    );
  if (!organization || !['OWNER', 'MANAGER'].includes(organization.role))
    return (
      <p className="mx-auto mt-8 max-w-3xl" role="alert">
        Your organization role cannot view merchant profiles.
      </p>
    );
  if (!merchant)
    return (
      <section className="mx-auto mt-6 max-w-4xl">
        <BackLink href={`/app/organizations/${organizationId}/merchants`}>
          Back to merchants
        </BackLink>
        <RequestError
          className="mt-6"
          message={error ?? 'The merchant profile could not be loaded.'}
          onRetry={() => void load()}
        />
      </section>
    );

  return (
    <section className="mx-auto mt-6 w-full max-w-4xl">
      <BackLink href={`/app/organizations/${organizationId}/merchants`}>
        Back to merchants
      </BackLink>
      <header className="mt-5 flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <p className="text-xs font-bold tracking-wider text-emerald-700 uppercase">
            {merchant.code ?? 'Merchant profile'}
          </p>
          <h1 className="mt-1 text-3xl font-bold text-slate-950">
            {merchant.name}
          </h1>
          <div className="mt-3">
            <MerchantStatusBadge status={merchant.status} />
          </div>
        </div>
        <button
          className="min-h-11 cursor-pointer rounded-lg bg-emerald-600 px-4 font-bold text-white"
          onClick={() => {
            setEditing((current) => !current);
            setSuccess(null);
          }}
          type="button"
        >
          {editing ? 'Close editor' : 'Edit profile'}
        </button>
      </header>
      {success ? <StatusNotice>{success}</StatusNotice> : null}
      {error ? (
        <p
          className="mt-5 rounded-lg border border-red-600 p-3 text-sm text-red-700"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      {editing ? (
        <div className="mt-6 rounded-xl border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-bold">Edit profile</h2>
          <MerchantForm
            merchant={merchant}
            organizationId={organizationId}
            onCancel={() => setEditing(false)}
            onSaved={(saved) => {
              setMerchant(saved);
              setStatus(saved.status);
              setEditing(false);
              setSuccess(`${saved.name} was updated successfully.`);
            }}
          />
        </div>
      ) : (
        <section className="mt-6 rounded-xl border border-slate-200 bg-white p-6">
          <h2 className="font-bold">Business and contact information</h2>
          <dl className="mt-5 grid gap-5 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-bold text-slate-500 uppercase">
                Business name
              </dt>
              <dd className="mt-1">{merchant.name}</dd>
            </div>
            <div>
              <dt className="text-xs font-bold text-slate-500 uppercase">
                Code
              </dt>
              <dd className="mt-1">{merchant.code ?? 'Not set'}</dd>
            </div>
            <div>
              <dt className="text-xs font-bold text-slate-500 uppercase">
                Contact
              </dt>
              <dd className="mt-1">{merchant.contactName}</dd>
            </div>
            <div>
              <dt className="text-xs font-bold text-slate-500 uppercase">
                Phone
              </dt>
              <dd className="mt-1">{merchant.phone}</dd>
            </div>
            <div>
              <dt className="text-xs font-bold text-slate-500 uppercase">
                Email
              </dt>
              <dd className="mt-1">{merchant.email ?? 'Not set'}</dd>
            </div>
          </dl>
        </section>
      )}

      <section className="mt-6 rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="font-bold">Lifecycle status</h2>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          Status is changed separately from profile details and requires
          confirmation.
        </p>
        <div className="mt-4 flex max-w-md flex-wrap items-end gap-3">
          <label
            className="grid min-w-52 flex-1 gap-2 text-sm font-bold"
            htmlFor="merchant-lifecycle-status"
          >
            Status
            <SelectControl
              disabled={changingStatus}
              id="merchant-lifecycle-status"
              onValueChange={(value) => setStatus(value as MerchantStatus)}
              value={status}
            >
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
              <option value="SUSPENDED">Suspended</option>
              <option value="ENDED">Ended</option>
            </SelectControl>
          </label>
          <button
            className="min-h-11 cursor-pointer rounded-lg border border-slate-200 bg-white px-4 font-bold disabled:cursor-not-allowed disabled:opacity-50"
            disabled={changingStatus || status === merchant.status}
            onClick={() => void changeStatus()}
            type="button"
          >
            {changingStatus ? 'Changing…' : 'Change status'}
          </button>
        </div>
      </section>
      {confirmationDialog}
    </section>
  );
}
