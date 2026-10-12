'use client';
import { occupiedSpaceCount } from '@/features/spaces/api/space-api';
import { SpaceManagement } from '@/features/spaces/components/space-management';
import { MerchantBranchManagement } from '@/features/merchant-branches/components/merchant-branch-management';

import { useEffect, useRef, useState } from 'react';
import { buttonStyles } from '@/shared/components/ui/button';
import { ApiError } from '@/features/auth/api/auth-client';
import { useAuth } from '@/features/auth/model/auth-context';
import { useOrganizationWorkspaceContext } from '@/features/organizations/components/organization-workspace-context';
import { OrganizationPageFrame } from '@/features/organizations/components/organization-page-frame';
import { BackLink } from '@/shared/components/ui/back-link';
import { useConfirmationDialog } from '@/shared/components/ui/confirmation-dialog';
import { ListSkeleton } from '@/shared/components/ui/list-skeleton';
import {
  OperationalPanel,
  StatusNotice,
} from '@/shared/components/ui/operational-page';
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
  const [spaceRevision, setSpaceRevision] = useState(0);
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
      setChangingStatus(true);
      const occupied =
        status === 'ACTIVE'
          ? 0
          : await occupiedSpaceCount(request, organizationId, merchant.id);
      const accepted = await confirm({
        title: `Change ${merchant.name} to ${status.toLowerCase()}?`,
        description: `This changes the merchant lifecycle state and preserves history.${status !== 'ACTIVE' ? ` All ${occupied} occupied spaces across branches will be released.` : ' Previous space assignments will not be restored.'}`,
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
      setSpaceRevision((value) => value + 1);
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
      <OrganizationPageFrame>
        <ListSkeleton label="Loading merchant profile" rows={5} />
      </OrganizationPageFrame>
    );
  if (
    !organization ||
    !['OWNER', 'MANAGER', 'MERCHANT'].includes(organization.role)
  )
    return (
      <OrganizationPageFrame>
        <p role="alert">
          Your organization role cannot view merchant profiles.
        </p>
      </OrganizationPageFrame>
    );
  if (!merchant && !error)
    return (
      <OrganizationPageFrame>
        <ListSkeleton label="Loading merchant profile" rows={5} />
      </OrganizationPageFrame>
    );
  if (!merchant)
    return (
      <OrganizationPageFrame>
        <BackLink href={`/app/organizations/${organizationId}/merchants`}>
          Back to merchants
        </BackLink>
        <RequestError
          className="mt-6"
          message={error ?? 'The merchant profile could not be loaded.'}
          onRetry={() => void load()}
        />
      </OrganizationPageFrame>
    );

  return (
    <OrganizationPageFrame>
      <section className="w-full">
        <BackLink href={`/app/organizations/${organizationId}/merchants`}>
          Back to merchants
        </BackLink>
        <header className="mt-5 flex flex-wrap items-start justify-between gap-4 border-b border-hairline pb-5">
          <div className="min-w-0 break-words">
            <p className="text-xs font-bold tracking-wider text-ink uppercase">
              {merchant.code ?? 'Merchant profile'}
            </p>
            <h1 className="mt-1 text-3xl font-bold text-ink">
              {merchant.name}
            </h1>
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
          <OperationalPanel className="mt-5" title="Edit profile">
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
          </OperationalPanel>
        ) : (
          <OperationalPanel
            className="mt-5"
            title={
              organization.role === 'MANAGER'
                ? 'Business identity'
                : 'Business and contact information'
            }
          >
            <dl className="grid gap-5 break-words p-5 sm:grid-cols-2 sm:p-6 [&>div]:min-w-0">
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
          </OperationalPanel>
        )}

        {canEdit ? (
          <OperationalPanel className="mt-5" title="Lifecycle status">
            <p className="px-5 pt-5 text-sm leading-6 text-muted sm:px-6 sm:pt-6">
              Status is changed separately from profile details and requires
              confirmation.
            </p>
            <div className="flex max-w-md flex-wrap items-end gap-3 p-5 sm:p-6">
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
          </OperationalPanel>
        ) : null}
        <MerchantBranchManagement
          organizationId={organizationId}
          kind="merchant"
          id={merchantId}
          onChanged={() => setSpaceRevision((value) => value + 1)}
        />
        <SpaceManagement
          organizationId={organizationId}
          kind="merchant"
          id={merchantId}
          revision={spaceRevision}
        />
        {confirmationDialog}
      </section>
    </OrganizationPageFrame>
  );
}
