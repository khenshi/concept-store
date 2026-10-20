'use client';

import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/features/auth/model/auth-context';
import { FormDialog } from '@/shared/components/ui/form-dialog';
import { ModalActionRow } from '@/shared/components/ui/modal-action-row';
import { SelectControl } from '@/shared/components/ui/select-control';
import { buttonStyles } from '@/shared/components/ui/button';
import {
  listMemberBranches,
  loadMemberAccessOptions,
  setMemberBranch,
  setMemberMerchant,
  updateOrganizationMemberRole,
} from '../api/organization-member-api';
import type { OrganizationMember } from '../model/organization-member.types';
import type { OrganizationRole } from '@/features/organizations/model/organization.types';
import type {
  AccessBranch,
  AccessMerchant,
} from '../model/member-access.schemas';

const roles: OrganizationRole[] = ['OWNER', 'MANAGER', 'CASHIER', 'MERCHANT'];

const roleLabels: Record<OrganizationRole, string> = {
  OWNER: 'Owner',
  MANAGER: 'Manager',
  CASHIER: 'Cashier',
  MERCHANT: 'Merchant',
};

export function MemberAccessDialog({
  organizationId,
  member,
  onClose,
  onMemberChanged,
}: {
  organizationId: string;
  member: OrganizationMember;
  onClose(): void;
  onMemberChanged(member: OrganizationMember): void;
}) {
  const { request } = useAuth();
  const [options, setOptions] = useState<{
    branches: AccessBranch[];
    merchants: AccessMerchant[];
  } | null>(null);
  const [assigned, setAssigned] = useState<string[]>([]);
  const [role, setRole] = useState<OrganizationRole>(member.role);
  const [merchantId, setMerchantId] = useState(member.merchantId ?? '');
  const [pending, setPending] = useState(false);
  const lock = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const [confirmation, setConfirmation] = useState<{
    label: string;
    action(): Promise<void>;
    clearsScopedAccess?: boolean;
  } | null>(null);
  const safeFocus = useRef<HTMLButtonElement>(null);
  const roleChanged = role !== member.role;
  const isStaffRole = role === 'MANAGER' || role === 'CASHIER';

  useEffect(() => {
    if (confirmation) safeFocus.current?.focus();
  }, [confirmation]);

  useEffect(() => {
    let active = true;
    void Promise.all([
      loadMemberAccessOptions(request, organizationId),
      listMemberBranches(request, organizationId, member.id),
    ])
      .then(([choices, branches]) => {
        if (active) {
          setOptions(choices);
          setAssigned(branches.map(({ id }) => id));
          setError(null);
        }
      })
      .catch(() => {
        if (active) setError('Access settings could not be loaded. Try again.');
      });
    return () => {
      active = false;
    };
  }, [request, organizationId, member.id, revision]);

  async function write(action: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true;
    setPending(true);
    setError(null);
    setNotice(null);
    try {
      await action();
      setConfirmation(null);
      setNotice('Access updated.');
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Access could not be updated. Try again.',
      );
    } finally {
      lock.current = false;
      setPending(false);
    }
  }

  const updateRole = async () => {
    const updated = await updateOrganizationMemberRole(
      request,
      organizationId,
      member.id,
      role,
      role === 'MERCHANT' ? merchantId : undefined,
    );
    onMemberChanged(updated);
    onClose();
  };

  const updateMerchant = async () => {
    const updated = await setMemberMerchant(
      request,
      organizationId,
      member.id,
      merchantId,
    );
    onMemberChanged({ ...member, merchantId: updated.merchantId });
  };

  return (
    <FormDialog
      title={`Edit access for ${member.email}`}
      description="Change this account's role, branch access, or merchant profile."
      pending={pending}
      onClose={onClose}
    >
      {notice && (
        <p role="status" className="mt-4 text-sm text-muted">
          {notice}
        </p>
      )}
      {!options ? (
        <div className="mt-4">
          {error && (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          )}
          <p role="status">Loading access settings…</p>
          {error && (
            <button
              type="button"
              className={buttonStyles({ variant: 'secondary' })}
              onClick={() => setRevision((value) => value + 1)}
            >
              Try again
            </button>
          )}
        </div>
      ) : confirmation ? (
        <section className="mt-5 grid gap-4" aria-label="Confirm access change">
          <h3>{confirmation.label}</h3>
          <p className="text-sm text-muted">
            This changes future access, not products, stock, or historical
            attribution.
            {confirmation.clearsScopedAccess
              ? ' Existing branch assignments and merchant links will be cleared.'
              : ''}
          </p>
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
              ref={safeFocus}
              type="button"
              disabled={pending}
              className={buttonStyles({ variant: 'quiet' })}
              onClick={() => {
                setConfirmation(null);
                setError(null);
              }}
            >
              Keep current access
            </button>
            <button
              type="button"
              disabled={pending}
              className={buttonStyles({ variant: 'danger' })}
              onClick={() => void write(confirmation.action)}
            >
              {pending ? 'Updating…' : 'Confirm change'}
            </button>
          </ModalActionRow>
        </section>
      ) : (
        <div className="mt-5 grid gap-6">
          <section className="grid gap-3">
            <label htmlFor="member-role" className="text-sm font-semibold">
              Organization role
            </label>
            <SelectControl
              id="member-role"
              value={role}
              disabled={pending}
              onValueChange={(value) => {
                setRole(value as OrganizationRole);
                setError(null);
              }}
            >
              {roles.map((candidate) => (
                <option key={candidate} value={candidate}>
                  {roleLabels[candidate]}
                </option>
              ))}
            </SelectControl>
            {roleChanged ? (
              <>
                <p className="text-sm text-muted">
                  Changing the role clears current branch assignments and
                  merchant links. Save the role change before editing its new
                  access settings.
                </p>
                {role === 'MERCHANT' ? (
                  <MerchantProfileField
                    merchants={options.merchants}
                    merchantId={merchantId}
                    pending={pending}
                    onChange={setMerchantId}
                  />
                ) : null}
                {role === 'OWNER' ? (
                  <p className="text-sm text-muted">
                    Owners have access to all current and future branches.
                  </p>
                ) : null}
                <div className="flex justify-end">
                  <button
                    type="button"
                    disabled={pending || (role === 'MERCHANT' && !merchantId)}
                    className={buttonStyles({ variant: 'primary' })}
                    onClick={() =>
                      setConfirmation({
                        label: `Change role to ${roleLabels[role]}?`,
                        action: updateRole,
                        clearsScopedAccess: true,
                      })
                    }
                  >
                    Review role change
                  </button>
                </div>
              </>
            ) : null}
          </section>

          {!roleChanged && member.role === 'OWNER' ? (
            <p>Owners have access to all current and future branches.</p>
          ) : null}

          {!roleChanged && isStaffRole ? (
            <section>
              <h3 className="text-base font-semibold">Branch assignments</h3>
              <p className="mt-2 text-sm text-muted">
                Changes save individually. Staff access is limited to assigned
                branches.
              </p>
              <ul className="mt-3 max-h-72 list-none divide-y divide-hairline overflow-y-auto p-0">
                {options.branches.map((branch) => {
                  const granted = assigned.includes(branch.id);
                  const action = async () => {
                    await setMemberBranch(
                      request,
                      organizationId,
                      member.id,
                      branch.id,
                      !granted,
                    );
                    const nextAssigned = granted
                      ? assigned.filter((id) => id !== branch.id)
                      : [...assigned, branch.id];
                    setAssigned(nextAssigned);
                    onMemberChanged({
                      ...member,
                      branchAccessCount: nextAssigned.length,
                    });
                  };
                  return (
                    <li
                      key={branch.id}
                      className="flex min-w-0 flex-wrap items-center justify-between gap-3 py-3"
                    >
                      <span className="min-w-0 break-words">
                        {branch.name} {branch.code ? `· ${branch.code}` : ''}
                      </span>
                      <button
                        type="button"
                        disabled={pending}
                        className={buttonStyles({ variant: 'secondary' })}
                        aria-label={`${granted ? 'Revoke' : 'Grant'} ${branch.name}`}
                        onClick={() =>
                          granted
                            ? setConfirmation({
                                label: `Revoke ${branch.name}?`,
                                action,
                              })
                            : void write(action)
                        }
                      >
                        {granted ? 'Revoke' : 'Grant'}
                      </button>
                    </li>
                  );
                })}
              </ul>
              {options.branches.length === 0 && (
                <p className="mt-3 text-sm text-muted">
                  No branches available.
                </p>
              )}
            </section>
          ) : null}

          {!roleChanged && member.role === 'MERCHANT' ? (
            <>
              <p className="text-sm text-muted">
                This user inherits all branches associated with their merchant
                profile. Manage participation on the merchant profile.
              </p>
              <section className="grid gap-3">
                <MerchantProfileField
                  merchants={options.merchants}
                  merchantId={merchantId}
                  pending={pending}
                  onChange={setMerchantId}
                />
                <div className="flex justify-end">
                  <button
                    type="button"
                    disabled={
                      pending || !merchantId || merchantId === member.merchantId
                    }
                    className={buttonStyles({ variant: 'primary' })}
                    onClick={() =>
                      setConfirmation({
                        label: 'Change the represented merchant?',
                        action: updateMerchant,
                      })
                    }
                  >
                    Review merchant link
                  </button>
                </div>
              </section>
            </>
          ) : null}
        </div>
      )}
      <ModalActionRow
        className="mt-6"
        feedback={
          options && !confirmation && error ? (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          ) : null
        }
      >
        <button
          type="button"
          disabled={pending}
          className={buttonStyles({ variant: 'quiet' })}
          onClick={onClose}
        >
          Done
        </button>
      </ModalActionRow>
    </FormDialog>
  );
}

function MerchantProfileField({
  merchants,
  merchantId,
  pending,
  onChange,
}: {
  merchants: AccessMerchant[];
  merchantId: string;
  pending: boolean;
  onChange(value: string): void;
}) {
  return (
    <div className="grid gap-3">
      <label htmlFor="member-merchant" className="text-sm font-semibold">
        Merchant profile
      </label>
      <SelectControl
        id="member-merchant"
        value={merchantId}
        disabled={pending}
        onValueChange={onChange}
      >
        <option value="">Choose a merchant</option>
        {merchants.map((merchant) => (
          <option key={merchant.id} value={merchant.id}>
            {merchant.name} · {merchant.status}
          </option>
        ))}
      </SelectControl>
    </div>
  );
}
