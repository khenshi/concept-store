'use client';

import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/features/auth/model/auth-context';
import { FormDialog } from '@/shared/components/ui/form-dialog';
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
import type {
  AccessBranch,
  AccessMerchant,
} from '../model/member-access.schemas';

export function MemberAccessDialog({
  organizationId,
  member,
  changeToMerchant = false,
  onClose,
  onMemberChanged,
}: {
  organizationId: string;
  member: OrganizationMember;
  changeToMerchant?: boolean;
  onClose(): void;
  onMemberChanged(member: OrganizationMember): void;
}) {
  const { request } = useAuth();
  const [options, setOptions] = useState<{
    branches: AccessBranch[];
    merchants: AccessMerchant[];
  } | null>(null);
  const [assigned, setAssigned] = useState<string[]>([]);
  const [merchantId, setMerchantId] = useState(member.merchantId ?? '');
  const [pending, setPending] = useState(false);
  const lock = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const [confirmation, setConfirmation] = useState<{
    label: string;
    action(): Promise<void>;
  } | null>(null);
  const safeFocus = useRef<HTMLButtonElement>(null);
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
  const updateMerchant = async () => {
    if (changeToMerchant) {
      const updated = await updateOrganizationMemberRole(
        request,
        organizationId,
        member.id,
        'MERCHANT',
        merchantId,
      );
      onMemberChanged(updated);
      onClose();
    } else {
      const updated = await setMemberMerchant(
        request,
        organizationId,
        member.id,
        merchantId,
      );
      onMemberChanged({ ...member, merchantId: updated.merchantId });
    }
  };
  return (
    <FormDialog
      title={
        changeToMerchant
          ? 'Change role to Merchant'
          : `Access for ${member.email}`
      }
      description="Owners manage branch access and the merchant profile this account represents."
      pending={pending}
      onClose={onClose}
    >
      {error && (
        <p role="alert" className="mt-4 text-sm text-danger">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="mt-4 text-sm text-muted">
          {notice}
        </p>
      )}
      {!options ? (
        <div className="mt-4">
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
            {changeToMerchant
              ? ' Existing branch assignments will be cleared.'
              : ''}
          </p>
          <div className="flex flex-wrap justify-end gap-3">
            <button
              ref={safeFocus}
              type="button"
              disabled={pending}
              className={buttonStyles({ variant: 'secondary' })}
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
          </div>
        </section>
      ) : (
        <div className="mt-5 grid gap-6">
          {member.role === 'OWNER' ? (
            <p>Owners have access to all current and future branches.</p>
          ) : (
            !changeToMerchant && (
              <section>
                <h3 className="text-base font-semibold">Branch assignments</h3>
                <p className="mt-2 text-sm text-muted">
                  Changes save individually. Merchants also see their own stock
                  wherever their products are placed.
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
                      setAssigned((ids) =>
                        granted
                          ? ids.filter((id) => id !== branch.id)
                          : [...ids, branch.id],
                      );
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
            )
          )}
          {(member.role === 'MERCHANT' || changeToMerchant) && (
            <section className="grid gap-3">
              <label
                htmlFor="member-merchant"
                className="text-sm font-semibold"
              >
                Merchant profile
              </label>
              <SelectControl
                id="member-merchant"
                value={merchantId}
                disabled={pending}
                onValueChange={setMerchantId}
              >
                <option value="">Choose a merchant</option>
                {options.merchants.map((merchant) => (
                  <option key={merchant.id} value={merchant.id}>
                    {merchant.name} · {merchant.status}
                  </option>
                ))}
              </SelectControl>
              <div className="flex justify-end">
                <button
                  type="button"
                  disabled={
                    pending ||
                    !merchantId ||
                    (!changeToMerchant && merchantId === member.merchantId)
                  }
                  className={buttonStyles({ variant: 'primary' })}
                  onClick={() =>
                    setConfirmation({
                      label: changeToMerchant
                        ? 'Change role and clear branch assignments?'
                        : 'Change the represented merchant?',
                      action: updateMerchant,
                    })
                  }
                >
                  {changeToMerchant
                    ? 'Review role change'
                    : 'Review merchant link'}
                </button>
              </div>
            </section>
          )}
        </div>
      )}
      <div className="mt-6 flex justify-end">
        <button
          type="button"
          disabled={pending}
          className={buttonStyles({ variant: 'secondary' })}
          onClick={onClose}
        >
          Done
        </button>
      </div>
    </FormDialog>
  );
}
