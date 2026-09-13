'use client';

import { useEffect, useRef, useState } from 'react';
import { buttonStyles } from '@/shared/components/ui/button';
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
import type { MerchantView, MerchantStatus } from '../model/merchant.types';
import { MerchantForm } from './merchant-form';
import { MerchantStatusBadge } from './merchant-status-badge';

function errorMessage(cause: unknown, fallback: string): string {
  return cause instanceof ApiError ? cause.message : fallback;
}

export function MerchantProfile(props: {
  organizationId: string;
  merchantId: string;
}) {
  const { organization } = useOrganizationWorkspaceContext();
  return (
    <ScopedMerchantProfile
      key={`${props.organizationId}:${props.merchantId}:${organization?.role}`}
      {...props}
    />
  );
}

function ScopedMerchantProfile({
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
  const canEdit = organization?.role === 'OWNER';
  const [merchant, setMerchant] = useState<MerchantView | null>(null);
  const [status, setStatus] = useState<MerchantStatus>('ACTIVE');
  const [editing, setEditing] = useState(false);
  const [changingStatus, setChangingStatus] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const load = () => setRevision((value) => value + 1);
  const statusLock = useRef(false);

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
        setMerchant(null);
        setError(null);
        return getMerchant(
          request,
          organizationId,
          merchantId,
          organization.role,
        );
      })
      .then((result) => {
        if (!active || !result) return;
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
  }, [merchantId, organizationId, organization, request, revision]);

  async function changeStatus() {
    if (
      !canEdit ||
      !merchant ||
      changingStatus ||
      statusLock.current ||
      status === merchant.status
    )
      return;
    statusLock.current = true;
    try {
      const accepted = await confirm({
        title: `Change ${merchant.name} to ${status.toLowerCase()}?`,
        description:
          'This changes the merchant lifecycle state but preserves the profile and its history.',
        confirmLabel: 'Change status',
        tone:
          status === 'ENDED' || status === 'SUSPENDED' ? 'danger' : 'primary',
      });
      if (!accepted) return;
      setChangingStatus(true);
      setError(null);
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
      statusLock.current = false;
      setChangingStatus(false);
    }
  }

  if (organizationStatus === 'loading')
    return (
      <ListSkeleton
        className="mx-auto mt-6 max-w-4xl"
        label="Loading merchant profile"
        rows={5}
      />
    );
  if (
    !organization ||
    !['OWNER', 'MANAGER', 'MERCHANT'].includes(organization.role)
  )
    return (
      <p className="mx-auto mt-8 max-w-3xl" role="alert">
        Your organization role cannot view merchant profiles.
      </p>
    );
  if (!merchant && !error)
    return (
      <ListSkeleton
        className="mt-6"
        label="Loading merchant profile"
        rows={5}
      />
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
    <section className="mx-auto mt-6 w-full max-w-5xl">
      <BackLink href={`/app/organizations/${organizationId}/merchants`}>
        Back to merchants
      </BackLink>
      <header className="mt-5 flex flex-wrap items-start justify-between gap-4 border-b border-hairline pb-5">
        <div className="min-w-0 break-words">
          <p className="text-xs font-bold tracking-wider text-ink uppercase">
            {merchant.code ?? 'Merchant profile'}
          </p>
          <h1 className="mt-1 text-3xl font-bold text-ink">{merchant.name}</h1>
          <div className="mt-3">
            <MerchantStatusBadge status={merchant.status} />
          </div>
        </div>
        {canEdit ? (
          <button
            className={buttonStyles({ variant: 'primary' })}
            onClick={() => {
              setEditing((current) => !current);
              setSuccess(null);
            }}
            type="button"
          >
            {editing ? 'Close editor' : 'Edit profile'}
          </button>
        ) : null}
      </header>
      {success ? <StatusNotice>{success}</StatusNotice> : null}
      {error ? (
        <p
          className="mt-5 rounded-lg border border-danger p-3 text-sm text-danger"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      {editing && canEdit && 'contactName' in merchant ? (
        <div className="mt-6 rounded-panel border border-hairline bg-surface p-6">
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
        <section className="mt-6 rounded-panel border border-hairline bg-surface p-6">
          <h2 className="font-bold">
            {organization.role === 'MANAGER'
              ? 'Business identity'
              : 'Business and contact information'}
          </h2>
          <dl className="mt-5 grid gap-5 break-words sm:grid-cols-2 [&>div]:min-w-0">
            <div>
              <dt className="text-xs font-bold text-muted uppercase">
                Business name
              </dt>
              <dd className="mt-1">{merchant.name}</dd>
            </div>
            <div>
              <dt className="text-xs font-bold text-muted uppercase">Code</dt>
              <dd className="mt-1">{merchant.code ?? 'Not set'}</dd>
            </div>
            {organization.role !== 'MANAGER' && 'contactName' in merchant ? (
              <>
                <div>
                  <dt className="text-xs font-bold text-muted uppercase">
                    Contact
                  </dt>
                  <dd className="mt-1">{merchant.contactName}</dd>
                </div>
                <div>
                  <dt className="text-xs font-bold text-muted uppercase">
                    Phone
                  </dt>
                  <dd className="mt-1">{merchant.phone}</dd>
                </div>
                <div>
                  <dt className="text-xs font-bold text-muted uppercase">
                    Email
                  </dt>
                  <dd className="mt-1">{merchant.email ?? 'Not set'}</dd>
                </div>
              </>
            ) : null}
          </dl>
        </section>
      )}

      {canEdit ? (
        <section className="mt-6 rounded-panel border border-hairline bg-surface p-6">
          <h2 className="font-bold">Lifecycle status</h2>
          <p className="mt-2 text-sm leading-6 text-muted">
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
              className={buttonStyles({ variant: 'secondary' })}
              disabled={changingStatus || status === merchant.status}
              aria-busy={changingStatus}
              onClick={() => void changeStatus()}
              type="button"
            >
              {changingStatus ? 'Changing…' : 'Change status'}
            </button>
          </div>
        </section>
      ) : null}
      {confirmationDialog}
    </section>
  );
}
